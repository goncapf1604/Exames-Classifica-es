import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  History,
  Lock,
  PauseCircle,
  Send,
  Upload,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import { PautaRecord, PublicationRecord, StudentResult } from '../types/sigen';
import {
  Button,
  FormField,
  Modal,
  NoticeBar,
  ScreenHeader,
  SearchInput,
  StatusLabel,
  inputClass,
} from '../components/ui/SharedUI';
import { formatDateTimePT, nowIso } from '../utils/exports';

/* ============================================================================
 * K10 · Importação de classificações/resultados
 * ========================================================================== */
interface ParsedRow {
  linha: number;
  alunoRef: string;
  alunoNome: string;
  provaCodigo: string;
  resultado: string;
  erro?: string;
}

const SAMPLE_CSV = `aluno_ref;aluno_nome;prova_codigo;resultado
2026-041;Rita Sofia Marques;635;158
2026-042;Gonçalo Pires Silva;635;182
2026-041;Rita Sofia Marques (Duplicado);635;158
2026-043;Inês Monteiro Duarte;635;215
2026-044;Miguel Ângelo Sousa;999;140`;

export const K10ImportScreen: React.FC = () => {
  const { updateState, activeInstitutionId, activeYear, activePhase, logAudit, toast, navigate } = useSigen();

  const [origem, setOrigem] = useState('Importação Genérica de Teste (CSV)');
  const [esquema, setEsquema] = useState('Esquema Teste v2.0 (Não oficial)');
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [validated, setValidated] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const parseCsv = (text: string): ParsedRow[] => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return [];
    const seen = new Set<string>();
    const validCodes = new Set(['635', '639', '715', '702', '712']);

    return lines.slice(1).map((line, idx) => {
      const cols = line.split(/[;,]/).map((c) => c.trim());
      const [alunoRef = '', alunoNome = '', provaCodigo = '', resultado = ''] = cols;
      const errors: string[] = [];
      const key = `${alunoRef}-${provaCodigo}`;
      if (!alunoRef || !alunoNome) errors.push('Referência ou nome em falta');
      if (seen.has(key)) errors.push('Registo duplicado no ficheiro');
      seen.add(key);
      if (!validCodes.has(provaCodigo)) errors.push(`Código de prova "${provaCodigo}" inválido`);
      const num = Number(resultado);
      if (resultado !== 'Faltou' && (Number.isNaN(num) || num < 0 || num > 200)) {
        errors.push(`Escala inválida "${resultado}" (esperado 0–200)`);
      }
      return {
        linha: idx + 2,
        alunoRef,
        alunoNome,
        provaCodigo,
        resultado,
        erro: errors.length > 0 ? errors.join('; ') : undefined,
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || '');
      setRawText(txt);
      setRows([]);
      setValidated(false);
      toast({ type: 'info', title: `Ficheiro ${file.name} carregado` });
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setFileName('exemplo_teste_classificacoes_635.csv');
    setRawText(SAMPLE_CSV);
    setRows([]);
    setValidated(false);
    toast({ type: 'info', title: 'Ficheiro de teste carregado (inclui erros intencionais para validação)' });
  };

  const handleValidate = () => {
    if (!rawText.trim()) {
      toast({ type: 'error', title: 'Carregue um ficheiro primeiro' });
      return;
    }
    const parsed = parseCsv(rawText);
    setRows(parsed);
    setValidated(true);
    const errCount = parsed.filter((r) => r.erro).length;
    toast({
      type: errCount > 0 ? 'warning' : 'success',
      title: `Validação concluída: ${parsed.length - errCount} válidos, ${errCount} erros`,
    });
  };

  const validRows = rows.filter((r) => !r.erro);
  const errorRows = rows.filter((r) => r.erro);

  const handleConfirmImport = () => {
    if (!validated || validRows.length === 0) {
      toast({ type: 'error', title: 'Valide o ficheiro antes de confirmar a importação' });
      return;
    }
    const codeName: Record<string, string> = { '635': 'Matemática A', '639': 'Português', '715': 'Física e Química A', '702': 'Biologia e Geologia', '712': 'Economia A' };
    const imported: StudentResult[] = validRows.map((r) => ({
      id: `res-imp-${Date.now()}-${r.linha}`,
      institutionId: activeInstitutionId,
      alunoRef: r.alunoRef,
      alunoNome: r.alunoNome,
      codigoAnonimo: `IMP-${r.provaCodigo}-${r.linha}`,
      provaCodigo: r.provaCodigo,
      provaNome: codeName[r.provaCodigo] || 'Prova',
      anoLetivo: activeYear,
      fase: activePhase,
      resultado: r.resultado === 'Faltou' ? 'Faltou' : Number(r.resultado),
      origem: 'Importação K10 (Teste)',
      estado: 'Pendente',
      historico: [{ dataHora: nowIso(), acao: `Importado via K10 (${fileName})`, autor: 'Importação K10', valorNovo: r.resultado }],
    }));

    updateState((prev) => ({ ...prev, results: [...imported, ...prev.results] }));
    logAudit({
      entidade: fileName || 'Lote K10',
      ecra: 'K10',
      acao: 'Confirmação de importação de teste',
      detalhe: `${imported.length} registos válidos importados; ${errorRows.length} linhas rejeitadas.`,
    });
    toast({ type: 'success', title: `${imported.length} resultados importados para K11` });
    setRows([]);
    setValidated(false);
    setRawText('');
    setFileName('');
  };

  const handleRejectLot = () => {
    logAudit({
      entidade: fileName || 'Lote K10',
      ecra: 'K10',
      acao: 'Rejeição de lote de importação',
      detalhe: `Lote arquivado com ${errorRows.length} erro(s) por linha.`,
    });
    setRows([]);
    setValidated(false);
    setRawText('');
    setFileName('');
    toast({ type: 'warning', title: 'Lote rejeitado e relatório de erros arquivado' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K10"
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('K11')}>
            Ver resultados em K11
          </Button>
        }
      />

      <NoticeBar tone="warning" title="Modo genérico de teste">
        Sem esquema oficial aprovado e certificado, apenas é permitida importação genérica de teste.
        O validador verifica duplicados, escala (0–200), códigos de prova e integridade por linha.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Origem" required>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={inputClass}>
              <option>Importação Genérica de Teste (CSV)</option>
              <option>Simulação ENES (Ambiente de Teste)</option>
              <option>Simulação ENEB (Ambiente de Teste)</option>
            </select>
          </FormField>
          <FormField label="Esquema / versão" required>
            <select value={esquema} onChange={(e) => setEsquema(e.target.value)} className={inputClass}>
              <option>Esquema Teste v2.0 (Não oficial)</option>
              <option>CSV Delimitado por Ponto e Vírgula (v1)</option>
            </select>
          </FormField>
          <FormField label="Ficheiro (.csv / .txt)" required>
            <div className="flex gap-2">
              <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-[#112A4A] hover:bg-slate-50 cursor-pointer min-h-[40px]">
                <Upload className="w-3.5 h-3.5" />
                <span className="truncate">{fileName || 'Escolher ficheiro'}</span>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
              <Button type="button" variant="secondary" size="sm" onClick={handleLoadSample}>
                Carregar exemplo
              </Button>
            </div>
          </FormField>
        </div>

        {/* Conditional Mapping Grid */}
        {rawText && (
          <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
            <div className="text-xs font-bold text-[#112A4A] mb-2">Mapeamento de colunas detetado</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-[#536477]">
              <div>Col 1 → aluno_ref</div>
              <div>Col 2 → aluno_nome</div>
              <div>Col 3 → prova_codigo</div>
              <div>Col 4 → resultado (0–200)</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
          <Button variant="teal" size="sm" onClick={handleValidate} disabled={!rawText}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Validar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)} disabled={rows.length === 0}>
            <Eye className="w-3.5 h-3.5" />
            Pré-visualizar ({rows.length})
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmImport} disabled={!validated || validRows.length === 0}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmar ({validRows.length} válidos)
          </Button>
          <Button variant="danger" size="sm" onClick={handleRejectLot} disabled={rows.length === 0}>
            Rejeitar lote
          </Button>
        </div>
      </div>

      {/* Line-by-line Error Report */}
      {validated && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-[#112A4A]">Relatório de validação por linha</span>
            <span className="tabular-nums text-[#536477]">
              Válidos: <strong className="text-[#286B42]">{validRows.length}</strong> · Erros:{' '}
              <strong className="text-[#B91C1C]">{errorRows.length}</strong>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[#536477]">
                  <th className="text-left py-2.5 px-4 font-semibold">Linha</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Aluno</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Prova</th>
                  <th className="text-right py-2.5 px-4 font-semibold">Resultado</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => (
                  <tr key={r.linha} className={r.erro ? 'bg-red-50/40' : ''}>
                    <td className="py-2.5 px-4 font-mono tabular-nums">#{r.linha}</td>
                    <td className="py-2.5 px-4 font-medium text-[#112A4A]">
                      {r.alunoRef} · {r.alunoNome}
                    </td>
                    <td className="py-2.5 px-4 font-mono">{r.provaCodigo}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{r.resultado}</td>
                    <td className="py-2.5 px-4">
                      {r.erro ? (
                        <StatusLabel status={r.erro} tone="danger" />
                      ) : (
                        <StatusLabel status="Válido para importação" tone="success" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={previewOpen} title="Pré-visualização do lote a importar" onClose={() => setPreviewOpen(false)} size="lg">
        <pre className="p-4 bg-slate-50 border border-slate-200 rounded font-mono text-xs overflow-x-auto">
          {rawText}
        </pre>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K11 · Resultados individuais e validação
 * ========================================================================== */
export const K11ResultsScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast, navigate } = useSigen();
  const results = state.results.filter((r) => r.institutionId === activeInstitutionId);

  const [search, setSearch] = useState('');
  const [detailResult, setDetailResult] = useState<StudentResult | null>(null);
  const [discrepTarget, setDiscrepTarget] = useState<StudentResult | null>(null);
  const [justificacao, setJustificacao] = useState('');

  const filtered = results.filter((r) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      r.alunoNome.toLowerCase().includes(q) ||
      r.alunoRef.toLowerCase().includes(q) ||
      r.provaCodigo.includes(q) ||
      r.provaNome.toLowerCase().includes(q)
    );
  });

  const handleValidate = (r: StudentResult) => {
    updateState((prev) => ({
      ...prev,
      results: prev.results.map((x) =>
        x.id === r.id
          ? {
              ...x,
              estado: 'Validado',
              historico: [{ dataHora: nowIso(), acao: 'Validação de resultado', autor: currentUser?.nome || 'Direção' }, ...x.historico],
            }
          : x
      ),
    }));
    logAudit({ entidade: `${r.alunoRef} (${r.provaCodigo})`, ecra: 'K11', acao: 'Validação de resultado individual', detalhe: `Classificação ${r.resultado} confirmada.` });
    toast({ type: 'success', title: `Resultado de ${r.alunoNome} validado` });
  };

  const handleFlagDiscrepancy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discrepTarget || !justificacao.trim()) return;
    updateState((prev) => ({
      ...prev,
      results: prev.results.map((x) =>
        x.id === discrepTarget.id
          ? {
              ...x,
              estado: 'Discrepância',
              justificacao,
              historico: [
                { dataHora: nowIso(), acao: 'Discrepância sinalizada (publicação bloqueada)', autor: currentUser?.nome || 'Secretariado', nota: justificacao },
                ...x.historico,
              ],
            }
          : x
      ),
    }));
    logAudit({ entidade: `${discrepTarget.alunoRef}`, ecra: 'K11', acao: 'Sinalização de discrepância', detalhe: justificacao, sensivel: true });
    setDiscrepTarget(null);
    setJustificacao('');
    toast({ type: 'warning', title: 'Discrepância sinalizada · Publicação bloqueada' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader screenId="K11" />

      <NoticeBar tone="info" title="Proteção contra edição livre">
        Resultados de fonte autorizada não podem ser alterados diretamente neste ecrã. Qualquer
        retificação exige abertura de processo formal vinculado a evidência/decisão em K20.
      </NoticeBar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar aluno, processo ou prova..." />
        <span className="text-xs text-[#536477] tabular-nums">{filtered.length} resultados</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Aluno / Ref.</th>
                <th className="text-left py-3 px-4 font-semibold">Prova / Fase</th>
                <th className="text-right py-3 px-4 font-semibold">Resultado</th>
                <th className="text-left py-3 px-4 font-semibold">Origem</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5">
                    <div className="font-semibold text-[#112A4A]">{r.alunoNome}</div>
                    <div className="text-xs font-mono text-[#536477]">{r.alunoRef} · {r.codigoAnonimo}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-medium text-[#112A4A]">{r.provaCodigo} · {r.provaNome}</div>
                    <div className="text-[#536477]">{r.anoLetivo} · {r.fase}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm font-bold tabular-nums text-[#112A4A]">
                    {r.resultado}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#536477]">{r.origem}</td>
                  <td className="py-3 px-4"><StatusLabel status={r.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setDetailResult(r)}>
                        <History className="w-3.5 h-3.5" />
                        Detalhe / Histórico
                      </Button>
                      {r.estado === 'Pendente' && (
                        <Button variant="teal" size="sm" onClick={() => handleValidate(r)}>Validar</Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => setDiscrepTarget(r)}>
                        Discrepância
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => navigate('K20')}>
                        Solicitar retificação
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!detailResult} title="Ficha de resultado e trilho histórico" subtitle={detailResult?.alunoNome} onClose={() => setDetailResult(null)} size="lg">
        {detailResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-md text-xs">
              <div><div className="text-[#536477]">Processo</div><div className="font-mono font-bold">{detailResult.alunoRef}</div></div>
              <div><div className="text-[#536477]">Prova</div><div className="font-semibold">{detailResult.provaCodigo} · {detailResult.provaNome}</div></div>
              <div><div className="text-[#536477]">Classificação</div><div className="font-mono text-base font-bold text-[#087E91]">{detailResult.resultado}</div></div>
              <div><div className="text-[#536477]">Origem</div><div className="font-semibold">{detailResult.origem}</div></div>
            </div>
            {detailResult.justificacao && (
              <NoticeBar tone="danger" title="Justificação de bloqueio">{detailResult.justificacao}</NoticeBar>
            )}
            <div>
              <h3 className="text-xs font-bold text-[#112A4A] mb-2">Trilho de alterações e validações</h3>
              <ol className="space-y-2 text-xs">
                {detailResult.historico.map((h, i) => (
                  <li key={i} className="p-3 bg-white border border-slate-200 rounded">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#112A4A]">{h.acao}</span>
                      <span className="text-[#536477] tabular-nums">{formatDateTimePT(h.dataHora)}</span>
                    </div>
                    <div className="text-[#536477] mt-0.5">
                      Autor: {h.autor} {h.valorAnterior && `· Antes: ${h.valorAnterior}`} {h.valorNovo && `· Novo: ${h.valorNovo}`}
                    </div>
                    {h.nota && <div className="text-[#112A4A] mt-1">{h.nota}</div>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!discrepTarget} title="Sinalizar discrepância e bloquear publicação" subtitle={discrepTarget?.alunoNome} onClose={() => setDiscrepTarget(null)}>
        <form onSubmit={handleFlagDiscrepancy} className="space-y-4">
          <FormField label="Justificação obrigatória" required>
            <textarea rows={3} value={justificacao} onChange={(e) => setJustificacao(e.target.value)} className={inputClass} placeholder="Descreva a inconsistência detetada..." />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDiscrepTarget(null)}>Cancelar</Button>
            <Button type="submit" variant="danger">Bloquear resultado</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K12 · Pautas e mapas de resultados
 * ========================================================================== */
export const K12PautasScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, activeInstitution, activeYear, activePhase, currentUser, logAudit, toast, openPrintDoc } = useSigen();
  const pautas = state.pautas.filter((p) => p.institutionId === activeInstitutionId);
  const results = state.results.filter((r) => r.institutionId === activeInstitutionId);

  const [newForm, setNewForm] = useState({
    provaCodigo: '635',
    provaNome: 'Matemática A',
    modelo: 'Mapa Local Anonimizado v2.0' as PautaRecord['modelo'],
    dataPublicacao: nowIso().slice(0, 10),
  });
  const [checklistTarget, setChecklistTarget] = useState<PautaRecord | null>(null);
  const [checks, setChecks] = useState([false, false, false]);

  const handleCreatePauta = (e: React.FormEvent) => {
    e.preventDefault();
    if (newForm.modelo.includes('Modelo Oficial')) {
      toast({
        type: 'error',
        title: 'Modelo oficial bloqueado',
        detail: 'Modelos oficiais só podem ser emitidos após validação formal do layout normativo.',
      });
      return;
    }
    const created: PautaRecord = {
      id: `pau-${Date.now()}`,
      institutionId: activeInstitutionId,
      escolaNome: activeInstitution?.designacao || 'Escola',
      provaCodigo: newForm.provaCodigo,
      provaNome: newForm.provaNome,
      anoLetivo: activeYear,
      fase: activePhase,
      modelo: newForm.modelo,
      dataPublicacao: newForm.dataPublicacao,
      responsavel: currentUser?.nome || 'Secretariado',
      estado: 'Rascunho',
      checklistConcluida: false,
      versao: 1,
    };
    updateState((prev) => ({ ...prev, pautas: [created, ...prev.pautas] }));
    logAudit({ entidade: `Pauta ${created.provaCodigo}`, ecra: 'K12', acao: 'Criação de pauta local', detalhe: created.modelo });
    toast({ type: 'success', title: 'Pauta local criada em rascunho' });
  };

  const handleCompleteChecklist = () => {
    if (!checklistTarget || !checks.every(Boolean)) {
      toast({ type: 'error', title: 'Confirme todos os pontos da checklist de privacidade e conferência' });
      return;
    }
    updateState((prev) => ({
      ...prev,
      pautas: prev.pautas.map((p) =>
        p.id === checklistTarget.id ? { ...p, checklistConcluida: true, estado: 'Conferida' } : p
      ),
    }));
    logAudit({ entidade: `Pauta ${checklistTarget.provaCodigo}`, ecra: 'K12', acao: 'Checklist de conferência concluída', detalhe: 'Regras de privacidade verificadas.' });
    setChecklistTarget(null);
    toast({ type: 'success', title: 'Pauta conferida — pronta para aprovação da Direção' });
  };

  const handleApprove = (p: PautaRecord) => {
    if (!p.checklistConcluida) {
      toast({ type: 'error', title: 'Conclua primeiro a checklist em "Conferir"' });
      return;
    }
    updateState((prev) => ({
      ...prev,
      pautas: prev.pautas.map((x) => (x.id === p.id ? { ...x, estado: 'Aprovada' } : x)),
    }));
    logAudit({ entidade: `Pauta ${p.provaCodigo} v${p.versao}`, ecra: 'K12', acao: 'Aprovação de publicação de pauta', detalhe: `Autorizada por ${currentUser?.nome}.` });
    toast({ type: 'success', title: 'Publicação aprovada · Disponível em K13' });
  };

  const handlePreviewPdf = (p: PautaRecord) => {
    const pResults = results.filter((r) => r.provaCodigo === p.provaCodigo && r.estado !== 'Discrepância');
    openPrintDoc({
      title: `Pauta de Resultados — ${p.provaCodigo} · ${p.provaNome}`,
      docCode: `K12-${p.provaCodigo}-v${p.versao}`,
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: p.escolaNome,
      generatedBy: currentUser?.nome || p.responsavel,
      generatedAt: formatDateTimePT(nowIso()),
      version: `v${p.versao}`,
      sections: [
        {
          heading: 'Cabeçalho da Pauta',
          rows: [
            { label: 'Modelo', value: p.modelo },
            { label: 'Ano / Fase', value: `${p.anoLetivo} · ${p.fase}` },
            { label: 'Data prevista de publicação', value: p.dataPublicacao },
            { label: 'Estado', value: p.estado },
          ],
        },
        {
          heading: 'Classificações (Anonimizadas conforme regras de privacidade)',
          table: {
            headers: ['Ref. Processo', 'Código Anónimo', 'Classificação', 'Estado', 'Origem'],
            rows: pResults.map((r) => [r.alunoRef, r.codigoAnonimo, String(r.resultado), r.estado, r.origem]),
          },
          note: 'Dados nominais completos ocultados nesta pauta local conforme regras de minimização de dados pessoais.',
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader screenId="K12" />

      <form onSubmit={handleCreatePauta} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <FormField label="Prova" required>
          <select
            value={newForm.provaCodigo}
            onChange={(e) => {
              const map: Record<string, string> = { '635': 'Matemática A', '639': 'Português', '715': 'Física e Química A' };
              setNewForm({ ...newForm, provaCodigo: e.target.value, provaNome: map[e.target.value] || 'Prova' });
            }}
            className={inputClass}
          >
            <option value="635">635 · Matemática A</option>
            <option value="639">639 · Português</option>
            <option value="715">715 · Física e Química A</option>
          </select>
        </FormField>
        <FormField label="Modelo (versão)" required>
          <select value={newForm.modelo} onChange={(e) => setNewForm({ ...newForm, modelo: e.target.value as PautaRecord['modelo'] })} className={inputClass}>
            <option value="Mapa Local Anonimizado v2.0">Mapa Local Anonimizado v2.0</option>
            <option value="Pauta Interna de Conferência v2.0">Pauta Interna de Conferência v2.0</option>
            <option value="Modelo Oficial JNE (Pendente validação)">Modelo Oficial JNE (Pendente validação)</option>
          </select>
        </FormField>
        <FormField label="Data de publicação" conditional>
          <input type="date" value={newForm.dataPublicacao} onChange={(e) => setNewForm({ ...newForm, dataPublicacao: e.target.value })} className={inputClass} />
        </FormField>
        <Button type="submit" variant="primary">Criar mapa / pauta</Button>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Prova / Modelo</th>
                <th className="text-left py-3 px-4 font-semibold">Data pub.</th>
                <th className="text-left py-3 px-4 font-semibold">Responsável</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pautas.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-5">
                    <div className="font-semibold text-[#112A4A]">
                      {p.provaCodigo} · {p.provaNome} <span className="font-mono text-xs text-[#087E91]">v{p.versao}</span>
                    </div>
                    <div className="text-xs text-[#536477]">{p.modelo}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{p.dataPublicacao}</td>
                  <td className="py-3 px-4 text-xs text-[#536477]">{p.responsavel}</td>
                  <td className="py-3 px-4"><StatusLabel status={p.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => handlePreviewPdf(p)}>
                        <FileText className="w-3.5 h-3.5" />
                        Pré-visualizar / PDF
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setChecklistTarget(p);
                          setChecks([p.checklistConcluida, p.checklistConcluida, p.checklistConcluida]);
                        }}
                      >
                        Conferir
                      </Button>
                      <Button variant="teal" size="sm" onClick={() => handleApprove(p)} disabled={p.estado === 'Aprovada' || p.estado === 'Arquivada'}>
                        Aprovar publicação
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          updateState((prev) => ({
                            ...prev,
                            pautas: prev.pautas.map((x) => (x.id === p.id ? { ...x, estado: 'Arquivada' } : x)),
                          }));
                          toast({ type: 'info', title: 'Versão da pauta arquivada' });
                        }}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Arquivar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!checklistTarget} title="Checklist de conferência antes da aprovação" subtitle={checklistTarget?.modelo} onClose={() => setChecklistTarget(null)}>
        <div className="space-y-4">
          {[
            'Verifiquei que não existem resultados com estado "Discrepância" incluídos na pauta.',
            'Confirmei o cumprimento das regras de publicidade e minimização de dados pessoais.',
            'Validei cabeçalho, instituição, fase e versão do documento local.',
          ].map((label, i) => (
            <label key={i} className="flex items-start gap-2.5 text-xs text-[#112A4A] cursor-pointer">
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={(e) => setChecks((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setChecklistTarget(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleCompleteChecklist}>Concluir checklist</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K13 · Publicação e comunicação de resultados
 * ========================================================================== */
export const K13PublicationScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast } = useSigen();
  const pautas = state.pautas.filter((p) => p.institutionId === activeInstitutionId);
  const publications = state.publications.filter((p) => p.institutionId === activeInstitutionId);

  const [form, setForm] = useState({
    pautaId: pautas[0]?.id || '',
    canal: 'Portal autenticado aluno/EE' as PublicationRecord['canal'],
    dataHora: '2026-11-25T09:00',
    publicoAlvo: 'Alunos / EE autenticados' as PublicationRecord['publicoAlvo'],
    mensagem: 'Resultados disponíveis em acesso individual autenticado.',
  });

  const handlePublish = (mode: 'schedule' | 'publish') => {
    const pauta = pautas.find((p) => p.id === form.pautaId);
    if (!pauta) return;
    if (mode === 'publish' && pauta.estado !== 'Aprovada' && pauta.estado !== 'Publicada') {
      toast({
        type: 'error',
        title: 'Publicação bloqueada — exige aprovação prévia em K12',
        detail: `A pauta ${pauta.provaCodigo} está no estado "${pauta.estado}".`,
      });
      return;
    }
    const created: PublicationRecord = {
      id: `pub-${Date.now()}`,
      institutionId: activeInstitutionId,
      pautaId: pauta.id,
      conjuntoLabel: `${pauta.provaCodigo} · ${pauta.provaNome} · ${pauta.fase} (v${pauta.versao})`,
      canal: form.canal,
      dataHora: mode === 'schedule' ? new Date(form.dataHora).toISOString() : nowIso(),
      publicoAlvo: form.publicoAlvo,
      mensagem: form.mensagem,
      estado: mode === 'schedule' ? 'Agendada' : 'Publicada',
      autor: currentUser?.nome || 'Direção',
    };
    updateState((prev) => ({ ...prev, publications: [created, ...prev.publications] }));
    logAudit({
      entidade: created.conjuntoLabel,
      ecra: 'K13',
      acao: mode === 'publish' ? 'Publicação de resultados' : 'Agendamento de publicação',
      detalhe: `Canal: ${created.canal} · Público: ${created.publicoAlvo}`,
    });
    toast({ type: 'success', title: mode === 'publish' ? 'Resultados publicados com acesso autenticado' : 'Publicação agendada' });
  };

  const handleSuspend = (pub: PublicationRecord) => {
    updateState((prev) => ({
      ...prev,
      publications: prev.publications.map((x) => (x.id === pub.id ? { ...x, estado: 'Suspensa' } : x)),
    }));
    logAudit({ entidade: pub.conjuntoLabel, ecra: 'K13', acao: 'Suspensão de publicação', detalhe: 'Acesso retirado imediatamente.', sensivel: true });
    toast({ type: 'warning', title: 'Publicação suspensa e acesso retirado' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader screenId="K13" />

      <NoticeBar tone="warning" title="Regras de divulgação">
        Não publicar antes de aprovação formal em K12. O acesso a classificações individuais exige
        autenticação; nunca publicar dados nominais além do legalmente permitido.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField label="Conjunto de resultados (K12)" required>
            <select value={form.pautaId} onChange={(e) => setForm({ ...form, pautaId: e.target.value })} className={inputClass}>
              {pautas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.provaCodigo} · {p.provaNome} ({p.estado})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Canal" required>
            <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as PublicationRecord['canal'] })} className={inputClass}>
              <option>Portal autenticado aluno/EE</option>
              <option>Afixação local (pauta anonimizada)</option>
              <option>Envio institucional</option>
            </select>
          </FormField>
          <FormField label="Data / hora" required>
            <input type="datetime-local" value={form.dataHora} onChange={(e) => setForm({ ...form, dataHora: e.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Público-alvo" required>
            <select value={form.publicoAlvo} onChange={(e) => setForm({ ...form, publicoAlvo: e.target.value as PublicationRecord['publicoAlvo'] })} className={inputClass}>
              <option>Alunos / EE autenticados</option>
              <option>Direção e Secretariado</option>
              <option>Coordenação</option>
            </select>
          </FormField>
        </div>
        <FormField label="Mensagem informativa (opcional)">
          <input value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className={inputClass} />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => handlePublish('schedule')}>Agendar</Button>
          <Button variant="primary" size="sm" onClick={() => handlePublish('publish')}>
            <Globe className="w-3.5 h-3.5" />
            Publicar (exige aprovação K12)
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-bold text-[#112A4A]">
          Histórico e registo de publicações
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Conjunto</th>
                <th className="text-left py-3 px-4 font-semibold">Canal / Público</th>
                <th className="text-left py-3 px-4 font-semibold">Data/Hora</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {publications.map((pub) => (
                <tr key={pub.id}>
                  <td className="py-3 px-5">
                    <div className="font-semibold text-[#112A4A]">{pub.conjuntoLabel}</div>
                    <div className="text-xs text-[#536477]">{pub.mensagem}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#536477]">
                    <div>{pub.canal}</div>
                    <div>{pub.publicoAlvo}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{formatDateTimePT(pub.dataHora)}</td>
                  <td className="py-3 px-4"><StatusLabel status={pub.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => toast({ type: 'info', title: 'Notificação enviada ao público-alvo' })}>
                        <Send className="w-3.5 h-3.5" />
                        Notificar
                      </Button>
                      {pub.estado !== 'Suspensa' && (
                        <Button variant="danger" size="sm" onClick={() => handleSuspend(pub)}>
                          <PauseCircle className="w-3.5 h-3.5" />
                          Suspender
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
    </div>
  );
};
