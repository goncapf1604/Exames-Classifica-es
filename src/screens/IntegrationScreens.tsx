import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  Download,
  FileCheck2,
  FileCode2,
  FileText,
  Lock,
  Play,
  RefreshCw,
  Unlock,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import { InteropJob, PhaseClosure } from '../types/sigen';
import {
  Button,
  FormField,
  Modal,
  NoticeBar,
  ScreenHeader,
  StatStrip,
  StatusLabel,
  inputClass,
} from '../components/ui/SharedUI';
import { exportCSV, exportJSON, formatDateTimePT, nowIso } from '../utils/exports';

/* ============================================================================
 * K21 · Ficheiros ENEB/ENES e interoperabilidade
 * ========================================================================== */
export const K21InteropScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, activeYear, activePhase, logAudit, toast, navigate } = useSigen();
  const jobs = state.interopJobs.filter((j) => j.institutionId === activeInstitutionId);
  const lots = state.lots.filter((l) => l.institutionId === activeInstitutionId);

  const [form, setForm] = useState({
    destino: 'ENES (Ambiente de Testes)' as InteropJob['destino'],
    versaoEsquema: 'Esquema Teste v2.0-local',
    loteRef: lots[0]?.codigoLote || 'LT-2026-635-01',
    ficheiro: 'ENES_Teste_2026_1Fase.csv',
  });
  const [rejectionsJob, setRejectionsJob] = useState<InteropJob | null>(null);

  const runJob = (mode: 'validar' | 'simular' | 'importar' | 'exportar') => {
    if (mode === 'exportar') {
      const instResults = state.results.filter((r) => r.institutionId === activeInstitutionId);
      exportJSON(`sigen_teste_${form.loteRef}_${Date.now()}`, {
        aviso: 'AMBIENTE DE TESTES ENEB/ENES',
        destino: form.destino,
        versaoEsquema: form.versaoEsquema,
        anoLetivo: activeYear,
        fase: activePhase,
        loteRef: form.loteRef,
        registos: instResults.map((r) => ({
          alunoRef: r.alunoRef,
          provaCodigo: r.provaCodigo,
          resultado: r.resultado,
          estado: r.estado,
        })),
      });
      logAudit({ entidade: form.loteRef, ecra: 'K21', acao: 'Exportação de ficheiro de teste (ENEB/ENES)', detalhe: form.destino });
      toast({ type: 'success', title: 'Ficheiro de teste exportado (JSON local)' });
      return;
    }

    const estadoMap: Record<'validar' | 'simular' | 'importar', InteropJob['estado']> = {
      validar: 'Validado (Teste)',
      simular: 'Simulado',
      importar: 'Reconciliado (Teste)',
    };

    const created: InteropJob = {
      id: `int-${Date.now()}`,
      institutionId: activeInstitutionId,
      destino: form.destino,
      versaoEsquema: form.versaoEsquema,
      anoLetivo: activeYear,
      fase: activePhase,
      ficheiro: form.ficheiro,
      loteRef: form.loteRef,
      dataHora: nowIso(),
      estado: estadoMap[mode],
      totalRegistos: 28,
      rejeicoes: [],
    };
    updateState((prev) => ({ ...prev, interopJobs: [created, ...prev.interopJobs] }));
    logAudit({ entidade: form.loteRef, ecra: 'K21', acao: `Interoperabilidade (${mode})`, detalhe: `${form.destino} · ${form.versaoEsquema}` });
    toast({ type: 'success', title: `Operação "${mode}" executada em ambiente de testes` });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader screenId="K21" badgeText="Integração oficial bloqueada até certificação" />
      <NoticeBar tone="info" title="Módulo ENES/ENEB">
        Formatos versionados, importação atómica de ficheiros e reconciliação de resultados:{' '}
        <button type="button" onClick={() => navigate('EN01')} className="font-semibold text-[#087E91] hover:underline">EN01</button>,{' '}
        <button type="button" onClick={() => navigate('EN02')} className="font-semibold text-[#087E91] hover:underline">EN02</button> e{' '}
        <button type="button" onClick={() => navigate('EN03')} className="font-semibold text-[#087E91] hover:underline">EN03</button>.
      </NoticeBar>

      <NoticeBar tone="danger" title="Ambiente de Testes · Integração Oficial Bloqueada">
        Layouts oficiais ENEB/ENES, codificações e canais de troca não foram certificados nesta versão.
        É estritamente proibido declarar integração oficial em produção antes de validação escrita e testes
        com a documentação normativa.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField label="Destino" required>
            <select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value as InteropJob['destino'] })} className={inputClass}>
              <option>ENES (Ambiente de Testes)</option>
              <option>ENEB (Ambiente de Testes)</option>
              <option>Exportação Local CSV/JSON</option>
            </select>
          </FormField>
          <FormField label="Versão de esquema" required>
            <select value={form.versaoEsquema} onChange={(e) => setForm({ ...form, versaoEsquema: e.target.value })} className={inputClass}>
              <option>Esquema Teste v2.0-local</option>
              <option>Esquema Reconciliação Sandbox v1</option>
            </select>
          </FormField>
          <FormField label="Lote referência" required>
            <select value={form.loteRef} onChange={(e) => setForm({ ...form, loteRef: e.target.value })} className={`${inputClass} font-mono`}>
              {lots.map((l) => (
                <option key={l.id} value={l.codigoLote}>{l.codigoLote}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Ficheiro" required>
            <input value={form.ficheiro} onChange={(e) => setForm({ ...form, ficheiro: e.target.value })} className={inputClass} />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={() => runJob('validar')}>
            <FileCheck2 className="w-3.5 h-3.5" />
            Validar estrutura
          </Button>
          <Button variant="teal" size="sm" onClick={() => runJob('simular')}>
            <Play className="w-3.5 h-3.5" />
            Simular
          </Button>
          <Button variant="secondary" size="sm" onClick={() => runJob('importar')}>
            Importar (reconciliar teste)
          </Button>
          <Button variant="primary" size="sm" onClick={() => runJob('exportar')}>
            <FileCode2 className="w-3.5 h-3.5" />
            Exportar ficheiro teste
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-bold text-[#112A4A]">
          Lotes de interoperabilidade e relatórios técnicos
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Ficheiro / Lote</th>
                <th className="text-left py-3 px-4 font-semibold">Destino / Esquema</th>
                <th className="text-right py-3 px-4 font-semibold">Registos</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Rejeições</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="py-3 px-5">
                    <div className="font-mono text-xs font-semibold text-[#112A4A]">{j.ficheiro}</div>
                    <div className="text-xs text-[#536477] font-mono">{j.loteRef} · {formatDateTimePT(j.dataHora)}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-medium text-[#112A4A]">{j.destino}</div>
                    <div className="text-[#536477]">{j.versaoEsquema}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{j.totalRegistos}</td>
                  <td className="py-3 px-4"><StatusLabel status={j.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    {j.rejeicoes.length > 0 ? (
                      <Button variant="danger" size="sm" onClick={() => setRejectionsJob(j)}>
                        Ver rejeições ({j.rejeicoes.length})
                      </Button>
                    ) : (
                      <span className="text-xs text-[#536477]">0 rejeições</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!rejectionsJob} title="Relatório técnico de rejeições" subtitle={rejectionsJob?.ficheiro} onClose={() => setRejectionsJob(null)}>
        <div className="space-y-2 text-xs">
          {rejectionsJob?.rejeicoes.map((r, i) => (
            <div key={i} className="p-3 rounded border border-red-200 bg-red-50/50">
              <div className="font-mono font-bold text-[#B91C1C]">Linha #{r.linha} · Campo: {r.campo}</div>
              <div className="text-[#112A4A] mt-0.5">{r.erro}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K22 · Relatórios e estatísticas
 * ========================================================================== */
export const K22ReportsScreen: React.FC = () => {
  const { state, activeInstitutionId, activeInstitution, activeYear, activePhase, currentUser, openPrintDoc, toast, refreshSync } = useSigen();
  const [provaFilter, setProvaFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [detailProva, setDetailProva] = useState<string | null>(null);

  const lots = state.lots.filter(
    (l) =>
      l.institutionId === activeInstitutionId &&
      (!provaFilter || l.provaCodigo === provaFilter) &&
      (!estadoFilter || l.estado === estadoFilter)
  );
  const results = state.results.filter(
    (r) => r.institutionId === activeInstitutionId && (!provaFilter || r.provaCodigo === provaFilter)
  );

  // Strictly aggregated by exam (no individual teacher rankings per K22 spec!)
  const examStats = useMemo(() => {
    const map = new Map<string, { code: string; name: string; provasLotes: number; resultados: number; media: number; sum: number; numericCount: number }>();
    lots.forEach((l) => {
      const cur = map.get(l.provaCodigo) || { code: l.provaCodigo, name: l.provaNome, provasLotes: 0, resultados: 0, media: 0, sum: 0, numericCount: 0 };
      cur.provasLotes += l.quantidade;
      map.set(l.provaCodigo, cur);
    });
    results.forEach((r) => {
      const cur = map.get(r.provaCodigo) || { code: r.provaCodigo, name: r.provaNome, provasLotes: 0, resultados: 0, media: 0, sum: 0, numericCount: 0 };
      cur.resultados += 1;
      if (typeof r.resultado === 'number') {
        cur.sum += r.resultado;
        cur.numericCount += 1;
        cur.media = Math.round((cur.sum / cur.numericCount) * 10) / 10;
      }
      map.set(r.provaCodigo, cur);
    });
    return Array.from(map.values());
  }, [lots, results]);

  const maxVolume = Math.max(1, ...examStats.map((e) => e.provasLotes));

  const handleExportPdf = () => {
    openPrintDoc({
      title: 'Relatório Operacional e Estatísticas Agregadas (K22)',
      docCode: 'K22-RELATORIO',
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Parâmetros e Salvaguarda Ética',
          rows: [
            { label: 'Ano / Fase', value: `${activeYear} · ${activePhase}` },
            { label: 'Agregação', value: 'Dados estritamente agregados por prova (sem rankings de docentes)' },
            { label: 'Tempo médio de conferência (simulado)', value: '18,4 horas' },
          ],
        },
        {
          heading: 'Volume e Indicadores por Prova',
          table: {
            headers: ['Código', 'Prova', 'Provas em Lotes', 'Resultados Registados', 'Média Agregada (0–200)'],
            rows: examStats.map((e) => [e.code, e.name, String(e.provasLotes), String(e.resultados), e.numericCount ? String(e.media) : '—']),
          },
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K22"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refreshSync}>
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                exportCSV(
                  `estatisticas_k22_${activeYear.replace('/', '-')}`,
                  ['CodigoProva', 'Prova', 'VolumeProvasLotes', 'ResultadosRegistados', 'MediaAgregada'],
                  examStats.map((e) => [e.code, e.name, e.provasLotes, e.resultados, e.media])
                );
                toast({ type: 'success', title: 'Relatório XLSX/CSV descarregado' });
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar XLSX/CSV
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportPdf}>
              <FileText className="w-3.5 h-3.5" />
              Exportar PDF
            </Button>
          </>
        }
      />

      <NoticeBar tone="info" title="Dados agregados por defeito">
        Conforme especificação K22, os relatórios operacionais apresentam métricas agregadas por prova
        e tempos de processamento, evitando rankings individuais indevidos de docentes classificadores.
      </NoticeBar>

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
              <option value="">Todos</option>
              <option value="Conferido">Conferido</option>
              <option value="Em distribuição">Em distribuição</option>
              <option value="Divergência">Divergência</option>
            </select>
          </FormField>
        </div>
      </div>

      <StatStrip
        items={[
          { label: 'Volume total de provas', value: lots.reduce((s, l) => s + l.quantidade, 0), sub: 'Em lotes da instituição', accent: 'navy' },
          { label: 'Tempo médio receção → conferência', value: '18,4 h', sub: 'Indicador operacional agregado', accent: 'teal' },
          { label: 'Resultados validados/publicados', value: results.filter((r) => r.estado === 'Validado' || r.estado === 'Publicado').length, sub: `De ${results.length} registos`, accent: 'green' },
          { label: 'Taxa de divergência custódia', value: `${lots.length ? Math.round((lots.filter((l) => l.estado === 'Divergência').length / lots.length) * 100) : 0}%`, sub: 'Lotes sinalizados em K02', accent: 'gold' },
        ]}
      />

      {/* Aggregated Visual Bar Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-display text-base font-bold text-[#112A4A] flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-[#087E91]" />
            Volume de provas por disciplina
          </h2>
          <div className="space-y-4">
            {examStats.map((e) => (
              <div key={e.code} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#112A4A]">
                    <span className="font-mono text-[#087E91] mr-1.5">{e.code}</span>
                    {e.name}
                  </span>
                  <span className="font-mono tabular-nums text-[#536477]">{e.provasLotes} provas</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-[#087E91] rounded transition-all duration-300"
                    style={{ width: `${Math.max(6, (e.provasLotes / maxVolume) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 text-sm font-bold text-[#112A4A]">
            Quadro agregado por prova
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                  <th className="text-left py-3 px-5 font-semibold">Prova</th>
                  <th className="text-right py-3 px-4 font-semibold">Provas (Lotes)</th>
                  <th className="text-right py-3 px-4 font-semibold">Resultados</th>
                  <th className="text-right py-3 px-4 font-semibold">Média (0–200)</th>
                  <th className="text-right py-3 px-5 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {examStats.map((e) => (
                  <tr key={e.code}>
                    <td className="py-3 px-5 font-medium text-[#112A4A]">
                      <span className="font-mono text-xs text-[#087E91] mr-2">{e.code}</span>
                      {e.name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{e.provasLotes}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{e.resultados}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-bold tabular-nums text-[#112A4A]">
                      {e.numericCount ? e.media : '—'}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailProva(e.code)}>Ver detalhe</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={!!detailProva} title={`Detalhe agregado da prova ${detailProva}`} onClose={() => setDetailProva(null)}>
        <div className="space-y-3 text-xs text-[#536477]">
          <p>
            Registos consolidados para a prova <strong className="text-[#112A4A]">{detailProva}</strong> na fase{' '}
            <strong className="text-[#112A4A]">{activePhase}</strong> ({activeYear}):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#112A4A]">
            <li>Lotes ativos: {lots.filter((l) => l.provaCodigo === detailProva).length}</li>
            <li>Resultados individuais registados: {results.filter((r) => r.provaCodigo === detailProva).length}</li>
            <li>Sem exposição de desempenho individual de docentes classificadores.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K23 · Arquivo e encerramento de fase
 * ========================================================================== */
export const K23ClosureScreen: React.FC = () => {
  const {
    state,
    updateState,
    activeInstitutionId,
    activeInstitution,
    activeYear,
    activePhase,
    currentUser,
    logAudit,
    toast,
    confirmAction,
    navigate,
    openPrintDoc,
  } = useSigen();

  const existingClosure = state.closures.find(
    (c) => c.institutionId === activeInstitutionId && c.anoLetivo === activeYear && c.fase === activePhase
  );

  const closure: PhaseClosure = existingClosure || {
    id: `cls-${activeInstitutionId}-${activeYear}-${activePhase}`,
    institutionId: activeInstitutionId,
    anoLetivo: activeYear,
    fase: activePhase,
    estado: 'Aberta',
    politicaRetencao: '10 anos (Arquivo escolar alargado)',
    responsavel: currentUser?.nome || 'Direção',
    checklist: [
      { id: 'chk-1', label: 'Todos os lotes rececionados e conferidos sem divergências abertas (K02)', verificado: false },
      { id: 'chk-2', label: 'Conferência de cotações e totais concluída com segregação de funções (K08)', verificado: false },
      { id: 'chk-3', label: 'Pautas locais aprovadas e publicadas conforme regras de privacidade (K12/K13)', verificado: false },
      { id: 'chk-4', label: 'Processos de consulta, reapreciação e reclamação encerrados (K14–K19)', verificado: false },
      { id: 'chk-5', label: 'Cópia de segurança e exportação do arquivo auditada (C07)', verificado: false },
    ],
    historicoFecho: [],
  };

  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Live automatic pending counter computed from real state!
  const openDivergences = state.lots.filter((l) => l.institutionId === activeInstitutionId && l.estado === 'Divergência').length;
  const openDiscrepancies = state.results.filter((r) => r.institutionId === activeInstitutionId && r.estado === 'Discrepância').length;
  const unverifiedChecklist = closure.checklist.filter((c) => !c.verificado).length;
  const totalPendencies = openDivergences + openDiscrepancies + unverifiedChecklist;

  const upsertClosure = (next: PhaseClosure) => {
    updateState((prev) => {
      const exists = prev.closures.some((c) => c.id === next.id);
      return {
        ...prev,
        closures: exists ? prev.closures.map((c) => (c.id === next.id ? next : c)) : [next, ...prev.closures],
      };
    });
  };

  const toggleCheck = (chkId: string) => {
    if (closure.estado === 'Encerrada') return;
    upsertClosure({
      ...closure,
      checklist: closure.checklist.map((c) => (c.id === chkId ? { ...c, verificado: !c.verificado } : c)),
    });
  };

  const handleVerifyClosure = () => {
    toast({
      type: totalPendencies === 0 ? 'success' : 'warning',
      title: totalPendencies === 0 ? 'Verificação de fecho: pronto a encerrar' : `${totalPendencies} pendência(s) detetada(s)`,
      detail: `Divergências K02: ${openDivergences} · Discrepâncias K11: ${openDiscrepancies} · Itens checklist: ${unverifiedChecklist}`,
    });
  };

  const handleClosePhase = () => {
    confirmAction({
      title: `Encerrar fase ${activeYear} · ${activePhase}?`,
      message:
        totalPendencies > 0
          ? `Existem ainda ${totalPendencies} pendência(s). Encerrar bloqueia novas operações de edição nesta fase e preserva todas as evidências conforme a política de retenção (${closure.politicaRetencao}).`
          : `Encerrar esta fase bloqueia operações e emite evidência auditável. Reabertura só mediante autorização auditada.`,
      confirmLabel: 'Confirmar encerramento',
      danger: true,
      onConfirm: () => {
        upsertClosure({
          ...closure,
          estado: 'Encerrada',
          dataFecho: nowIso(),
          responsavel: currentUser?.nome || closure.responsavel,
          historicoFecho: [
            { dataHora: nowIso(), acao: 'Encerramento formal de fase', autor: currentUser?.nome || 'Direção', motivo: `Retenção: ${closure.politicaRetencao}` },
            ...closure.historicoFecho,
          ],
        });
        logAudit({
          entidade: `Fase ${activeYear} · ${activePhase}`,
          ecra: 'K23',
          acao: 'Encerramento e bloqueio de fase',
          detalhe: `Política de retenção: ${closure.politicaRetencao}.`,
          sensivel: true,
        });
        toast({ type: 'success', title: 'Fase encerrada e operações bloqueadas' });
      },
    });
  };

  const handleReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;
    upsertClosure({
      ...closure,
      estado: 'Reaberta',
      historicoFecho: [
        { dataHora: nowIso(), acao: 'Reabertura autorizada e auditada', autor: currentUser?.nome || 'Direção', motivo: reopenReason },
        ...closure.historicoFecho,
      ],
    });
    logAudit({
      entidade: `Fase ${activeYear} · ${activePhase}`,
      ecra: 'K23',
      acao: 'Reabertura excecional de fase',
      detalhe: reopenReason,
      sensivel: true,
    });
    setReopenReason('');
    setReopenOpen(false);
    toast({ type: 'warning', title: 'Fase reaberta mediante decisão auditada' });
  };

  const handleExportArchive = () => {
    openPrintDoc({
      title: `Termo de Encerramento e Arquivo — ${activeYear} · ${activePhase}`,
      docCode: `K23-TERMO-${activeYear.replace('/', '-')}`,
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Declaração de Encerramento e Retenção Legal',
          rows: [
            { label: 'Ano letivo / Fase', value: `${activeYear} · ${activePhase}` },
            { label: 'Estado da fase', value: closure.estado },
            { label: 'Política de retenção', value: closure.politicaRetencao },
            { label: 'Responsável', value: closure.responsavel },
            { label: 'Pendências contabilizadas', value: String(totalPendencies) },
          ],
        },
        {
          heading: 'Checklist de Fecho',
          table: {
            headers: ['Requisito', 'Estado'],
            rows: closure.checklist.map((c) => [c.label, c.verificado ? 'Verificado' : 'Pendente']),
          },
          note: 'Nenhuma documentação sujeita a retenção legal é eliminada no encerramento. O fecho é reversível apenas por decisão formal auditada.',
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K23"
        badgeText={`Estado da fase: ${closure.estado}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleVerifyClosure}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verificar fecho
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('C02')}>
              Resolver pendências ({totalPendencies})
            </Button>
            {closure.estado !== 'Encerrada' ? (
              <Button variant="danger" size="sm" onClick={handleClosePhase}>
                <Lock className="w-3.5 h-3.5" />
                Encerrar fase
              </Button>
            ) : (
              <Button variant="teal" size="sm" onClick={() => setReopenOpen(true)}>
                <Unlock className="w-3.5 h-3.5" />
                Reabrir (autorização)
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleExportArchive}>
              <Archive className="w-3.5 h-3.5" />
              Exportar arquivo (Termo PDF)
            </Button>
          </>
        }
      />

      <NoticeBar tone="warning" title="Preservação de evidências e retenção legal">
        Não eliminar documentação sujeita a retenção legal. O encerramento bloqueia novas edições na
        fase ativa e só pode ser revertido mediante decisão formal registada na auditoria C07.
      </NoticeBar>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#112A4A]">
                Checklist obrigatória de fecho · {activeYear} ({activePhase})
              </h2>
              <p className="text-xs text-[#536477] mt-0.5">
                Pendências automáticas: <strong className="tabular-nums text-[#112A4A]">{totalPendencies}</strong> (K02: {openDivergences} · K11: {openDiscrepancies} · Checklist: {unverifiedChecklist})
              </p>
            </div>
            <StatusLabel status={closure.estado} />
          </div>

          <div className="space-y-3">
            {closure.checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 p-3.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={item.verificado}
                  disabled={closure.estado === 'Encerrada'}
                  onChange={() => toggleCheck(item.id)}
                  className="mt-1"
                />
                <span className={item.verificado ? 'text-[#536477] line-through' : 'text-[#112A4A] font-medium'}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h3 className="font-display text-sm font-bold text-[#112A4A]">Política de retenção e responsável</h3>
            <FormField label="Política de retenção legal" required>
              <select
                value={closure.politicaRetencao}
                disabled={closure.estado === 'Encerrada'}
                onChange={(e) => upsertClosure({ ...closure, politicaRetencao: e.target.value as PhaseClosure['politicaRetencao'] })}
                className={inputClass}
              >
                <option>5 anos (Norma administrativa)</option>
                <option>10 anos (Arquivo escolar alargado)</option>
                <option>Retenção legal permanente (Atas/Pautas)</option>
              </select>
            </FormField>
            <FormField label="Responsável pelo encerramento" required>
              <input value={closure.responsavel} disabled className={inputClass} />
            </FormField>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display text-sm font-bold text-[#112A4A] mb-3">
              Histórico auditado de fecho / reabertura
            </h3>
            <ol className="space-y-3 text-xs">
              {closure.historicoFecho.map((h, i) => (
                <li key={i} className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#112A4A]">{h.acao}</span>
                    <span className="text-[#536477] tabular-nums">{formatDateTimePT(h.dataHora)}</span>
                  </div>
                  <div className="text-[#536477] mt-1">{h.motivo} · {h.autor}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <Modal open={reopenOpen} title="Autorizar reabertura de fase encerrada" onClose={() => setReopenOpen(false)}>
        <form onSubmit={handleReopen} className="space-y-4">
          <FormField label="Decisão / fundamentação formal para reabertura" required>
            <textarea rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} className={inputClass} placeholder="Ex.: Despacho da Direção para integração de resultado de reclamação ao JNE..." />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReopenOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Confirmar reabertura auditada</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
