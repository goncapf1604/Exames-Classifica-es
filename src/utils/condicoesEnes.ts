/**
 * Condições para a emissão oficial da Ficha ENES e para a importação de ficheiros oficiais reais.
 * Ficheiro idêntico nas duas apps (SIGEN Exames e SIGEN Classificações).
 *
 * Enquanto as quatro condições não estiverem confirmadas (com referência documental) pelo
 * Administrador central, o SIGEN só permite: importar ficheiros de teste, validar dados fictícios
 * e gerar a minuta da Ficha ENES.
 */
export type ChaveCondicao = 'modelo' | 'regras' | 'autorizacao' | 'testes';

export interface CondicoesLike {
  id: string;
  condicoes: { chave: ChaveCondicao; confirmada: boolean; naoAplicavel?: boolean; referencia: string; confirmadoPor?: string; confirmadoEm?: string }[];
  historico: { dataHora: string; autor: string; acao: string; nota?: string }[];
}

export const CONDICOES_ID = 'condicoes-ficha-enes';

export const CONDICOES_LABELS: Record<ChaveCondicao, string> = {
  modelo: 'Modelo oficial da Ficha ENES confirmado',
  regras: 'Regras de emissão e validação verificadas',
  autorizacao: 'Autorização para o procedimento de emissão (quando aplicável)',
  testes: 'Testes de conformidade concluídos',
};

export const condicoesIniciais = (): CondicoesLike => ({
  id: CONDICOES_ID,
  condicoes: (Object.keys(CONDICOES_LABELS) as ChaveCondicao[]).map((chave) => ({ chave, confirmada: false, referencia: '' })),
  historico: [],
});

export const condicaoCumprida = (c: CondicoesLike['condicoes'][number]) =>
  !!c.referencia.trim() && (c.confirmada || (c.chave === 'autorizacao' && !!c.naoAplicavel));

/** true só quando as quatro condições estão cumpridas. */
export const emissaoOficialDesbloqueada = (doc?: CondicoesLike | null) =>
  !!doc && (Object.keys(CONDICOES_LABELS) as ChaveCondicao[]).every((k) => {
    const c = doc.condicoes.find((x) => x.chave === k);
    return !!c && condicaoCumprida(c);
  });

export const capacidadesEnes = (desbloqueada: boolean) => [
  { acao: 'Importar ficheiro de teste', ecra: 'EN02 · Classificações', disponivel: true },
  { acao: 'Validar dados fictícios', ecra: 'EN01/EN02 · Classificações', disponivel: true },
  { acao: 'Gerar minuta ENES', ecra: 'EN05 · Exames', disponivel: true },
  { acao: 'Importar ficheiro oficial real', ecra: 'EN02 · Classificações', disponivel: desbloqueada },
  { acao: 'Emitir Ficha ENES oficial', ecra: 'EN05 · Exames', disponivel: desbloqueada },
];
