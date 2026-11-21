import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileDiff,
  FileText,
  Lock,
  Plus,
  RotateCw,
  Save,
  Send,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import { CriterionDocument, ProofGrading } from '../types/sigen';
import {
  Button,
  FormField,
  Modal,
  NoticeBar,
  ScreenHeader,
  StatusLabel,
  inputClass,
} from '../components/ui/SharedUI';
import { exportCSV, formatDateTimePT, nowIso } from '../utils/exports';

/* ============================================================================
 * K06 · Visualizador de prova digitalizada
 * ========================================================================== */
export const K06ViewerScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast, navigate } = useSigen();
  const proofs = state.proofGradings.filter((p) => p.institutionId === activeInstitutionId);
  const criteria = state.criteria.filter((c) => c.institutionId === activeInstitutionId);

  const [selectedProofId, setSelectedProofId] = useState(proofs[0]?.id || '');
  const proof = proofs.find((p) => p.id === selectedProofId) || proofs[0] || null;
  const [pageIdx, setPageIdx] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [selectedCrit, setSelectedCrit] = useState(proof?.criterioVersao || criteria[0]?.versao || '');
  const [closed, setClosed] = useState(false);

  const [ilegOpen, setIlegOpen] = useState(false);
  const [ilegNote, setIlegNote] = useState('');

  const page = proof?.paginas[pageIdx] || proof?.paginas[0];

  const handleReportIllegibility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proof || !ilegNote.trim()) return;
    updateState((prev) => ({
      ...prev,
      incidents: [
        {
          id: `inc-${Date.now()}`,
          institutionId: activeInstitutionId,
          dataHora: nowIso(),
          tipo: 'Ilegibilidade de prova',
          descricao: `${proof.codigoAnonimo} (Pág. ${pageIdx + 1}): ${ilegNote}`,
          responsavel: currentUser?.nome || 'Classificador',
          estado: 'Aberto',
        },
        ...prev.incidents,
      ],
    }));
    logAudit({
      entidade: proof.codigoAnonimo,
      ecra: 'K06',
      acao: 'Sinalização de ilegibilidade',
      detalhe: `Página ${pageIdx + 1}: ${ilegNote}`,
    });
    setIlegNote('');
    setIlegOpen(false);
    toast({ type: 'warning', title: 'Ocorrência de ilegibilidade registada' });
  };

  const handleCloseAccess = () => {
    if (proof) {
      logAudit({
        entidade: proof.codigoAnonimo,
        ecra: 'K06',
        acao: 'Fecho de visualização protegida',
        detalhe: `Sessão de visualização encerrada na página ${pageIdx + 1}.`,
      });
    }
    setClosed(true);
    toast({ type: 'info', title: 'Acesso à prova digitalizada encerrado e registado' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K06"
        actions={
          <>
            <Button variant="teal" size="sm" onClick={() => navigate('K07')}>
              Abrir cotações (K07)
            </Button>
            <Button variant="danger" size="sm" onClick={() => setIlegOpen(true)} disabled={!proof || closed}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Sinalizar ilegibilidade
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCloseAccess} disabled={closed}>
              <Lock className="w-3.5 h-3.5" />
              Fechar acesso
            </Button>
          </>
        }
      />

      <NoticeBar tone="info" title="Visualização protegida e anonimizada">
        Acesso condicionado a autorização. Download, seleção de texto e menu de contexto encontram-se
        desativados sobre a imagem digitalizada, com marca de água de rastreabilidade do utilizador.
      </NoticeBar>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <FormField label="Prova anónima" required>
              <select
                value={selectedProofId}
                onChange={(e) => {
                  setSelectedProofId(e.target.value);
                  setPageIdx(0);
                  setClosed(false);
                }}
                className={`${inputClass} font-mono`}
              >
                {proofs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigoAnonimo} · {p.provaNome}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="w-48">
            <FormField label="Critério (versão)" required>
              <select value={selectedCrit} onChange={(e) => setSelectedCrit(e.target.value)} className={inputClass}>
                {criteria.map((c) => (
                  <option key={c.id} value={c.versao}>
                    {c.versao} ({c.estado})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!proof || closed || pageIdx <= 0}
            onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </Button>
          <span className="text-xs font-mono tabular-nums px-2 text-[#112A4A]">
            Pág. {proof ? pageIdx + 1 : 0}/{proof?.paginas.length || 0}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!proof || closed || pageIdx >= (proof?.paginas.length || 1) - 1}
            onClick={() => setPageIdx((i) => Math.min((proof?.paginas.length || 1) - 1, i + 1))}
          >
            Seguinte
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Button variant="secondary" size="sm" disabled={closed} onClick={() => setZoom((z) => Math.max(60, z - 20))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs font-mono tabular-nums w-12 text-center">{zoom}%</span>
          <Button variant="secondary" size="sm" disabled={closed} onClick={() => setZoom((z) => Math.min(180, z + 20))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" disabled={closed} onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw className="w-4 h-4" />
            Rodar
          </Button>
        </div>
      </div>

      {/* Protected Scan Canvas */}
      {closed ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
          <Lock className="w-8 h-8 text-[#536477] mx-auto" />
          <div className="font-display text-base font-bold text-[#112A4A]">Acesso à prova encerrado</div>
          <p className="text-xs text-[#536477]">O registo de visualização foi gravado no trilho de auditoria.</p>
          <Button variant="primary" size="sm" onClick={() => setClosed(false)}>
            Reabrir visualização autorizada
          </Button>
        </div>
      ) : proof && page ? (
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            toast({ type: 'warning', title: 'Cópia/Download bloqueados na visualização protegida (K06)' });
          }}
          className="bg-slate-800 rounded-lg p-6 sm:p-10 overflow-auto flex justify-center select-none min-h-[480px]"
        >
          <div
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'top center',
            }}
            className="relative bg-[#FCFBF7] text-[#1E293B] w-full max-w-2xl p-8 sm:p-10 shadow-2xl border border-slate-300 transition-transform duration-150"
          >
            {/* Traceability watermark (security requirement for scanned exam protection) */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-10 rotate-[-25deg] text-center">
              <div className="font-mono text-lg font-bold text-[#112A4A]">
                {proof.codigoAnonimo} · VISUALIZAÇÃO PROTEGIDA
              </div>
              <div className="font-mono text-xs text-[#112A4A] mt-1">
                {currentUser?.email} · {formatDateTimePT(nowIso())}
              </div>
            </div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-mono font-bold text-[#112A4A]">
                    PROVA ANÓNIMA: {proof.codigoAnonimo}
                  </div>
                  <div className="text-xs text-slate-600">
                    {proof.provaCodigo} · {proof.provaNome} · Lote {proof.loteCodigo}
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-500">
                  <div>{page.titulo}</div>
                  <div>IDENTIDADE DO ALUNO OCULTADA</div>
                </div>
              </div>

              <div className="space-y-5 font-mono text-sm leading-7">
                {page.conteudoResposta.map((line, i) => (
                  <div
                    key={i}
                    className="pb-4 border-b border-dashed border-slate-300 text-[#1E3A5F]"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Modal open={ilegOpen} title="Sinalizar ilegibilidade de prova digitalizada" subtitle={proof?.codigoAnonimo} onClose={() => setIlegOpen(false)}>
        <form onSubmit={handleReportIllegibility} className="space-y-4">
          <FormField label="Descrição do problema de legibilidade" required>
            <textarea
              rows={3}
              value={ilegNote}
              onChange={(e) => setIlegNote(e.target.value)}
              placeholder="Ex.: Corte na margem direita da página 2 impede leitura da etapa final do item 2.2."
              className={inputClass}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIlegOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="danger">Criar ocorrência</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K07 · Cotações por item
 * ========================================================================== */
export const K07ItemGradingScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast, isPhaseClosed } = useSigen();
  const proofs = state.proofGradings.filter((p) => p.institutionId === activeInstitutionId);
  const [selectedId, setSelectedId] = useState(proofs[0]?.id || '');
  const proof = proofs.find((p) => p.id === selectedId) || proofs[0] || null;

  const [draftItems, setDraftItems] = useState(proof?.itens || []);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  React.useEffect(() => {
    if (proof) {
      setDraftItems(proof.itens.map((it) => ({ ...it })));
      setValidationMsg(null);
    }
  }, [proof?.id, proof?.versao]);

  const isLocked = !proof || proof.estado === 'Submetido' || proof.estado === 'Confirmado' || isPhaseClosed;

  const totalCalculated = useMemo(
    () => draftItems.reduce((sum, it) => sum + (it.cotacaoAtribuida ?? 0), 0),
    [draftItems]
  );
  const maxTotal = useMemo(() => draftItems.reduce((sum, it) => sum + it.cotacaoMaxima, 0), [draftItems]);

  const validateAll = (): string[] => {
    const errors: string[] = [];
    draftItems.forEach((it) => {
      if (it.cotacaoAtribuida === null || Number.isNaN(it.cotacaoAtribuida)) {
        errors.push(`Item ${it.itemCode}: cotação em falta.`);
      } else if (it.cotacaoAtribuida < 0 || it.cotacaoAtribuida > it.cotacaoMaxima) {
        errors.push(`Item ${it.itemCode}: valor ${it.cotacaoAtribuida} fora do intervalo (0–${it.cotacaoMaxima}).`);
      }
    });
    return errors;
  };

  const handleScoreChange = (idx: number, raw: string) => {
    const val = raw === '' ? null : Number(raw);
    setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, cotacaoAtribuida: val } : it)));
  };

  const handleObsChange = (idx: number, obs: string) => {
    setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, observacao: obs } : it)));
  };

  const handleSaveDraft = () => {
    if (!proof) return;
    updateState((prev) => ({
      ...prev,
      proofGradings: prev.proofGradings.map((p) =>
        p.id === proof.id
          ? { ...p, itens: draftItems, totalRegistado: totalCalculated, estado: 'Rascunho', atualizadoEm: nowIso() }
          : p
      ),
    }));
    toast({ type: 'success', title: 'Rascunho de cotações guardado' });
  };

  const handleValidate = () => {
    const errs = validateAll();
    if (errs.length === 0) {
      setValidationMsg(`Todos os ${draftItems.length} itens válidos. Soma calculada: ${totalCalculated}/${maxTotal} pontos.`);
      toast({ type: 'success', title: 'Validação concluída sem erros' });
    } else {
      setValidationMsg(errs.join(' '));
      toast({ type: 'error', title: `${errs.length} erro(s) de validação encontrados` });
    }
  };

  const handleSubmit = () => {
    if (!proof) return;
    const errs = validateAll();
    if (errs.length > 0) {
      setValidationMsg(errs.join(' '));
      toast({ type: 'error', title: 'Submissão bloqueada', detail: 'Corrija itens em falta ou fora de intervalo.' });
      return;
    }
    updateState((prev) => ({
      ...prev,
      proofGradings: prev.proofGradings.map((p) =>
        p.id === proof.id
          ? {
              ...p,
              itens: draftItems,
              totalRegistado: totalCalculated,
              estado: 'Submetido',
              divergenciaConferencia: 'Conforme',
              atualizadoEm: nowIso(),
              classificadorNome: currentUser?.nome || p.classificadorNome,
              classificadorEmail: currentUser?.email || p.classificadorEmail,
            }
          : p
      ),
    }));
    logAudit({
      entidade: proof.codigoAnonimo,
      ecra: 'K07',
      acao: `Submissão de grelha de cotações (v${proof.versao})`,
      detalhe: `Total submetido: ${totalCalculated}/${maxTotal} pontos.`,
      antes: { totalRegistado: proof.totalRegistado, estado: proof.estado },
      depois: { totalRegistado: totalCalculated, estado: 'Submetido' },
    });
    toast({ type: 'success', title: 'Grelha submetida e fechada para conferência (K08)' });
  };

  const handleReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proof || !reopenReason.trim()) return;
    const nextVer = proof.versao + 1;
    updateState((prev) => ({
      ...prev,
      proofGradings: prev.proofGradings.map((p) =>
        p.id === proof.id
          ? { ...p, estado: 'Rascunho', versao: nextVer, atualizadoEm: nowIso() }
          : p
      ),
    }));
    logAudit({
      entidade: proof.codigoAnonimo,
      ecra: 'K07',
      acao: `Pedido de reabertura / correção (v${nextVer})`,
      detalhe: reopenReason,
    });
    setReopenOpen(false);
    setReopenReason('');
    toast({ type: 'warning', title: `Grelha reaberta para correção (v${nextVer})` });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K07"
        badgeText="Modo simulação / autorizado"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleValidate}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Validar itens
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toast({ type: 'info', title: `Total calculado: ${totalCalculated} / ${maxTotal} pontos` })}
            >
              <Calculator className="w-3.5 h-3.5" />
              Calcular total
            </Button>
            {!isLocked ? (
              <>
                <Button variant="secondary" size="sm" onClick={handleSaveDraft}>
                  <Save className="w-3.5 h-3.5" />
                  Guardar rascunho
                </Button>
                <Button variant="primary" size="sm" onClick={handleSubmit}>
                  <Send className="w-3.5 h-3.5" />
                  Submeter
                </Button>
              </>
            ) : (
              <Button variant="teal" size="sm" onClick={() => setReopenOpen(true)} disabled={isPhaseClosed}>
                Corrigir erro (pedir reabertura)
              </Button>
            )}
          </>
        }
      />

      <NoticeBar tone="warning" title="Regras de escala e utilização">
        Cotações fora de intervalo ou itens em falta são bloqueados automaticamente. Regras oficiais
        de arredondamento/escala aplicam-se apenas após especificação oficial — não utilizar em
        classificação oficial sem autorização.
      </NoticeBar>

      {proof && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-60">
                <FormField label="Prova anónima" required>
                  <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={`${inputClass} font-mono`}>
                    {proofs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigoAnonimo} · {p.provaNome} (v{p.versao})
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="text-xs text-[#536477] pb-2">
                Critério: <strong className="font-mono text-[#112A4A]">{proof.criterioVersao}</strong> · Versão:{' '}
                <strong className="font-mono text-[#087E91]">v{proof.versao}</strong>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusLabel status={proof.estado} />
              <div className="text-right">
                <div className="text-[11px] text-[#536477]">Total calculado</div>
                <div className="font-display text-xl font-bold text-[#112A4A] tabular-nums">
                  {totalCalculated} <span className="text-sm font-normal text-[#536477]">/ {maxTotal}</span>
                </div>
              </div>
            </div>
          </div>

          {validationMsg && (
            <NoticeBar tone={validationMsg.startsWith('Todos') ? 'info' : 'danger'}>{validationMsg}</NoticeBar>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                  <th className="text-left py-3 px-4 font-semibold">Item</th>
                  <th className="text-left py-3 px-4 font-semibold">Descrição</th>
                  <th className="text-right py-3 px-4 font-semibold">Máx.</th>
                  <th className="text-right py-3 px-4 font-semibold w-36">Cotação atribuída *</th>
                  <th className="text-left py-3 px-4 font-semibold">Observação (condicional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {draftItems.map((it, idx) => {
                  const outOfRange =
                    it.cotacaoAtribuida !== null &&
                    (it.cotacaoAtribuida < 0 || it.cotacaoAtribuida > it.cotacaoMaxima);
                  return (
                    <tr key={it.itemCode}>
                      <td className="py-2.5 px-4 font-mono text-xs font-bold text-[#087E91]">{it.itemCode}</td>
                      <td className="py-2.5 px-4 text-xs text-[#112A4A]">{it.descricao}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums text-[#536477]">
                        {it.cotacaoMaxima}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          type="number"
                          min={0}
                          max={it.cotacaoMaxima}
                          step={1}
                          disabled={isLocked}
                          value={it.cotacaoAtribuida ?? ''}
                          onChange={(e) => handleScoreChange(idx, e.target.value)}
                          className={`w-24 text-right font-mono tabular-nums rounded-md border px-2.5 py-1.5 text-sm ${
                            outOfRange ? 'border-[#B91C1C] bg-red-50 text-[#B91C1C]' : 'border-slate-300 bg-white text-[#112A4A]'
                          } disabled:bg-slate-100`}
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={it.observacao}
                          onChange={(e) => handleObsChange(idx, e.target.value)}
                          placeholder="Justificação / nota de critério..."
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-[#112A4A] disabled:bg-slate-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={reopenOpen} title="Pedir reabertura para correção de erro" subtitle={proof?.codigoAnonimo} onClose={() => setReopenOpen(false)}>
        <form onSubmit={handleReopen} className="space-y-4">
          <FormField label="Motivo da correção" required>
            <textarea rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} className={inputClass} placeholder="Indique o item e o motivo da reabertura..." />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReopenOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Reabrir (nova versão)</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K08 · Conferência de cotações e totais
 * ========================================================================== */
export const K08VerificationScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast } = useSigen();
  const proofs = state.proofGradings.filter((p) => p.institutionId === activeInstitutionId);
  const [parecerMap, setParecerMap] = useState<Record<string, string>>({});

  const calcSum = (p: ProofGrading) => p.itens.reduce((s, it) => s + (it.cotacaoAtribuida ?? 0), 0);

  const handleVerifyAll = () => {
    let divergences = 0;
    updateState((prev) => ({
      ...prev,
      proofGradings: prev.proofGradings.map((p) => {
        if (p.institutionId !== activeInstitutionId) return p;
        const sum = calcSum(p);
        const div = sum !== p.totalRegistado ? 'Divergência detetada' : 'Conforme';
        if (div !== 'Conforme') divergences++;
        return { ...p, divergenciaConferencia: div };
      }),
    }));
    toast({
      type: divergences > 0 ? 'warning' : 'success',
      title: `Verificação executada: ${divergences} divergência(s) detetada(s)`,
    });
  };

  const handleConfirm = (p: ProofGrading) => {
    // Enforce segregation of duties between classificador and conferente
    if (currentUser && p.classificadorEmail.toLowerCase() === currentUser.email.toLowerCase()) {
      toast({
        type: 'error',
        title: 'Segregação de funções violada',
        detail: 'O classificador que corrigiu a prova não pode ser o conferente que a aprova.',
      });
      return;
    }
    const sum = calcSum(p);
    if (sum !== p.totalRegistado) {
      toast({
        type: 'error',
        title: 'Divergência impede confirmação',
        detail: `Soma calculada (${sum}) difere do total registado (${p.totalRegistado}). Solicite retificação.`,
      });
      return;
    }
    const parecer = parecerMap[p.id] || 'Conferido sem inconsistências.';
    updateState((prev) => ({
      ...prev,
      proofGradings: prev.proofGradings.map((x) =>
        x.id === p.id
          ? {
              ...x,
              estado: 'Confirmado',
              conferenteNome: currentUser?.nome,
              parecerConferencia: parecer,
              divergenciaConferencia: 'Conforme',
            }
          : x
      ),
    }));
    logAudit({
      entidade: p.codigoAnonimo,
      ecra: 'K08',
      acao: 'Confirmação de cotações e totais',
      detalhe: `Total ${sum} confirmado por ${currentUser?.nome}. Parecer: ${parecer}`,
    });
    toast({ type: 'success', title: `Prova ${p.codigoAnonimo} confirmada` });
  };

  const handleReturn = (p: ProofGrading, mode: 'erro' | 'retificacao') => {
    const parecer = parecerMap[p.id]?.trim();
    if (!parecer) {
      toast({ type: 'error', title: 'Parecer / motivo obrigatório', detail: 'Todas as devoluções exigem motivo e autor.' });
      return;
    }
    updateState((prev) => ({
      ...prev,
      proofGradings: prev.proofGradings.map((x) =>
        x.id === p.id
          ? {
              ...x,
              estado: mode === 'retificacao' ? 'Retificação solicitada' : 'Em conferência',
              divergenciaConferencia: 'Erro sinalizado',
              parecerConferencia: parecer,
              conferenteNome: currentUser?.nome,
            }
          : x
      ),
    }));
    logAudit({
      entidade: p.codigoAnonimo,
      ecra: 'K08',
      acao: mode === 'retificacao' ? 'Solicitação de retificação (devolução)' : 'Sinalização de erro em conferência',
      detalhe: parecer,
    });
    toast({ type: 'warning', title: mode === 'retificacao' ? 'Prova devolvida para retificação' : 'Erro sinalizado em tarefa' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K08"
        actions={
          <>
            <Button variant="teal" size="sm" onClick={handleVerifyAll}>
              <FileCheck2 className="w-3.5 h-3.5" />
              Verificar regras
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportCSV(
                  'mapa_conferencia_k08',
                  ['CodigoAnonimo', 'Lote', 'SomaCalculada', 'TotalRegistado', 'Divergencia', 'Estado', 'Conferente'],
                  proofs.map((p) => [
                    p.codigoAnonimo,
                    p.loteCodigo,
                    calcSum(p),
                    p.totalRegistado,
                    calcSum(p) === p.totalRegistado ? 'Conforme' : 'Divergência',
                    p.estado,
                    p.conferenteNome || '—',
                  ])
                )
              }
            >
              Exportar mapa (CSV)
            </Button>
          </>
        }
      />

      <NoticeBar tone="info" title="Segregação entre classificador e conferente">
        O sistema impede que o mesmo utilizador aprove na conferência uma prova que classificou em K07.
        Experimente a divergência automática na prova <strong className="font-mono">ANON-635-002</strong> (soma 148 vs registado 142).
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-4 font-semibold">Lote / Prova</th>
                <th className="text-right py-3 px-3 font-semibold">Soma calc.</th>
                <th className="text-right py-3 px-3 font-semibold">Total reg.</th>
                <th className="text-left py-3 px-3 font-semibold">Divergência</th>
                <th className="text-left py-3 px-3 font-semibold">Parecer (condicional)</th>
                <th className="text-right py-3 px-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {proofs.map((p) => {
                const sum = calcSum(p);
                const hasDiff = sum !== p.totalRegistado;
                return (
                  <tr key={p.id}>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-bold text-[#112A4A]">{p.codigoAnonimo}</div>
                      <div className="text-xs text-[#536477]">
                        {p.loteCodigo} · {p.classificadorNome}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-bold tabular-nums text-[#112A4A]">
                      {sum}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono text-xs font-bold tabular-nums ${hasDiff ? 'text-[#B91C1C]' : 'text-[#112A4A]'}`}>
                      {p.totalRegistado}
                    </td>
                    <td className="py-3 px-3">
                      <StatusLabel status={hasDiff ? 'Divergência detetada' : p.estado === 'Confirmado' ? 'Confirmado' : 'Conforme'} />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={parecerMap[p.id] ?? p.parecerConferencia ?? ''}
                        onChange={(e) => setParecerMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Motivo / parecer..."
                        className="w-full min-w-[180px] rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => handleReturn(p, 'erro')}>
                          Sinalizar erro
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleReturn(p, 'retificacao')}>
                          Solicitar retificação
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => handleConfirm(p)} disabled={p.estado === 'Confirmado'}>
                          Confirmar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * K09 · Critérios e versões
 * ========================================================================== */
export const K09CriteriaScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, logAudit, toast } = useSigen();
  const criteria = state.criteria.filter((c) => c.institutionId === activeInstitutionId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [diffPair, setDiffPair] = useState<[CriterionDocument, CriterionDocument] | null>(null);
  const [form, setForm] = useState({
    provaCodigo: '635',
    provaNome: 'Matemática A',
    documentoNome: '',
    versao: 'CRIT-635-v1.2',
    vigencia: '2026-06-21',
    resumoAlteracoes: '',
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.documentoNome.trim() || !form.versao.trim()) return;
    const created: CriterionDocument = {
      id: `crit-${Date.now()}`,
      institutionId: activeInstitutionId,
      provaCodigo: form.provaCodigo,
      provaNome: form.provaNome,
      documentoNome: form.documentoNome,
      versao: form.versao,
      vigencia: form.vigencia,
      estado: 'Rascunho',
      resumoAlteracoes: form.resumoAlteracoes || 'Nova versão carregada para revisão.',
      regrasChave: ['Aplicação não retroativa salvo deliberação formal.', form.resumoAlteracoes || 'Conforme anexo.'],
      fonte: 'Simulação local',
    };
    updateState((prev) => ({ ...prev, criteria: [created, ...prev.criteria] }));
    logAudit({ entidade: created.versao, ecra: 'K09', acao: 'Carregamento de critério', detalhe: created.documentoNome });
    setUploadOpen(false);
    toast({ type: 'success', title: `Critério ${created.versao} carregado` });
  };

  const handleStatus = (c: CriterionDocument, next: CriterionDocument['estado']) => {
    updateState((prev) => ({
      ...prev,
      criteria: prev.criteria.map((x) => (x.id === c.id ? { ...x, estado: next } : x)),
    }));
    logAudit({ entidade: c.versao, ecra: 'K09', acao: `Alteração de estado para ${next}`, detalhe: c.documentoNome });
    toast({ type: 'info', title: `${c.versao}: ${next}` });
  };

  const handleReplace = (c: CriterionDocument) => {
    setForm({
      provaCodigo: c.provaCodigo,
      provaNome: c.provaNome,
      documentoNome: c.documentoNome.replace('.pdf', '_nova_versao.pdf'),
      versao: `${c.versao}-rev`,
      vigencia: nowIso().slice(0, 10),
      resumoAlteracoes: `Substituição versionada de ${c.versao}.`,
    });
    setUploadOpen(true);
  };

  const handleCompare = (c: CriterionDocument) => {
    const older = criteria.find((x) => x.provaCodigo === c.provaCodigo && x.id !== c.id);
    if (!older) {
      toast({ type: 'info', title: 'Sem versão anterior para comparar nesta prova' });
      return;
    }
    setDiffPair([older, c]);
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K09"
        actions={
          <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4" />
            Carregar critério
          </Button>
        }
      />

      <NoticeBar tone="warning" title="Integridade normativa">
        Critérios oficiais provêm exclusivamente de fonte autorizada. Alterações versionadas não têm
        efeito retroativo sem procedimento formal auditado.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Prova / Versão</th>
                <th className="text-left py-3 px-4 font-semibold">Documento e resumo</th>
                <th className="text-left py-3 px-4 font-semibold">Vigência</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {criteria.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-5">
                    <div className="font-mono text-xs font-bold text-[#087E91]">{c.versao}</div>
                    <div className="text-xs text-[#112A4A]">{c.provaCodigo} · {c.provaNome}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-semibold text-[#112A4A] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#536477]" />
                      {c.documentoNome}
                    </div>
                    <div className="text-[#536477] mt-0.5">{c.resumoAlteracoes}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{c.vigencia}</td>
                  <td className="py-3 px-4"><StatusLabel status={c.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {c.estado === 'Rascunho' && (
                        <Button variant="teal" size="sm" onClick={() => handleStatus(c, 'Publicado')}>Publicar</Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => handleReplace(c)}>Substituir</Button>
                      <Button variant="secondary" size="sm" onClick={() => handleCompare(c)}>
                        <FileDiff className="w-3.5 h-3.5" />
                        Ver diferenças
                      </Button>
                      {c.estado !== 'Arquivado' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatus(c, 'Arquivado')}>
                          <Archive className="w-3.5 h-3.5" />
                          Arquivar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={uploadOpen} title="Carregar nova versão de critério (K09)" onClose={() => setUploadOpen(false)}>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prova" required>
              <select
                value={form.provaCodigo}
                onChange={(e) => {
                  const map: Record<string, string> = { '635': 'Matemática A', '639': 'Português', '715': 'Física e Química A' };
                  setForm({ ...form, provaCodigo: e.target.value, provaNome: map[e.target.value] || 'Prova' });
                }}
                className={inputClass}
              >
                <option value="635">635 · Matemática A</option>
                <option value="639">639 · Português</option>
                <option value="715">715 · Física e Química A</option>
              </select>
            </FormField>
            <FormField label="Versão" required>
              <input value={form.versao} onChange={(e) => setForm({ ...form, versao: e.target.value })} className={`${inputClass} font-mono`} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Documento de critério" required>
              <input value={form.documentoNome} onChange={(e) => setForm({ ...form, documentoNome: e.target.value })} placeholder="Criterios_635_v1.2.pdf" className={inputClass} />
            </FormField>
            <FormField label="Vigência" required>
              <input type="date" value={form.vigencia} onChange={(e) => setForm({ ...form, vigencia: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Resumo das alterações aprovadas" required>
            <textarea rows={3} value={form.resumoAlteracoes} onChange={(e) => setForm({ ...form, resumoAlteracoes: e.target.value })} className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Anexar versão</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!diffPair} title="Comparação entre versões de critérios" onClose={() => setDiffPair(null)} size="lg">
        {diffPair && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {diffPair.map((item, idx) => (
              <div key={item.id} className={`p-4 rounded-lg border ${idx === 1 ? 'border-[#087E91] bg-[#F0F9FA]' : 'border-slate-200 bg-slate-50'}`}>
                <div className="font-mono font-bold text-[#112A4A]">{item.versao} · {item.vigencia}</div>
                <div className="text-[#536477] mt-1">{item.documentoNome}</div>
                <p className="mt-2 font-medium text-[#112A4A]">{item.resumoAlteracoes}</p>
                <ul className="mt-3 list-disc pl-4 space-y-1 text-[#536477]">
                  {item.regrasChave.map((r, ri) => (
                    <li key={ri}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};
