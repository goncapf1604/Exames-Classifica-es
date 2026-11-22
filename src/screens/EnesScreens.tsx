/**
 * Módulo ENES/ENEB (adenda SIGEN 04) — SIGEN Classificações
 *   EN01 · Configuração de formatos e versões
 *   EN02 · Importação de ficheiro ENES/ENEB
 *   EN03 · Reconciliação de alunos, provas e classificações
 * Complementa o K21. Nenhuma classificação importada substitui um registo sem decisão
 * justificada, permissão e auditoria.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSearch,
  FileUp,
  GitCompare,
  History,
  Link2,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import {
  EnesCampo,
  EnesFormato,
  EnesImportacao,
  EnesReconciliacao,
  StudentResult,
} from '../types/sigen';
import {
  Button,
  EmptyState,
  FormField,
  Modal,
  NoticeBar,
  ScreenHeader,
  SearchInput,
  StatStrip,
  StatusLabel,
  inputClass,
} from '../components/ui/SharedUI';
import { exportCSV, formatDateTimePT, nowIso } from '../utils/exports';
import {
  analisarFicheiro,
  checksumSha256,
  corresponder,
  ENES_CAMPOS,
  formatoPermiteProducao,
  formatoUtilizavel,
  gerarExemplo,
  ResultadoAnalise,
} from '../utils/enes';

const novoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const downloadTexto = (nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
};

/** Códigos de prova conhecidos para a escola/ano/fase (calendário + resultados + lotes). */
function useProvasConhecidas(institutionId: string, ano: string, fase: string) {
  const { state } = useSigen();
  return useMemo(() => {
    const nomes = new Map<string, string>();
    state.calendars
      .filter((c) => c.anoLetivo === ano && c.fase === fase && (c.institutionId === institutionId || !c.institutionId))
      .forEach((c) => c.datasExame.forEach((d) => nomes.set(d.codigoProva, d.nomeProva)));
    state.results
      .filter((r) => r.institutionId === institutionId)
      .forEach((r) => nomes.has(r.provaCodigo) || nomes.set(r.provaCodigo, r.provaNome));
    state.lots
      .filter((l) => l.institutionId === institutionId)
      .forEach((l) => nomes.has(l.provaCodigo) || nomes.set(l.provaCodigo, l.provaNome));
    return nomes;
  }, [state.calendars, state.results, state.lots, institutionId, ano, fase]);
}

const FORMATO_VAZIO = (ano: string, fase: EnesFormato['fase']): EnesFormato => ({
  id: novoId('fmt'),
  anoLetivo: ano,
  fase,
  sistemaOrigem: 'ENES',
  versaoFormato: '',
  extensao: '.csv',
  codificacao: 'utf-8',
  delimitador: ';',
  cabecalhos: [],
  mapaColunas: {},
  regrasValidacao: [
    'Classificação inteira entre 0 e 200, ou "Faltou" / "Anulada"',
    'Sem linhas duplicadas (processo + prova + fase)',
  ],
  dataVigencia: '',
  estado: 'Rascunho',
  referenciaDocumental: '',
  versao: 1,
  historico: [],
});

const toneFormato = (e: EnesFormato['estado']) =>
  e === 'Homologado' ? 'success' : e === 'Ativo (testes)' ? 'info' : e === 'Desativado' ? 'neutral' : 'warning';

/* ============================================================================
 * EN01 · Configuração de formatos e versões
 * ========================================================================== */
export const EN01FormatosScreen: React.FC = () => {
  const { state, updateState, currentUser, activeYear, activePhase, activeInstitution, logAudit, toast, confirmAction } = useSigen();
  const formatos = state.enesFormatos;
  const [selId, setSelId] = useState<string | null>(formatos[0]?.id ?? null);
  const [rascunho, setRascunho] = useState<EnesFormato | null>(formatos[0] ? { ...formatos[0] } : null);
  const [cabecalhosTxt, setCabecalhosTxt] = useState((formatos[0]?.cabecalhos ?? []).join(', '));
  const [regrasTxt, setRegrasTxt] = useState((formatos[0]?.regrasValidacao ?? []).join('\n'));
  const [mapaAberto, setMapaAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [teste, setTeste] = useState<(ResultadoAnalise & { ficheiro: string }) | null>(null);
  const ficheiroTeste = useRef<HTMLInputElement>(null);
  const provas = useProvasConhecidas(activeInstitution?.id ?? '', rascunho?.anoLetivo ?? activeYear, rascunho?.fase ?? activePhase);
  const autor = currentUser?.nome ?? 'Sistema';

  const selecionar = (f: EnesFormato) => {
    setSelId(f.id);
    setRascunho({ ...f });
    setCabecalhosTxt(f.cabecalhos.join(', '));
    setRegrasTxt(f.regrasValidacao.join('\n'));
    setTeste(null);
  };

  const aplicarTextos = (f: EnesFormato): EnesFormato => ({
    ...f,
    cabecalhos: cabecalhosTxt.split(',').map((x) => x.trim()).filter(Boolean),
    regrasValidacao: regrasTxt.split('\n').map((x) => x.trim()).filter(Boolean),
  });

  const gravar = (f: EnesFormato, acao: string, nota?: string) => {
    const comHist = { ...f, historico: [...f.historico, { dataHora: nowIso(), autor, acao, nota }] };
    updateState((prev) => ({
      ...prev,
      enesFormatos: prev.enesFormatos.some((x) => x.id === f.id)
        ? prev.enesFormatos.map((x) => (x.id === f.id ? comHist : x))
        : [comHist, ...prev.enesFormatos],
    }));
    setRascunho(comHist);
    setSelId(f.id);
    logAudit({ entidade: `Formato ${f.sistemaOrigem} ${f.versaoFormato}`, ecra: 'EN01', acao, detalhe: nota ?? `Estado: ${f.estado} · versão ${f.versao}` });
  };

  const novo = () => {
    const f = FORMATO_VAZIO(activeYear, activePhase);
    setSelId(null);
    setRascunho(f);
    setCabecalhosTxt('');
    setRegrasTxt(f.regrasValidacao.join('\n'));
    setTeste(null);
  };

  const guardarRascunho = () => {
    if (!rascunho) return;
    const f = aplicarTextos(rascunho);
    if (!f.versaoFormato.trim()) return toast({ type: 'error', title: 'Indique a versão do formato' });
    if (!f.cabecalhos.length) return toast({ type: 'error', title: 'Indique os cabeçalhos esperados' });
    const original = formatos.find((x) => x.id === f.id);
    // Alterar um formato ativo cria uma nova versão em rascunho (o histórico mantém a anterior)
    const novaVersao = original && original.estado !== 'Rascunho';
    gravar(
      { ...f, estado: 'Rascunho', versao: novaVersao ? f.versao + 1 : f.versao },
      novaVersao ? 'Nova versão em rascunho' : original ? 'Rascunho guardado' : 'Formato criado',
      novaVersao ? `Versão ${f.versao + 1} criada a partir da versão ${f.versao}.` : undefined
    );
    toast({ type: 'success', title: 'Rascunho guardado' });
  };

  const transitar = (para: EnesFormato['estado'], acao: string, nota?: string) => {
    if (!rascunho) return;
    gravar({ ...aplicarTextos(rascunho), estado: para }, acao, nota);
    toast({ type: 'success', title: acao });
  };

  const homologar = () => {
    if (!rascunho) return;
    if (!rascunho.referenciaDocumental.trim()) {
      toast({ type: 'error', title: 'Referência documental obrigatória', detail: 'Indique a especificação oficial ou a amostra legítima que valida o formato.' });
      return;
    }
    confirmAction({
      title: 'Homologar internamente este formato?',
      message: `Confirma que o formato ${rascunho.versaoFormato} foi validado contra a especificação oficial ou amostra autorizada (${rascunho.referenciaDocumental})? Só formatos homologados podem ser usados em produção.`,
      confirmLabel: 'Homologar',
      onConfirm: () => transitar('Homologado', 'Formato homologado', `Referência: ${rascunho.referenciaDocumental}`),
    });
  };

  const testarFormato = async (file: File) => {
    if (!rascunho) return;
    const f = aplicarTextos(rascunho);
    const r = analisarFicheiro(file.name, await file.arrayBuffer(), f, {
      faseLote: f.fase,
      codigoEscola: activeInstitution?.codigoEscola ?? '',
      provasConhecidas: new Set(provas.keys()),
    });
    setTeste({ ...r, ficheiro: file.name });
    logAudit({ entidade: `Formato ${f.versaoFormato}`, ecra: 'EN01', acao: 'Teste de formato', detalhe: `${file.name}: ${r.linhas.length} linhas válidas, ${r.erros.length} erros.` });
  };

  const set = <K extends keyof EnesFormato>(k: K, v: EnesFormato[K]) => rascunho && setRascunho({ ...rascunho, [k]: v });
  const cabecalhosAtuais = cabecalhosTxt.split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div>
      <ScreenHeader
        screenId="EN01"
        actions={
          <Button variant="primary" onClick={novo}>
            <Plus className="w-4 h-4" /> Novo formato
          </Button>
        }
      />
      <NoticeBar tone="warning" title="Regra do formato">
        Formatos não validados só podem ser usados em ambiente de testes. O SIGEN não infere o layout oficial ENES/ENEB:
        cada formato tem de vir de especificação técnica oficial ou de amostra legítima e anonimizada.
      </NoticeBar>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-[#112A4A]">Formatos registados</div>
          {formatos.length === 0 ? (
            <EmptyState title="Sem formatos" description="Crie o primeiro formato a partir da especificação disponível." />
          ) : (
            <ul className="divide-y divide-slate-200">
              {formatos.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(f)}
                    className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-50 ${selId === f.id ? 'bg-[#F0F7F9]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#112A4A]">
                        {f.sistemaOrigem} · {f.versaoFormato || '(sem versão)'}
                      </span>
                      <StatusLabel status={f.estado} tone={toneFormato(f.estado)} />
                    </div>
                    <div className="text-[#536477] mt-1">
                      {f.anoLetivo} · {f.fase} · v{f.versao} · {f.extensao} {f.codificacao}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {rascunho && (
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Ano letivo" required>
                <input className={inputClass} value={rascunho.anoLetivo} onChange={(e) => set('anoLetivo', e.target.value)} />
              </FormField>
              <FormField label="Fase" required>
                <select className={inputClass} value={rascunho.fase} onChange={(e) => set('fase', e.target.value as EnesFormato['fase'])}>
                  <option>1.ª Fase</option>
                  <option>2.ª Fase</option>
                  <option>Época Especial</option>
                </select>
              </FormField>
              <FormField label="Sistema de origem" required>
                <select className={inputClass} value={rascunho.sistemaOrigem} onChange={(e) => set('sistemaOrigem', e.target.value as EnesFormato['sistemaOrigem'])}>
                  <option>ENES</option>
                  <option>ENEB</option>
                  <option>Outro</option>
                </select>
              </FormField>
              <FormField label="Versão do formato" required>
                <input className={inputClass} value={rascunho.versaoFormato} onChange={(e) => set('versaoFormato', e.target.value)} placeholder="ex. 2026.1" />
              </FormField>
              <FormField label="Extensão">
                <select className={inputClass} value={rascunho.extensao} onChange={(e) => set('extensao', e.target.value as EnesFormato['extensao'])}>
                  <option>.csv</option>
                  <option>.txt</option>
                </select>
              </FormField>
              <FormField label="Codificação">
                <select className={inputClass} value={rascunho.codificacao} onChange={(e) => set('codificacao', e.target.value as EnesFormato['codificacao'])}>
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1252">Windows-1252</option>
                  <option value="iso-8859-1">ISO-8859-1</option>
                </select>
              </FormField>
              <FormField label="Delimitador">
                <select className={inputClass} value={rascunho.delimitador} onChange={(e) => set('delimitador', e.target.value as EnesFormato['delimitador'])}>
                  <option value=";">Ponto e vírgula (;)</option>
                  <option value=",">Vírgula (,)</option>
                  <option value="|">Barra (|)</option>
                  <option value="TAB">Tabulação</option>
                </select>
              </FormField>
              <FormField label="Data de vigência">
                <input type="date" className={inputClass} value={rascunho.dataVigencia} onChange={(e) => set('dataVigencia', e.target.value)} />
              </FormField>
              <FormField label="Estado de homologação interna">
                <div className="pt-2">
                  <StatusLabel status={`${rascunho.estado} · v${rascunho.versao}`} tone={toneFormato(rascunho.estado)} />
                </div>
              </FormField>
            </div>
            <FormField label="Cabeçalhos esperados (separados por vírgula)" required>
              <input className={`${inputClass} font-mono`} value={cabecalhosTxt} onChange={(e) => setCabecalhosTxt(e.target.value)} />
            </FormField>
            <FormField label="Mapa de colunas">
              <div className="flex flex-wrap gap-2 text-xs">
                {ENES_CAMPOS.map((c) => (
                  <span key={c.campo} className={`px-2 py-1 rounded border ${rascunho.mapaColunas[c.campo] ? 'border-[#087E91] text-[#087E91]' : c.obrigatorio ? 'border-[#B42318] text-[#B42318]' : 'border-slate-300 text-[#536477]'}`}>
                    {c.label}: <span className="font-mono">{rascunho.mapaColunas[c.campo] ?? '—'}</span>
                  </span>
                ))}
              </div>
            </FormField>
            <FormField label="Regras de validação (uma por linha)">
              <textarea rows={3} className={inputClass} value={regrasTxt} onChange={(e) => setRegrasTxt(e.target.value)} />
            </FormField>
            <FormField label="Referência documental" hint="Especificação técnica oficial ou amostra autorizada que suporta este formato.">
              <input className={inputClass} value={rascunho.referenciaDocumental} onChange={(e) => set('referenciaDocumental', e.target.value)} />
            </FormField>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
              <Button size="sm" onClick={() => setMapaAberto(true)}>
                <Link2 className="w-3.5 h-3.5" /> Mapear campos
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const f = aplicarTextos(rascunho);
                  if (!f.cabecalhos.length) return toast({ type: 'error', title: 'Defina primeiro os cabeçalhos' });
                  downloadTexto(`exemplo_ficticio_${f.sistemaOrigem}_${f.versaoFormato || 'rascunho'}${f.extensao}`, gerarExemplo(f, activeInstitution?.codigoEscola ?? '', [...provas.keys()]));
                }}
              >
                <Download className="w-3.5 h-3.5" /> Carregar exemplo
              </Button>
              <Button size="sm" onClick={() => ficheiroTeste.current?.click()}>
                <FileSearch className="w-3.5 h-3.5" /> Testar formato
              </Button>
              <input
                ref={ficheiroTeste}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void testarFormato(file);
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="primary" onClick={guardarRascunho}>
                <Save className="w-3.5 h-3.5" /> Guardar rascunho
              </Button>
              <Button size="sm" disabled={rascunho.estado !== 'Rascunho' || !formatos.some((x) => x.id === rascunho.id)} onClick={() => transitar('Em validação', 'Submetido para validação')}>
                <Send className="w-3.5 h-3.5" /> Submeter para validação
              </Button>
              <Button size="sm" variant="teal" disabled={rascunho.estado !== 'Em validação'} onClick={() => transitar('Ativo (testes)', 'Versão ativada (testes)')}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Ativar versão
              </Button>
              <Button size="sm" variant="teal" disabled={rascunho.estado !== 'Ativo (testes)'} onClick={homologar}>
                <ShieldCheck className="w-3.5 h-3.5" /> Homologar
              </Button>
              <Button size="sm" variant="danger" disabled={rascunho.estado === 'Desativado' || !formatos.some((x) => x.id === rascunho.id)} onClick={() => transitar('Desativado', 'Formato desativado')}>
                <XCircle className="w-3.5 h-3.5" /> Desativar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setHistoricoAberto(true)}>
                <History className="w-3.5 h-3.5" /> Consultar histórico
              </Button>
            </div>

            {teste && (
              <div className={`rounded-md border p-3 text-xs ${teste.erros.length ? 'border-[#FDA29B] bg-[#FEF3F2]' : 'border-[#A6F4C5] bg-[#ECFDF3]'}`}>
                <div className="font-semibold text-[#112A4A]">
                  Teste de {teste.ficheiro}: {teste.linhas.length} linha(s) válida(s), {teste.erros.length} erro(s)
                </div>
                {teste.avisos.map((a) => (
                  <div key={a} className="text-[#B54708] mt-1">{a}</div>
                ))}
                {teste.erros.slice(0, 8).map((e, i) => (
                  <div key={i} className="text-[#B42318] mt-1">
                    Linha {e.linha} · {e.campo}: {e.erro}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={mapaAberto && !!rascunho} onClose={() => setMapaAberto(false)} title="Mapear campos" subtitle="Associe cada campo do SIGEN a uma coluna do ficheiro.">
        <div className="space-y-3">
          {cabecalhosAtuais.length === 0 && <NoticeBar tone="warning">Defina primeiro os cabeçalhos esperados.</NoticeBar>}
          {ENES_CAMPOS.map((c) => (
            <FormField key={c.campo} label={c.label} required={c.obrigatorio}>
              <select
                className={inputClass}
                value={rascunho?.mapaColunas[c.campo] ?? ''}
                onChange={(e) =>
                  rascunho &&
                  setRascunho({
                    ...rascunho,
                    mapaColunas: { ...rascunho.mapaColunas, [c.campo as EnesCampo]: e.target.value || undefined },
                  })
                }
              >
                <option value="">— não mapeado —</option>
                {cabecalhosAtuais.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </FormField>
          ))}
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setMapaAberto(false)}>
              Concluir
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={historicoAberto && !!rascunho} onClose={() => setHistoricoAberto(false)} title="Histórico do formato">
        <ul className="space-y-2 text-xs">
          {(rascunho?.historico ?? []).length === 0 && <li className="text-[#536477]">Sem registos.</li>}
          {[...(rascunho?.historico ?? [])].reverse().map((h, i) => (
            <li key={i} className="border-b border-slate-100 pb-2">
              <div className="font-semibold text-[#112A4A]">{h.acao}</div>
              <div className="text-[#536477]">
                {formatDateTimePT(h.dataHora)} · {h.autor}
                {h.nota ? ` · ${h.nota}` : ''}
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * EN02 · Importação de ficheiro ENES/ENEB
 * ========================================================================== */
const toneImport = (e: EnesImportacao['estado']) =>
  e === 'Importado' ? 'success' : e === 'Com erros' ? 'danger' : e === 'Anulado' ? 'neutral' : 'info';

export const EN02ImportacaoScreen: React.FC = () => {
  const { state, updateState, currentUser, activeInstitution, activeInstitutionId, activeYear, activePhase, logAudit, toast, navigate } = useSigen();
  const formatosDisponiveis = state.enesFormatos.filter((f) => formatoUtilizavel(f) && f.anoLetivo === activeYear && f.fase === activePhase);
  const lotes = state.enesImportacoes.filter((l) => l.institutionId === activeInstitutionId);
  const provas = useProvasConhecidas(activeInstitutionId, activeYear, activePhase);

  const [formatoId, setFormatoId] = useState(formatosDisponiveis[0]?.id ?? '');
  const [modo, setModo] = useState<EnesImportacao['modo']>('Teste');
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [errosLote, setErrosLote] = useState<EnesImportacao | null>(null);
  const [anular, setAnular] = useState<EnesImportacao | null>(null);
  const [justificacao, setJustificacao] = useState('');
  const [simulacao, setSimulacao] = useState<{ lote: EnesImportacao; contagem: Record<string, number> } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const formato = state.enesFormatos.find((f) => f.id === formatoId);
  const autor = currentUser?.nome ?? 'Sistema';

  const atualizarLote = (l: EnesImportacao, acao: string, nota?: string): EnesImportacao => {
    const novo = { ...l, historico: [...l.historico, { dataHora: nowIso(), autor, acao, nota }] };
    updateState((prev) => ({
      ...prev,
      enesImportacoes: prev.enesImportacoes.some((x) => x.id === l.id)
        ? prev.enesImportacoes.map((x) => (x.id === l.id ? novo : x))
        : [novo, ...prev.enesImportacoes],
    }));
    return novo;
  };

  const validarEstrutura = async () => {
    if (!formato) return toast({ type: 'error', title: 'Selecione um formato ativo (EN01)' });
    if (!ficheiro) return toast({ type: 'error', title: 'Selecione o ficheiro' });
    if (modo === 'Produção' && !formatoPermiteProducao(formato)) {
      return toast({ type: 'error', title: 'Formato não homologado', detail: 'Só pode ser usado em ambiente de testes.' });
    }
    const bytes = await ficheiro.arrayBuffer();
    const checksum = await checksumSha256(bytes);
    const analise = analisarFicheiro(ficheiro.name, bytes, formato, {
      faseLote: activePhase,
      codigoEscola: activeInstitution?.codigoEscola ?? '',
      provasConhecidas: new Set(provas.keys()),
    });
    const repetido = state.enesImportacoes.find((l) => l.checksum === checksum && l.estado === 'Importado' && l.institutionId === activeInstitutionId);
    if (repetido) analise.erros.unshift({ linha: 0, campo: 'ficheiro', erro: `Ficheiro idêntico já importado no lote ${repetido.id}.` });
    const lote = atualizarLote(
      {
        id: novoId('IMP'),
        institutionId: activeInstitutionId,
        anoLetivo: activeYear,
        fase: activePhase,
        origem: formato.sistemaOrigem,
        formatoId: formato.id,
        formatoVersao: `${formato.versaoFormato} (v${formato.versao})`,
        ficheiro: ficheiro.name,
        tamanhoBytes: bytes.byteLength,
        checksum,
        operador: autor,
        dataHora: nowIso(),
        modo,
        estado: analise.erros.length ? 'Com erros' : 'Validado',
        linhas: analise.linhas,
        erros: analise.erros,
        avisos: analise.avisos,
        historico: [],
      },
      'Validação de estrutura',
      `${analise.linhas.length} linhas válidas, ${analise.erros.length} erros`
    );
    logAudit({ entidade: `Lote ${lote.id}`, ecra: 'EN02', acao: 'Validação de ficheiro ENES/ENEB', detalhe: `${ficheiro.name} · SHA-256 ${checksum.slice(0, 16)}… · ${lote.estado}` });
    toast({ type: lote.erros.length ? 'warning' : 'success', title: lote.erros.length ? `${lote.erros.length} erro(s) encontrados` : 'Estrutura válida', detail: lote.erros.length ? 'Veja os erros e corrija o ficheiro ou o mapeamento.' : 'Pode simular e confirmar a importação.' });
    if (lote.erros.length) setErrosLote(lote);
  };

  const simular = (l: EnesImportacao) => {
    const contagem: Record<string, number> = { Correspondente: 0, Divergente: 0, 'Sem correspondência': 0 };
    l.linhas.forEach((x) => contagem[corresponder(x, state.results, l).correspondencia]++);
    setSimulacao({ lote: atualizarLote({ ...l, estado: l.estado === 'Validado' ? 'Simulado' : l.estado }, 'Simulação de importação', JSON.stringify(contagem)), contagem });
  };

  const confirmar = (l: EnesImportacao) => {
    if (l.erros.length) return toast({ type: 'error', title: 'Importação bloqueada', detail: 'A importação é atómica: corrija todos os erros primeiro.' });
    // Importação atómica: todas as linhas passam para reconciliação; nenhum resultado é alterado aqui.
    const itens: EnesReconciliacao[] = l.linhas.map((x) => {
      const m = corresponder(x, state.results, l);
      const item: EnesReconciliacao = {
        id: `${l.id}-L${x.linha}`,
        institutionId: l.institutionId,
        importacaoId: l.id,
        linha: x.linha,
        alunoRef: x.alunoRef,
        nome: x.nome,
        provaCodigo: x.provaCodigo,
        provaNome: provas.get(x.provaCodigo) ?? x.provaCodigo,
        anoLetivo: l.anoLetivo,
        fase: l.fase,
        classificacaoImportada: x.classificacao,
        correspondencia: m.correspondencia,
        decisao: m.correspondencia === 'Correspondente' ? 'Manter local' : 'Pendente',
        estado: 'Pendente',
      };
      if (x.curso) item.curso = x.curso;
      if (x.data) item.data = x.data;
      if (m.resultado) {
        item.resultadoId = m.resultado.id;
        item.classificacaoLocal = String(m.resultado.resultado);
        item.estadoResultadoLocal = m.resultado.estado;
      }
      return item;
    });
    updateState((prev) => ({ ...prev, enesReconciliacoes: [...itens, ...prev.enesReconciliacoes] }));
    atualizarLote({ ...l, estado: 'Importado' }, 'Importação confirmada', `${itens.length} registos enviados para reconciliação (EN03)`);
    logAudit({ entidade: `Lote ${l.id}`, ecra: 'EN02', acao: 'Importação confirmada', detalhe: `${itens.length} linhas · modo ${l.modo} · sem alteração automática de resultados.` });
    toast({ type: 'success', title: 'Importação confirmada', detail: 'Os registos aguardam reconciliação em EN03.' });
  };

  const confirmarAnulacao = () => {
    if (!anular) return;
    if (justificacao.trim().length < 10) return toast({ type: 'error', title: 'Justificação obrigatória (mín. 10 caracteres)' });
    const l = anular;
    const itens = state.enesReconciliacoes.filter((r) => r.importacaoId === l.id);
    // Reversão auditada do que já tinha sido aplicado aos resultados
    updateState((prev) => ({
      ...prev,
      results: prev.results
        .filter((r) => !itens.some((i) => i.estado === 'Confirmada' && i.decisao === 'Criar resultado' && i.resultadoId === r.id && r.estado !== 'Publicado'))
        .map((r) => {
          const i = itens.find((x) => x.estado === 'Confirmada' && x.decisao === 'Aceitar importada' && x.resultadoId === r.id);
          if (!i || i.classificacaoLocal === undefined) return r;
          const anterior = /^\d+$/.test(i.classificacaoLocal) ? Number(i.classificacaoLocal) : (i.classificacaoLocal as StudentResult['resultado']);
          return {
            ...r,
            resultado: anterior,
            historico: [
              ...r.historico,
              { dataHora: nowIso(), acao: `Reversão por anulação do lote ${l.id} (EN02)`, autor, valorAnterior: String(r.resultado), valorNovo: String(anterior), nota: justificacao.trim() },
            ],
          };
        }),
      enesReconciliacoes: prev.enesReconciliacoes.map((r) => (r.importacaoId === l.id ? { ...r, estado: 'Anulada' } : r)),
    }));
    atualizarLote({ ...l, estado: 'Anulado', justificacaoAnulacao: justificacao.trim() }, 'Lote anulado', justificacao.trim());
    logAudit({ entidade: `Lote ${l.id}`, ecra: 'EN02', acao: 'Anulação de lote', detalhe: justificacao.trim(), sensivel: true });
    setAnular(null);
    setJustificacao('');
    toast({ type: 'info', title: 'Lote anulado e alterações revertidas' });
  };

  const exportarRelatorio = (l: EnesImportacao) =>
    exportCSV(
      `relatorio_${l.id}`,
      ['Linha', 'Processo', 'Nome', 'Prova', 'Fase', 'Classificação', 'Erro'],
      [
        ...l.linhas.map((x) => [x.linha, x.alunoRef, x.nome, x.provaCodigo, x.fase, x.classificacao, '']),
        ...l.erros.map((e) => [e.linha, '', '', '', '', '', `${e.campo}: ${e.erro}`]),
      ]
    );

  return (
    <div>
      <ScreenHeader screenId="EN02" badgeText={`${activeYear} · ${activePhase}`} />
      <NoticeBar tone="info" title="Importação atómica e auditada">
        O lote só é importado se não tiver erros. Importar não altera resultados: as linhas seguem para reconciliação (EN03),
        onde cada alteração exige decisão justificada.
      </NoticeBar>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <FormField label="Escola / agrupamento">
            <input className={inputClass} disabled value={`${activeInstitution?.codigoEscola ?? ''} · ${activeInstitution?.designacao ?? ''}`} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ano">
              <input className={inputClass} disabled value={activeYear} />
            </FormField>
            <FormField label="Fase">
              <input className={inputClass} disabled value={activePhase} />
            </FormField>
          </div>
          <FormField label="Formato / versão" required hint={formatosDisponiveis.length ? undefined : 'Não há formato ativo para este ano/fase (EN01).'}>
            <select className={inputClass} value={formatoId} onChange={(e) => setFormatoId(e.target.value)}>
              <option value="">— selecione —</option>
              {formatosDisponiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.sistemaOrigem} · {f.versaoFormato} (v{f.versao}) · {f.estado}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ambiente">
            <select className={inputClass} value={modo} onChange={(e) => setModo(e.target.value as EnesImportacao['modo'])}>
              <option>Teste</option>
              <option disabled={!formato || !formatoPermiteProducao(formato)}>Produção</option>
            </select>
          </FormField>
          <FormField label="Ficheiro" required>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => input.current?.click()}>
                <FileUp className="w-3.5 h-3.5" /> Selecionar ficheiro
              </Button>
              <span className="text-xs text-[#536477] truncate">{ficheiro ? `${ficheiro.name} · ${(ficheiro.size / 1024).toFixed(1)} KB` : 'Nenhum ficheiro'}</span>
            </div>
            <input ref={input} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => void validarEstrutura()}>
              <ShieldCheck className="w-3.5 h-3.5" /> Validar estrutura
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('EN01')}>
              <Link2 className="w-3.5 h-3.5" /> Corrigir mapeamento
            </Button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 text-sm font-semibold text-[#112A4A]">Lotes de importação</div>
          {lotes.length === 0 ? (
            <EmptyState title="Sem lotes" description="Valide um ficheiro para criar o primeiro lote." />
          ) : (
            <div className="divide-y divide-slate-200">
              {lotes.map((l) => (
                <div key={l.id} className="p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-semibold text-[#087E91]">{l.id}</span> · {l.ficheiro}
                      <div className="text-[#536477] mt-0.5">
                        {l.origem} {l.formatoVersao} · {l.modo} · {l.linhas.length} linhas · {l.erros.length} erros · {formatDateTimePT(l.dataHora)} · {l.operador}
                      </div>
                      <div className="text-[#536477] font-mono mt-0.5" title={l.checksum}>
                        SHA-256 {l.checksum.slice(0, 24)}…
                      </div>
                    </div>
                    <StatusLabel status={l.estado} tone={toneImport(l.estado)} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" disabled={!l.erros.length && !l.avisos.length} onClick={() => setErrosLote(l)}>
                      <AlertTriangle className="w-3.5 h-3.5" /> Ver erros
                    </Button>
                    <Button size="sm" disabled={!['Validado', 'Simulado'].includes(l.estado)} onClick={() => simular(l)}>
                      <GitCompare className="w-3.5 h-3.5" /> Simular importação
                    </Button>
                    <Button size="sm" variant="teal" disabled={!['Validado', 'Simulado'].includes(l.estado) || l.erros.length > 0} onClick={() => confirmar(l)}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar importação
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => exportarRelatorio(l)}>
                      <Download className="w-3.5 h-3.5" /> Exportar relatório
                    </Button>
                    <Button size="sm" variant="danger" disabled={l.estado === 'Anulado'} onClick={() => setAnular(l)}>
                      <RotateCcw className="w-3.5 h-3.5" /> Anular lote
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!errosLote} onClose={() => setErrosLote(null)} title={`Erros do lote ${errosLote?.id ?? ''}`} size="lg">
        <div className="text-xs space-y-1 max-h-[60vh] overflow-y-auto">
          {errosLote?.avisos.map((a) => (
            <div key={a} className="text-[#B54708]">Aviso: {a}</div>
          ))}
          {errosLote?.erros.map((e, i) => (
            <div key={i} className="text-[#B42318]">
              Linha {e.linha} · {e.campo}: {e.erro}
            </div>
          ))}
          {errosLote && !errosLote.erros.length && <div className="text-[#536477]">Sem erros.</div>}
        </div>
      </Modal>

      <Modal open={!!simulacao} onClose={() => setSimulacao(null)} title="Simulação de importação">
        {simulacao && (
          <div className="space-y-3 text-xs">
            <StatStrip
              items={[
                { label: 'Correspondentes', value: simulacao.contagem.Correspondente, accent: 'green' },
                { label: 'Divergentes', value: simulacao.contagem.Divergente, accent: 'gold' },
                { label: 'Sem correspondência', value: simulacao.contagem['Sem correspondência'], accent: 'navy' },
              ]}
            />
            <p className="text-[#536477]">Nada foi alterado. Ao confirmar, as linhas seguem para EN03, onde divergências e novos registos exigem decisão.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!anular} onClose={() => setAnular(null)} title={`Anular lote ${anular?.id ?? ''}`}>
        <div className="space-y-3">
          <NoticeBar tone="danger">
            As reconciliações deste lote são anuladas e as classificações que já tinham sido alteradas voltam ao valor anterior,
            com registo no histórico de cada resultado.
          </NoticeBar>
          <FormField label="Justificação" required>
            <textarea rows={3} className={inputClass} value={justificacao} onChange={(e) => setJustificacao(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAnular(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarAnulacao}>
              Anular lote
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * EN03 · Reconciliação de alunos, provas e classificações
 * ========================================================================== */
const toneCorresp = (c: EnesReconciliacao['correspondencia']) =>
  c === 'Correspondente' ? 'success' : c === 'Divergente' ? 'warning' : 'info';

export const EN03ReconciliacaoScreen: React.FC = () => {
  const { state, updateState, currentUser, activeInstitutionId, logAudit, toast, confirmAction } = useSigen();
  const [pesquisa, setPesquisa] = useState('');
  const [filtroCorresp, setFiltroCorresp] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Pendente');
  const [comparar, setComparar] = useState<EnesReconciliacao | null>(null);
  const [resolver, setResolver] = useState<EnesReconciliacao | null>(null);
  const [associar, setAssociar] = useState<EnesReconciliacao | null>(null);
  const [decisao, setDecisao] = useState<EnesReconciliacao['decisao']>('Manter local');
  const [justificacao, setJustificacao] = useState('');
  const [resultadoEscolhido, setResultadoEscolhido] = useState('');
  const autor = currentUser?.nome ?? 'Sistema';
  const podeSobreporConfirmados = currentUser?.perfil === 'ADMIN_CENTRAL' || currentUser?.perfil === 'COORDENACAO';

  const itens = state.enesReconciliacoes.filter(
    (r) =>
      r.institutionId === activeInstitutionId &&
      (!filtroEstado || r.estado === filtroEstado) &&
      (!filtroCorresp || r.correspondencia === filtroCorresp) &&
      (!pesquisa || `${r.nome} ${r.alunoRef} ${r.provaCodigo}`.toLowerCase().includes(pesquisa.toLowerCase()))
  );
  const todos = state.enesReconciliacoes.filter((r) => r.institutionId === activeInstitutionId);
  const resultadoDe = (r: EnesReconciliacao) => state.results.find((x) => x.id === r.resultadoId);

  const atualizar = (id: string, patch: Partial<EnesReconciliacao>) =>
    updateState((prev) => ({ ...prev, enesReconciliacoes: prev.enesReconciliacoes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const guardarDecisao = () => {
    if (!resolver) return;
    if (decisao !== 'Manter local' && justificacao.trim().length < 10) return toast({ type: 'error', title: 'Justificação obrigatória (mín. 10 caracteres)' });
    const res = resultadoDe(resolver);
    if (decisao === 'Aceitar importada' && res && ['Validado', 'Publicado'].includes(res.estado) && !podeSobreporConfirmados) {
      return toast({ type: 'error', title: 'Sem permissão', detail: 'Só a Coordenação ou o Admin central podem substituir uma classificação confirmada.' });
    }
    atualizar(resolver.id, { decisao, justificacao: justificacao.trim() || undefined, decididoPor: autor, decididoEm: nowIso() });
    logAudit({ entidade: `Reconciliação ${resolver.id}`, ecra: 'EN03', acao: `Decisão: ${decisao}`, detalhe: justificacao.trim() || 'Sem alteração ao registo local.' });
    setResolver(null);
    setJustificacao('');
  };

  const guardarAssociacao = () => {
    if (!associar || !resultadoEscolhido) return;
    const res = state.results.find((x) => x.id === resultadoEscolhido);
    if (!res) return;
    atualizar(associar.id, {
      resultadoId: res.id,
      classificacaoLocal: String(res.resultado),
      estadoResultadoLocal: res.estado,
      correspondencia: String(res.resultado) === associar.classificacaoImportada ? 'Correspondente' : 'Divergente',
      decisao: 'Pendente',
    });
    logAudit({ entidade: `Reconciliação ${associar.id}`, ecra: 'EN03', acao: 'Associação manual de registo', detalhe: `Associado ao resultado ${res.id} (${res.alunoNome}).`, sensivel: true });
    setAssociar(null);
    setResultadoEscolhido('');
  };

  const confirmarReconciliacao = () => {
    const prontos = todos.filter((r) => r.estado === 'Pendente' && ['Manter local', 'Aceitar importada', 'Criar resultado'].includes(r.decisao));
    if (!prontos.length) return toast({ type: 'info', title: 'Não há decisões por confirmar' });
    confirmAction({
      title: `Confirmar ${prontos.length} reconciliação(ões)?`,
      message: 'As classificações aceites são atualizadas com nova versão no histórico. Resultados já publicados passam a "Em retificação".',
      confirmLabel: 'Confirmar reconciliação',
      onConfirm: () => {
        const novos: StudentResult[] = [];
        const criadosPor = new Map<string, string>();
        prontos
          .filter((r) => r.decisao === 'Criar resultado')
          .forEach((r) => {
            const id = `res-enes-${r.id}`;
            criadosPor.set(r.id, id);
            novos.push({
              id,
              institutionId: r.institutionId,
              alunoRef: r.alunoRef,
              alunoNome: r.nome,
              codigoAnonimo: '—',
              provaCodigo: r.provaCodigo,
              provaNome: r.provaNome,
              anoLetivo: r.anoLetivo,
              fase: r.fase,
              resultado: /^\d+$/.test(r.classificacaoImportada) ? Number(r.classificacaoImportada) : (r.classificacaoImportada as StudentResult['resultado']),
              origem: 'Importação ENES/ENEB',
              estado: 'Pendente',
              justificacao: r.justificacao,
              historico: [{ dataHora: nowIso(), acao: `Criado por reconciliação ENES/ENEB (lote ${r.importacaoId})`, autor, valorNovo: r.classificacaoImportada, nota: r.justificacao }],
            });
          });
        updateState((prev) => ({
          ...prev,
          results: [
            ...novos,
            ...prev.results.map((res) => {
              const r = prontos.find((p) => p.decisao === 'Aceitar importada' && p.resultadoId === res.id);
              if (!r) return res;
              const valor = /^\d+$/.test(r.classificacaoImportada) ? Number(r.classificacaoImportada) : (r.classificacaoImportada as StudentResult['resultado']);
              return {
                ...res,
                resultado: valor,
                estado: res.estado === 'Publicado' ? 'Em retificação' : res.estado,
                historico: [
                  ...res.historico,
                  { dataHora: nowIso(), acao: `Classificação atualizada por reconciliação ENES/ENEB (lote ${r.importacaoId})`, autor, valorAnterior: String(res.resultado), valorNovo: r.classificacaoImportada, nota: r.justificacao },
                ],
              };
            }),
          ],
          enesReconciliacoes: prev.enesReconciliacoes.map((x) =>
            prontos.some((p) => p.id === x.id)
              ? { ...x, estado: 'Confirmada', resultadoId: criadosPor.get(x.id) ?? x.resultadoId, decididoPor: x.decididoPor ?? autor, decididoEm: x.decididoEm ?? nowIso() }
              : x
          ),
        }));
        logAudit({ entidade: 'Reconciliação ENES/ENEB', ecra: 'EN03', acao: 'Reconciliação confirmada', detalhe: `${prontos.length} registos · ${prontos.filter((p) => p.decisao === 'Aceitar importada').length} classificações alteradas · ${novos.length} resultados criados.`, sensivel: true });
        toast({ type: 'success', title: 'Reconciliação confirmada' });
      },
    });
  };

  const exportarPendencias = () =>
    exportCSV(
      'pendencias_reconciliacao_enes',
      ['Lote', 'Linha', 'Processo', 'Nome', 'Prova', 'Fase', 'Importada', 'Local', 'Correspondência', 'Decisão'],
      todos
        .filter((r) => r.estado === 'Pendente')
        .map((r) => [r.importacaoId, r.linha, r.alunoRef, r.nome, r.provaCodigo, r.fase, r.classificacaoImportada, r.classificacaoLocal ?? '—', r.correspondencia, r.decisao])
    );

  const cont = (f: (r: EnesReconciliacao) => boolean) => todos.filter(f).length;

  return (
    <div>
      <ScreenHeader
        screenId="EN03"
        actions={
          <>
            <Button onClick={exportarPendencias}>
              <Download className="w-4 h-4" /> Exportar pendências
            </Button>
            <Button variant="primary" onClick={confirmarReconciliacao}>
              <CheckCircle2 className="w-4 h-4" /> Confirmar reconciliação
            </Button>
          </>
        }
      />
      <StatStrip
        items={[
          { label: 'Pendentes', value: cont((r) => r.estado === 'Pendente'), accent: 'navy' },
          { label: 'Divergentes', value: cont((r) => r.estado === 'Pendente' && r.correspondencia === 'Divergente'), accent: 'gold' },
          { label: 'Sem correspondência', value: cont((r) => r.estado === 'Pendente' && r.correspondencia === 'Sem correspondência'), accent: 'teal' },
          { label: 'Em revisão', value: cont((r) => r.decisao === 'Em revisão'), accent: 'danger' },
          { label: 'Confirmadas', value: cont((r) => r.estado === 'Confirmada'), accent: 'green' },
        ]}
      />
      <NoticeBar tone="warning" title="Regra">
        Nenhuma classificação importada substitui um registo confirmado sem decisão justificada, permissão
        (Coordenação / Admin central) e registo de versão no histórico do resultado.
      </NoticeBar>

      <div className="flex flex-wrap gap-3 my-4">
        <div className="w-64">
          <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Procurar aluno, processo ou prova" />
        </div>
        <select className={`${inputClass} w-48`} value={filtroCorresp} onChange={(e) => setFiltroCorresp(e.target.value)}>
          <option value="">Toda a correspondência</option>
          <option>Correspondente</option>
          <option>Divergente</option>
          <option>Sem correspondência</option>
        </select>
        <select className={`${inputClass} w-40`} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos os estados</option>
          <option>Pendente</option>
          <option>Confirmada</option>
          <option>Anulada</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        {itens.length === 0 ? (
          <EmptyState title="Sem registos" description="Importe um lote em EN02 para iniciar a reconciliação." />
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[#536477] text-left">
              <tr>
                <th className="py-2.5 px-3">Aluno</th>
                <th className="py-2.5 px-3">Prova</th>
                <th className="py-2.5 px-3">Importada</th>
                <th className="py-2.5 px-3">Local</th>
                <th className="py-2.5 px-3">Correspondência</th>
                <th className="py-2.5 px-3">Decisão</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-[#112A4A]">{r.nome}</div>
                    <div className="text-[#536477] font-mono">{r.alunoRef}{r.curso ? ` · ${r.curso}` : ''}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    {r.provaCodigo} · {r.provaNome}
                    <div className="text-[#536477]">{r.fase}{r.data ? ` · ${r.data}` : ''}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold">{r.classificacaoImportada}</td>
                  <td className="py-2.5 px-3 font-mono">
                    {r.classificacaoLocal ?? '—'}
                    {r.estadoResultadoLocal && <div className="text-[#536477] font-sans">{r.estadoResultadoLocal}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusLabel status={r.correspondencia} tone={toneCorresp(r.correspondencia)} />
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusLabel status={r.estado === 'Pendente' ? r.decisao : r.estado} tone={r.estado === 'Confirmada' ? 'success' : r.estado === 'Anulada' ? 'neutral' : r.decisao === 'Em revisão' ? 'danger' : 'warning'} />
                    {r.justificacao && <div className="text-[#536477] mt-1 max-w-[220px] truncate" title={r.justificacao}>{r.justificacao}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setComparar(r)}>
                      <GitCompare className="w-3.5 h-3.5" /> Comparar
                    </Button>
                    {r.estado === 'Pendente' && (
                      <>
                        {r.correspondencia === 'Sem correspondência' && (
                          <Button size="sm" variant="ghost" onClick={() => setAssociar(r)}>
                            <Link2 className="w-3.5 h-3.5" /> Associar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setResolver(r);
                            setDecisao(r.correspondencia === 'Sem correspondência' ? 'Criar resultado' : r.correspondencia === 'Divergente' ? 'Aceitar importada' : 'Manter local');
                            setJustificacao(r.justificacao ?? '');
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            atualizar(r.id, { decisao: 'Em revisão', decididoPor: autor, decididoEm: nowIso() });
                            logAudit({ entidade: `Reconciliação ${r.id}`, ecra: 'EN03', acao: 'Marcado para revisão', detalhe: `${r.nome} · ${r.provaCodigo}` });
                          }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Rever
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!comparar} onClose={() => setComparar(null)} title="Comparar fontes" size="lg">
        {comparar && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 rounded-md p-3">
              <div className="font-semibold text-[#112A4A] mb-2">Ficheiro importado ({comparar.importacaoId}, linha {comparar.linha})</div>
              <div>Aluno: {comparar.nome} ({comparar.alunoRef})</div>
              <div>Prova: {comparar.provaCodigo} · {comparar.fase}</div>
              <div className="mt-1 font-mono text-base">{comparar.classificacaoImportada}</div>
            </div>
            <div className="border border-slate-200 rounded-md p-3">
              <div className="font-semibold text-[#112A4A] mb-2">Registo local SIGEN</div>
              {resultadoDe(comparar) ? (
                <>
                  <div>
                    {resultadoDe(comparar)!.alunoNome} · {resultadoDe(comparar)!.origem} · {resultadoDe(comparar)!.estado}
                  </div>
                  <div className="mt-1 font-mono text-base">{String(resultadoDe(comparar)!.resultado)}</div>
                  <div className="mt-2 font-semibold">Histórico</div>
                  <ul className="mt-1 space-y-1">
                    {resultadoDe(comparar)!.historico.map((h, i) => (
                      <li key={i} className="text-[#536477]">
                        {formatDateTimePT(h.dataHora)} · {h.acao} · {h.autor}
                        {h.valorAnterior ? ` · ${h.valorAnterior} → ${h.valorNovo}` : h.valorNovo ? ` · ${h.valorNovo}` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-[#536477]">Sem registo local associado.</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!resolver} onClose={() => setResolver(null)} title="Resolver divergência">
        {resolver && (
          <div className="space-y-3">
            <div className="text-xs text-[#536477]">
              {resolver.nome} · {resolver.provaCodigo} — importada <strong>{resolver.classificacaoImportada}</strong>, local{' '}
              <strong>{resolver.classificacaoLocal ?? '—'}</strong> {resolver.estadoResultadoLocal ? `(${resolver.estadoResultadoLocal})` : ''}
            </div>
            <FormField label="Decisão" required>
              <select className={inputClass} value={decisao} onChange={(e) => setDecisao(e.target.value as EnesReconciliacao['decisao'])}>
                {resolver.resultadoId ? (
                  <>
                    <option>Manter local</option>
                    <option>Aceitar importada</option>
                  </>
                ) : (
                  <>
                    <option>Criar resultado</option>
                    <option value="Manter local">Ignorar linha (manter sem registo)</option>
                  </>
                )}
              </select>
            </FormField>
            <FormField label="Justificação" required={decisao !== 'Manter local'}>
              <textarea rows={3} className={inputClass} value={justificacao} onChange={(e) => setJustificacao(e.target.value)} placeholder="ex. Confirmado com a pauta oficial / ofício JNE n.º …" />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setResolver(null)}>Cancelar</Button>
              <Button variant="primary" onClick={guardarDecisao}>
                Guardar decisão
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!associar} onClose={() => setAssociar(null)} title="Associar registo local">
        {associar && (
          <div className="space-y-3">
            <div className="text-xs text-[#536477]">
              {associar.nome} ({associar.alunoRef}) · prova {associar.provaCodigo} · {associar.fase}
            </div>
            <FormField label="Resultado local" required>
              <select className={inputClass} value={resultadoEscolhido} onChange={(e) => setResultadoEscolhido(e.target.value)}>
                <option value="">— selecione —</option>
                {state.results
                  .filter((x) => x.institutionId === associar.institutionId && x.provaCodigo === associar.provaCodigo && x.fase === associar.fase)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.alunoRef} · {x.alunoNome} · {String(x.resultado)} ({x.estado})
                    </option>
                  ))}
              </select>
            </FormField>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setAssociar(null)}>Cancelar</Button>
              <Button variant="primary" disabled={!resultadoEscolhido} onClick={guardarAssociacao}>
                Associar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
