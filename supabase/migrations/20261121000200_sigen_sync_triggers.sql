-- =====================================================================
-- SIGEN · Sincronização entre apps (executada na base de dados)
--
-- Os dados comuns (instituições, utilizadores, notificações, auditoria,
-- incidentes) já são partilhados por estarem nas mesmas tabelas. Estes
-- gatilhos tratam o que tem de PASSAR de uma app para a outra:
--
--  A) Exames -> Classificações : presenças de uma sessão FECHADA
--       Presente / Atraso tolerado -> lote de provas recebido + código anónimo
--       Falta                     -> resultado "Faltou" (pendente de validação)
--  B) Exames -> Classificações : catálogo de provas (datas) -> calendário (datasExame)
--  C) Exames -> Classificações : calendário de inscrições -> prazos/estado do calendário
--  D) Classificações -> Exames : resultado "Publicado" -> notificação ao EE/aluno
--
-- Registos criados aqui têm origem_sync preenchido e id com prefixo "sync-".
-- As apps recebem-nos em tempo real (Supabase Realtime).
-- =====================================================================

create or replace function sigen_now_iso() returns text language sql stable set search_path = public as $$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- ---------------------------------------------------------------------
-- A) Presenças -> lotes, anonimização e faltas
-- ---------------------------------------------------------------------
create or replace function sigen_sync_presenca()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d          jsonb := new.dados;
  v_prova    provas%rowtype;
  v_aluno    alunos%rowtype;
  v_inst     text := coalesce(new.instituicao_id, new.dados->>'escolaId');
  v_cod_esc  text;
  v_lot_id   text;
  v_lot_cod  text;
  v_presentes int;
  v_seq      int;
  v_presente boolean := (new.dados->>'presenca') in ('Presente', 'Atraso tolerado');
  v_ts       text := sigen_now_iso();
begin
  if new.app <> 'exames' or new.colecao <> 'attendance' then return new; end if;
  if coalesce((d->>'sessaoFechada')::boolean, false) is not true then return new; end if;
  if d->>'presenca' not in ('Presente', 'Atraso tolerado', 'Falta') then return new; end if;

  select * into v_prova from provas where id = d->>'sessaoId';
  if not found then return new; end if;
  select * into v_aluno from alunos where id = d->>'alunoId';
  if not found then return new; end if;
  select codigo_escola into v_cod_esc from instituicoes where id = v_inst;

  v_lot_id  := 'sync-lot-' || v_inst || '-' || v_prova.id;
  v_lot_cod := 'LT-' || split_part(v_prova.ano_letivo, '/', 2) || '-' || v_prova.codigo || '-' || coalesce(v_cod_esc, v_inst);

  if v_presente then
    -- deixou de ser falta: remove o resultado "Faltou" gerado automaticamente
    delete from registos where app = 'classificacoes' and colecao = 'results'
       and id = 'sync-res-' || new.id and dados->>'estado' = 'Pendente';

    if not exists (select 1 from registos where app = 'classificacoes'
                    and colecao = 'anonymousMappings' and id = 'sync-an-' || new.id) then
      select count(*) + 1 into v_seq from registos
       where app = 'classificacoes' and colecao = 'anonymousMappings'
         and instituicao_id = v_inst and dados->>'provaCodigo' = v_prova.codigo;
      insert into registos (app, colecao, id, instituicao_id, origem_sync, dados) values (
        'classificacoes', 'anonymousMappings', 'sync-an-' || new.id, v_inst, 'exames:attendance:' || new.id,
        jsonb_build_object(
          'id', 'sync-an-' || new.id,
          'institutionId', v_inst,
          'codigoAnonimo', 'ANON-' || v_prova.codigo || '-S' || lpad(v_seq::text, 3, '0'),
          'provaCodigo', v_prova.codigo,
          'provaNome', v_prova.designacao,
          'loteCodigo', v_lot_cod,
          'referenciaIdentidade', 'KEY-' || coalesce(v_cod_esc, 'SIGEN') || '-' || upper(substr(md5(new.id), 1, 6)),
          'nomeAlunoReal', v_aluno.nome_completo || ' (Proc. ' || v_aluno.identificador_interno || ')',
          'estadoAnonimizacao', 'Gerado',
          'revelacoes', '[]'::jsonb))
      on conflict do nothing;
    end if;
  else
    delete from registos where app = 'classificacoes' and colecao = 'anonymousMappings'
       and id = 'sync-an-' || new.id and dados->>'estadoAnonimizacao' = 'Gerado';

    insert into registos (app, colecao, id, instituicao_id, origem_sync, dados) values (
      'classificacoes', 'results', 'sync-res-' || new.id, v_inst, 'exames:attendance:' || new.id,
      jsonb_build_object(
        'id', 'sync-res-' || new.id,
        'institutionId', v_inst,
        'alunoRef', v_aluno.identificador_interno,
        'alunoNome', v_aluno.nome_completo,
        'codigoAnonimo', '—',
        'provaCodigo', v_prova.codigo,
        'provaNome', v_prova.designacao,
        'anoLetivo', v_prova.ano_letivo,
        'fase', v_prova.fase,
        'resultado', 'Faltou',
        'origem', 'SIGEN Exames (presenças)',
        'estado', 'Pendente',
        'justificacao', 'Falta registada no controlo de presenças do dia da prova.',
        'historico', jsonb_build_array(jsonb_build_object(
            'dataHora', v_ts, 'acao', 'Falta sincronizada do SIGEN Exames (E19)',
            'autor', 'Sincronização SIGEN', 'valorNovo', 'Faltou'))))
    on conflict do nothing;
  end if;

  -- Lote de provas realizadas (1 por escola e prova); quantidade = presentes
  select count(*) into v_presentes from registos
   where app = 'exames' and colecao = 'attendance'
     and coalesce(instituicao_id, dados->>'escolaId') = v_inst
     and dados->>'sessaoId' = v_prova.id
     and coalesce((dados->>'sessaoFechada')::boolean, false)
     and dados->>'presenca' in ('Presente', 'Atraso tolerado');

  if v_presentes > 0 then
    insert into registos (app, colecao, id, instituicao_id, origem_sync, dados) values (
      'classificacoes', 'lots', v_lot_id, v_inst, 'exames:attendance',
      jsonb_build_object(
        'id', v_lot_id,
        'institutionId', v_inst,
        'codigoLote', v_lot_cod,
        'provaCodigo', v_prova.codigo,
        'provaNome', v_prova.designacao,
        'anoLetivo', v_prova.ano_letivo,
        'fase', v_prova.fase,
        'origem', 'SIGEN Exames · sessão fechada (E19)',
        'quantidade', v_presentes,
        'dataHora', v_ts,
        'responsavel', 'Sincronização SIGEN',
        'estado', 'Recebido',
        'eventos', jsonb_build_array(jsonb_build_object(
            'id', 'ev-' || v_lot_id, 'dataHora', v_ts, 'tipo', 'Receção',
            'responsavel', 'Sincronização SIGEN',
            'observacao', 'Lote criado automaticamente a partir das presenças do SIGEN Exames.'))))
    on conflict (app, colecao, id) do update
      set dados = jsonb_set(registos.dados, '{quantidade}', to_jsonb(v_presentes))
      where (registos.dados->>'quantidade')::int is distinct from v_presentes;
  end if;

  return new;
end;
$$;

create trigger registos_sync_presenca
  after insert or update of dados on registos
  for each row when (new.app = 'exames' and new.colecao = 'attendance')
  execute function sigen_sync_presenca();

-- ---------------------------------------------------------------------
-- B) Provas (datas) -> calendário das Classificações
-- ---------------------------------------------------------------------
create or replace function sigen_sync_prova_calendario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_lista jsonb;
begin
  for r in select * from registos
            where app = 'classificacoes' and colecao = 'calendars'
              and dados->>'anoLetivo' = new.ano_letivo and dados->>'fase' = new.fase
  loop
    select coalesce(jsonb_agg(e order by e->>'dataExame'), '[]'::jsonb) into v_lista
      from (
        select e from jsonb_array_elements(coalesce(r.dados->'datasExame', '[]'::jsonb)) e
         where e->>'codigoProva' <> new.codigo
        union all
        select jsonb_build_object('codigoProva', new.codigo, 'nomeProva', new.designacao,
                                  'dataExame', to_char(new.data_hora, 'YYYY-MM-DD'))
         where new.estado = 'Publicada'
      ) s;
    if v_lista is distinct from r.dados->'datasExame' then
      update registos set dados = jsonb_set(dados, '{datasExame}', v_lista), origem_sync = 'exames:provas'
       where app = r.app and colecao = r.colecao and id = r.id;
    end if;
  end loop;
  return new;
end;
$$;

create trigger provas_sync_calendario
  after insert or update on provas
  for each row execute function sigen_sync_prova_calendario();

-- ---------------------------------------------------------------------
-- C) Calendário de inscrições (Exames) -> calendário (Classificações)
-- ---------------------------------------------------------------------
create or replace function sigen_sync_calendario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update registos c
     set dados = c.dados
                 || jsonb_build_object('inscricaoInicio', new.dados->>'inicioInscricao',
                                       'inscricaoFim',    new.dados->>'fimInscricao',
                                       'estado',          new.dados->>'estado'),
         origem_sync = 'exames:calendars:' || new.id
   where c.app = 'classificacoes' and c.colecao = 'calendars'
     and c.dados->>'anoLetivo' = new.dados->>'anoLetivo'
     and c.dados->>'fase' = new.dados->>'fase'
     and (c.dados->>'inscricaoInicio', c.dados->>'inscricaoFim', c.dados->>'estado')
         is distinct from (new.dados->>'inicioInscricao', new.dados->>'fimInscricao', new.dados->>'estado');
  return new;
end;
$$;

create trigger registos_sync_calendario
  after insert or update of dados on registos
  for each row when (new.app = 'exames' and new.colecao = 'calendars')
  execute function sigen_sync_calendario();

-- ---------------------------------------------------------------------
-- D) Resultado publicado (Classificações) -> notificação (visível nas duas apps)
-- ---------------------------------------------------------------------
create or replace function sigen_sync_resultado_publicado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_aluno  alunos%rowtype;
  v_dest   text;
  v_inst   text;
begin
  if new.dados->>'estado' <> 'Publicado' then return new; end if;
  if tg_op = 'UPDATE' and old.dados->>'estado' = 'Publicado' then return new; end if;

  select * into v_aluno from alunos
   where identificador_interno = new.dados->>'alunoRef'
      or nome_completo = new.dados->>'alunoNome'
   order by (identificador_interno = new.dados->>'alunoRef') desc
   limit 1;

  if v_aluno.id is not null then
    select g.dados->>'email' into v_dest from registos g
     where g.app = 'exames' and g.colecao = 'guardians'
       and g.dados->'alunoIds' ? v_aluno.id
     limit 1;
    v_dest := coalesce(v_dest, nullif(v_aluno.email, ''));
  end if;
  v_dest := coalesce(v_dest, new.dados->>'alunoNome', 'Aluno / EE');

  select id into v_inst from instituicoes where id = coalesce(new.instituicao_id, new.dados->>'institutionId');

  insert into notificacoes (id, instituicao_id, destinatario, canal, assunto, mensagem, estado, autor, app_origem)
  values (
    'sync-ntf-' || new.id, v_inst, v_dest, 'PLATAFORMA',
    'Resultado publicado · ' || coalesce(new.dados->>'provaNome', 'Prova'),
    'Foi publicado o resultado de ' || coalesce(new.dados->>'alunoNome', 'aluno') ||
      ' na prova ' || coalesce(new.dados->>'provaCodigo', '') || ' (' || coalesce(new.dados->>'fase', '') ||
      '). Consulte o portal autenticado do SIGEN.',
    'ENVIADA', 'SIGEN Classificações (automático)', 'classificacoes')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger registos_sync_resultado
  after insert or update of dados on registos
  for each row when (new.app = 'classificacoes' and new.colecao = 'results')
  execute function sigen_sync_resultado_publicado();

revoke execute on function sigen_sync_presenca(), sigen_sync_prova_calendario(),
  sigen_sync_calendario(), sigen_sync_resultado_publicado() from public, anon, authenticated;
