import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import { ExamLot, GraderProfile, LotAssignment } from '../types/sigen';
import {
  Button,
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

/* ============================================================================
 * K01 · Painel de classificações
 * ========================================================================== */
export const K01ClassificationsDashboardScreen: React.FC = () => {
  const { state, activeInstitutionId, activeInstitution, activeYear, activePhase, currentUser, navigate, openPrintDoc, refreshSync } = useSigen();
  const [provaFilter, setProvaFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  const lots = state.lots.filter(
    (l) =>
      l.institutionId === activeInstitutionId &&
      (!provaFilter || l.provaCodigo === provaFilter) &&
      (!estadoFilter || l.estado === estadoFilter)
  );
  const proofs = state.proofGradings.filter(
    (p) => p.institutionId === activeInstitutionId && (!provaFilter || p.provaCodigo === provaFilter)
  );
  const results = state.results.filter(
    (r) => r.institutionId === activeInstitutionId && (!provaFilter || r.provaCodigo === provaFilter)
  );

  const officialResults = results.filter((r) => r.origem === 'Fonte oficial');
  const localAdminMetrics = {
    totalProvasRecebidas: lots.reduce((sum, l) => sum + l.quantidade, 0),
    lotesDivergentes: lots.filter((l) => l.estado === 'Divergência').length,
    provasSubmetidas: proofs.filter((p) => p.estado === 'Submetido' || p.estado === 'Confirmado').length,
    pendenciasConferencia: proofs.filter((p) => p.estado === 'Submetido').length,
  };

  const handleExport = () => {
    openPrintDoc({
      title: 'Relatório do Painel de Classificações (K01)',
      docCode: 'K01-PAINEL',
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Indicadores Administrativos (Operação Local)',
          rows: [
            { label: 'Ano / Fase', value: `${activeYear} · ${activePhase}` },
            { label: 'Lotes registados', value: String(lots.length) },
            { label: 'Volume total de provas em lotes', value: String(localAdminMetrics.totalProvasRecebidas) },
            { label: 'Divergências em custódia', value: String(localAdminMetrics.lotesDivergentes) },
            { label: 'Provas pendentes de conferência (K08)', value: String(localAdminMetrics.pendenciasConferencia) },
          ],
        },
        {
          heading: 'Resultados Oficiais (Separados dos Indicadores Administrativos)',
          rows: [
            { label: 'Resultados de fonte oficial validada', value: String(officialResults.length) },
            { label: 'Resultados locais / exemplo', value: String(results.length - officialResults.length) },
          ],
          note: 'Conforme especificação K01, indicadores administrativos locais nunca são misturados com resultados oficiais homologados.',
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K01"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refreshSync}>
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('K08')}>
              Abrir pendências ({localAdminMetrics.pendenciasConferencia + localAdminMetrics.lotesDivergentes})
            </Button>
            <Button variant="teal" size="sm" onClick={() => navigate('K02')}>
              Ver lotes (K02)
            </Button>
            <Button variant="primary" size="sm" onClick={handleExport}>
              <FileText className="w-3.5 h-3.5" />
              Exportar resumo (PDF)
            </Button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="w-52">
          <FormField label="Prova (opcional)">
            <select value={provaFilter} onChange={(e) => setProvaFilter(e.target.value)} className={inputClass}>
              <option value="">Todas as provas</option>
              <option value="635">635 · Matemática A</option>
              <option value="639">639 · Português</option>
              <option value="715">715 · Física e Química A</option>
              <option value="712">712 · Economia A</option>
            </select>
          </FormField>
        </div>
        <div className="w-52">
          <FormField label="Estado de lote (opcional)">
            <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className={inputClass}>
              <option value="">Todos os estados</option>
              <option value="Recebido">Recebido</option>
              <option value="Conferido">Conferido</option>
              <option value="Em distribuição">Em distribuição</option>
              <option value="Divergência">Divergência</option>
            </select>
          </FormField>
        </div>
      </div>

      {/* Explicit separation: Administrative vs Official */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#112A4A]">
                Indicadores Administrativos (Locais)
              </h2>
              <p className="text-xs text-[#536477]">Controlo de custódia, distribuição e correção interna</p>
            </div>
            <span className="text-xs font-mono text-[#087E91]">Operação local</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200">
              <div className="text-xs text-[#536477]">Lotes rececionados</div>
              <div className="font-display text-2xl font-bold text-[#112A4A] tabular-nums mt-1">{lots.length}</div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200">
              <div className="text-xs text-[#536477]">Volume de provas</div>
              <div className="font-display text-2xl font-bold text-[#087E91] tabular-nums mt-1">
                {localAdminMetrics.totalProvasRecebidas}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200">
              <div className="text-xs text-[#536477]">Divergências abertas</div>
              <div className="font-display text-2xl font-bold text-[#B91C1C] tabular-nums mt-1">
                {localAdminMetrics.lotesDivergentes}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200">
              <div className="text-xs text-[#536477]">Por conferir (K08)</div>
              <div className="font-display text-2xl font-bold text-[#D99A00] tabular-nums mt-1">
                {localAdminMetrics.pendenciasConferencia}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#112A4A]">
                Resultados Oficiais vs. Simulação
              </h2>
              <p className="text-xs text-[#536477]">Separação estrita de classificações homologadas</p>
            </div>
            <span className="text-xs font-mono text-[#398B58]">Rastreável</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200">
              <div className="text-xs text-[#536477]">Fonte oficial autorizada</div>
              <div className="font-display text-2xl font-bold text-[#398B58] tabular-nums mt-1">
                {officialResults.length}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200">
              <div className="text-xs text-[#536477]">Dados locais / exemplo</div>
              <div className="font-display text-2xl font-bold text-[#536477] tabular-nums mt-1">
                {results.length - officialResults.length}
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-between pt-2">
              <span className="text-xs text-[#536477]">
                Consulte detalhes e histórico auditado em K11.
              </span>
              <Button variant="secondary" size="sm" onClick={() => navigate('K11')}>
                Abrir K11
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

/* ============================================================================
 * K02 · Receção e cadeia de custódia
 * ========================================================================== */
export const K02CustodyScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, activeInstitution, activeYear, activePhase, currentUser, logAudit, toast, openPrintDoc, isPhaseClosed } = useSigen();
  const lots = state.lots.filter((l) => l.institutionId === activeInstitutionId);
  const [selectedLotId, setSelectedLotId] = useState<string>(lots[0]?.id || '');
  const selectedLot = lots.find((l) => l.id === selectedLotId) || lots[0] || null;

  const [newOpen, setNewOpen] = useState(false);
  const [actionModal, setActionModal] = useState<'conferir' | 'transferir' | 'divergencia' | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [actionQty, setActionQty] = useState(0);

  const [form, setForm] = useState({
    codigoLote: `LT-2026-635-${String(lots.length + 1).padStart(2, '0')}`,
    provaCodigo: '635',
    provaNome: 'Matemática A',
    origem: 'Secretariado Local · Sala A01',
    quantidade: 25,
  });

  const handleRegisterLot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigoLote.trim() || form.quantidade <= 0) {
      toast({ type: 'error', title: 'Dados de lote inválidos' });
      return;
    }
    const created: ExamLot = {
      id: `lot-${Date.now()}`,
      institutionId: activeInstitutionId,
      codigoLote: form.codigoLote,
      provaCodigo: form.provaCodigo,
      provaNome: form.provaNome,
      anoLetivo: activeYear,
      fase: activePhase,
      origem: form.origem,
      quantidade: Number(form.quantidade),
      dataHora: nowIso(),
      responsavel: currentUser?.nome || 'Secretariado',
      estado: 'Recebido',
      eventos: [
        {
          id: `ev-${Date.now()}`,
          dataHora: nowIso(),
          tipo: 'Receção',
          responsavel: currentUser?.nome || 'Secretariado',
          observacao: `Receção registada (${form.quantidade} provas) de ${form.origem}.`,
        },
      ],
    };
    updateState((prev) => ({ ...prev, lots: [created, ...prev.lots] }));
    logAudit({
      entidade: created.codigoLote,
      ecra: 'K02',
      acao: 'Registo de receção de lote',
      detalhe: `${created.quantidade} provas de ${created.provaCodigo} · ${created.provaNome}.`,
    });
    setSelectedLotId(created.id);
    setNewOpen(false);
    toast({ type: 'success', title: `Lote ${created.codigoLote} rececionado` });
  };

  const handleCustodyAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot || !actionModal) return;

    if (actionModal === 'conferir') {
      const hasDiff = actionQty !== selectedLot.quantidade;
      const nextEstado: ExamLot['estado'] = hasDiff ? 'Divergência' : 'Conferido';
      updateState((prev) => ({
        ...prev,
        lots: prev.lots.map((l) =>
          l.id === selectedLot.id
            ? {
                ...l,
                quantidadeConferida: actionQty,
                estado: nextEstado,
                eventos: [
                  ...l.eventos,
                  {
                    id: `ev-${Date.now()}`,
                    dataHora: nowIso(),
                    tipo: hasDiff ? 'Divergência' : 'Conferência',
                    responsavel: currentUser?.nome || 'Secretariado',
                    quantidadeConferida: actionQty,
                    observacao:
                      actionValue.trim() ||
                      (hasDiff
                        ? `Divergência detetada: ${actionQty} conferidas vs ${l.quantidade} declaradas. Requer dupla conferência.`
                        : `Quantidades conferidas sem diferença (${actionQty}/${l.quantidade}).`),
                  },
                ],
              }
            : l
        ),
      }));
      logAudit({
        entidade: selectedLot.codigoLote,
        ecra: 'K02',
        acao: hasDiff ? 'Divergência em conferência' : 'Conferência de quantidades',
        detalhe: `Contagem: ${actionQty} / Esperado: ${selectedLot.quantidade}.`,
      });
      toast({
        type: hasDiff ? 'warning' : 'success',
        title: hasDiff ? 'Divergência sinalizada (dupla conferência necessária)' : 'Quantidades conferidas',
      });
    } else if (actionModal === 'transferir') {
      if (!actionValue.trim()) {
        toast({ type: 'error', title: 'Indique o destino da transferência' });
        return;
      }
      updateState((prev) => ({
        ...prev,
        lots: prev.lots.map((l) =>
          l.id === selectedLot.id
            ? {
                ...l,
                estado: 'Transferido',
                eventos: [
                  ...l.eventos,
                  {
                    id: `ev-${Date.now()}`,
                    dataHora: nowIso(),
                    tipo: 'Transferência',
                    responsavel: currentUser?.nome || 'Secretariado',
                    destino: actionValue,
                    observacao: `Transferido para ${actionValue}.`,
                  },
                ],
              }
            : l
        ),
      }));
      logAudit({
        entidade: selectedLot.codigoLote,
        ecra: 'K02',
        acao: 'Transferência de custódia',
        detalhe: `Destino registado: ${actionValue}`,
      });
      toast({ type: 'success', title: 'Transferência registada no trilho append-only' });
    } else if (actionModal === 'divergencia') {
      if (!actionValue.trim()) {
        toast({ type: 'error', title: 'Descreva a divergência encontrada' });
        return;
      }
      updateState((prev) => ({
        ...prev,
        lots: prev.lots.map((l) =>
          l.id === selectedLot.id
            ? {
                ...l,
                estado: 'Divergência',
                eventos: [
                  ...l.eventos,
                  {
                    id: `ev-${Date.now()}`,
                    dataHora: nowIso(),
                    tipo: 'Divergência',
                    responsavel: currentUser?.nome || 'Secretariado',
                    observacao: actionValue,
                  },
                ],
              }
            : l
        ),
        incidents: [
          {
            id: `inc-${Date.now()}`,
            institutionId: activeInstitutionId,
            dataHora: nowIso(),
            tipo: 'Divergência custódia',
            descricao: `Lote ${selectedLot.codigoLote}: ${actionValue}`,
            responsavel: currentUser?.nome || 'Secretariado',
            estado: 'Aberto',
          },
          ...prev.incidents,
        ],
      }));
      logAudit({
        entidade: selectedLot.codigoLote,
        ecra: 'K02',
        acao: 'Sinalização de divergência',
        detalhe: actionValue,
        sensivel: true,
      });
      toast({ type: 'warning', title: 'Incidente de divergência aberto' });
    }
    setActionModal(null);
    setActionValue('');
  };

  const handleEmitTerm = (lot: ExamLot) => {
    openPrintDoc({
      title: `Termo de Receção e Cadeia de Custódia — ${lot.codigoLote}`,
      docCode: `K02-${lot.codigoLote}`,
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Identificação do Lote',
          rows: [
            { label: 'Lote', value: lot.codigoLote },
            { label: 'Prova / Código', value: `${lot.provaCodigo} · ${lot.provaNome}` },
            { label: 'Fase / Ano', value: `${lot.fase} (${lot.anoLetivo})` },
            { label: 'Origem', value: lot.origem },
            { label: 'Quantidade declarada / conferida', value: `${lot.quantidade} / ${lot.quantidadeConferida ?? 'Pendente'}` },
            { label: 'Estado atual', value: lot.estado },
          ],
        },
        {
          heading: 'Histórico Append-Only de Movimentos',
          table: {
            headers: ['Data/Hora', 'Movimento', 'Responsável', 'Observação'],
            rows: lot.eventos.map((ev) => [formatDateTimePT(ev.dataHora), ev.tipo, ev.responsavel, ev.observacao]),
          },
          note: 'Registo de controlo da cadeia de custódia.',
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K02"
        actions={
          <Button variant="primary" size="sm" onClick={() => setNewOpen(true)} disabled={isPhaseClosed}>
            <Plus className="w-4 h-4" />
            Registar receção
          </Button>
        }
      />

      <NoticeBar tone="info" title="Regra de custódia">
        Histórico estritamente append-only (sem eliminação de movimentos). Divergências exigem dupla
        conferência e geram incidente auditável.
      </NoticeBar>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                  <th className="text-left py-3 px-4 font-semibold">Lote</th>
                  <th className="text-left py-3 px-3 font-semibold">Prova</th>
                  <th className="text-right py-3 px-3 font-semibold">Qtd.</th>
                  <th className="text-left py-3 px-3 font-semibold">Estado</th>
                  <th className="text-right py-3 px-4 font-semibold">Termo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lots.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLotId(l.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedLot?.id === l.id ? 'bg-[#F0F9FA]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#112A4A]">{l.codigoLote}</td>
                    <td className="py-3 px-3 text-xs">
                      <div className="font-semibold text-[#112A4A]">{l.provaCodigo} · {l.provaNome}</div>
                      <div className="text-[#536477]">{l.origem}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      {l.quantidadeConferida ?? '—'}/{l.quantidade}
                    </td>
                    <td className="py-3 px-3">
                      <StatusLabel status={l.estado} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEmitTerm(l);
                        }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Emitir termo
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Custody timeline & actions */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          {selectedLot ? (
            <>
              <div className="border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#087E91]">{selectedLot.codigoLote}</span>
                  <StatusLabel status={selectedLot.estado} />
                </div>
                <h2 className="font-display text-base font-bold text-[#112A4A] mt-1">
                  {selectedLot.provaCodigo} · {selectedLot.provaNome}
                </h2>
                <div className="text-xs text-[#536477] mt-1">
                  Responsável: {selectedLot.responsavel} · {formatDateTimePT(selectedLot.dataHora)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="teal"
                  size="sm"
                  disabled={isPhaseClosed}
                  onClick={() => {
                    setActionQty(selectedLot.quantidade);
                    setActionValue('');
                    setActionModal('conferir');
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Conferir quantidades
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isPhaseClosed}
                  onClick={() => {
                    setActionValue('');
                    setActionModal('transferir');
                  }}
                >
                  Transferir
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isPhaseClosed}
                  onClick={() => {
                    setActionValue('');
                    setActionModal('divergencia');
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Sinalizar divergência
                </Button>
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#112A4A] mb-3">
                  Movimentos append-only ({selectedLot.eventos.length})
                </h3>
                <ol className="space-y-3">
                  {selectedLot.eventos.map((ev) => (
                    <li key={ev.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#112A4A]">{ev.tipo}</span>
                        <span className="text-[#536477] tabular-nums">{formatDateTimePT(ev.dataHora)}</span>
                      </div>
                      <p className="text-[#536477] mt-1">{ev.observacao}</p>
                      <div className="text-[11px] text-slate-500 mt-1">Responsável: {ev.responsavel}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <div className="text-sm text-[#536477]">Selecione um lote para ver a cadeia de custódia.</div>
          )}
        </div>
      </div>

      <Modal open={newOpen} title="Registar receção de lote (K02)" onClose={() => setNewOpen(false)}>
        <form onSubmit={handleRegisterLot} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Identificador do lote" required>
              <input value={form.codigoLote} onChange={(e) => setForm({ ...form, codigoLote: e.target.value })} className={`${inputClass} font-mono`} />
            </FormField>
            <FormField label="Quantidade de provas" required>
              <input type="number" min={1} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Código de prova" required>
              <select
                value={form.provaCodigo}
                onChange={(e) => {
                  const map: Record<string, string> = { '635': 'Matemática A', '639': 'Português', '715': 'Física e Química A', '702': 'Biologia e Geologia' };
                  setForm({ ...form, provaCodigo: e.target.value, provaNome: map[e.target.value] || 'Prova' });
                }}
                className={inputClass}
              >
                <option value="635">635 · Matemática A</option>
                <option value="639">639 · Português</option>
                <option value="715">715 · Física e Química A</option>
                <option value="702">702 · Biologia e Geologia</option>
              </select>
            </FormField>
            <FormField label="Origem (se permitido)">
              <input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Registar receção</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!actionModal}
        title={
          actionModal === 'conferir'
            ? 'Conferir quantidades do lote'
            : actionModal === 'transferir'
              ? 'Transferir lote em custódia'
              : 'Sinalizar divergência'
        }
        subtitle={selectedLot?.codigoLote}
        onClose={() => setActionModal(null)}
      >
        <form onSubmit={handleCustodyAction} className="space-y-4">
          {actionModal === 'conferir' && (
            <FormField label={`Quantidade conferida (declarada: ${selectedLot?.quantidade})`} required>
              <input type="number" min={0} value={actionQty} onChange={(e) => setActionQty(Number(e.target.value))} className={`${inputClass} font-mono`} />
            </FormField>
          )}
          <FormField
            label={actionModal === 'transferir' ? 'Destino da transferência' : 'Observação / Fundamentação'}
            required={actionModal !== 'conferir'}
          >
            <textarea rows={3} value={actionValue} onChange={(e) => setActionValue(e.target.value)} className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setActionModal(null)}>Cancelar</Button>
            <Button type="submit" variant={actionModal === 'divergencia' ? 'danger' : 'primary'}>Confirmar registo</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K03 · Identificação anónima e associação restrita
 * ========================================================================== */
export const K03AnonymousIdScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast } = useSigen();
  const mappings = state.anonymousMappings.filter((m) => m.institutionId === activeInstitutionId);
  const lots = state.lots.filter((l) => l.institutionId === activeInstitutionId);

  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [revealTarget, setRevealTarget] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [genForm, setGenForm] = useState({ loteCodigo: lots[0]?.codigoLote || 'LT-2026-635-01', nomeAlunoReal: '' });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.nomeAlunoReal.trim()) return;
    const lot = lots.find((l) => l.codigoLote === genForm.loteCodigo) || lots[0];
    const code = `ANON-${lot?.provaCodigo || '635'}-${String(mappings.length + 101).slice(-3)}`;
    const created = {
      id: `an-${Date.now()}`,
      institutionId: activeInstitutionId,
      codigoAnonimo: code,
      provaCodigo: lot?.provaCodigo || '635',
      provaNome: lot?.provaNome || 'Matemática A',
      loteCodigo: lot?.codigoLote || genForm.loteCodigo,
      referenciaIdentidade: `KEY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      nomeAlunoReal: genForm.nomeAlunoReal,
      estadoAnonimizacao: 'Associado' as const,
      revelacoes: [],
    };
    updateState((prev) => ({ ...prev, anonymousMappings: [created, ...prev.anonymousMappings] }));
    logAudit({
      entidade: created.codigoAnonimo,
      ecra: 'K03',
      acao: 'Geração de código anónimo local',
      detalhe: `Associado ao lote ${created.loteCodigo}. Chave protegida gerada.`,
      sensivel: true,
    });
    setNewOpen(false);
    setGenForm({ ...genForm, nomeAlunoReal: '' });
    toast({ type: 'success', title: `Código anónimo ${code} gerado` });
  };

  const handleCheckDuplicates = () => {
    const codes = mappings.map((m) => m.codigoAnonimo);
    const hasDup = new Set(codes).size !== codes.length;
    toast({
      type: hasDup ? 'error' : 'success',
      title: hasDup ? 'Duplicados detetados!' : 'Verificação concluída: 0 códigos duplicados',
      detail: `${mappings.length} associações verificadas.`,
    });
  };

  const handleBlock = (id: string, code: string) => {
    updateState((prev) => ({
      ...prev,
      anonymousMappings: prev.anonymousMappings.map((m) =>
        m.id === id ? { ...m, estadoAnonimizacao: 'Bloqueado', bloqueadoPor: currentUser?.nome } : m
      ),
    }));
    logAudit({
      entidade: code,
      ecra: 'K03',
      acao: 'Bloqueio de associação anónima',
      detalhe: 'Associação bloqueada para consulta durante classificação.',
      sensivel: true,
    });
    toast({ type: 'info', title: `Associação ${code} bloqueada` });
  };

  const handleConfirmReveal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revealTarget || !revealReason.trim()) {
      toast({ type: 'error', title: 'Motivo formal obrigatório para revelar identidade' });
      return;
    }
    const target = mappings.find((m) => m.id === revealTarget);
    setRevealedIds((prev) => ({ ...prev, [revealTarget]: true }));
    updateState((prev) => ({
      ...prev,
      anonymousMappings: prev.anonymousMappings.map((m) =>
        m.id === revealTarget
          ? {
              ...m,
              revelacoes: [
                { dataHora: nowIso(), autor: currentUser?.nome || 'Autorizado', motivo: revealReason },
                ...m.revelacoes,
              ],
            }
          : m
      ),
    }));
    logAudit({
      entidade: target?.codigoAnonimo || revealTarget,
      ecra: 'K03',
      acao: 'Revelação de identidade restrita',
      detalhe: `Motivo registado: ${revealReason}`,
      motivoAcesso: revealReason,
      sensivel: true,
    });
    setRevealTarget(null);
    setRevealReason('');
    toast({ type: 'warning', title: 'Identidade revelada e registada na auditoria C07' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K03"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleCheckDuplicates}>
              <ShieldCheck className="w-3.5 h-3.5" />
              Verificar duplicados
            </Button>
            <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
              <KeyRound className="w-3.5 h-3.5" />
              Gerar código local
            </Button>
          </>
        }
      />

      <NoticeBar tone="warning" title="Associação estritamente protegida">
        O mapeamento entre código anónimo e identidade pessoal nunca é disponibilizado aos
        classificadores. Cada revelação exige fundamento explícito e é auditada de forma imutável.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Código anónimo</th>
                <th className="text-left py-3 px-4 font-semibold">Prova / Lote</th>
                <th className="text-left py-3 px-4 font-semibold">Referência de identidade</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {mappings.map((m) => {
                const isRevealed = !!revealedIds[m.id];
                return (
                  <tr key={m.id}>
                    <td className="py-3 px-5 font-mono text-xs font-bold text-[#112A4A]">{m.codigoAnonimo}</td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-[#112A4A]">{m.provaCodigo} · {m.provaNome}</div>
                      <div className="font-mono text-[#536477]">{m.loteCodigo}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {isRevealed ? (
                        <div>
                          <div className="font-semibold text-[#B91C1C]">{m.nomeAlunoReal}</div>
                          <div className="font-mono text-[11px] text-[#536477]">{m.referenciaIdentidade}</div>
                        </div>
                      ) : (
                        <span className="font-mono text-[#536477]">•••••••••••• (Chave protegida)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel status={m.estadoAnonimizacao} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {m.estadoAnonimizacao !== 'Bloqueado' && (
                          <Button variant="secondary" size="sm" onClick={() => handleBlock(m.id, m.codigoAnonimo)}>
                            <Lock className="w-3.5 h-3.5" />
                            Bloquear associação
                          </Button>
                        )}
                        {isRevealed ? (
                          <Button variant="ghost" size="sm" onClick={() => setRevealedIds((p) => ({ ...p, [m.id]: false }))}>
                            Ocultar
                          </Button>
                        ) : (
                          <Button variant="danger" size="sm" onClick={() => setRevealTarget(m.id)}>
                            <Eye className="w-3.5 h-3.5" />
                            Revelar identidade
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} title="Gerar código anónimo local" onClose={() => setNewOpen(false)}>
        <form onSubmit={handleGenerate} className="space-y-4">
          <FormField label="Lote" required>
            <select value={genForm.loteCodigo} onChange={(e) => setGenForm({ ...genForm, loteCodigo: e.target.value })} className={inputClass}>
              {lots.map((l) => (
                <option key={l.id} value={l.codigoLote}>{l.codigoLote} · {l.provaNome}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Referência do aluno (fictício / teste)" required>
            <input value={genForm.nomeAlunoReal} onChange={(e) => setGenForm({ ...genForm, nomeAlunoReal: e.target.value })} placeholder="Ex.: Inês Castro (Proc. 2026-042)" className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Gerar e proteger</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!revealTarget} title="Autorização de revelação de identidade" subtitle="Esta operação é auditada e irreversível no trilho C07." onClose={() => setRevealTarget(null)}>
        <form onSubmit={handleConfirmReveal} className="space-y-4">
          <FormField label="Motivo formal da revelação" required>
            <textarea rows={3} value={revealReason} onChange={(e) => setRevealReason(e.target.value)} placeholder="Ex.: Cumprimento de pedido de consulta Modelo 09 validado (CONS-2026-001)" className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRevealTarget(null)}>Cancelar</Button>
            <Button type="submit" variant="danger">Confirmar revelação</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K04 · Cadastro de classificadores
 * ========================================================================== */
export const K04GradersScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, logAudit, toast, confirmAction } = useSigen();
  const graders = state.graders.filter((g) => g.institutionId === activeInstitutionId);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GraderProfile | null>(null);
  const [historyGrader, setHistoryGrader] = useState<GraderProfile | null>(null);

  const [form, setForm] = useState({
    nome: '',
    identificadorProfissional: '',
    disciplinas: '635 · Matemática A',
    disponibilidadeInicio: '2026-06-15',
    disponibilidadeFim: '2026-12-20',
    impedimentos: '',
    perfilAutorizado: 'Classificador 1.ª Linha' as GraderProfile['perfilAutorizado'],
  });

  const filtered = graders.filter(
    (g) =>
      !search.trim() ||
      g.nome.toLowerCase().includes(search.toLowerCase()) ||
      g.identificadorProfissional.toLowerCase().includes(search.toLowerCase()) ||
      g.disciplinas.join(' ').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm({
      nome: '',
      identificadorProfissional: '',
      disciplinas: '635 · Matemática A',
      disponibilidadeInicio: '2026-06-15',
      disponibilidadeFim: '2026-12-20',
      impedimentos: '',
      perfilAutorizado: 'Classificador 1.ª Linha',
    });
    setModalOpen(true);
  };

  const openEdit = (g: GraderProfile) => {
    setEditing(g);
    setForm({
      nome: g.nome,
      identificadorProfissional: g.identificadorProfissional,
      disciplinas: g.disciplinas.join(', '),
      disponibilidadeInicio: g.disponibilidadeInicio,
      disponibilidadeFim: g.disponibilidadeFim,
      impedimentos: g.impedimentos.join(', '),
      perfilAutorizado: g.perfilAutorizado,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.identificadorProfissional.trim()) return;
    const discArr = form.disciplinas.split(',').map((s) => s.trim()).filter(Boolean);
    const impArr = form.impedimentos.split(',').map((s) => s.trim()).filter(Boolean);

    if (editing) {
      updateState((prev) => ({
        ...prev,
        graders: prev.graders.map((g) =>
          g.id === editing.id
            ? {
                ...g,
                nome: form.nome,
                identificadorProfissional: form.identificadorProfissional,
                disciplinas: discArr,
                disponibilidadeInicio: form.disponibilidadeInicio,
                disponibilidadeFim: form.disponibilidadeFim,
                impedimentos: impArr,
                perfilAutorizado: form.perfilAutorizado,
                historico: [`${nowIso().slice(0, 10)}: Cadastro atualizado.`, ...g.historico],
              }
            : g
        ),
      }));
      toast({ type: 'success', title: 'Classificador atualizado' });
    } else {
      const created: GraderProfile = {
        id: `grd-${Date.now()}`,
        institutionId: activeInstitutionId,
        nome: form.nome,
        identificadorProfissional: form.identificadorProfissional,
        disciplinas: discArr,
        disponibilidadeInicio: form.disponibilidadeInicio,
        disponibilidadeFim: form.disponibilidadeFim,
        impedimentos: impArr,
        perfilAutorizado: form.perfilAutorizado,
        estado: 'Ativo',
        historico: [`${nowIso().slice(0, 10)}: Registo criado no cadastro.`],
      };
      updateState((prev) => ({ ...prev, graders: [created, ...prev.graders] }));
      logAudit({ entidade: created.nome, ecra: 'K04', acao: 'Adição de classificador', detalhe: created.identificadorProfissional });
      toast({ type: 'success', title: 'Classificador adicionado' });
    }
    setModalOpen(false);
  };

  const handleSuspend = (g: GraderProfile) => {
    confirmAction({
      title: g.estado === 'Ativo' ? 'Suspender elegibilidade?' : 'Reativar classificador?',
      message: `Confirmar alteração de estado para ${g.nome}?`,
      confirmLabel: g.estado === 'Ativo' ? 'Suspender' : 'Reativar',
      danger: g.estado === 'Ativo',
      onConfirm: () => {
        const next = g.estado === 'Ativo' ? 'Suspenso' : 'Ativo';
        updateState((prev) => ({
          ...prev,
          graders: prev.graders.map((x) => (x.id === g.id ? { ...x, estado: next } : x)),
        }));
        toast({ type: 'warning', title: `${g.nome}: ${next}` });
      },
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K04"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportCSV(
                  'lista_classificadores_k04',
                  ['Nome', 'Identificador', 'Disciplinas', 'Disponibilidade', 'Impedimentos', 'Perfil', 'Estado'],
                  graders.map((g) => [
                    g.nome,
                    g.identificadorProfissional,
                    g.disciplinas.join(' | '),
                    `${g.disponibilidadeInicio} a ${g.disponibilidadeFim}`,
                    g.impedimentos.join(' | '),
                    g.perfilAutorizado,
                    g.estado,
                  ])
                )
              }
            >
              Exportar CSV
            </Button>
            <Button variant="primary" size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4" />
              Adicionar classificador
            </Button>
          </>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar docente, identificador ou disciplina..." />

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Docente / ID Profissional</th>
                <th className="text-left py-3 px-4 font-semibold">Disciplinas</th>
                <th className="text-left py-3 px-4 font-semibold">Disponibilidade</th>
                <th className="text-left py-3 px-4 font-semibold">Impedimentos</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5">
                    <div className="font-semibold text-[#112A4A]">{g.nome}</div>
                    <div className="text-xs font-mono text-[#536477]">{g.identificadorProfissional} · {g.perfilAutorizado}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#112A4A]">{g.disciplinas.join(' · ')}</td>
                  <td className="py-3 px-4 text-xs text-[#536477] tabular-nums whitespace-nowrap">
                    {g.disponibilidadeInicio} → {g.disponibilidadeFim}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#536477]">
                    {g.impedimentos.length > 0 ? g.impedimentos.join('; ') : 'Sem impedimentos declarados'}
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={g.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setHistoryGrader(g)}>Ver histórico</Button>
                      <Button variant="secondary" size="sm" onClick={() => openEdit(g)}>Editar</Button>
                      <Button variant="secondary" size="sm" onClick={() => handleSuspend(g)}>
                        {g.estado === 'Ativo' ? 'Suspender' : 'Reativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} title={editing ? 'Editar classificador' : 'Adicionar classificador'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nome" required>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Identificador profissional" required>
              <input value={form.identificadorProfissional} onChange={(e) => setForm({ ...form, identificadorProfissional: e.target.value })} className={`${inputClass} font-mono`} />
            </FormField>
          </div>
          <FormField label="Disciplinas (separadas por vírgula)" required>
            <input value={form.disciplinas} onChange={(e) => setForm({ ...form, disciplinas: e.target.value })} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Disponibilidade início" required>
              <input type="date" value={form.disponibilidadeInicio} onChange={(e) => setForm({ ...form, disponibilidadeInicio: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Disponibilidade fim" required>
              <input type="date" value={form.disponibilidadeFim} onChange={(e) => setForm({ ...form, disponibilidadeFim: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Impedimentos (separados por vírgula)" conditional>
            <input value={form.impedimentos} onChange={(e) => setForm({ ...form, impedimentos: e.target.value })} placeholder="Ex.: Escola X, Turma Y" className={inputClass} />
          </FormField>
          <FormField label="Perfil autorizado" required>
            <select value={form.perfilAutorizado} onChange={(e) => setForm({ ...form, perfilAutorizado: e.target.value as GraderProfile['perfilAutorizado'] })} className={inputClass}>
              <option value="Classificador 1.ª Linha">Classificador 1.ª Linha</option>
              <option value="Classificador Reapreciação">Classificador Reapreciação</option>
              <option value="Supervisor de Correção">Supervisor de Correção</option>
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!historyGrader} title="Histórico de competência e elegibilidade" subtitle={historyGrader?.nome} onClose={() => setHistoryGrader(null)}>
        <ul className="space-y-2 text-xs text-[#112A4A]">
          {historyGrader?.historico.map((h, i) => (
            <li key={i} className="p-3 bg-slate-50 border border-slate-200 rounded">{h}</li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K05 · Distribuição e reatribuição de lotes
 * ========================================================================== */
export const K05DistributionScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast } = useSigen();
  const assignments = state.assignments.filter((a) => a.institutionId === activeInstitutionId);
  const lots = state.lots.filter((l) => l.institutionId === activeInstitutionId);
  const graders = state.graders.filter((g) => g.institutionId === activeInstitutionId && g.estado === 'Ativo');

  const [form, setForm] = useState({
    loteId: lots[0]?.id || '',
    classificadorId: graders[0]?.id || '',
    dataLimite: '2026-11-30',
  });
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ id: string; mode: 'recusar' | 'reatribuir' } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reassignGraderId, setReassignGraderId] = useState(graders[0]?.id || '');

  const checkConflicts = (loteId: string, graderId: string): string[] => {
    const lot = lots.find((l) => l.id === loteId);
    const grader = graders.find((g) => g.id === graderId);
    const issues: string[] = [];
    if (!lot || !grader) return issues;
    if (!grader.disciplinas.some((d) => d.includes(lot.provaCodigo))) {
      issues.push(`Disciplina incompatível: ${grader.nome} não tem código ${lot.provaCodigo} no cadastro K04.`);
    }
    if (grader.impedimentos.some((imp) => lot.origem.toLowerCase().includes(imp.toLowerCase().split(' ')[0]))) {
      issues.push(`Impedimento declarado: conflito entre origem do lote (${lot.origem}) e impedimentos do classificador.`);
    }
    if (lot.estado === 'Divergência') {
      issues.push(`Lote ${lot.codigoLote} tem divergência aberta em K02 — resolver antes de atribuir.`);
    }
    return issues;
  };

  const handleCheckConflicts = () => {
    const issues = checkConflicts(form.loteId, form.classificadorId);
    if (issues.length === 0) {
      setConflictMsg('Sem incompatibilidades ou conflitos detetados para esta proposta.');
      toast({ type: 'success', title: 'Verificação de conflitos: conforme' });
    } else {
      setConflictMsg(issues.join(' '));
      toast({ type: 'warning', title: `${issues.length} conflito(s) detetado(s)` });
    }
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    const issues = checkConflicts(form.loteId, form.classificadorId);
    if (issues.length > 0) {
      setConflictMsg(issues.join(' '));
      toast({ type: 'error', title: 'Atribuição bloqueada por incompatibilidade' });
      return;
    }
    const lot = lots.find((l) => l.id === form.loteId);
    const grader = graders.find((g) => g.id === form.classificadorId);
    if (!lot || !grader) return;

    const created: LotAssignment = {
      id: `asg-${Date.now()}`,
      institutionId: activeInstitutionId,
      loteId: lot.id,
      loteCodigo: lot.codigoLote,
      provaCodigo: lot.provaCodigo,
      classificadorId: grader.id,
      classificadorNome: grader.nome,
      dataLimite: form.dataLimite,
      estado: 'Proposto',
      versao: 1,
      historico: [{ versao: 1, data: nowIso(), estado: 'Proposto', nota: `Proposto por ${currentUser?.nome}.` }],
    };
    updateState((prev) => ({ ...prev, assignments: [created, ...prev.assignments] }));
    logAudit({ entidade: lot.codigoLote, ecra: 'K05', acao: 'Proposta de atribuição', detalhe: `Proposto a ${grader.nome} até ${form.dataLimite}.` });
    toast({ type: 'success', title: 'Lote proposto para aceitação' });
  };

  const handleAccept = (a: LotAssignment) => {
    updateState((prev) => ({
      ...prev,
      assignments: prev.assignments.map((x) =>
        x.id === a.id
          ? {
              ...x,
              estado: 'Aceite',
              historico: [{ versao: x.versao, data: nowIso(), estado: 'Aceite', nota: `Confirmado por ${currentUser?.nome}.` }, ...x.historico],
            }
          : x
      ),
    }));
    logAudit({ entidade: a.loteCodigo, ecra: 'K05', acao: 'Aceitação de lote', detalhe: `Aceite por ${currentUser?.nome}.` });
    toast({ type: 'success', title: `Atribuição do lote ${a.loteCodigo} aceite` });
  };

  const handleConfirmReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonModal || !reasonText.trim()) {
      toast({ type: 'error', title: 'Fundamentação / motivo obrigatório' });
      return;
    }
    const target = assignments.find((a) => a.id === reasonModal.id);
    if (!target) return;

    if (reasonModal.mode === 'recusar') {
      updateState((prev) => ({
        ...prev,
        assignments: prev.assignments.map((x) =>
          x.id === target.id
            ? {
                ...x,
                estado: 'Recusado',
                motivoReatribuicao: reasonText,
                historico: [{ versao: x.versao, data: nowIso(), estado: 'Recusado', nota: reasonText }, ...x.historico],
              }
            : x
        ),
      }));
      toast({ type: 'warning', title: 'Atribuição recusada com fundamentação registada' });
    } else {
      const nextGrader = graders.find((g) => g.id === reassignGraderId);
      const nextVer = target.versao + 1;
      updateState((prev) => ({
        ...prev,
        assignments: prev.assignments.map((x) =>
          x.id === target.id
            ? {
                ...x,
                classificadorId: nextGrader?.id || x.classificadorId,
                classificadorNome: nextGrader?.nome || x.classificadorNome,
                estado: 'Reatribuído',
                motivoReatribuicao: reasonText,
                versao: nextVer,
                historico: [
                  { versao: nextVer, data: nowIso(), estado: 'Reatribuído', nota: `Para ${nextGrader?.nome}: ${reasonText}` },
                  ...x.historico,
                ],
              }
            : x
        ),
      }));
      logAudit({ entidade: target.loteCodigo, ecra: 'K05', acao: `Reatribuição de lote (v${nextVer})`, detalhe: reasonText });
      toast({ type: 'success', title: `Lote reatribuído (v${nextVer})` });
    }
    setReasonModal(null);
    setReasonText('');
  };

  return (
    <div className="space-y-6">
      <ScreenHeader screenId="K05" />

      <NoticeBar tone="warning" title="Modo operacional mediante autorização">
        O SIGEN não atribui automaticamente provas oficiais sem autorização expressa. A distribuição
        impede incompatibilidades declaradas no cadastro K04 e preserva o histórico de reatribuições.
      </NoticeBar>

      {/* Propose assignment bar */}
      <form onSubmit={handleAssign} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <FormField label="Lote" required>
            <select value={form.loteId} onChange={(e) => setForm({ ...form, loteId: e.target.value })} className={inputClass}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>{l.codigoLote} ({l.provaCodigo})</option>
              ))}
            </select>
          </FormField>
          <FormField label="Classificador" required>
            <select value={form.classificadorId} onChange={(e) => setForm({ ...form, classificadorId: e.target.value })} className={inputClass}>
              {graders.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Data limite" required>
            <input type="date" value={form.dataLimite} onChange={(e) => setForm({ ...form, dataLimite: e.target.value })} className={inputClass} />
          </FormField>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleCheckConflicts}>Ver conflitos</Button>
            <Button type="submit" variant="primary">Atribuir</Button>
          </div>
        </div>
        {conflictMsg && (
          <NoticeBar tone={conflictMsg.startsWith('Sem') ? 'info' : 'danger'}>{conflictMsg}</NoticeBar>
        )}
      </form>

      {/* Assignments list */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Lote / Versão</th>
                <th className="text-left py-3 px-4 font-semibold">Classificador</th>
                <th className="text-left py-3 px-4 font-semibold">Data limite</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5 font-mono text-xs font-semibold text-[#112A4A]">
                    {a.loteCodigo} <span className="text-[#087E91]">v{a.versao}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#112A4A]">{a.classificadorNome}</div>
                    {a.motivoReatribuicao && (
                      <div className="text-xs text-[#536477]">Motivo: {a.motivoReatribuicao}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{a.dataLimite}</td>
                  <td className="py-3 px-4"><StatusLabel status={a.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {a.estado === 'Proposto' && (
                        <>
                          <Button variant="teal" size="sm" onClick={() => handleAccept(a)}>
                            <UserCheck className="w-3.5 h-3.5" />
                            Aceitar
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setReasonModal({ id: a.id, mode: 'recusar' })}>
                            Recusar
                          </Button>
                        </>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => { setReassignGraderId(graders[0]?.id || ''); setReasonModal({ id: a.id, mode: 'reatribuir' }); }}>
                        Reatribuir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast({ type: 'info', title: `Aviso enviado a ${a.classificadorNome}` })}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Notificar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!reasonModal}
        title={reasonModal?.mode === 'recusar' ? 'Fundamentar recusa de lote' : 'Reatribuir lote (nova versão)'}
        onClose={() => setReasonModal(null)}
      >
        <form onSubmit={handleConfirmReason} className="space-y-4">
          {reasonModal?.mode === 'reatribuir' && (
            <FormField label="Novo classificador" required>
              <select value={reassignGraderId} onChange={(e) => setReassignGraderId(e.target.value)} className={inputClass}>
                {graders.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label={reasonModal?.mode === 'recusar' ? 'Fundamentação da recusa' : 'Motivo da reatribuição'} required>
            <textarea rows={3} value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReasonModal(null)}>Cancelar</Button>
            <Button type="submit" variant="primary">Confirmar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
