import React, { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  FileText,
  Lock,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import {
  ClassificationRectification,
  ConsultationRequest,
  JneComplaint,
  ProofAvailability,
  ReappraisalRequest,
  ReappraisalTracking,
  ScoreRectificationRequest,
} from '../types/sigen';
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
 * K14 · Pedidos de consulta de prova
 * ========================================================================== */
export const K14ConsultationsScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, activeInstitution, activePhase, currentUser, logAudit, toast, openPrintDoc } = useSigen();
  const list = state.consultations.filter((c) => c.institutionId === activeInstitutionId);
  const results = state.results.filter((r) => r.institutionId === activeInstitutionId);

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({
    alunoNome: results[0]?.alunoNome || 'Tiago Manuel Teixeira',
    alunoRef: results[0]?.alunoRef || '2026-014',
    provaCodigo: '635',
    provaNome: 'Matemática A',
    modelo: 'Modelo 09/JNE (Referência Norma 03)',
    anexoAssinado: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.alunoNome.trim()) return;
    const created: ConsultationRequest = {
      id: `cons-${Date.now()}`,
      institutionId: activeInstitutionId,
      codigoProcesso: `CONS-2026-${String(list.length + 1).padStart(3, '0')}`,
      alunoRef: form.alunoRef,
      alunoNome: form.alunoNome,
      provaCodigo: form.provaCodigo,
      provaNome: form.provaNome,
      fase: activePhase,
      modelo: form.modelo,
      dataPedido: nowIso(),
      anexoAssinado: form.anexoAssinado || undefined,
      estado: 'Submetido',
    };
    updateState((prev) => ({ ...prev, consultations: [created, ...prev.consultations] }));
    logAudit({ entidade: created.codigoProcesso, ecra: 'K14', acao: 'Criação de pedido de consulta', detalhe: `${created.alunoNome} · ${created.provaNome}` });
    setNewOpen(false);
    toast({ type: 'success', title: `Pedido ${created.codigoProcesso} registado` });
  };

  const updateItem = (id: string, patch: Partial<ConsultationRequest>, msg: string) => {
    updateState((prev) => ({
      ...prev,
      consultations: prev.consultations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    toast({ type: 'success', title: msg });
  };

  const printReceipt = (c: ConsultationRequest) => {
    openPrintDoc({
      title: `Recibo de Pedido de Consulta de Prova — ${c.codigoProcesso}`,
      docCode: `K14-${c.codigoProcesso}`,
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Dados do Pedido',
          rows: [
            { label: 'Processo', value: c.codigoProcesso },
            { label: 'Aluno', value: `${c.alunoNome} (${c.alunoRef})` },
            { label: 'Prova / Fase', value: `${c.provaCodigo} · ${c.provaNome} (${c.fase})` },
            { label: 'Modelo de referência', value: c.modelo },
            { label: 'Data do pedido', value: formatDateTimePT(c.dataPedido) },
            { label: 'Anexo assinado', value: c.anexoAssinado || 'Pendente de entrega' },
            { label: 'Estado', value: c.estado },
          ],
          note: 'Confirmar versão do Modelo 09, prazos e formalidades na Norma 03 em vigor antes de operacionalização oficial.',
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K14"
        actions={
          <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4" />
            Novo pedido
          </Button>
        }
      />

      <NoticeBar tone="info" title="Referência normativa (Norma 03)">
        Modelo 09 indicado como referência operacional; confirmar versão oficial, prazos úteis e
        formalidades na Norma 03 em vigor.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Processo / Aluno</th>
                <th className="text-left py-3 px-4 font-semibold">Prova / Modelo</th>
                <th className="text-left py-3 px-4 font-semibold">Anexo assinado</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-5">
                    <div className="font-mono text-xs font-bold text-[#087E91]">{c.codigoProcesso}</div>
                    <div className="font-semibold text-[#112A4A]">{c.alunoNome}</div>
                    <div className="text-xs text-[#536477] tabular-nums">{formatDateTimePT(c.dataPedido)}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-medium text-[#112A4A]">{c.provaCodigo} · {c.provaNome} ({c.fase})</div>
                    <div className="text-[#536477]">{c.modelo}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#536477]">
                    {c.anexoAssinado || 'Sem anexo'}
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={c.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {!c.anexoAssinado && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateItem(c.id, { anexoAssinado: `Mod09_${c.codigoProcesso}_assinado.pdf` }, 'Modelo 09 anexado')}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Anexar modelo
                        </Button>
                      )}
                      {c.estado === 'Submetido' && (
                        <Button variant="teal" size="sm" onClick={() => updateItem(c.id, { estado: 'Validado' }, 'Pedido validado')}>
                          Validar
                        </Button>
                      )}
                      {c.estado === 'Validado' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateItem(c.id, { estado: 'Agendado', dataEntregaAgendada: '2026-11-24 10:00' }, 'Entrega agendada')}
                        >
                          Agendar entrega
                        </Button>
                      )}
                      {c.estado !== 'Concluído' && (
                        <Button variant="primary" size="sm" onClick={() => updateItem(c.id, { estado: 'Concluído' }, 'Pedido concluído e arquivado')}>
                          Concluir
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => printReceipt(c)}>
                        <FileText className="w-3.5 h-3.5" />
                        Recibo
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} title="Novo pedido de consulta de prova (K14)" onClose={() => setNewOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nome do aluno" required>
              <input value={form.alunoNome} onChange={(e) => setForm({ ...form, alunoNome: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Ref. processo aluno" required>
              <input value={form.alunoRef} onChange={(e) => setForm({ ...form, alunoRef: e.target.value })} className={`${inputClass} font-mono`} />
            </FormField>
          </div>
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
          <FormField label="Anexo assinado (Modelo 09)" conditional>
            <input value={form.anexoAssinado} onChange={(e) => setForm({ ...form, anexoAssinado: e.target.value })} placeholder="Ex.: Mod09_Assinado.pdf" className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Criar pedido</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K15 · Disponibilização de prova para consulta
 * ========================================================================== */
export const K15AvailabilityScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, activeInstitution, currentUser, logAudit, toast, openPrintDoc } = useSigen();
  const availabilities = state.availabilities.filter((a) => a.institutionId === activeInstitutionId);
  const consultations = state.consultations.filter((c) => c.institutionId === activeInstitutionId);

  const [prepOpen, setPrepOpen] = useState(false);
  const [form, setForm] = useState({
    pedidoId: consultations[0]?.id || '',
    meioEntrega: 'Portal autenticado' as ProofAvailability['meioEntrega'],
  });

  const handlePrepare = (e: React.FormEvent) => {
    e.preventDefault();
    const ped = consultations.find((c) => c.id === form.pedidoId);
    if (!ped) return;
    const created: ProofAvailability = {
      id: `av-${Date.now()}`,
      institutionId: activeInstitutionId,
      pedidoId: ped.id,
      codigoProcesso: ped.codigoProcesso,
      alunoNome: ped.alunoNome,
      provaNome: `${ped.provaCodigo} · ${ped.provaNome}`,
      ficheiroProva: `Copia_Autorizada_${ped.codigoProcesso}.pdf`,
      dataDisponibilizacao: nowIso(),
      meioEntrega: form.meioEntrega,
      estado: 'Em preparação',
      registoAcessos: [{ dataHora: nowIso(), utilizador: currentUser?.nome || 'Secretariado', acao: 'Cópia preparada' }],
    };
    updateState((prev) => ({ ...prev, availabilities: [created, ...prev.availabilities] }));
    logAudit({ entidade: ped.codigoProcesso, ecra: 'K15', acao: 'Preparação de cópia para consulta', detalhe: created.ficheiroProva });
    setPrepOpen(false);
    toast({ type: 'success', title: 'Cópia preparada respeitando anonimato de terceiros' });
  };

  const mutateAccess = (av: ProofAvailability, nextEstado: ProofAvailability['estado'], acaoLabel: string) => {
    updateState((prev) => ({
      ...prev,
      availabilities: prev.availabilities.map((x) =>
        x.id === av.id
          ? {
              ...x,
              estado: nextEstado,
              comprovativo: nextEstado === 'Entregue' ? `Comprovativo_${av.codigoProcesso}.pdf` : x.comprovativo,
              registoAcessos: [{ dataHora: nowIso(), utilizador: currentUser?.nome || 'Utilizador', acao: acaoLabel }, ...x.registoAcessos],
            }
          : x
      ),
    }));
    logAudit({ entidade: av.codigoProcesso, ecra: 'K15', acao: acaoLabel, detalhe: `${av.ficheiroProva} (${nextEstado})`, sensivel: true });
    toast({ type: nextEstado === 'Acesso revogado' ? 'warning' : 'success', title: `${av.codigoProcesso}: ${acaoLabel}` });
  };

  const emitTermo = (av: ProofAvailability) => {
    openPrintDoc({
      title: `Termo de Disponibilização de Prova — ${av.codigoProcesso}`,
      docCode: `K15-${av.codigoProcesso}`,
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Detalhes de Entrega e Acesso',
          rows: [
            { label: 'Pedido', value: av.codigoProcesso },
            { label: 'Aluno', value: av.alunoNome },
            { label: 'Prova', value: av.provaNome },
            { label: 'Ficheiro disponibilizado', value: av.ficheiroProva },
            { label: 'Meio de entrega', value: av.meioEntrega },
            { label: 'Estado atual', value: av.estado },
          ],
        },
        {
          heading: 'Registo de Quem Acedeu e Quando',
          table: {
            headers: ['Data/Hora', 'Utilizador', 'Ação'],
            rows: av.registoAcessos.map((r) => [formatDateTimePT(r.dataHora), r.utilizador, r.acao]),
          },
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K15"
        actions={
          <Button variant="primary" size="sm" onClick={() => setPrepOpen(true)}>
            <Plus className="w-4 h-4" />
            Preparar cópia
          </Button>
        }
      />

      <div className="space-y-4">
        {availabilities.map((av) => (
          <div key={av.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#087E91]">{av.codigoProcesso}</span>
                  <span>·</span>
                  <span className="text-[#536477]">{av.meioEntrega}</span>
                  <span>·</span>
                  <StatusLabel status={av.estado} />
                </div>
                <h2 className="font-display text-base font-bold text-[#112A4A] mt-1">
                  {av.alunoNome} — {av.provaNome}
                </h2>
                <div className="text-xs text-[#536477] mt-0.5 font-mono">{av.ficheiroProva}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {av.estado === 'Em preparação' && (
                  <Button variant="teal" size="sm" onClick={() => mutateAccess(av, 'Disponibilizada', 'Acesso concedido ao requerente')}>
                    Disponibilizar
                  </Button>
                )}
                {av.estado === 'Disponibilizada' && (
                  <Button variant="primary" size="sm" onClick={() => mutateAccess(av, 'Entregue', 'Entrega confirmada com comprovativo')}>
                    Registar entrega
                  </Button>
                )}
                {av.estado !== 'Acesso revogado' && (
                  <Button variant="danger" size="sm" onClick={() => mutateAccess(av, 'Acesso revogado', 'Acesso revogado e encerrado')}>
                    <Lock className="w-3.5 h-3.5" />
                    Revogar acesso
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => emitTermo(av)}>
                  <FileText className="w-3.5 h-3.5" />
                  Termo PDF
                </Button>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs text-[#536477]">
              <strong className="text-[#112A4A]">Registo de acessos:</strong>{' '}
              {av.registoAcessos.map((r) => `${formatDateTimePT(r.dataHora)} (${r.utilizador}: ${r.acao})`).join(' · ')}
            </div>
          </div>
        ))}
      </div>

      <Modal open={prepOpen} title="Preparar cópia de prova para consulta (K15)" onClose={() => setPrepOpen(false)}>
        <form onSubmit={handlePrepare} className="space-y-4">
          <FormField label="Pedido de consulta (K14)" required>
            <select value={form.pedidoId} onChange={(e) => setForm({ ...form, pedidoId: e.target.value })} className={inputClass}>
              {consultations.map((c) => (
                <option key={c.id} value={c.id}>{c.codigoProcesso} · {c.alunoNome} ({c.provaNome})</option>
              ))}
            </select>
          </FormField>
          <FormField label="Meio de entrega" required>
            <select value={form.meioEntrega} onChange={(e) => setForm({ ...form, meioEntrega: e.target.value as ProofAvailability['meioEntrega'] })} className={inputClass}>
              <option>Portal autenticado</option>
              <option>Presencial secretariado</option>
              <option>Link temporário cifrado</option>
            </select>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPrepOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Preparar cópia</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K16 · Pedido de retificação de cotações
 * ========================================================================== */
export const K16ScoreRectificationScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, logAudit, toast } = useSigen();
  const list = state.scoreRectifications.filter((r) => r.institutionId === activeInstitutionId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ provaNome: '635 · Matemática A', alunoNome: '', itemCotacao: '', modelo10: 'Modelo_10_Ref.pdf', fundamentacao: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.alunoNome.trim() || !form.itemCotacao.trim() || !form.fundamentacao.trim()) return;
    const created: ScoreRectificationRequest = {
      id: `srect-${Date.now()}`,
      institutionId: activeInstitutionId,
      codigoProcesso: `RET-COT-2026-${String(list.length + 1).padStart(2, '0')}`,
      provaNome: form.provaNome,
      alunoNome: form.alunoNome,
      itemCotacao: form.itemCotacao,
      modelo10: form.modelo10,
      fundamentacao: form.fundamentacao,
      data: nowIso().slice(0, 10),
      estado: 'Criado',
    };
    updateState((prev) => ({ ...prev, scoreRectifications: [created, ...prev.scoreRectifications] }));
    logAudit({ entidade: created.codigoProcesso, ecra: 'K16', acao: 'Criação de pedido de retificação de cotações', detalhe: created.itemCotacao });
    setOpen(false);
    toast({ type: 'success', title: `Pedido ${created.codigoProcesso} registado (nota não alterada)` });
  };

  const setEstado = (id: string, estado: ScoreRectificationRequest['estado'], decisaoDoc?: string) => {
    updateState((prev) => ({
      ...prev,
      scoreRectifications: prev.scoreRectifications.map((x) =>
        x.id === id ? { ...x, estado, decisaoDoc: decisaoDoc ?? x.decisaoDoc } : x
      ),
    }));
    toast({ type: 'info', title: `Estado atualizado: ${estado}` });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K16"
        actions={<Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />Criar pedido</Button>}
      />
      <NoticeBar tone="warning" title="Restrição normativa">
        Aplicabilidade e legitimidade dependem da Norma 03. O SIGEN nunca altera classificações por simples pedido — exige decisão formal vinculada.
      </NoticeBar>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Processo / Aluno</th>
                <th className="text-left py-3 px-4 font-semibold">Item / Fundamentação</th>
                <th className="text-left py-3 px-4 font-semibold">Modelo 10 / Decisão</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-5">
                    <div className="font-mono text-xs font-bold text-[#087E91]">{r.codigoProcesso}</div>
                    <div className="font-semibold text-[#112A4A]">{r.alunoNome}</div>
                    <div className="text-xs text-[#536477]">{r.provaNome} · {r.data}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-semibold text-[#112A4A]">{r.itemCotacao}</div>
                    <div className="text-[#536477]">{r.fundamentacao}</div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-[#536477]">
                    <div>{r.modelo10 || 'Sem anexo'}</div>
                    {r.decisaoDoc && <div className="text-[#286B42]">{r.decisaoDoc}</div>}
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={r.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {r.estado === 'Criado' && <Button variant="teal" size="sm" onClick={() => setEstado(r.id, 'Encaminhado')}>Encaminhar</Button>}
                      {r.estado === 'Encaminhado' && (
                        <Button variant="primary" size="sm" onClick={() => setEstado(r.id, 'Decisão registada', `Decisao_${r.codigoProcesso}.pdf`)}>
                          Registar decisão
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setEstado(r.id, 'Notificado')}>
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

      <Modal open={open} title="Criar pedido de retificação de cotações (K16)" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prova" required>
              <input value={form.provaNome} onChange={(e) => setForm({ ...form, provaNome: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Aluno" required>
              <input value={form.alunoNome} onChange={(e) => setForm({ ...form, alunoNome: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Item / cotação" required>
              <input value={form.itemCotacao} onChange={(e) => setForm({ ...form, itemCotacao: e.target.value })} placeholder="Ex.: Item 2.2 (32/40)" className={inputClass} />
            </FormField>
            <FormField label="Modelo 10 (ficheiro)" conditional>
              <input value={form.modelo10} onChange={(e) => setForm({ ...form, modelo10: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Fundamentação" required>
            <textarea rows={3} value={form.fundamentacao} onChange={(e) => setForm({ ...form, fundamentacao: e.target.value })} className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Criar pedido</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K17 · Pedido de reapreciação
 * ========================================================================== */
export const K17ReappraisalRequestScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, activePhase, logAudit, toast, navigate } = useSigen();
  const list = state.reappraisals.filter((r) => r.institutionId === activeInstitutionId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    provaCodigo: '635',
    provaNome: 'Matemática A',
    requerente: '',
    modelo12: 'Modelo_12A_Reapreciacao.pdf',
    fundamentacao: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requerente.trim()) return;
    const created: ReappraisalRequest = {
      id: `reap-${Date.now()}`,
      institutionId: activeInstitutionId,
      codigoProcesso: `REAP-2026-${String(list.length + 5).padStart(3, '0')}`,
      provaCodigo: form.provaCodigo,
      provaNome: form.provaNome,
      fase: activePhase,
      requerente: form.requerente,
      modelo12: form.modelo12,
      fundamentacao: form.fundamentacao,
      dataEntrada: nowIso(),
      pagamento: 'Pendente',
      documentosVerificados: false,
      estado: 'Criado',
    };
    updateState((prev) => ({ ...prev, reappraisals: [created, ...prev.reappraisals] }));
    logAudit({ entidade: created.codigoProcesso, ecra: 'K17', acao: 'Criação de pedido de reapreciação', detalhe: created.requerente });
    setOpen(false);
    toast({ type: 'success', title: `Dossiê ${created.codigoProcesso} iniciado` });
  };

  const handleForwardToK18 = (r: ReappraisalRequest) => {
    if (!r.documentosVerificados) {
      toast({ type: 'error', title: 'Verifique primeiro a checklist documental' });
      return;
    }
    const tracking: ReappraisalTracking = {
      id: `rtr-${Date.now()}`,
      institutionId: activeInstitutionId,
      processoCodigo: r.codigoProcesso,
      requerente: r.requerente,
      provaNome: `${r.provaCodigo} · ${r.provaNome}`,
      entidadeDestino: 'Delegação Regional JNE',
      dataEnvio: nowIso(),
      referenciaOficial: `REM-${r.codigoProcesso}`,
      classificacaoAnterior: 150,
      estado: 'A aguardar envio',
    };
    updateState((prev) => ({
      ...prev,
      reappraisals: prev.reappraisals.map((x) => (x.id === r.id ? { ...x, estado: 'Encaminhado' } : x)),
      reappraisalTrackings: prev.reappraisalTrackings.some((t) => t.processoCodigo === r.codigoProcesso)
        ? prev.reappraisalTrackings
        : [tracking, ...prev.reappraisalTrackings],
    }));
    logAudit({ entidade: r.codigoProcesso, ecra: 'K17', acao: 'Encaminhamento de reapreciação para K18', detalhe: 'Remessa registada.' });
    toast({ type: 'success', title: 'Remessa registada · Acompanhar em K18' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K17"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate('K18')}>Acompanhar em K18</Button>
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />Criar pedido</Button>
          </>
        }
      />

      <NoticeBar tone="info" title="Conformidade Norma 03">
        Modelos 12/12-A, prazos, valores de caução e legitimidade exigem confirmação na Norma 03. Sem decisão oficial não existe alteração de nota.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Processo / Requerente</th>
                <th className="text-left py-3 px-4 font-semibold">Prova / Modelo 12</th>
                <th className="text-left py-3 px-4 font-semibold">Pagamento</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-5">
                    <div className="font-mono text-xs font-bold text-[#087E91]">{r.codigoProcesso}</div>
                    <div className="font-semibold text-[#112A4A]">{r.requerente}</div>
                    <div className="text-xs text-[#536477] tabular-nums">{formatDateTimePT(r.dataEntrada)}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-medium text-[#112A4A]">{r.provaCodigo} · {r.provaNome}</div>
                    <div className="font-mono text-[#536477]">{r.modelo12}</div>
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={r.pagamento} /></td>
                  <td className="py-3 px-4"><StatusLabel status={r.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {!r.documentosVerificados && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              reappraisals: prev.reappraisals.map((x) =>
                                x.id === r.id ? { ...x, documentosVerificados: true, estado: 'Documentação validada' } : x
                              ),
                            }));
                            toast({ type: 'success', title: 'Checklist documental verificada' });
                          }}
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          Verificar docs
                        </Button>
                      )}
                      {r.pagamento === 'Pendente' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              reappraisals: prev.reappraisals.map((x) => (x.id === r.id ? { ...x, pagamento: 'Confirmado' } : x)),
                            }));
                            toast({ type: 'success', title: 'Pagamento/caução confirmado' });
                          }}
                        >
                          Registar pagamento
                        </Button>
                      )}
                      {r.estado !== 'Encaminhado' && (
                        <Button variant="teal" size="sm" onClick={() => handleForwardToK18(r)}>Encaminhar</Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => toast({ type: 'info', title: `Requerente ${r.requerente} notificado` })}>
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

      <Modal open={open} title="Criar pedido de reapreciação (K17)" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Requerente (Aluno / EE)" required>
            <input value={form.requerente} onChange={(e) => setForm({ ...form, requerente: e.target.value })} className={inputClass} />
          </FormField>
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
            <FormField label="Modelo 12 / 12-A" required>
              <input value={form.modelo12} onChange={(e) => setForm({ ...form, modelo12: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Fundamentação / Alegação" conditional>
            <textarea rows={3} value={form.fundamentacao} onChange={(e) => setForm({ ...form, fundamentacao: e.target.value })} className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Criar dossiê</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K18 · Reapreciação — acompanhamento e decisão
 * ========================================================================== */
export const K18ReappraisalTrackingScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast, navigate } = useSigen();
  const trackings = state.reappraisalTrackings.filter((t) => t.institutionId === activeInstitutionId);
  const [decisionTarget, setDecisionTarget] = useState<ReappraisalTracking | null>(null);
  const [decDoc, setDecDoc] = useState('Decisao_Oficial_Reapreciacao.pdf');
  const [newGrade, setNewGrade] = useState(160);

  const handleSaveResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionTarget || !decDoc.trim()) return;
    updateState((prev) => ({
      ...prev,
      reappraisalTrackings: prev.reappraisalTrackings.map((t) =>
        t.id === decisionTarget.id
          ? { ...t, decisaoDoc: decDoc, novaClassificacao: newGrade, estado: 'Resposta registada' }
          : t
      ),
    }));
    logAudit({ entidade: decisionTarget.processoCodigo, ecra: 'K18', acao: 'Registo de resposta de reapreciação', detalhe: `Doc: ${decDoc} · Nova classificação: ${newGrade}` });
    setDecisionTarget(null);
    toast({ type: 'success', title: 'Resposta anexada — pendente validação e atualização controlada' });
  };

  const handleUpdateResultControlled = (t: ReappraisalTracking) => {
    if (!t.decisaoDoc || t.novaClassificacao === undefined) {
      toast({ type: 'error', title: 'Exige decisão oficial anexada antes de atualizar resultado' });
      return;
    }
    // Creates controlled rectification in K20!
    const rect: ClassificationRectification = {
      id: `crect-${Date.now()}`,
      institutionId: activeInstitutionId,
      resultadoId: state.results.find((r) => r.institutionId === activeInstitutionId)?.id || 'res-03',
      alunoNome: t.requerente,
      provaNome: t.provaNome,
      valorAnterior: String(t.classificacaoAnterior),
      valorNovo: String(t.novaClassificacao),
      documentoDecisao: t.decisaoDoc,
      proponente: currentUser?.nome || 'Coordenação',
      dataEfeito: nowIso().slice(0, 10),
      estado: 'Proposta',
    };
    updateState((prev) => ({
      ...prev,
      reappraisalTrackings: prev.reappraisalTrackings.map((x) =>
        x.id === t.id ? { ...x, estado: 'Resultado atualizado' } : x
      ),
      classificationRectifications: [rect, ...prev.classificationRectifications],
    }));
    logAudit({ entidade: t.processoCodigo, ecra: 'K18', acao: 'Abertura de retificação controlada (K20)', detalhe: `${t.classificacaoAnterior} → ${t.novaClassificacao}` });
    toast({ type: 'success', title: 'Proposta de atualização enviada para aprovação em K20' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K18"
        actions={<Button variant="secondary" size="sm" onClick={() => navigate('K20')}>Abrir Livro de Retificações (K20)</Button>}
      />

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Processo / Destino</th>
                <th className="text-left py-3 px-4 font-semibold">Ref. Oficial / Decisão</th>
                <th className="text-right py-3 px-4 font-semibold">Classificação</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {trackings.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 px-5">
                    <div className="font-mono text-xs font-bold text-[#087E91]">{t.processoCodigo}</div>
                    <div className="font-semibold text-[#112A4A]">{t.requerente}</div>
                    <div className="text-xs text-[#536477]">{t.entidadeDestino} · {t.provaNome}</div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-[#536477]">
                    <div>{t.referenciaOficial}</div>
                    {t.decisaoDoc && <div className="text-[#286B42]">{t.decisaoDoc}</div>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    <div>Ant.: {t.classificacaoAnterior}</div>
                    {t.novaClassificacao !== undefined && (
                      <div className="font-bold text-[#087E91]">Nova: {t.novaClassificacao}</div>
                    )}
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={t.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {t.estado === 'A aguardar envio' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              reappraisalTrackings: prev.reappraisalTrackings.map((x) => (x.id === t.id ? { ...x, estado: 'Enviado', dataEnvio: nowIso() } : x)),
                            }));
                            toast({ type: 'info', title: 'Marcado como enviado' });
                          }}
                        >
                          Marcar enviado
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setDecisionTarget(t);
                          setNewGrade(t.novaClassificacao ?? t.classificacaoAnterior);
                        }}
                      >
                        Registar resposta
                      </Button>
                      {t.estado === 'Resposta registada' && (
                        <Button
                          variant="teal"
                          size="sm"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              reappraisalTrackings: prev.reappraisalTrackings.map((x) => (x.id === t.id ? { ...x, estado: 'Decisão validada' } : x)),
                            }));
                            toast({ type: 'success', title: 'Decisão validada' });
                          }}
                        >
                          Validar decisão
                        </Button>
                      )}
                      {t.estado === 'Decisão validada' && (
                        <Button variant="primary" size="sm" onClick={() => handleUpdateResultControlled(t)}>
                          Atualizar resultado (K20)
                        </Button>
                      )}
                      {t.estado !== 'Encerrado' && t.decisaoDoc && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              reappraisalTrackings: prev.reappraisalTrackings.map((x) => (x.id === t.id ? { ...x, estado: 'Encerrado' } : x)),
                            }));
                            toast({ type: 'info', title: 'Processo encerrado e arquivado' });
                          }}
                        >
                          Encerrar
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

      <Modal open={!!decisionTarget} title="Registar resposta e decisão oficial" subtitle={decisionTarget?.processoCodigo} onClose={() => setDecisionTarget(null)}>
        <form onSubmit={handleSaveResponse} className="space-y-4">
          <FormField label="Documento de decisão (obrigatório no fecho)" required>
            <input value={decDoc} onChange={(e) => setDecDoc(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Nova classificação (escala 0–200 · importação autorizada)" required>
            <input type="number" min={0} max={200} value={newGrade} onChange={(e) => setNewGrade(Number(e.target.value))} className={`${inputClass} font-mono`} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDecisionTarget(null)}>Cancelar</Button>
            <Button type="submit" variant="primary">Anexar resposta</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K19 · Reclamação ao Presidente do JNE
 * ========================================================================== */
export const K19JneComplaintScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, logAudit, toast } = useSigen();
  const list = state.jneComplaints.filter((c) => c.institutionId === activeInstitutionId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    processoOrigem: 'REAP-2026-004',
    requerente: '',
    modelo16: 'Modelo_16A_Reclamacao.pdf',
    fundamentacaoAnexo: 'Alegacao_Formal.pdf',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requerente.trim()) return;
    const created: JneComplaint = {
      id: `jne-${Date.now()}`,
      institutionId: activeInstitutionId,
      codigoReclamacao: `RECL-JNE-2026-${String(list.length + 1).padStart(2, '0')}`,
      processoOrigem: form.processoOrigem,
      requerente: form.requerente,
      modelo16: form.modelo16,
      fundamentacaoAnexo: form.fundamentacaoAnexo,
      dataEntrada: nowIso(),
      prazoLimiteRef: '2 dias úteis após afixação reapreciação (confirmar Norma 03)',
      estado: 'Criada',
    };
    updateState((prev) => ({ ...prev, jneComplaints: [created, ...prev.jneComplaints] }));
    logAudit({ entidade: created.codigoReclamacao, ecra: 'K19', acao: 'Registo de reclamação ao JNE', detalhe: `Origem: ${created.processoOrigem}` });
    setOpen(false);
    toast({ type: 'success', title: `Reclamação ${created.codigoReclamacao} registada` });
  };

  const setEstado = (id: string, estado: JneComplaint['estado'], decisaoDoc?: string) => {
    updateState((prev) => ({
      ...prev,
      jneComplaints: prev.jneComplaints.map((c) => (c.id === id ? { ...c, estado, decisaoDoc: decisaoDoc ?? c.decisaoDoc } : c)),
    }));
    toast({ type: 'info', title: `Reclamação: ${estado}` });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K19"
        actions={<Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />Criar reclamação</Button>}
      />

      <NoticeBar tone="info" title="Sistema de acompanhamento">
        Tramitação, destinatário e prazos devem seguir a Norma 03 confirmada. O SIGEN atua como sistema de registo e acompanhamento documental.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Reclamação / Origem</th>
                <th className="text-left py-3 px-4 font-semibold">Documentos (Mod. 16/16-A)</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-5">
                    <div className="font-mono text-xs font-bold text-[#087E91]">{c.codigoReclamacao}</div>
                    <div className="font-semibold text-[#112A4A]">{c.requerente}</div>
                    <div className="text-xs text-[#536477]">Origem: {c.processoOrigem}</div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-[#536477]">
                    <div>{c.modelo16}</div>
                    <div>{c.fundamentacaoAnexo}</div>
                    {c.decisaoDoc && <div className="text-[#286B42]">{c.decisaoDoc}</div>}
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={c.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => toast({ type: 'info', title: 'Prazo de referência (Norma 03)', detail: c.prazoLimiteRef })}>
                        <CalendarClock className="w-3.5 h-3.5" />
                        Consultar prazo
                      </Button>
                      {c.estado === 'Criada' && (
                        <Button variant="secondary" size="sm" onClick={() => setEstado(c.id, 'Documentação validada')}>Validar doc.</Button>
                      )}
                      {c.estado === 'Documentação validada' && (
                        <Button variant="teal" size="sm" onClick={() => setEstado(c.id, 'Encaminhada')}>Encaminhar</Button>
                      )}
                      {c.estado === 'Encaminhada' && (
                        <Button variant="primary" size="sm" onClick={() => setEstado(c.id, 'Decisão registada', `Decisao_JNE_${c.codigoReclamacao}.pdf`)}>
                          Registar decisão
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setEstado(c.id, 'Notificada')}>Notificar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} title="Registar reclamação ao Presidente do JNE (K19)" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Processo de origem (Reapreciação K18)" required>
            <input value={form.processoOrigem} onChange={(e) => setForm({ ...form, processoOrigem: e.target.value })} className={`${inputClass} font-mono`} />
          </FormField>
          <FormField label="Requerente" required>
            <input value={form.requerente} onChange={(e) => setForm({ ...form, requerente: e.target.value })} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Modelo 16 / 16-A" required>
              <input value={form.modelo16} onChange={(e) => setForm({ ...form, modelo16: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Fundamentação (anexo)" required>
              <input value={form.fundamentacaoAnexo} onChange={(e) => setForm({ ...form, fundamentacaoAnexo: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Criar dossiê</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * K20 · Retificações e histórico de classificações
 * ========================================================================== */
export const K20RectificationsBookScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast, confirmAction } = useSigen();
  const list = state.classificationRectifications.filter((r) => r.institutionId === activeInstitutionId);
  const results = state.results.filter((r) => r.institutionId === activeInstitutionId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    resultadoId: results[0]?.id || '',
    valorNovo: '166',
    documentoDecisao: '',
    dataEfeito: nowIso().slice(0, 10),
  });

  const selectedRes = results.find((r) => r.id === form.resultadoId);

  const handlePropose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRes || !form.documentoDecisao.trim()) {
      toast({ type: 'error', title: 'Documento de decisão obrigatório' });
      return;
    }
    const created: ClassificationRectification = {
      id: `crect-${Date.now()}`,
      institutionId: activeInstitutionId,
      resultadoId: selectedRes.id,
      alunoNome: selectedRes.alunoNome,
      provaNome: `${selectedRes.provaCodigo} · ${selectedRes.provaNome}`,
      valorAnterior: String(selectedRes.resultado),
      valorNovo: form.valorNovo,
      documentoDecisao: form.documentoDecisao,
      proponente: currentUser?.nome || 'Coordenação',
      dataEfeito: form.dataEfeito,
      estado: 'Proposta',
    };
    updateState((prev) => ({ ...prev, classificationRectifications: [created, ...prev.classificationRectifications] }));
    logAudit({ entidade: selectedRes.alunoRef, ecra: 'K20', acao: 'Proposta de retificação de classificação', detalhe: `${created.valorAnterior} → ${created.valorNovo} (${created.documentoDecisao})` });
    setOpen(false);
    toast({ type: 'success', title: 'Proposta registada no Livro de Retificações' });
  };

  const handleApprove = (rect: ClassificationRectification) => {
    // Recommend dual control
    if (rect.proponente === currentUser?.nome && currentUser?.perfil !== 'ADMIN_CENTRAL') {
      toast({ type: 'error', title: 'Duplo controlo obrigatório', detail: 'A aprovação deve ser efetuada por responsável diferente do proponente.' });
      return;
    }
    updateState((prev) => ({
      ...prev,
      classificationRectifications: prev.classificationRectifications.map((x) =>
        x.id === rect.id ? { ...x, estado: 'Aprovada', aprovador: currentUser?.nome } : x
      ),
      results: prev.results.map((r) =>
        r.id === rect.resultadoId
          ? {
              ...r,
              resultado: Number.isNaN(Number(rect.valorNovo)) ? r.resultado : Number(rect.valorNovo),
              historico: [
                {
                  dataHora: nowIso(),
                  acao: 'Retificação aprovada (K20)',
                  autor: currentUser?.nome || 'Direção',
                  valorAnterior: rect.valorAnterior,
                  valorNovo: rect.valorNovo,
                  nota: `Documento: ${rect.documentoDecisao}`,
                },
                ...r.historico,
              ],
            }
          : r
      ),
    }));
    logAudit({
      entidade: rect.alunoNome,
      ecra: 'K20',
      acao: 'Aprovação de retificação de classificação',
      detalhe: `Aplicado ${rect.valorAnterior} → ${rect.valorNovo} com base em ${rect.documentoDecisao}.`,
      antes: { classificacao: rect.valorAnterior },
      depois: { classificacao: rect.valorNovo },
      sensivel: true,
    });
    toast({ type: 'success', title: 'Retificação aprovada e aplicada com histórico preservado' });
  };

  const handleRevert = (rect: ClassificationRectification) => {
    confirmAction({
      title: 'Reverter retificação (nova operação auditada)?',
      message: `A reversão não apaga o registo anterior — cria uma nova operação auditada que restaura o valor ${rect.valorAnterior}.`,
      confirmLabel: 'Executar reversão',
      danger: true,
      onConfirm: () => {
        const reversal: ClassificationRectification = {
          id: `crect-rev-${Date.now()}`,
          institutionId: activeInstitutionId,
          resultadoId: rect.resultadoId,
          alunoNome: rect.alunoNome,
          provaNome: rect.provaNome,
          valorAnterior: rect.valorNovo,
          valorNovo: rect.valorAnterior,
          documentoDecisao: `Reversao_Auditada_${rect.id}.pdf`,
          proponente: currentUser?.nome || 'Direção',
          aprovador: currentUser?.nome || 'Direção',
          dataEfeito: nowIso().slice(0, 10),
          estado: 'Revertida',
          motivoReversao: 'Operação de reversão auditada preservando versões anteriores.',
        };
        updateState((prev) => ({
          ...prev,
          classificationRectifications: [reversal, ...prev.classificationRectifications],
          results: prev.results.map((r) =>
            r.id === rect.resultadoId
              ? {
                  ...r,
                  resultado: Number.isNaN(Number(rect.valorAnterior)) ? r.resultado : Number(rect.valorAnterior),
                  historico: [
                    { dataHora: nowIso(), acao: 'Reversão auditada (K20)', autor: currentUser?.nome || 'Direção', valorAnterior: rect.valorNovo, valorNovo: rect.valorAnterior },
                    ...r.historico,
                  ],
                }
              : r
          ),
        }));
        logAudit({ entidade: rect.alunoNome, ecra: 'K20', acao: 'Reversão auditada de retificação', detalhe: `Restaurado ${rect.valorAnterior}.`, sensivel: true });
        toast({ type: 'warning', title: 'Reversão registada como nova operação auditada' });
      },
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="K20"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportCSV(
                  'livro_retificacoes_k20',
                  ['Aluno', 'Prova', 'ValorAnterior', 'ValorNovo', 'DocumentoDecisao', 'Proponente', 'Aprovador', 'DataEfeito', 'Estado'],
                  list.map((r) => [r.alunoNome, r.provaNome, r.valorAnterior, r.valorNovo, r.documentoDecisao, r.proponente, r.aprovador || '—', r.dataEfeito, r.estado])
                )
              }
            >
              Exportar histórico
            </Button>
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" />
              Propor retificação
            </Button>
          </>
        }
      />

      <NoticeBar tone="info" title="Livro imutável com duplo controlo">
        Sem edição direta em base de dados. Todas as alterações exigem documento de decisão anexado,
        validação e preservação integral de versões anteriores.
      </NoticeBar>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Aluno / Prova</th>
                <th className="text-right py-3 px-4 font-semibold">Anterior → Novo</th>
                <th className="text-left py-3 px-4 font-semibold">Decisão / Responsáveis</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-5">
                    <div className="font-semibold text-[#112A4A]">{r.alunoNome}</div>
                    <div className="text-xs text-[#536477]">{r.provaNome} · Efeito: {r.dataEfeito}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    <span className="text-[#536477]">{r.valorAnterior}</span>
                    <span className="mx-1.5">→</span>
                    <span className="font-bold text-[#087E91]">{r.valorNovo}</span>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-mono text-[#112A4A]">{r.documentoDecisao}</div>
                    <div className="text-[#536477]">Prop.: {r.proponente} {r.aprovador && `· Aprov.: ${r.aprovador}`}</div>
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={r.estado} /></td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex gap-1.5">
                      {r.estado === 'Proposta' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              classificationRectifications: prev.classificationRectifications.map((x) =>
                                x.id === r.id ? { ...x, estado: 'Decisão validada' } : x
                              ),
                            }));
                            toast({ type: 'info', title: 'Documento de decisão conferido' });
                          }}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Validar decisão
                        </Button>
                      )}
                      {(r.estado === 'Proposta' || r.estado === 'Decisão validada') && (
                        <Button variant="primary" size="sm" onClick={() => handleApprove(r)}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprovar
                        </Button>
                      )}
                      {r.estado === 'Aprovada' && (
                        <Button variant="danger" size="sm" onClick={() => handleRevert(r)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reverter
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

      <Modal open={open} title="Propor retificação de classificação (K20)" onClose={() => setOpen(false)}>
        <form onSubmit={handlePropose} className="space-y-4">
          <FormField label="Resultado a retificar (K11)" required>
            <select value={form.resultadoId} onChange={(e) => setForm({ ...form, resultadoId: e.target.value })} className={inputClass}>
              {results.map((r) => (
                <option key={r.id} value={r.id}>{r.alunoRef} · {r.alunoNome} ({r.provaCodigo}: {r.resultado})</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Valor anterior (leitura automática)">
              <input value={String(selectedRes?.resultado ?? '—')} disabled className={`${inputClass} font-mono`} />
            </FormField>
            <FormField label="Valor novo (apenas autorizado)" required>
              <input type="number" min={0} max={200} value={form.valorNovo} onChange={(e) => setForm({ ...form, valorNovo: e.target.value })} className={`${inputClass} font-mono`} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Documento de decisão (anexo)" required>
              <input value={form.documentoDecisao} onChange={(e) => setForm({ ...form, documentoDecisao: e.target.value })} placeholder="Ex.: Despacho_JNE_004.pdf" className={inputClass} />
            </FormField>
            <FormField label="Data de efeito" required>
              <input type="date" value={form.dataEfeito} onChange={(e) => setForm({ ...form, dataEfeito: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Submeter proposta</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
