-- =====================================================================
-- SIGEN · Base de dados partilhada
--   App "SIGEN Exames"          (repo Exames-School)        -> app = 'exames'
--   App "SIGEN Classificações"  (repo Exames-Classifica-es) -> app = 'classificacoes'
--
-- Estrutura:
--   1. Tabelas comuns (plataforma C01–C07), lidas e escritas pelas duas apps:
--        instituicoes, utilizadores, notificacoes, auditoria, incidentes_privacidade
--   2. Entidades-chave do SIGEN Exames com colunas próprias:
--        alunos, provas
--   3. registos: armazenamento documental (jsonb) das restantes coleções de
--      cada app (inscrições, salas, presenças, lotes, classificações, ...)
--   4. Gatilhos de sincronização entre apps (ver ficheiro 0200).
--
-- Cada tabela comum guarda os campos próprios de cada app em
-- extra_exames / extra_classificacoes, para que uma app nunca apague
-- dados que só a outra conhece.
-- =====================================================================

create type sigen_app as enum ('exames', 'classificacoes');

create or replace function sigen_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Plataforma comum
-- ---------------------------------------------------------------------
create table instituicoes (
  id                  text primary key,
  designacao          text not null,
  codigo_escola       text not null,
  tipo                text not null,
  agrupamento_mae_id  text references instituicoes(id) on delete set null,
  morada              text not null default '',
  contacto_email      text not null default '',
  contacto_telefone   text not null default '',
  estado              text not null default 'Ativa' check (estado in ('Ativa', 'Inativa')),
  tem_historico       boolean not null default false,
  criada_em           date,
  origem_dados        text not null default 'LOCAL',
  extra_exames          jsonb not null default '{}'::jsonb,
  extra_classificacoes  jsonb not null default '{}'::jsonb,
  atualizado_por      sigen_app,
  atualizado_em       timestamptz not null default now()
);

create table utilizadores (
  id                text primary key,
  nome              text not null,
  email             text not null,
  password_demo     text not null default '',
  -- Perfis canónicos (união das duas apps). EE_ALUNO = EE_ALUNO_MAIOR (Exames) = ALUNO_EE (Classificações)
  perfil            text not null check (perfil in (
                      'ADMIN_CENTRAL','ADMIN_AGRUPAMENTO','DIRECAO','COORDENACAO','SECRETARIADO',
                      'CLASSIFICADOR','CONFERENTE','VIGILANTE','AUDITOR_EPD','EE_ALUNO')),
  escola_ids        text[] not null default '{}',
  vigencia_inicio   date,
  vigencia_fim      date,
  mfa_ativo         boolean not null default false,
  mfa_codigo_demo   text not null default '000000',
  estado            text not null default 'Ativo' check (estado in ('Ativo', 'Convidado', 'Suspenso')),
  ultimo_acesso     timestamptz,
  extra_exames          jsonb not null default '{}'::jsonb,
  extra_classificacoes  jsonb not null default '{}'::jsonb,
  atualizado_por    sigen_app,
  atualizado_em     timestamptz not null default now()
);
create unique index utilizadores_email_uidx on utilizadores (lower(email));

create table notificacoes (
  id              text primary key,
  instituicao_id  text references instituicoes(id) on delete cascade,
  destinatario    text not null,
  canal           text not null check (canal in ('PLATAFORMA', 'EMAIL', 'SMS')),
  assunto         text not null,
  mensagem        text not null default '',
  anexos          text[] not null default '{}',
  data_envio      timestamptz not null default now(),
  estado          text not null check (estado in ('ENVIADA', 'AGENDADA', 'CANCELADA', 'FALHA')),
  autor           text not null default '',
  app_origem      sigen_app not null,
  exemplo         boolean not null default false,
  atualizado_em   timestamptz not null default now()
);
create index notificacoes_inst_idx on notificacoes (instituicao_id, data_envio desc);

create table auditoria (
  id                text primary key,
  instituicao_id    text,
  data_hora         timestamptz not null default now(),
  utilizador_email  text,
  utilizador_nome   text not null,
  perfil            text,
  entidade          text not null,
  entidade_id       text,
  ecra              text,
  acao              text not null,
  detalhe           text not null default '',
  motivo_acesso     text,
  sensivel          boolean not null default false,
  antes             jsonb,
  depois            jsonb,
  app_origem        sigen_app not null,
  atualizado_em     timestamptz not null default now()
);
create index auditoria_inst_idx on auditoria (instituicao_id, data_hora desc);

create table incidentes_privacidade (
  id              text primary key,
  instituicao_id  text references instituicoes(id) on delete cascade,
  data_hora       timestamptz not null default now(),
  gravidade       text check (gravidade in ('Baixa', 'Média', 'Alta')),
  tipo            text,
  descricao       text not null,
  responsavel     text not null default '',
  estado          text not null check (estado in ('ABERTO', 'EM_ANALISE', 'ENCERRADO')),
  app_origem      sigen_app not null,
  atualizado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Entidades-chave (origem: SIGEN Exames)
-- ---------------------------------------------------------------------
create table alunos (
  id                      text primary key,
  instituicao_id          text not null references instituicoes(id) on delete cascade,
  identificador_interno   text not null,
  nome_completo           text not null,
  data_nascimento         date,
  tipo_documento          text,
  numero_documento        text,
  curso                   text,
  ano_turma               text,
  email                   text,
  telefone                text,
  situacao_escolar        text not null default 'Interno',
  anexos                  text[] not null default '{}',
  origem_dados            text not null default 'LOCAL',
  import_batch_id         text,
  atualizado_em           timestamptz not null default now()
);
create index alunos_inst_idx on alunos (instituicao_id);
create index alunos_ident_idx on alunos (identificador_interno);

create table provas (
  id                    text primary key,
  codigo                text not null,
  designacao            text not null,
  nivel                 text not null,
  tipo                  text not null,
  fase                  text not null check (fase in ('1.ª Fase', '2.ª Fase', 'Época Especial')),
  data_hora             timestamp not null,
  ano_letivo            text generated always as (
                          case when extract(month from data_hora) >= 9
                               then extract(year from data_hora)::int || '/' || (extract(year from data_hora)::int + 1)
                               else (extract(year from data_hora)::int - 1) || '/' || extract(year from data_hora)::int
                          end) stored,
  duracao_minutos       integer not null default 120,
  material_permitido    text not null default '',
  estado                text not null default 'Rascunho' check (estado in ('Rascunho', 'Publicada', 'Cancelada')),
  motivo_cancelamento   text,
  versao                integer not null default 1,
  atualizado_em         timestamptz not null default now()
);
create index provas_codigo_idx on provas (codigo, fase);

-- ---------------------------------------------------------------------
-- 3. Registos documentais por app/coleção
-- ---------------------------------------------------------------------
create table registos (
  app             sigen_app not null,
  colecao         text not null,
  id              text not null,
  instituicao_id  text,
  dados           jsonb not null,
  origem_sync     text,           -- preenchido quando o registo foi criado por um gatilho entre apps
  atualizado_em   timestamptz not null default now(),
  primary key (app, colecao, id)
);
create index registos_inst_idx on registos (app, colecao, instituicao_id);
create index registos_dados_gin on registos using gin (dados jsonb_path_ops);

-- atualizado_em automático
do $$
declare t text;
begin
  foreach t in array array['instituicoes','utilizadores','notificacoes','auditoria',
                           'incidentes_privacidade','alunos','provas','registos']
  loop
    execute format('create trigger %I before update on %I for each row execute function sigen_touch_updated_at()',
                   t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Vistas de leitura (consultas fáceis no SQL editor / relatórios)
-- ---------------------------------------------------------------------
create view v_inscricoes with (security_invoker = true) as
select r.id, r.instituicao_id,
       r.dados->>'anoLetivo' as ano_letivo, r.dados->>'fase' as fase,
       r.dados->>'alunoId' as aluno_id, a.nome_completo as aluno_nome,
       r.dados->>'estado' as estado,
       (select string_agg(p->>'codigoProva' || ' ' || (p->>'designacao'), ', ')
          from jsonb_array_elements(r.dados->'provas') p) as provas,
       r.atualizado_em
from registos r
left join alunos a on a.id = r.dados->>'alunoId'
where r.app = 'exames' and r.colecao = 'enrollments';

create view v_presencas with (security_invoker = true) as
select r.id, r.instituicao_id,
       r.dados->>'sessaoId' as prova_id, p.codigo as prova_codigo, p.designacao as prova_nome,
       r.dados->>'alunoId' as aluno_id, a.nome_completo as aluno_nome,
       r.dados->>'salaId' as sala_id, r.dados->>'presenca' as presenca,
       coalesce((r.dados->>'sessaoFechada')::boolean, false) as sessao_fechada,
       r.atualizado_em
from registos r
left join provas p on p.id = r.dados->>'sessaoId'
left join alunos a on a.id = r.dados->>'alunoId'
where r.app = 'exames' and r.colecao = 'attendance';

create view v_resultados with (security_invoker = true) as
select r.id, r.instituicao_id,
       r.dados->>'alunoRef' as aluno_ref, r.dados->>'alunoNome' as aluno_nome,
       r.dados->>'provaCodigo' as prova_codigo, r.dados->>'provaNome' as prova_nome,
       r.dados->>'anoLetivo' as ano_letivo, r.dados->>'fase' as fase,
       r.dados->>'resultado' as resultado, r.dados->>'estado' as estado,
       r.dados->>'origem' as origem, r.origem_sync, r.atualizado_em
from registos r
where r.app = 'classificacoes' and r.colecao = 'results';

-- ---------------------------------------------------------------------
-- Acesso (MODO DEMONSTRAÇÃO)
-- As apps ainda usam autenticação de demonstração local (passwordDemo),
-- por isso o papel "anon" tem acesso total. ANTES DE PRODUÇÃO: migrar o
-- login para Supabase Auth e substituir estas políticas por políticas
-- por instituição (escola_ids do utilizador autenticado).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['instituicoes','utilizadores','notificacoes','auditoria',
                           'incidentes_privacidade','alunos','provas','registos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to anon, authenticated using (true) with check (true)',
                   t || '_demo_all', t);
    execute format('alter table %I replica identity full', t);
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;
