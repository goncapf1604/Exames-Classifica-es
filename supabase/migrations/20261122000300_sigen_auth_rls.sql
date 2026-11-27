-- =====================================================================
-- SIGEN · Autenticação (Supabase Auth) e acesso por escola/perfil
--
-- Substitui o "modo demonstração" (anon com acesso total) por:
--   * contas reais em auth.users, ligadas a utilizadores.auth_user_id (pelo email);
--   * palavra-passe inicial obrigatoriamente alterada no 1.º acesso
--     (app_metadata.trocar_password, limpo automaticamente ao mudar a password);
--   * MFA TOTP do Supabase: perfis com mfa_ativo só acedem com sessão aal2;
--   * conta Suspensa ou fora da vigência não vê nada;
--   * cada utilizador só vê as escolas em escola_ids (Admin central: todas);
--   * EE / aluno maior só vê os registos dos seus educandos (e resultados publicados);
--   * auditoria só de acrescentar; identidade do autor definida pelo servidor.
-- O papel "anon" deixa de ter acesso a qualquer tabela.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Ligação utilizadores <-> auth.users
-- ---------------------------------------------------------------------
alter table utilizadores
  add column auth_user_id uuid unique references auth.users(id) on delete set null,
  add column aluno_refs text[] not null default '{}';
comment on column utilizadores.aluno_refs is
  'EE/aluno maior: números de processo dos educandos (além dos ligados pelos encarregados de educação no SIGEN Exames).';

alter table utilizadores drop column password_demo;
alter table utilizadores drop column mfa_codigo_demo;

create or replace function private.ligar_auth_utilizador()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.auth_user_id is null or (tg_op = 'UPDATE' and new.email is distinct from old.email) then
    new.auth_user_id := (select id from auth.users where lower(email) = lower(new.email) limit 1);
  end if;
  return new;
end;
$$;
create trigger utilizadores_ligar_auth
  before insert or update of email on utilizadores
  for each row execute function private.ligar_auth_utilizador();

create or replace function private.ligar_novo_auth()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  update public.utilizadores set auth_user_id = new.id
   where lower(email) = lower(new.email) and auth_user_id is null;
  return new;
end;
$$;
create trigger sigen_ligar_utilizador
  after insert on auth.users
  for each row execute function private.ligar_novo_auth();

-- A palavra-passe inicial deixa de ser exigida assim que é alterada
create or replace function private.limpar_trocar_password()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(old.raw_app_meta_data->>'trocar_password', 'false') = 'true'
     and coalesce(new.raw_app_meta_data->>'trocar_password', 'false') = 'true' then
    new.raw_app_meta_data := new.raw_app_meta_data - 'trocar_password';
  end if;
  return new;
end;
$$;
create trigger sigen_limpar_trocar_password
  before update of encrypted_password on auth.users
  for each row execute function private.limpar_trocar_password();

-- ---------------------------------------------------------------------
-- Funções auxiliares das políticas
-- ---------------------------------------------------------------------
create or replace function private.eu()
returns utilizadores language sql stable security definer set search_path = public as $$
  select u.* from utilizadores u
   where u.auth_user_id = auth.uid()
     and u.estado = 'Ativo'
     and (u.vigencia_inicio is null or u.vigencia_inicio <= current_date)
     and (u.vigencia_fim is null or u.vigencia_fim >= current_date)
   limit 1
$$;

-- Sessão completa: conta ativa, MFA cumprido (aal2) quando exigido e password inicial já trocada
create or replace function private.ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select (not e.mfa_ativo or coalesce(auth.jwt()->>'aal', '') = 'aal2')
       and coalesce(auth.jwt()->'app_metadata'->>'trocar_password', 'false') <> 'true'
      from private.eu() e where e.id is not null), false)
$$;

create or replace function private.perfil()
returns text language sql stable security definer set search_path = public as $$
  select case when private.ativo() then (select perfil from private.eu()) end
$$;

create or replace function private.escolas()
returns text[] language sql stable security definer set search_path = public as $$
  select case
    when not private.ativo() then '{}'::text[]
    when private.perfil() = 'ADMIN_CENTRAL' then (select coalesce(array_agg(id), '{}') from instituicoes)
    else (select coalesce(array_agg(distinct x), '{}') from (
            select unnest(e.escola_ids) x from private.eu() e
            union
            select i.agrupamento_mae_id from instituicoes i, private.eu() e
             where i.id = any(e.escola_ids) and i.agrupamento_mae_id is not null) s)
  end
$$;

create or replace function private.staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.perfil() <> 'EE_ALUNO', false)
$$;

create or replace function private.pode_escrever()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.perfil() not in ('EE_ALUNO', 'AUDITOR_EPD'), false)
$$;

create or replace function private.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO'), false)
$$;

-- Educandos de um EE: pelos encarregados de educação (SIGEN Exames) e por aluno_refs
create or replace function private.ee_alunos()
returns table (id text, ref text, nome text)
language sql stable security definer set search_path = public as $$
  with e as (select * from private.eu() where perfil = 'EE_ALUNO' and private.ativo()),
  ids as (
    select jsonb_array_elements_text(g.dados->'alunoIds') aid
      from registos g, e
     where g.app = 'exames' and g.colecao = 'guardians' and lower(g.dados->>'email') = lower(e.email)
  )
  select a.id, a.identificador_interno, a.nome_completo from alunos a
   where a.id in (select aid from ids)
      or a.identificador_interno in (select unnest(e.aluno_refs) from e)
  union
  select null, r, null from e, unnest(e.aluno_refs) r
$$;

create or replace function private.registo_do_ee(d jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from private.ee_alunos() a
     where d->>'alunoId' = a.id
        or d->>'alunoRef' = a.ref
        or d->>'alunoNome' = a.nome
        or d->>'requerente' = a.nome
        or (d ? 'alunoIds' and d->'alunoIds' ? a.id))
  or lower(d->>'email') = lower((select email from private.eu()))
$$;

-- Que coleções o EE pode ver / alterar (sempre só dos seus educandos)
create or replace function private.registo_visivel_ee(p_app sigen_app, p_colecao text, d jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_colecao = 'calendars' then true
    when p_app = 'classificacoes' and p_colecao = 'publications' then true
    when p_app = 'classificacoes' and p_colecao = 'results' then d->>'estado' = 'Publicado' and private.registo_do_ee(d)
    when (p_app = 'exames' and p_colecao in ('enrollments', 'enesRequests', 'guardians'))
      or (p_app = 'classificacoes' and p_colecao in ('consultations', 'availabilities', 'scoreRectifications',
                                                      'reappraisals', 'jneComplaints'))
      then private.registo_do_ee(d)
    else false
  end
$$;

create or replace function private.registo_editavel_ee(p_app sigen_app, p_colecao text, d jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select ((p_app = 'exames' and p_colecao in ('enrollments', 'enesRequests'))
       or (p_app = 'classificacoes' and p_colecao in ('consultations', 'reappraisals', 'jneComplaints', 'scoreRectifications')))
     and private.registo_do_ee(d)
$$;

grant execute on all functions in schema private to authenticated;
revoke execute on function private.ligar_auth_utilizador(), private.ligar_novo_auth(),
  private.limpar_trocar_password() from authenticated;

-- ---------------------------------------------------------------------
-- Políticas (remove o acesso total de demonstração)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['instituicoes','utilizadores','notificacoes','auditoria',
                           'incidentes_privacidade','alunos','provas','registos']
  loop
    execute format('drop policy if exists %I on %I', t || '_demo_all', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;
revoke all on v_inscricoes, v_presencas, v_resultados from anon;

-- instituicoes
create policy instituicoes_ler on instituicoes for select to authenticated
  using (id = any(private.escolas()));
create policy instituicoes_admin on instituicoes for all to authenticated
  using (private.perfil() = 'ADMIN_CENTRAL') with check (private.perfil() = 'ADMIN_CENTRAL');

-- utilizadores: o próprio (mesmo antes do MFA, para a app saber o que pedir) e administradores
create policy utilizadores_proprio on utilizadores for select to authenticated
  using (auth_user_id = auth.uid());
create policy utilizadores_admin_ler on utilizadores for select to authenticated
  using (private.e_admin() and escola_ids && private.escolas());
create policy utilizadores_proprio_atualizar on utilizadores for update to authenticated
  using (private.ativo() and auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy utilizadores_admin_escrever on utilizadores for insert to authenticated
  with check (private.e_admin() and escola_ids <@ private.escolas());
create policy utilizadores_admin_atualizar on utilizadores for update to authenticated
  using (private.e_admin() and escola_ids && private.escolas())
  with check (private.e_admin() and escola_ids <@ private.escolas());
create policy utilizadores_admin_apagar on utilizadores for delete to authenticated
  using (private.perfil() = 'ADMIN_CENTRAL');

-- Quem não é administrador só pode alterar o seu último acesso;
-- Admin de agrupamento não pode criar Admins centrais.
create or replace function private.proteger_utilizador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role / gatilhos
  if not private.e_admin() then
    if (new.nome, new.email, new.perfil, new.escola_ids, new.vigencia_inicio, new.vigencia_fim,
        new.mfa_ativo, new.estado, new.aluno_refs, new.auth_user_id)
       is distinct from
       (old.nome, old.email, old.perfil, old.escola_ids, old.vigencia_inicio, old.vigencia_fim,
        old.mfa_ativo, old.estado, old.aluno_refs, old.auth_user_id) then
      raise exception 'Sem permissão para alterar dados da conta' using errcode = '42501';
    end if;
  elsif private.perfil() = 'ADMIN_AGRUPAMENTO' and new.perfil = 'ADMIN_CENTRAL'
        and (tg_op = 'INSERT' or old.perfil <> 'ADMIN_CENTRAL') then
    raise exception 'Só o Administrador central pode atribuir esse perfil' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger utilizadores_proteger
  before insert or update on utilizadores
  for each row execute function private.proteger_utilizador();

-- notificacoes
create policy notificacoes_ler on notificacoes for select to authenticated
  using (
    (private.staff() and instituicao_id = any(private.escolas()))
    or (private.perfil() = 'EE_ALUNO'
        and position(lower((select email from private.eu())) in lower(destinatario)) > 0));
create policy notificacoes_escrever on notificacoes for all to authenticated
  using (private.pode_escrever() and instituicao_id = any(private.escolas()))
  with check (private.pode_escrever() and instituicao_id = any(private.escolas()));

-- auditoria: só acrescentar; leitura pelos perfis de supervisão (ou entradas próprias)
create policy auditoria_inserir on auditoria for insert to authenticated
  with check (private.ativo() and (instituicao_id is null or instituicao_id = any(private.escolas())));
create policy auditoria_ler on auditoria for select to authenticated
  using (
    (private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO', 'DIRECAO', 'AUDITOR_EPD')
       and (instituicao_id is null or instituicao_id = any(private.escolas())))
    or (private.ativo() and lower(utilizador_email) = lower((select email from private.eu()))));

create or replace function private.carimbar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare e utilizadores;
begin
  if auth.uid() is null then return new; end if;
  select * into e from private.eu();
  new.utilizador_email := e.email;
  new.utilizador_nome  := e.nome;
  new.perfil           := e.perfil;
  new.data_hora        := now();
  return new;
end;
$$;
create trigger auditoria_carimbar
  before insert on auditoria
  for each row execute function private.carimbar_auditoria();

-- Tentativas de login falhadas (antes de haver sessão)
create or replace function public.sigen_registar_falha_login(p_email text, p_app sigen_app)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from auditoria
       where acao = 'LOGIN_FALHADO' and utilizador_email = lower(left(p_email, 200))
         and data_hora > now() - interval '10 minutes') >= 20 then
    return;
  end if;
  insert into auditoria (id, utilizador_email, utilizador_nome, entidade, ecra, acao, detalhe, sensivel, app_origem)
  values ('aud-fail-' || gen_random_uuid(), lower(left(p_email, 200)), 'Não autenticado',
          'Autenticação (C01)', 'C01', 'LOGIN_FALHADO', 'Credenciais inválidas ou acesso não autorizado.', true, p_app);
end;
$$;
revoke execute on function public.sigen_registar_falha_login(text, sigen_app) from public;
grant execute on function public.sigen_registar_falha_login(text, sigen_app) to anon, authenticated;

-- incidentes de privacidade
create policy incidentes_acesso on incidentes_privacidade for all to authenticated
  using (private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO', 'DIRECAO', 'AUDITOR_EPD')
         and instituicao_id = any(private.escolas()))
  with check (private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO', 'DIRECAO', 'AUDITOR_EPD')
              and instituicao_id = any(private.escolas()));

-- alunos
create policy alunos_ler on alunos for select to authenticated
  using ((private.staff() and instituicao_id = any(private.escolas()))
         or (private.perfil() = 'EE_ALUNO' and id in (select id from private.ee_alunos())));
create policy alunos_escrever on alunos for all to authenticated
  using (private.pode_escrever() and instituicao_id = any(private.escolas()))
  with check (private.pode_escrever() and instituicao_id = any(private.escolas()));

-- provas (catálogo nacional)
create policy provas_ler on provas for select to authenticated using (private.ativo());
create policy provas_escrever on provas for all to authenticated
  using (private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO', 'DIRECAO', 'COORDENACAO'))
  with check (private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO', 'DIRECAO', 'COORDENACAO'));

-- registos
create policy registos_ler on registos for select to authenticated
  using (
    (private.staff()
       and (instituicao_id = any(private.escolas()) or instituicao_id is null)
       -- correspondência código anónimo <-> aluno: só Direção e Admin central (K03)
       and (colecao <> 'anonymousMappings' or private.perfil() in ('ADMIN_CENTRAL', 'DIRECAO')))
    or (private.perfil() = 'EE_ALUNO'
        and (instituicao_id is null or instituicao_id = any(private.escolas()))
        and private.registo_visivel_ee(app, colecao, dados)));
create policy registos_escrever on registos for all to authenticated
  using (
    (private.pode_escrever()
       and (instituicao_id = any(private.escolas())
            or (instituicao_id is null and private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO', 'DIRECAO')))
       and (colecao <> 'anonymousMappings' or private.perfil() in ('ADMIN_CENTRAL', 'DIRECAO')))
    or (private.perfil() = 'EE_ALUNO' and instituicao_id = any(private.escolas())
        and private.registo_editavel_ee(app, colecao, dados)))
  with check (
    (private.pode_escrever()
       and (instituicao_id = any(private.escolas())
            or (instituicao_id is null and private.perfil() in ('ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO', 'DIRECAO')))
       and (colecao <> 'anonymousMappings' or private.perfil() in ('ADMIN_CENTRAL', 'DIRECAO')))
    or (private.perfil() = 'EE_ALUNO' and instituicao_id = any(private.escolas())
        and private.registo_editavel_ee(app, colecao, dados)));
