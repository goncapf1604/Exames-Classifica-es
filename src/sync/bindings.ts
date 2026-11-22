/**
 * SIGEN Classificações · ligação entre o estado da app e a base de dados partilhada.
 *
 * Tabelas comuns (também usadas pelo SIGEN Exames):
 *   instituicoes, utilizadores, notificacoes, auditoria, incidentes_privacidade
 * Restantes coleções: tabela "registos" (app = 'classificacoes').
 *
 * Dados que chegam automaticamente do SIGEN Exames (gatilhos na base de dados):
 *   lots (lotes de provas), anonymousMappings (códigos anónimos), results ("Faltou"),
 *   calendars (datas das provas e prazos de inscrição).
 */
import type {
  AuditLog,
  Institution,
  NotificationRecord,
  PrivacyIncident,
  ScreenId,
  UserAccount,
  UserRole,
} from '../types/sigen';
import { Binding, dateOrNull, normIso, registosBinding, Row } from './engine';

const APP = 'classificacoes' as const;

const ROLE_TO_DB: Record<UserRole, string> = {
  ADMIN_CENTRAL: 'ADMIN_CENTRAL',
  ADMIN_AGRUPAMENTO: 'ADMIN_AGRUPAMENTO',
  DIRECAO: 'DIRECAO',
  COORDENACAO: 'COORDENACAO',
  SECRETARIADO: 'SECRETARIADO',
  CLASSIFICADOR: 'CLASSIFICADOR',
  CONFERENTE: 'CONFERENTE',
  AUDITOR_EPD: 'AUDITOR_EPD',
  ALUNO_EE: 'EE_ALUNO',
};
const ROLE_FROM_DB = Object.fromEntries(Object.entries(ROLE_TO_DB).map(([k, v]) => [v, k])) as Record<
  string,
  UserRole
>;

const CANAL_TO_DB: Record<NotificationRecord['canal'], string> = {
  Plataforma: 'PLATAFORMA',
  'Email institucional': 'EMAIL',
  'Aviso SMS': 'SMS',
};
const CANAL_FROM_DB: Record<string, NotificationRecord['canal']> = {
  PLATAFORMA: 'Plataforma',
  EMAIL: 'Email institucional',
  SMS: 'Aviso SMS',
};
const NOTIF_TO_DB: Record<NotificationRecord['estado'], string> = {
  Enviada: 'ENVIADA',
  Agendada: 'AGENDADA',
  Cancelada: 'CANCELADA',
  Falha: 'FALHA',
};
const NOTIF_FROM_DB: Record<string, NotificationRecord['estado']> = {
  ENVIADA: 'Enviada',
  AGENDADA: 'Agendada',
  CANCELADA: 'Cancelada',
  FALHA: 'Falha',
};
const INC_TO_DB: Record<PrivacyIncident['estado'], string> = {
  Aberto: 'ABERTO',
  'Em análise': 'EM_ANALISE',
  Resolvido: 'ENCERRADO',
};
const INC_FROM_DB: Record<string, PrivacyIncident['estado']> = {
  ABERTO: 'Aberto',
  EM_ANALISE: 'Em análise',
  ENCERRADO: 'Resolvido',
};

const INST_TIPOS: Institution['tipo'][] = ['Agrupamento', 'Escola Secundária', 'Escola Básica', 'Estabelecimento Privado'];
const tipoFromDb = (t: string): Institution['tipo'] =>
  INST_TIPOS.includes(t as Institution['tipo'])
    ? (t as Institution['tipo'])
    : t === 'Escola Básica 2,3'
      ? 'Escola Básica'
      : 'Escola Secundária'; // 'Escola Sede' e outros
/** Tipo canónico (ex.: 'Escola Sede') preservado quando esta app não o distingue. */
const canonicalTipo = new Map<string, string>();

/** App que criou cada registo partilhado (para não trocar a origem ao editar). */
const origem = new Map<string, string>();
const origemDe = (table: string, id: string) => origem.get(`${table}:${id}`) ?? APP;
const lembrarOrigem = (table: string, r: Row) => {
  if (r.app_origem) origem.set(`${table}:${r.id}`, r.app_origem);
};

const splitContacto = (c: string) => {
  const [a = '', b = ''] = (c ?? '').split(' · ');
  return a.includes('@') ? { email: a.trim(), tel: b.trim() } : { email: b.trim(), tel: a.trim() };
};

const institutions: Binding = {
  key: 'institutions',
  table: 'instituicoes',
  toRow: (i: Institution): Row => {
    const prev = canonicalTipo.get(i.id);
    const { email, tel } = splitContacto(i.contacto);
    return {
      id: i.id,
      designacao: i.designacao,
      codigo_escola: i.codigoEscola,
      tipo: prev && tipoFromDb(prev) === i.tipo ? prev : i.tipo,
      agrupamento_mae_id: i.agrupamentoMaeId || null,
      morada: i.morada ?? '',
      contacto_email: email,
      contacto_telefone: tel,
      estado: i.estado,
      tem_historico: !!i.temHistorico,
      criada_em: dateOrNull(i.criadaEm),
      atualizado_por: APP,
    };
  },
  fromRow: (r): Institution => {
    canonicalTipo.set(r.id, r.tipo);
    const inst: Institution = {
      id: r.id,
      designacao: r.designacao,
      codigoEscola: r.codigo_escola,
      tipo: tipoFromDb(r.tipo),
      morada: r.morada ?? '',
      contacto: [r.contacto_email, r.contacto_telefone].filter(Boolean).join(' · '),
      estado: r.estado,
      criadaEm: r.criada_em ?? String(r.atualizado_em ?? '').slice(0, 10),
      temHistorico: !!r.tem_historico,
    };
    if (r.agrupamento_mae_id) inst.agrupamentoMaeId = r.agrupamento_mae_id;
    return inst;
  },
};

const users: Binding = {
  key: 'users',
  table: 'utilizadores',
  toRow: (u: UserAccount): Row => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: ROLE_TO_DB[u.perfil],
    escola_ids: u.escolasIds ?? [],
    vigencia_inicio: dateOrNull(u.vigenciaInicio),
    vigencia_fim: dateOrNull(u.vigenciaFim),
    mfa_ativo: !!u.mfaAtivo,
    estado: u.estado,
    ultimo_acesso: u.ultimoAcesso ? normIso(u.ultimoAcesso) : null,
    atualizado_por: APP,
  }),
  fromRow: (r): UserAccount | null => {
    const perfil = ROLE_FROM_DB[r.perfil];
    if (!perfil) return null; // perfil exclusivo do SIGEN Exames (ex.: VIGILANTE)
    const u: UserAccount = {
      id: r.id,
      nome: r.nome,
      email: r.email,
      passwordDemo: '', // gerida pelo Supabase Auth
      perfil,
      escolasIds: r.escola_ids ?? [],
      vigenciaInicio: r.vigencia_inicio ?? '',
      vigenciaFim: r.vigencia_fim ?? '',
      mfaAtivo: !!r.mfa_ativo,
      mfaCodigoDemo: '', // MFA real (TOTP) no Supabase Auth
      estado: r.estado,
    };
    if (r.ultimo_acesso) u.ultimoAcesso = normIso(r.ultimo_acesso);
    return u;
  },
};

const notifications: Binding = {
  key: 'notifications',
  table: 'notificacoes',
  order: { column: 'data_envio', ascending: false },
  limit: 2000,
  toRow: (n: NotificationRecord): Row => ({
    id: n.id,
    instituicao_id: n.institutionId || null,
    destinatario: n.destinatario,
    canal: CANAL_TO_DB[n.canal] ?? 'PLATAFORMA',
    assunto: n.assunto,
    mensagem: n.mensagem ?? '',
    anexos: n.anexos ?? [],
    data_envio: n.dataEnvio ? normIso(n.dataEnvio) : new Date().toISOString(),
    estado: NOTIF_TO_DB[n.estado] ?? 'ENVIADA',
    autor: n.autor ?? '',
    exemplo: n.origem === 'Dados de exemplo',
    app_origem: origemDe('notificacoes', n.id),
  }),
  fromRow: (r): NotificationRecord => {
    lembrarOrigem('notificacoes', r);
    return {
      id: r.id,
      institutionId: r.instituicao_id ?? '',
      destinatario: r.destinatario,
      canal: CANAL_FROM_DB[r.canal] ?? 'Plataforma',
      assunto: r.assunto,
      mensagem: r.mensagem ?? '',
      anexos: r.anexos ?? [],
      dataEnvio: normIso(r.data_envio),
      estado: NOTIF_FROM_DB[r.estado] ?? 'Enviada',
      autor: r.autor ?? '',
      origem: r.exemplo ? 'Dados de exemplo' : 'Dados locais',
    };
  },
};

const auditLogs: Binding = {
  key: 'auditLogs',
  table: 'auditoria',
  insertOnly: true,
  order: { column: 'data_hora', ascending: false },
  limit: 1000,
  toRow: (a: AuditLog): Row => ({
    id: a.id,
    instituicao_id: a.institutionId || null,
    data_hora: a.dataHora ? normIso(a.dataHora) : new Date().toISOString(),
    utilizador_nome: a.utilizador,
    perfil: ROLE_TO_DB[a.perfil] ?? a.perfil ?? null,
    entidade: a.entidade,
    ecra: a.ecra ?? null,
    acao: a.acao,
    detalhe: a.detalhe ?? '',
    motivo_acesso: a.motivoAcesso ?? null,
    sensivel: !!a.sensivel,
    antes: a.antes ?? null,
    depois: a.depois ?? null,
    app_origem: origemDe('auditoria', a.id),
  }),
  fromRow: (r): AuditLog => {
    lembrarOrigem('auditoria', r);
    const a: AuditLog = {
      id: r.id,
      institutionId: r.instituicao_id ?? '',
      dataHora: normIso(r.data_hora),
      utilizador: r.utilizador_nome,
      perfil: (ROLE_FROM_DB[r.perfil] ?? r.perfil ?? 'SECRETARIADO') as UserRole,
      entidade: r.entidade,
      // registos do SIGEN Exames não têm ecrã K/C desta app
      ecra: (r.ecra ?? (r.app_origem === 'exames' ? 'EXAMES' : 'C02')) as ScreenId,
      acao: r.acao,
      detalhe: r.detalhe ?? '',
    };
    if (r.sensivel) a.sensivel = true;
    if (r.motivo_acesso) a.motivoAcesso = r.motivo_acesso;
    if (r.antes) a.antes = r.antes;
    if (r.depois) a.depois = r.depois;
    return a;
  },
};

const incidents: Binding = {
  key: 'incidents',
  table: 'incidentes_privacidade',
  toRow: (p: PrivacyIncident): Row => ({
    id: p.id,
    instituicao_id: p.institutionId || null,
    data_hora: p.dataHora ? normIso(p.dataHora) : new Date().toISOString(),
    tipo: p.tipo,
    descricao: p.descricao,
    responsavel: p.responsavel,
    estado: INC_TO_DB[p.estado] ?? 'ABERTO',
    app_origem: origemDe('incidentes_privacidade', p.id),
  }),
  fromRow: (r): PrivacyIncident => {
    lembrarOrigem('incidentes_privacidade', r);
    return {
      id: r.id,
      institutionId: r.instituicao_id ?? '',
      dataHora: normIso(r.data_hora),
      tipo: r.tipo ?? 'Proteção de dados',
      descricao: r.descricao,
      responsavel: r.responsavel ?? '',
      estado: INC_FROM_DB[r.estado] ?? 'Aberto',
    };
  },
};

/** Ordem importa: instituições primeiro (chaves estrangeiras). */
export const CLASSIFICACOES_BINDINGS: Binding[] = [
  institutions,
  users,
  notifications,
  auditLogs,
  incidents,
  registosBinding(APP, 'calendars', 'institutionId'),
  registosBinding(APP, 'lots', 'institutionId'),
  registosBinding(APP, 'anonymousMappings', 'institutionId'),
  registosBinding(APP, 'graders', 'institutionId'),
  registosBinding(APP, 'assignments', 'institutionId'),
  registosBinding(APP, 'proofGradings', 'institutionId'),
  registosBinding(APP, 'criteria', 'institutionId'),
  registosBinding(APP, 'results', 'institutionId'),
  registosBinding(APP, 'pautas', 'institutionId'),
  registosBinding(APP, 'publications', 'institutionId'),
  registosBinding(APP, 'consultations', 'institutionId'),
  registosBinding(APP, 'availabilities', 'institutionId'),
  registosBinding(APP, 'scoreRectifications', 'institutionId'),
  registosBinding(APP, 'reappraisals', 'institutionId'),
  registosBinding(APP, 'reappraisalTrackings', 'institutionId'),
  registosBinding(APP, 'jneComplaints', 'institutionId'),
  registosBinding(APP, 'classificationRectifications', 'institutionId'),
  registosBinding(APP, 'interopJobs', 'institutionId'),
  registosBinding(APP, 'closures', 'institutionId'),
];

/** Perfis (canónicos) com acesso ao SIGEN Classificações. */
export const CLASSIFICACOES_PERFIS = Object.values(ROLE_TO_DB);

export const CLASSIFICACOES_REGISTOS_FILTER = `app=eq.${APP}`;
