export type UserRole =
  | 'ADMIN_CENTRAL'
  | 'ADMIN_AGRUPAMENTO'
  | 'DIRECAO'
  | 'COORDENACAO'
  | 'SECRETARIADO'
  | 'CLASSIFICADOR'
  | 'CONFERENTE'
  | 'AUDITOR_EPD'
  | 'ALUNO_EE';

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_CENTRAL: 'Administrador central',
  ADMIN_AGRUPAMENTO: 'Administrador do agrupamento',
  DIRECAO: 'Direção',
  COORDENACAO: 'Coordenação de classificações',
  SECRETARIADO: 'Secretariado autorizado',
  CLASSIFICADOR: 'Classificador autorizado',
  CONFERENTE: 'Conferente autorizado',
  AUDITOR_EPD: 'EPD / Auditor',
  ALUNO_EE: 'Aluno / Encarregado de Educação',
};

export type ScreenId =
  | 'C01' | 'C02' | 'C03' | 'C04' | 'C05' | 'C06' | 'C07'
  | 'K01' | 'K02' | 'K03' | 'K04' | 'K05'
  | 'K06' | 'K07' | 'K08' | 'K09' | 'K10' | 'K11' | 'K12' | 'K13'
  | 'K14' | 'K15' | 'K16' | 'K17' | 'K18' | 'K19' | 'K20'
  | 'K21' | 'K22' | 'K23';

export type ScreenSection = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ScreenDefinition {
  id: ScreenId;
  section: ScreenSection;
  shortTitle: string;
  title: string;
  objective: string;
  allowedRoles: UserRole[];
  outputDoc: string;
}

export interface Institution {
  id: string;
  designacao: string;
  codigoEscola: string;
  tipo: 'Agrupamento' | 'Escola Secundária' | 'Escola Básica' | 'Estabelecimento Privado';
  agrupamentoMaeId?: string;
  morada: string;
  contacto: string;
  estado: 'Ativa' | 'Inativa';
  criadaEm: string;
  temHistorico: boolean;
}

export interface UserAccount {
  id: string;
  nome: string;
  email: string;
  passwordDemo: string;
  perfil: UserRole;
  escolasIds: string[];
  vigenciaInicio: string;
  vigenciaFim: string;
  mfaAtivo: boolean;
  mfaCodigoDemo: string;
  estado: 'Ativo' | 'Convidado' | 'Suspenso';
  ultimoAcesso?: string;
}

export interface ExamCalendarEntry {
  codigoProva: string;
  nomeProva: string;
  dataExame: string;
}

export interface CalendarConfig {
  id: string;
  institutionId: string;
  anoLetivo: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  inscricaoInicio: string;
  inscricaoFim: string;
  datasExame: ExamCalendarEntry[];
  prazoValidacaoDias: number;
  estado: 'Rascunho' | 'Publicado' | 'Fase Fechada';
  versao: number;
  historico: {
    versao: number;
    data: string;
    autor: string;
    justificacao: string;
    resumo: string;
  }[];
}

export interface NotificationRecord {
  id: string;
  institutionId: string;
  destinatario: string;
  canal: 'Plataforma' | 'Email institucional' | 'Aviso SMS';
  assunto: string;
  mensagem: string;
  anexos: string[];
  dataEnvio: string;
  estado: 'Enviada' | 'Agendada' | 'Cancelada' | 'Falha';
  autor: string;
  origem: 'Dados locais' | 'Dados de exemplo';
}

export interface AuditLog {
  id: string;
  institutionId: string;
  dataHora: string;
  utilizador: string;
  perfil: UserRole;
  entidade: string;
  ecra: ScreenId;
  acao: string;
  detalhe: string;
  antes?: Record<string, unknown>;
  depois?: Record<string, unknown>;
  sensivel?: boolean;
  motivoAcesso?: string;
}

export interface PrivacyIncident {
  id: string;
  institutionId: string;
  dataHora: string;
  tipo: 'Acesso indevido' | 'Ilegibilidade de prova' | 'Divergência custódia' | 'Proteção de dados';
  descricao: string;
  responsavel: string;
  estado: 'Aberto' | 'Em análise' | 'Resolvido';
}

export interface CustodyEvent {
  id: string;
  dataHora: string;
  tipo: 'Receção' | 'Conferência' | 'Transferência' | 'Divergência';
  responsavel: string;
  destino?: string;
  quantidadeConferida?: number;
  observacao: string;
}

export interface ExamLot {
  id: string;
  institutionId: string;
  codigoLote: string;
  provaCodigo: string;
  provaNome: string;
  anoLetivo: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  origem: string;
  quantidade: number;
  quantidadeConferida?: number;
  dataHora: string;
  responsavel: string;
  estado: 'Recebido' | 'Conferido' | 'Em distribuição' | 'Transferido' | 'Divergência';
  eventos: CustodyEvent[];
}

export interface AnonymousMapping {
  id: string;
  institutionId: string;
  codigoAnonimo: string;
  provaCodigo: string;
  provaNome: string;
  loteCodigo: string;
  referenciaIdentidade: string;
  nomeAlunoReal: string;
  estadoAnonimizacao: 'Gerado' | 'Associado' | 'Bloqueado';
  bloqueadoPor?: string;
  revelacoes: {
    dataHora: string;
    autor: string;
    motivo: string;
  }[];
}

export interface GraderProfile {
  id: string;
  institutionId: string;
  nome: string;
  identificadorProfissional: string;
  disciplinas: string[];
  disponibilidadeInicio: string;
  disponibilidadeFim: string;
  impedimentos: string[];
  perfilAutorizado: 'Classificador 1.ª Linha' | 'Classificador Reapreciação' | 'Supervisor de Correção';
  estado: 'Ativo' | 'Suspenso';
  historico: string[];
}

export interface LotAssignment {
  id: string;
  institutionId: string;
  loteId: string;
  loteCodigo: string;
  provaCodigo: string;
  classificadorId: string;
  classificadorNome: string;
  dataLimite: string;
  estado: 'Proposto' | 'Aceite' | 'Recusado' | 'Reatribuído' | 'Concluído';
  motivoReatribuicao?: string;
  versao: number;
  historico: { versao: number; data: string; estado: string; nota: string }[];
}

export interface GradingItemScore {
  itemCode: string;
  descricao: string;
  cotacaoMaxima: number;
  cotacaoAtribuida: number | null;
  observacao: string;
}

export interface ProofGrading {
  id: string;
  institutionId: string;
  codigoAnonimo: string;
  loteCodigo: string;
  provaCodigo: string;
  provaNome: string;
  criterioVersao: string;
  classificadorEmail: string;
  classificadorNome: string;
  itens: GradingItemScore[];
  totalRegistado: number;
  estado: 'Rascunho' | 'Submetido' | 'Em conferência' | 'Confirmado' | 'Retificação solicitada';
  versao: number;
  atualizadoEm: string;
  conferenteNome?: string;
  parecerConferencia?: string;
  divergenciaConferencia?: 'Conforme' | 'Divergência detetada' | 'Erro sinalizado';
  paginas: { numero: number; titulo: string; conteudoResposta: string[] }[];
}

export interface CriterionDocument {
  id: string;
  institutionId: string;
  provaCodigo: string;
  provaNome: string;
  documentoNome: string;
  versao: string;
  vigencia: string;
  estado: 'Rascunho' | 'Publicado' | 'Arquivado';
  resumoAlteracoes: string;
  regrasChave: string[];
  fonte: 'Simulação local' | 'Fonte oficial validada';
}

export interface StudentResult {
  id: string;
  institutionId: string;
  alunoRef: string;
  alunoNome: string;
  codigoAnonimo: string;
  provaCodigo: string;
  provaNome: string;
  anoLetivo: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  resultado: number | 'Faltou' | 'Anulada';
  origem: 'Dados de exemplo' | 'Dados locais (K07/K08)' | 'Importação K10 (Teste)' | 'Fonte oficial';
  estado: 'Pendente' | 'Validado' | 'Discrepância' | 'Em retificação' | 'Publicado';
  justificacao?: string;
  historico: {
    dataHora: string;
    acao: string;
    autor: string;
    valorAnterior?: string;
    valorNovo?: string;
    nota?: string;
  }[];
}

export interface PautaRecord {
  id: string;
  institutionId: string;
  escolaNome: string;
  provaCodigo: string;
  provaNome: string;
  anoLetivo: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  modelo: 'Mapa Local Anonimizado v2.0' | 'Pauta Interna de Conferência v2.0' | 'Modelo Oficial JNE (Pendente validação)';
  dataPublicacao: string;
  responsavel: string;
  estado: 'Rascunho' | 'Conferida' | 'Aprovada' | 'Publicada' | 'Arquivada';
  checklistConcluida: boolean;
  versao: number;
}

export interface PublicationRecord {
  id: string;
  institutionId: string;
  pautaId: string;
  conjuntoLabel: string;
  canal: 'Portal autenticado aluno/EE' | 'Afixação local (pauta anonimizada)' | 'Envio institucional';
  dataHora: string;
  publicoAlvo: 'Alunos / EE autenticados' | 'Direção e Secretariado' | 'Coordenação';
  mensagem: string;
  estado: 'Agendada' | 'Publicada' | 'Suspensa';
  autor: string;
}

export interface ConsultationRequest {
  id: string;
  institutionId: string;
  codigoProcesso: string;
  alunoRef: string;
  alunoNome: string;
  provaCodigo: string;
  provaNome: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  modelo: string;
  dataPedido: string;
  anexoAssinado?: string;
  estado: 'Submetido' | 'Validado' | 'Agendado' | 'Concluído';
  dataEntregaAgendada?: string;
}

export interface ProofAvailability {
  id: string;
  institutionId: string;
  pedidoId: string;
  codigoProcesso: string;
  alunoNome: string;
  provaNome: string;
  ficheiroProva: string;
  dataDisponibilizacao: string;
  meioEntrega: 'Portal autenticado' | 'Presencial secretariado' | 'Link temporário cifrado';
  comprovativo?: string;
  estado: 'Em preparação' | 'Disponibilizada' | 'Entregue' | 'Acesso revogado';
  registoAcessos: { dataHora: string; utilizador: string; acao: string }[];
}

export interface ScoreRectificationRequest {
  id: string;
  institutionId: string;
  codigoProcesso: string;
  provaNome: string;
  alunoNome: string;
  itemCotacao: string;
  modelo10?: string;
  fundamentacao: string;
  data: string;
  estado: 'Criado' | 'Encaminhado' | 'Decisão registada' | 'Notificado';
  decisaoDoc?: string;
}

export interface ReappraisalRequest {
  id: string;
  institutionId: string;
  codigoProcesso: string;
  provaCodigo: string;
  provaNome: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  requerente: string;
  modelo12: string;
  fundamentacao: string;
  dataEntrada: string;
  pagamento: 'Pendente' | 'Confirmado' | 'Isento';
  documentosVerificados: boolean;
  estado: 'Criado' | 'Documentação validada' | 'Encaminhado' | 'Decisão registada' | 'Notificado';
  decisaoResumo?: string;
}

export interface ReappraisalTracking {
  id: string;
  institutionId: string;
  processoCodigo: string;
  requerente: string;
  provaNome: string;
  entidadeDestino: 'Agrupamento de Escolas (Sede)' | 'Delegação Regional JNE' | 'Comissão de Reapreciação';
  dataEnvio: string;
  referenciaOficial: string;
  decisaoDoc?: string;
  novaClassificacao?: number;
  classificacaoAnterior: number;
  estado: 'A aguardar envio' | 'Enviado' | 'Resposta registada' | 'Decisão validada' | 'Resultado atualizado' | 'Encerrado';
}

export interface JneComplaint {
  id: string;
  institutionId: string;
  codigoReclamacao: string;
  processoOrigem: string;
  requerente: string;
  modelo16: string;
  fundamentacaoAnexo: string;
  dataEntrada: string;
  prazoLimiteRef: string;
  estado: 'Criada' | 'Documentação validada' | 'Encaminhada' | 'Decisão registada' | 'Notificada';
  decisaoDoc?: string;
}

export interface ClassificationRectification {
  id: string;
  institutionId: string;
  resultadoId: string;
  alunoNome: string;
  provaNome: string;
  valorAnterior: string;
  valorNovo: string;
  documentoDecisao: string;
  proponente: string;
  aprovador?: string;
  dataEfeito: string;
  estado: 'Proposta' | 'Decisão validada' | 'Aprovada' | 'Revertida';
  motivoReversao?: string;
}

export interface InteropJob {
  id: string;
  institutionId: string;
  destino: 'ENES (Ambiente de Testes)' | 'ENEB (Ambiente de Testes)' | 'Exportação Local CSV/JSON';
  versaoEsquema: string;
  anoLetivo: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  ficheiro: string;
  loteRef: string;
  dataHora: string;
  estado: 'Validado (Teste)' | 'Simulado' | 'Reconciliado (Teste)' | 'Com rejeições';
  totalRegistos: number;
  rejeicoes: { linha: number; campo: string; erro: string }[];
}

export interface PhaseClosure {
  id: string;
  institutionId: string;
  anoLetivo: string;
  fase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  estado: 'Aberta' | 'Encerrada' | 'Reaberta';
  politicaRetencao: '5 anos (Norma administrativa)' | '10 anos (Arquivo escolar alargado)' | 'Retenção legal permanente (Atas/Pautas)';
  responsavel: string;
  dataFecho?: string;
  checklist: {
    id: string;
    label: string;
    verificado: boolean;
  }[];
  historicoFecho: { dataHora: string; acao: string; autor: string; motivo: string }[];
}

export interface PrintableDocument {
  title: string;
  docCode: string;
  origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO' | 'DOCUMENTO LOCAL · SIMULAÇÃO' | 'DOCUMENTO RESTRITO · AUDITORIA';
  institutionName: string;
  generatedBy: string;
  generatedAt: string;
  version: string;
  sections: {
    heading: string;
    rows?: { label: string; value: string }[];
    table?: { headers: string[]; rows: string[][] };
    note?: string;
  }[];
}
