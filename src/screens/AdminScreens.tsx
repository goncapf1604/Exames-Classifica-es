import { gerirConta } from '../sync/auth';
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  Copy,
  Eye,
  FileText,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import {
  AuditLog,
  CalendarConfig,
  Institution,
  NotificationRecord,
  ROLE_LABELS,
  UserAccount,
  UserRole,
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

/* ============================================================================
 * C02 · Painel inicial
 * ========================================================================== */
export const C02DashboardScreen: React.FC = () => {
  const {
    state,
    currentUser,
    activeInstitution,
    activeInstitutionId,
    activeYear,
    activePhase,
    navigate,
    openPrintDoc,
    setNotificationsOpen,
    refreshSync,
  } = useSigen();

  const [dateFrom, setDateFrom] = useState('2026-06-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const instLots = state.lots.filter((l) => l.institutionId === activeInstitutionId);
  const instResults = state.results.filter((r) => r.institutionId === activeInstitutionId);
  const instProofs = state.proofGradings.filter((p) => p.institutionId === activeInstitutionId);
  const instConsultations = state.consultations.filter((c) => c.institutionId === activeInstitutionId);
  const instReappraisals = state.reappraisals.filter((r) => r.institutionId === activeInstitutionId);

  const pendingTasks = useMemo(() => {
    const tasks: { id: string; screen: 'K02' | 'K05' | 'K08' | 'K11' | 'K12' | 'K14' | 'K18'; area: string; title: string; origem: string; status: string }[] = [];
    instLots
      .filter((l) => l.estado === 'Divergência' || l.estado === 'Recebido')
      .forEach((l) =>
        tasks.push({
          id: l.id,
          screen: 'K02',
          area: 'Custódia (K02)',
          title: `Lote ${l.codigoLote} (${l.provaNome}) aguarda conferência/resolução`,
          origem: 'Dados locais',
          status: l.estado,
        })
      );
    state.assignments
      .filter((a) => a.institutionId === activeInstitutionId && a.estado === 'Proposto')
      .forEach((a) =>
        tasks.push({
          id: a.id,
          screen: 'K05',
          area: 'Distribuição (K05)',
          title: `Lote ${a.loteCodigo} proposto a ${a.classificadorNome} aguarda aceitação`,
          origem: 'Dados locais',
          status: a.estado,
        })
      );
    instProofs
      .filter((p) => p.estado === 'Submetido' || p.divergenciaConferencia === 'Divergência detetada')
      .forEach((p) =>
        tasks.push({
          id: p.id,
          screen: 'K08',
          area: 'Conferência (K08)',
          title: `Prova ${p.codigoAnonimo} (${p.provaNome}) requer conferência de totais`,
          origem: 'Dados locais',
          status: p.divergenciaConferencia || p.estado,
        })
      );
    instResults
      .filter((r) => r.estado === 'Pendente' || r.estado === 'Discrepância')
      .forEach((r) =>
        tasks.push({
          id: r.id,
          screen: 'K11',
          area: 'Resultados (K11)',
          title: `Resultado ${r.alunoNome} (${r.provaCodigo}) pendente de validação`,
          origem: r.origem,
          status: r.estado,
        })
      );
    instConsultations
      .filter((c) => c.estado !== 'Concluído')
      .forEach((c) =>
        tasks.push({
          id: c.id,
          screen: 'K14',
          area: 'Consultas (K14)',
          title: `Pedido ${c.codigoProcesso} · ${c.alunoNome} (${c.provaNome})`,
          origem: 'Dados de exemplo',
          status: c.estado,
        })
      );
    instReappraisals
      .filter((r) => r.estado !== 'Notificado')
      .forEach((r) =>
        tasks.push({
          id: r.id,
          screen: 'K18',
          area: 'Reapreciação (K18)',
          title: `Processo ${r.codigoProcesso} · ${r.requerente}`,
          origem: 'Dados de exemplo',
          status: r.estado,
        })
      );
    return tasks;
  }, [instLots, state.assignments, activeInstitutionId, instProofs, instResults, instConsultations, instReappraisals]);

  const officialCount = instResults.filter((r) => r.origem === 'Fonte oficial').length;
  const localCount = instResults.filter((r) => r.origem.includes('local') || r.origem.includes('K10')).length;
  const exampleCount = instResults.filter((r) => r.origem === 'Dados de exemplo').length;

  const handleExportPdf = () => {
    openPrintDoc({
      title: 'Resumo Executivo do Painel Inicial (C02)',
      docCode: 'C02-RESUMO',
      origin: 'DOCUMENTO LOCAL · DADOS DE EXEMPLO',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Contexto do Relatório',
          rows: [
            { label: 'Ano letivo / Fase', value: `${activeYear} · ${activePhase}` },
            { label: 'Intervalo consultado', value: `${dateFrom} a ${dateTo}` },
            { label: 'Última sincronização', value: formatDateTimePT(state.lastSyncAt) },
            { label: 'Perfil emissor', value: currentUser ? ROLE_LABELS[currentUser.perfil] : '—' },
          ],
        },
        {
          heading: 'Distinção da Origem dos Dados',
          rows: [
            { label: 'Resultados (Dados de exemplo)', value: String(exampleCount) },
            { label: 'Resultados (Dados locais / simulação)', value: String(localCount) },
            { label: 'Resultados (Fonte oficial autorizada)', value: String(officialCount) },
            { label: 'Pendências operacionais abertas', value: String(pendingTasks.length) },
          ],
        },
        {
          heading: 'Quadro de Pendências',
          table: {
            headers: ['Área', 'Descrição', 'Origem', 'Estado'],
            rows: pendingTasks.map((t) => [t.area, t.title, t.origem, t.status]),
          },
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="C02"
        badgeText={`Última sincronização: ${formatDateTimePT(state.lastSyncAt)}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refreshSync}>
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
            <Button
              variant={showPendingOnly ? 'teal' : 'secondary'}
              size="sm"
              onClick={() => setShowPendingOnly((v) => !v)}
            >
              Abrir pendentes ({pendingTasks.length})
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setNotificationsOpen(true)}>
              <Bell className="w-3.5 h-3.5" />
              Notificações
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportPdf}>
              <FileText className="w-3.5 h-3.5" />
              Exportar resumo (PDF)
            </Button>
          </>
        }
      />

      {/* Explicit distinction of data origin per C02 spec */}
      <NoticeBar tone="info" title="Separação de origem de dados">
        Instituição ativa: <strong>{activeInstitution?.designacao}</strong> · Registos atuais:{' '}
        <span className="tabular-nums font-semibold">{exampleCount}</span> dados de exemplo ·{' '}
        <span className="tabular-nums font-semibold">{localCount}</span> dados locais ·{' '}
        <span className="tabular-nums font-semibold">{officialCount}</span> dados oficiais.
      </NoticeBar>

      {/* Optional date interval filter */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div className="w-44">
          <FormField label="Data início (opcional)">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <div className="w-44">
          <FormField label="Data fim (opcional)">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <div className="text-xs text-[#536477] pb-2.5">
          Contexto: <strong className="text-[#112A4A]">{activeYear}</strong> ·{' '}
          <strong className="text-[#112A4A]">{activePhase}</strong>
        </div>
      </div>

      <StatStrip
        items={[
          { label: 'Lotes em custódia', value: instLots.length, sub: `${instLots.filter((l) => l.estado === 'Divergência').length} com divergência`, accent: 'navy' },
          { label: 'Provas em correção/conferência', value: instProofs.length, sub: `${instProofs.filter((p) => p.estado === 'Confirmado').length} confirmadas`, accent: 'teal' },
          { label: 'Resultados registados', value: instResults.length, sub: `${officialCount} oficiais · ${localCount + exampleCount} locais/exemplo`, accent: 'green' },
          { label: 'Tarefas pendentes', value: pendingTasks.length, sub: 'Ações recomendadas para o perfil', accent: pendingTasks.length > 0 ? 'gold' : 'green' },
        ]}
      />

      {/* Pending tasks table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#112A4A]">
              Quadro de pendências operacionais
            </h2>
            <p className="text-xs text-[#536477]">
              Tarefas filtradas automaticamente para a instituição isolada ({activeInstitution?.codigoEscola}).
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('K01')}>
            Abrir Painel de Classificações (K01)
          </Button>
        </div>
        {pendingTasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#536477]">
            Sem pendências abertas para esta instituição.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                  <th className="text-left py-3 px-5 font-semibold">Área</th>
                  <th className="text-left py-3 px-4 font-semibold">Descrição da pendência</th>
                  <th className="text-left py-3 px-4 font-semibold">Origem</th>
                  <th className="text-left py-3 px-4 font-semibold">Estado</th>
                  <th className="text-right py-3 px-5 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5 font-mono text-xs text-[#087E91] whitespace-nowrap">
                      {task.area}
                    </td>
                    <td className="py-3 px-4 text-[#112A4A] font-medium">{task.title}</td>
                    <td className="py-3 px-4 text-xs text-[#536477] whitespace-nowrap">{task.origem}</td>
                    <td className="py-3 px-4">
                      <StatusLabel status={task.status} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Button variant="secondary" size="sm" onClick={() => navigate(task.screen)}>
                        Abrir {task.screen}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!showPendingOnly && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { id: 'K02' as const, title: 'Receção e custódia', desc: 'Registar lotes físicos, conferir quantidades e emitir termos PDF.' },
            { id: 'K07' as const, title: 'Cotações por item', desc: 'Lançar cotações em modo autorizado ou simulação com validação de intervalos.' },
            { id: 'K12' as const, title: 'Pautas e publicação', desc: 'Conferir checklist de privacidade, aprovar pautas e controlar divulgação.' },
          ].map((card) => (
            <div key={card.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono font-semibold text-[#087E91]">{card.id}</div>
                <h3 className="font-display text-base font-bold text-[#112A4A] mt-1">{card.title}</h3>
                <p className="text-xs text-[#536477] mt-1.5 leading-relaxed">{card.desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <Button variant="secondary" size="sm" onClick={() => navigate(card.id)}>
                  Aceder a {card.id}
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

/* ============================================================================
 * C03 · Instituições, agrupamentos e escolas
 * ========================================================================== */
export const C03InstitutionsScreen: React.FC = () => {
  const { state, updateState, logAudit, toast, confirmAction } = useSigen();
  const [search, setSearch] = useState('');
  const [parentFilter, setParentFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);

  const [form, setForm] = useState({
    designacao: '',
    codigoEscola: '',
    tipo: 'Escola Secundária' as Institution['tipo'],
    agrupamentoMaeId: '',
    morada: '',
    contacto: '',
    estado: 'Ativa' as Institution['estado'],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const agrupamentos = state.institutions.filter((i) => i.tipo === 'Agrupamento');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.institutions.filter((i) => {
      if (parentFilter && i.agrupamentoMaeId !== parentFilter && i.id !== parentFilter) return false;
      if (!q) return true;
      return (
        i.designacao.toLowerCase().includes(q) ||
        i.codigoEscola.toLowerCase().includes(q) ||
        i.morada.toLowerCase().includes(q)
      );
    });
  }, [state.institutions, search, parentFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({
      designacao: '',
      codigoEscola: '',
      tipo: 'Escola Secundária',
      agrupamentoMaeId: agrupamentos[0]?.id || '',
      morada: '',
      contacto: '',
      estado: 'Ativa',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (inst: Institution) => {
    setEditing(inst);
    setForm({
      designacao: inst.designacao,
      codigoEscola: inst.codigoEscola,
      tipo: inst.tipo,
      agrupamentoMaeId: inst.agrupamentoMaeId || '',
      morada: inst.morada,
      contacto: inst.contacto,
      estado: inst.estado,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.designacao.trim() || !form.codigoEscola.trim() || !form.morada.trim() || !form.contacto.trim()) {
      setFormError('Preencha todos os campos obrigatórios.');
      return;
    }
    const duplicate = state.institutions.find(
      (i) => i.codigoEscola.trim() === form.codigoEscola.trim() && i.id !== editing?.id
    );
    if (duplicate) {
      setFormError(`Já existe uma instituição com o código ${form.codigoEscola} neste contexto.`);
      return;
    }

    if (editing) {
      const updated: Institution = {
        ...editing,
        ...form,
        agrupamentoMaeId: form.tipo === 'Agrupamento' ? undefined : form.agrupamentoMaeId || undefined,
      };
      updateState((prev) => ({
        ...prev,
        institutions: prev.institutions.map((i) => (i.id === editing.id ? updated : i)),
      }));
      logAudit({
        entidade: updated.designacao,
        ecra: 'C03',
        acao: 'Edição de instituição',
        detalhe: `Atualizada ficha da entidade ${updated.codigoEscola}.`,
        antes: { designacao: editing.designacao, estado: editing.estado },
        depois: { designacao: updated.designacao, estado: updated.estado },
      });
      toast({ type: 'success', title: 'Instituição atualizada' });
    } else {
      const created: Institution = {
        id: `inst-${Date.now()}`,
        ...form,
        agrupamentoMaeId: form.tipo === 'Agrupamento' ? undefined : form.agrupamentoMaeId || undefined,
        criadaEm: nowIso().slice(0, 10),
        temHistorico: false,
      };
      updateState((prev) => ({
        ...prev,
        institutions: [...prev.institutions, created],
        users: prev.users.map((u) =>
          u.perfil === 'ADMIN_CENTRAL' ? { ...u, escolasIds: [...u.escolasIds, created.id] } : u
        ),
      }));
      logAudit({
        entidade: created.designacao,
        ecra: 'C03',
        acao: 'Criação de instituição',
        detalhe: `Criada entidade isolada código ${created.codigoEscola}.`,
      });
      toast({ type: 'success', title: 'Nova instituição criada com isolamento multi-tenant' });
    }
    setModalOpen(false);
  };

  const handleDeactivate = (inst: Institution) => {
    confirmAction({
      title: inst.estado === 'Ativa' ? 'Desativar instituição?' : 'Reativar instituição?',
      message:
        inst.estado === 'Ativa'
          ? `Desativar "${inst.designacao}" bloqueia novas operações. A eliminação física é impedida para preservar o histórico de auditoria.`
          : `Reativar "${inst.designacao}" volta a permitir operações autorizadas.`,
      confirmLabel: inst.estado === 'Ativa' ? 'Desativar' : 'Reativar',
      danger: inst.estado === 'Ativa',
      onConfirm: () => {
        const nextEstado = inst.estado === 'Ativa' ? 'Inativa' : 'Ativa';
        updateState((prev) => ({
          ...prev,
          institutions: prev.institutions.map((i) =>
            i.id === inst.id ? { ...i, estado: nextEstado } : i
          ),
        }));
        logAudit({
          entidade: inst.designacao,
          ecra: 'C03',
          acao: nextEstado === 'Inativa' ? 'Desativação de instituição' : 'Reativação de instituição',
          detalhe: `Estado alterado de ${inst.estado} para ${nextEstado}.`,
          antes: { estado: inst.estado },
          depois: { estado: nextEstado },
        });
        toast({ type: 'warning', title: `Instituição marcada como ${nextEstado}` });
      },
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="C03"
        actions={
          <Button variant="primary" size="sm" onClick={openNew}>
            <Plus className="w-4 h-4" />
            Nova instituição
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar designação, código ou morada..." />
          {parentFilter && (
            <Button variant="secondary" size="sm" onClick={() => setParentFilter('')}>
              Limpar filtro de agrupamento
            </Button>
          )}
        </div>
        <div className="text-xs text-[#536477] tabular-nums">
          Total: <strong>{filtered.length}</strong> entidades
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Código</th>
                <th className="text-left py-3 px-4 font-semibold">Designação</th>
                <th className="text-left py-3 px-4 font-semibold">Tipo</th>
                <th className="text-left py-3 px-4 font-semibold">Contacto</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((inst) => (
                <tr key={inst.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5 font-mono text-xs font-semibold text-[#112A4A] tabular-nums">
                    {inst.codigoEscola}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#112A4A]">{inst.designacao}</div>
                    <div className="text-xs text-[#536477]">{inst.morada}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#536477] whitespace-nowrap">{inst.tipo}</td>
                  <td className="py-3 px-4 text-xs text-[#536477]">{inst.contacto}</td>
                  <td className="py-3 px-4">
                    <StatusLabel status={inst.estado} />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {inst.tipo === 'Agrupamento' && (
                        <Button variant="ghost" size="sm" onClick={() => setParentFilter(inst.id)}>
                          <Building2 className="w-3.5 h-3.5" />
                          Ver escolas
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => openEdit(inst)}>
                        Editar
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleDeactivate(inst)}>
                        {inst.estado === 'Ativa' ? 'Desativar' : 'Reativar'}
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
        open={modalOpen}
        title={editing ? 'Editar instituição' : 'Nova instituição, agrupamento ou escola'}
        subtitle="Segregação de dados por tenant e código único obrigatório."
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <NoticeBar tone="danger">{formError}</NoticeBar>}
          <FormField label="Designação" required>
            <input
              value={form.designacao}
              onChange={(e) => setForm({ ...form, designacao: e.target.value })}
              className={inputClass}
              placeholder="Ex.: Escola Secundária de..."
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Código de escola" required hint="Conforme fonte oficial">
              <input
                value={form.codigoEscola}
                onChange={(e) => setForm({ ...form, codigoEscola: e.target.value })}
                className={`${inputClass} font-mono`}
                placeholder="Ex.: 401827"
              />
            </FormField>
            <FormField label="Tipo" required>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as Institution['tipo'] })}
                className={inputClass}
              >
                <option value="Agrupamento">Agrupamento</option>
                <option value="Escola Secundária">Escola Secundária</option>
                <option value="Escola Básica">Escola Básica</option>
                <option value="Estabelecimento Privado">Estabelecimento Privado</option>
              </select>
            </FormField>
          </div>
          {form.tipo !== 'Agrupamento' && (
            <FormField label="Agrupamento-mãe" conditional>
              <select
                value={form.agrupamentoMaeId}
                onChange={(e) => setForm({ ...form, agrupamentoMaeId: e.target.value })}
                className={inputClass}
              >
                <option value="">Sem agrupamento (escola não agrupada)</option>
                {agrupamentos.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.designacao}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Morada" required>
            <input
              value={form.morada}
              onChange={(e) => setForm({ ...form, morada: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Contacto (email/telefone)" required>
              <input
                value={form.contacto}
                onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="Estado" required>
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value as Institution['estado'] })}
                className={inputClass}
              >
                <option value="Ativa">Ativa</option>
                <option value="Inativa">Inativa</option>
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * C04 · Utilizadores e permissões
 * ========================================================================== */
export const C04UsersScreen: React.FC = () => {
  const { state, updateState, logAudit, toast, confirmAction, navigate, modoServidor } = useSigen();

  // Contas reais (Supabase Auth): palavra-passe temporária mostrada uma única vez ao administrador
  const mostrarPassword = (email: string, password: string) =>
    confirmAction({
      title: 'Palavra-passe temporária',
      message: `Comunique a ${email}, por um canal seguro, a palavra-passe temporária ${password} — será obrigatório definir uma nova no 1.º acesso. Não volta a ser mostrada.`,
      confirmLabel: 'Já comuniquei',
      onConfirm: () => undefined,
    });
  const emitirPassword = async (u: UserAccount) => {
    let r = await gerirConta('repor_password', { utilizador_id: u.id }, 'classificacoes');
    if (r.erro?.includes('ainda não tem conta')) r = await gerirConta('criar', { email: u.email }, 'classificacoes');
    if (r.erro || !r.password) toast({ type: 'error', title: 'Não foi possível emitir a palavra-passe', detail: r.erro });
    else mostrarPassword(u.email, r.password);
  };
  const reporMfa = (u: UserAccount) =>
    confirmAction({
      title: `Repor o MFA de ${u.nome}?`,
      message: 'A aplicação autenticadora atual deixa de funcionar e o utilizador terá de configurar o MFA no próximo acesso.',
      confirmLabel: 'Repor MFA',
      danger: true,
      onConfirm: async () => {
        const r = await gerirConta('repor_mfa', { utilizador_id: u.id }, 'classificacoes');
        if (r.erro) toast({ type: 'error', title: 'Não foi possível repor o MFA', detail: r.erro });
        else toast({ type: 'success', title: 'MFA reposto', detail: u.email });
      },
    });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    perfil: 'SECRETARIADO' as UserRole,
    escolasIds: ['inst-esc-1'] as string[],
    vigenciaInicio: '2026-01-01',
    vigenciaFim: '2026-12-31',
    mfaAtivo: true,
    estado: 'Convidado' as UserAccount['estado'],
  });
  const [error, setError] = useState<string | null>(null);

  const filtered = state.users.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || ROLE_LABELS[u.perfil].toLowerCase().includes(q);
  });

  const openInvite = () => {
    setEditing(null);
    setForm({
      nome: '',
      email: '',
      perfil: 'SECRETARIADO',
      escolasIds: [state.institutions[0]?.id || 'inst-esc-1'],
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
      mfaAtivo: true,
      estado: 'Convidado',
    });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (u: UserAccount) => {
    setEditing(u);
    setForm({
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      escolasIds: u.escolasIds,
      vigenciaInicio: u.vigenciaInicio,
      vigenciaFim: u.vigenciaFim,
      mfaAtivo: u.mfaAtivo,
      estado: u.estado,
    });
    setError(null);
    setModalOpen(true);
  };

  const toggleSchool = (id: string) => {
    setForm((prev) => ({
      ...prev,
      escolasIds: prev.escolasIds.includes(id)
        ? prev.escolasIds.filter((s) => s !== id)
        : [...prev.escolasIds, id],
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim() || form.escolasIds.length === 0) {
      setError('Nome, email e pelo menos uma escola autorizada são obrigatórios.');
      return;
    }
    if (form.vigenciaFim < form.vigenciaInicio) {
      setError('A data de fim de vigência não pode ser anterior à data de início.');
      return;
    }
    // Check separation of duties: warn if same email already exists with incompatible role
    const conflict = state.users.find(
      (u) =>
        u.email.toLowerCase() === form.email.trim().toLowerCase() &&
        u.id !== editing?.id
    );
    if (conflict) {
      setError('Já existe um utilizador com este email. Separação de funções impede perfis duplicados.');
      return;
    }

    if (editing) {
      updateState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === editing.id ? { ...u, ...form } : u)),
      }));
      logAudit({
        entidade: form.nome,
        ecra: 'C04',
        acao: 'Alteração de permissões',
        detalhe: `Perfil ${ROLE_LABELS[form.perfil]} atribuído para ${form.escolasIds.length} escola(s).`,
        antes: { perfil: editing.perfil, estado: editing.estado },
        depois: { perfil: form.perfil, estado: form.estado },
      });
      toast({ type: 'success', title: 'Permissões guardadas' });
    } else {
      const created: UserAccount = {
        id: `usr-${Date.now()}`,
        ...form,
        passwordDemo: 'Sigen2026!',
        mfaCodigoDemo: '123456',
      };
      updateState((prev) => ({ ...prev, users: [...prev.users, created] }));
      logAudit({
        entidade: created.nome,
        ecra: 'C04',
        acao: 'Convite de utilizador',
        detalhe: `Convite enviado para ${created.email} com perfil ${ROLE_LABELS[created.perfil]}.`,
      });
      toast({ type: 'success', title: 'Convite enviado e permissões atribuídas' });
      if (modoServidor) {
        void gerirConta('criar', { email: created.email }, 'classificacoes').then((r) =>
          r.password
            ? mostrarPassword(created.email, r.password)
            : toast({ type: 'error', title: 'Conta de acesso não criada', detail: r.erro })
        );
      }
    }
    setModalOpen(false);
  };

  const handleSuspend = (u: UserAccount) => {
    confirmAction({
      title: u.estado === 'Suspenso' ? 'Reativar conta?' : 'Suspender utilizador?',
      message:
        u.estado === 'Suspenso'
          ? `Reativar o acesso de ${u.nome}?`
          : `Suspender ${u.nome} revoga imediatamente a sessão e bloqueia novas autenticações.`,
      confirmLabel: u.estado === 'Suspenso' ? 'Reativar' : 'Suspender',
      danger: u.estado !== 'Suspenso',
      onConfirm: () => {
        const next = u.estado === 'Suspenso' ? 'Ativo' : 'Suspenso';
        updateState((prev) => ({
          ...prev,
          users: prev.users.map((x) => (x.id === u.id ? { ...x, estado: next } : x)),
        }));
        logAudit({
          entidade: u.nome,
          ecra: 'C04',
          acao: next === 'Suspenso' ? 'Suspensão de conta' : 'Reativação de conta',
          detalhe: `Sessão revogada/atualizada para estado ${next}.`,
        });
        toast({ type: 'warning', title: `Utilizador ${u.nome}: ${next}` });
      },
    });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="C04"
        actions={
          <Button variant="primary" size="sm" onClick={openInvite}>
            <UserPlus className="w-4 h-4" />
            Convidar utilizador
          </Button>
        }
      />

      <NoticeBar tone="info" title="Princípio do menor privilégio e segregação">
        As permissões são avaliadas por ação e instituição. Perfis incompatíveis (ex.: Classificador
        e Conferente sobre a mesma prova) são controlados automaticamente nos ecrãs K07/K08.
      </NoticeBar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar nome, email ou perfil..." />
        <span className="text-xs text-[#536477] tabular-nums">{filtered.length} utilizadores</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-5 font-semibold">Utilizador</th>
                <th className="text-left py-3 px-4 font-semibold">Perfil</th>
                <th className="text-left py-3 px-4 font-semibold">Escolas</th>
                <th className="text-left py-3 px-4 font-semibold">Vigência</th>
                <th className="text-left py-3 px-4 font-semibold">MFA</th>
                <th className="text-left py-3 px-4 font-semibold">Estado</th>
                <th className="text-right py-3 px-5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5">
                    <div className="font-semibold text-[#112A4A]">{u.nome}</div>
                    <div className="text-xs text-[#536477]">{u.email}</div>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-[#112A4A]">
                    {ROLE_LABELS[u.perfil]}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#536477] tabular-nums">
                    {u.escolasIds.length} instituição(ões)
                  </td>
                  <td className="py-3 px-4 text-xs text-[#536477] tabular-nums whitespace-nowrap">
                    {u.vigenciaInicio} → {u.vigenciaFim}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#112A4A]">
                    {u.mfaAtivo ? 'Ativo' : 'Opcional'}
                  </td>
                  <td className="py-3 px-4">
                    <StatusLabel status={u.estado} />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>
                        Editar
                      </Button>
                      {modoServidor ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => void emitirPassword(u)}>
                            Palavra-passe temporária
                          </Button>
                          {u.mfaAtivo && (
                            <Button variant="ghost" size="sm" onClick={() => reporMfa(u)}>
                              Repor MFA
                            </Button>
                          )}
                        </>
                      ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          logAudit({
                            entidade: u.nome,
                            ecra: 'C04',
                            acao: 'Reenvio de convite',
                            detalhe: `Notificação de convite reenviada para ${u.email}.`,
                          });
                          toast({ type: 'info', title: `Convite reenviado para ${u.email}` });
                        }}
                      >
                        Reenviar convite
                      </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => navigate('C07')}>
                        Ver acessos
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleSuspend(u)}>
                        {u.estado === 'Suspenso' ? 'Reativar' : 'Suspender'}
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
        open={modalOpen}
        title={editing ? 'Editar permissões de utilizador' : 'Convidar novo utilizador'}
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && <NoticeBar tone="danger">{error}</NoticeBar>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nome" required>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Email" required>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Perfil" required>
              <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as UserRole })} className={inputClass}>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Estado" required>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as UserAccount['estado'] })} className={inputClass}>
                <option value="Ativo">Ativo</option>
                <option value="Convidado">Convidado</option>
                <option value="Suspenso">Suspenso</option>
              </select>
            </FormField>
          </div>
          <FormField label="Escola(s) autorizadas (seleção múltipla)" required>
            <div className="border border-slate-200 rounded-md p-3 space-y-2 bg-slate-50">
              {state.institutions.map((inst) => (
                <label key={inst.id} className="flex items-center gap-2 text-xs text-[#112A4A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.escolasIds.includes(inst.id)}
                    onChange={() => toggleSchool(inst.id)}
                    className="rounded border-slate-300"
                  />
                  <span>
                    {inst.designacao} <span className="font-mono text-[#536477]">({inst.codigoEscola})</span>
                  </span>
                </label>
              ))}
            </div>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Vigência início" required>
              <input type="date" value={form.vigenciaInicio} onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Vigência fim" required>
              <input type="date" value={form.vigenciaFim} onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[#112A4A] cursor-pointer">
            <input
              type="checkbox"
              checked={form.mfaAtivo}
              onChange={(e) => setForm({ ...form, mfaAtivo: e.target.checked })}
            />
            Exigir autenticação multifator (MFA 6 dígitos)
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Guardar permissões
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * C05 · Configuração do ano letivo e calendário
 * ========================================================================== */
export const C05CalendarScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast, confirmAction } = useSigen();
  const instCalendars = state.calendars.filter((c) => c.institutionId === activeInstitutionId);
  const [selectedId, setSelectedId] = useState<string>(instCalendars[0]?.id || '');
  const activeCal = instCalendars.find((c) => c.id === selectedId) || instCalendars[0] || null;

  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [justificacao, setJustificacao] = useState('');
  const [editForm, setEditForm] = useState({
    inscricaoInicio: '',
    inscricaoFim: '',
    prazoValidacaoDias: 2,
  });
  const [newYearForm, setNewYearForm] = useState({
    anoLetivo: '2026/2027',
    fase: '1.ª Fase' as CalendarConfig['fase'],
    inscricaoInicio: '2027-03-05',
    inscricaoFim: '2027-03-19',
    prazoValidacaoDias: 2,
  });

  const openEdit = () => {
    if (!activeCal) return;
    setEditForm({
      inscricaoInicio: activeCal.inscricaoInicio,
      inscricaoFim: activeCal.inscricaoFim,
      prazoValidacaoDias: activeCal.prazoValidacaoDias,
    });
    setJustificacao('');
    setEditOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCal) return;
    if (activeCal.estado === 'Publicado' && !justificacao.trim()) {
      toast({ type: 'error', title: 'Justificação obrigatória', detail: 'Alterações após publicação exigem justificação registada em histórico.' });
      return;
    }
    const nextVersion = activeCal.versao + 1;
    updateState((prev) => ({
      ...prev,
      calendars: prev.calendars.map((c) =>
        c.id === activeCal.id
          ? {
              ...c,
              ...editForm,
              versao: nextVersion,
              historico: [
                {
                  versao: nextVersion,
                  data: nowIso(),
                  autor: currentUser?.nome || 'Administração',
                  justificacao: justificacao.trim() || 'Atualização de rascunho.',
                  resumo: `Inscrições ${editForm.inscricaoInicio} a ${editForm.inscricaoFim}; prazo validação ${editForm.prazoValidacaoDias} dias.`,
                },
                ...c.historico,
              ],
            }
          : c
      ),
    }));
    logAudit({
      entidade: `Calendário ${activeCal.anoLetivo} · ${activeCal.fase}`,
      ecra: 'C05',
      acao: `Edição de prazos (v${nextVersion})`,
      detalhe: justificacao.trim() || 'Atualização de parâmetros.',
    });
    toast({ type: 'success', title: `Calendário versionado (v${nextVersion})` });
    setEditOpen(false);
  };

  const handlePublish = () => {
    if (!activeCal) return;
    updateState((prev) => ({
      ...prev,
      calendars: prev.calendars.map((c) =>
        c.id === activeCal.id
          ? {
              ...c,
              estado: 'Publicado',
              historico: [
                {
                  versao: c.versao,
                  data: nowIso(),
                  autor: currentUser?.nome || 'Direção',
                  justificacao: 'Publicação aprovada.',
                  resumo: 'Calendário disponibilizado às equipas.',
                },
                ...c.historico,
              ],
            }
          : c
      ),
    }));
    logAudit({
      entidade: `Calendário ${activeCal.anoLetivo} · ${activeCal.fase}`,
      ecra: 'C05',
      acao: 'Publicação de calendário',
      detalhe: 'Calendário disponibilizado.',
    });
    toast({ type: 'success', title: 'Calendário publicado' });
  };

  const handleClosePhase = () => {
    if (!activeCal) return;
    confirmAction({
      title: 'Fechar fase no calendário?',
      message: `Fechar a fase ${activeCal.anoLetivo} · ${activeCal.fase} bloqueia operações de edição nesta fase.`,
      confirmLabel: 'Fechar fase',
      danger: true,
      onConfirm: () => {
        updateState((prev) => ({
          ...prev,
          calendars: prev.calendars.map((c) =>
            c.id === activeCal.id ? { ...c, estado: 'Fase Fechada' } : c
          ),
        }));
        logAudit({
          entidade: `Calendário ${activeCal.anoLetivo} · ${activeCal.fase}`,
          ecra: 'C05',
          acao: 'Fecho de fase',
          detalhe: 'Operações bloqueadas no calendário.',
        });
        toast({ type: 'warning', title: 'Fase marcada como fechada' });
      },
    });
  };

  const handleDuplicate = () => {
    if (!activeCal) return;
    const copy: CalendarConfig = {
      ...activeCal,
      id: `cal-${Date.now()}`,
      anoLetivo: '2026/2027',
      estado: 'Rascunho',
      versao: 1,
      historico: [
        {
          versao: 1,
          data: nowIso(),
          autor: currentUser?.nome || 'Administração',
          justificacao: `Duplicado a partir de ${activeCal.anoLetivo} · ${activeCal.fase}.`,
          resumo: 'Rascunho inicial criado por duplicação.',
        },
      ],
    };
    updateState((prev) => ({ ...prev, calendars: [...prev.calendars, copy] }));
    setSelectedId(copy.id);
    toast({ type: 'success', title: 'Configuração duplicada como rascunho' });
  };

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    const created: CalendarConfig = {
      id: `cal-${Date.now()}`,
      institutionId: activeInstitutionId,
      ...newYearForm,
      datasExame: [
        { codigoProva: '639', nomeProva: 'Português', dataExame: '2027-06-15' },
        { codigoProva: '635', nomeProva: 'Matemática A', dataExame: '2027-06-18' },
      ],
      estado: 'Rascunho',
      versao: 1,
      historico: [
        {
          versao: 1,
          data: nowIso(),
          autor: currentUser?.nome || 'Administração',
          justificacao: 'Inicialização de novo ano letivo.',
          resumo: 'Criado em modo rascunho.',
        },
      ],
    };
    updateState((prev) => ({ ...prev, calendars: [...prev.calendars, created] }));
    setSelectedId(created.id);
    setCreateOpen(false);
    logAudit({
      entidade: `Calendário ${created.anoLetivo} · ${created.fase}`,
      ecra: 'C05',
      acao: 'Criação de ano letivo',
      detalhe: 'Novo calendário inicializado.',
    });
    toast({ type: 'success', title: `Ano letivo ${created.anoLetivo} criado` });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="C05"
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Criar ano
            </Button>
            {activeCal && (
              <>
                <Button variant="secondary" size="sm" onClick={openEdit} disabled={activeCal.estado === 'Fase Fechada'}>
                  Editar prazos
                </Button>
                <Button variant="teal" size="sm" onClick={handlePublish} disabled={activeCal.estado !== 'Rascunho'}>
                  Publicar
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDuplicate}>
                  <Copy className="w-3.5 h-3.5" />
                  Duplicar configuração
                </Button>
                <Button variant="danger" size="sm" onClick={handleClosePhase} disabled={activeCal.estado === 'Fase Fechada'}>
                  <Lock className="w-3.5 h-3.5" />
                  Fechar fase
                </Button>
              </>
            )}
          </>
        }
      />

      {instCalendars.length === 0 ? (
        <EmptyState
          title="Sem calendários configurados nesta instituição"
          description="Crie um novo ano letivo e fase para parametrizar prazos de inscrição e datas de exame."
          action={<Button variant="primary" onClick={() => setCreateOpen(true)}>Criar primeiro ano letivo</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {instCalendars.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`px-4 py-2 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                  activeCal?.id === c.id
                    ? 'bg-[#112A4A] text-white border-[#112A4A]'
                    : 'bg-white text-[#112A4A] border-slate-300 hover:bg-slate-50'
                }`}
              >
                {c.anoLetivo} · {c.fase} · v{c.versao} ({c.estado})
              </button>
            ))}
          </div>

          {activeCal && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#112A4A]">
                      {activeCal.anoLetivo} · {activeCal.fase}
                    </h2>
                    <div className="text-xs text-[#536477] mt-0.5 tabular-nums">
                      Versão {activeCal.versao} · Inscrições: {activeCal.inscricaoInicio} a {activeCal.inscricaoFim} · Prazo de validação: {activeCal.prazoValidacaoDias} dias úteis
                    </div>
                  </div>
                  <StatusLabel status={activeCal.estado} />
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#112A4A] mb-3 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-[#087E91]" />
                    Datas de exame configuradas (por prova)
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                        <th className="text-left py-2.5 px-4 font-semibold">Código</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Prova</th>
                        <th className="text-right py-2.5 px-4 font-semibold">Data de exame</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeCal.datasExame.map((ex) => (
                        <tr key={ex.codigoProva}>
                          <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#087E91]">{ex.codigoProva}</td>
                          <td className="py-2.5 px-4 text-[#112A4A]">{ex.nomeProva}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums">{ex.dataExame}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="font-display text-sm font-bold text-[#112A4A] mb-4">
                  Histórico de versões
                </h3>
                <ol className="space-y-4">
                  {activeCal.historico.map((h, i) => (
                    <li key={i} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-[#087E91]">v{h.versao}</span>
                        <span className="text-[#536477] tabular-nums">{formatDateTimePT(h.data)}</span>
                      </div>
                      <div className="text-xs font-semibold text-[#112A4A] mt-1">{h.resumo}</div>
                      <div className="text-xs text-[#536477] mt-0.5">Justificação: {h.justificacao}</div>
                      <div className="text-[11px] text-slate-500 mt-1">Autor: {h.autor}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={editOpen} title="Editar prazos do calendário" subtitle="Cria nova versão preservando o histórico." onClose={() => setEditOpen(false)}>
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Início de inscrição" required>
              <input type="date" value={editForm.inscricaoInicio} onChange={(e) => setEditForm({ ...editForm, inscricaoInicio: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Fim de inscrição" required>
              <input type="date" value={editForm.inscricaoFim} onChange={(e) => setEditForm({ ...editForm, inscricaoFim: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Prazo de validação (dias úteis)" required>
            <input type="number" min={1} max={30} value={editForm.prazoValidacaoDias} onChange={(e) => setEditForm({ ...editForm, prazoValidacaoDias: Number(e.target.value) })} className={inputClass} />
          </FormField>
          <FormField label="Justificação da alteração" required={activeCal?.estado === 'Publicado'} conditional={activeCal?.estado !== 'Publicado'}>
            <textarea rows={3} value={justificacao} onChange={(e) => setJustificacao(e.target.value)} className={inputClass} placeholder="Indique a norma ou motivo operacional..." />
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Guardar versão</Button>
          </div>
        </form>
      </Modal>

      <Modal open={createOpen} title="Criar ano letivo e fase" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreateYear} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Ano letivo" required>
              <select value={newYearForm.anoLetivo} onChange={(e) => setNewYearForm({ ...newYearForm, anoLetivo: e.target.value })} className={inputClass}>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2027/2028">2027/2028</option>
              </select>
            </FormField>
            <FormField label="Fase" required>
              <select value={newYearForm.fase} onChange={(e) => setNewYearForm({ ...newYearForm, fase: e.target.value as CalendarConfig['fase'] })} className={inputClass}>
                <option value="1.ª Fase">1.ª Fase</option>
                <option value="2.ª Fase">2.ª Fase</option>
                <option value="Época Especial">Época Especial</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Início inscrição" required>
              <input type="date" value={newYearForm.inscricaoInicio} onChange={(e) => setNewYearForm({ ...newYearForm, inscricaoInicio: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Fim inscrição" required>
              <input type="date" value={newYearForm.inscricaoFim} onChange={(e) => setNewYearForm({ ...newYearForm, inscricaoFim: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Inicializar ano</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * C06 · Notificações e modelos de comunicação
 * ========================================================================== */
export const C06NotificationsScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, currentUser, logAudit, toast } = useSigen();
  const list = state.notifications.filter((n) => n.institutionId === activeInstitutionId);

  const [form, setForm] = useState({
    destinatario: 'Coordenação de Classificações',
    canal: 'Plataforma' as NotificationRecord['canal'],
    assunto: '',
    mensagem: '',
    anexo: '',
    dataEnvio: '',
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  const sensitivePattern = /\b(\d{9}|cc\s*\d+|nif|nota:\s*\d{2,3})\b/i;
  const hasSensitiveWarning = form.canal === 'Email institucional' && sensitivePattern.test(form.mensagem);

  const applyTemplate = (tpl: 'lote' | 'consulta' | 'pauta') => {
    if (tpl === 'lote') {
      setForm((f) => ({
        ...f,
        assunto: 'Aviso interno: Lote pronto para distribuição',
        mensagem:
          'Informa-se que foi conferido um lote de provas na secretaria de exames. Aceda ao ecrã K05 com as suas credenciais para consultar detalhes.',
      }));
    } else if (tpl === 'consulta') {
      setForm((f) => ({
        ...f,
        assunto: 'Disponibilização de prova para consulta (K15)',
        mensagem:
          'O pedido de consulta de prova encontra-se validado. A cópia autorizada será disponibilizada através do portal autenticado, sem inclusão de anexos sensíveis por email.',
      }));
    } else {
      setForm((f) => ({
        ...f,
        assunto: 'Aviso de publicação de pauta local',
        mensagem:
          'A pauta local encontra-se conferida e aprovada pela Direção. Os interessados poderão consultar o seu resultado individual através de acesso autenticado.',
      }));
    }
  };

  const submitNotification = (mode: 'send' | 'schedule') => {
    if (!form.destinatario.trim() || !form.assunto.trim() || !form.mensagem.trim()) {
      toast({ type: 'error', title: 'Campos obrigatórios em falta', detail: 'Preencha destinatário, assunto e mensagem.' });
      return;
    }
    if (mode === 'schedule' && !form.dataEnvio) {
      toast({ type: 'error', title: 'Indique a data de envio para agendar' });
      return;
    }
    const created: NotificationRecord = {
      id: `not-${Date.now()}`,
      institutionId: activeInstitutionId,
      destinatario: form.destinatario,
      canal: form.canal,
      assunto: form.assunto,
      mensagem: form.mensagem,
      anexos: form.anexo ? [form.anexo] : [],
      dataEnvio: mode === 'schedule' ? new Date(form.dataEnvio).toISOString() : nowIso(),
      estado: mode === 'schedule' ? 'Agendada' : 'Enviada',
      autor: currentUser?.nome || 'Secretariado',
      origem: 'Dados locais',
    };
    updateState((prev) => ({ ...prev, notifications: [created, ...prev.notifications] }));
    logAudit({
      entidade: created.assunto,
      ecra: 'C06',
      acao: mode === 'schedule' ? 'Agendamento de notificação' : 'Envio de notificação',
      detalhe: `Destinatário: ${created.destinatario} · Canal: ${created.canal}`,
    });
    toast({ type: 'success', title: mode === 'schedule' ? 'Notificação agendada' : 'Notificação registada e enviada' });
    setForm({ destinatario: 'Coordenação de Classificações', canal: 'Plataforma', assunto: '', mensagem: '', anexo: '', dataEnvio: '' });
  };

  const handleResend = (n: NotificationRecord) => {
    const replica: NotificationRecord = {
      ...n,
      id: `not-${Date.now()}`,
      assunto: `[Reenvio] ${n.assunto}`,
      dataEnvio: nowIso(),
      estado: 'Enviada',
      autor: currentUser?.nome || n.autor,
    };
    updateState((prev) => ({ ...prev, notifications: [replica, ...prev.notifications] }));
    toast({ type: 'info', title: 'Notificação reenviada e replicada no histórico' });
  };

  const handleCancel = (n: NotificationRecord) => {
    updateState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((x) => (x.id === n.id ? { ...x, estado: 'Cancelada' } : x)),
    }));
    toast({ type: 'warning', title: 'Envio pendente cancelado' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader screenId="C06" />

      <NoticeBar tone="warning" title="Proteção de dados e valor legal">
        Nunca enviar dados pessoais sensíveis ou classificações nominais desnecessárias por email.
        As notificações do SIGEN são avisos rastreáveis internos e não substituem comunicações oficiais.
      </NoticeBar>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#112A4A]">Nova comunicação</h2>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => applyTemplate('lote')} className="text-xs text-[#087E91] hover:underline cursor-pointer">
                Modelo lote
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={() => applyTemplate('consulta')} className="text-xs text-[#087E91] hover:underline cursor-pointer">
                Modelo consulta
              </button>
            </div>
          </div>

          {hasSensitiveWarning && (
            <NoticeBar tone="danger" title="Alerta de privacidade">
              Detetado possível dado sensível (NIF/CC/nota) numa mensagem por email. Remova os dados antes de enviar.
            </NoticeBar>
          )}

          <FormField label="Destinatário (utilizador ou grupo)" required>
            <input value={form.destinatario} onChange={(e) => setForm({ ...form, destinatario: e.target.value })} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Canal" required>
              <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as NotificationRecord['canal'] })} className={inputClass}>
                <option value="Plataforma">Plataforma</option>
                <option value="Email institucional">Email institucional</option>
                <option value="Aviso SMS">Aviso SMS</option>
              </select>
            </FormField>
            <FormField label="Data de envio (agendar)">
              <input type="datetime-local" value={form.dataEnvio} onChange={(e) => setForm({ ...form, dataEnvio: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Assunto" required>
            <input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Mensagem" required>
            <textarea rows={4} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Anexo (nome de referência opcional)">
            <input value={form.anexo} onChange={(e) => setForm({ ...form, anexo: e.target.value })} placeholder="Ex.: Aviso_Calendario.pdf" className={inputClass} />
          </FormField>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="w-3.5 h-3.5" />
              Pré-visualizar
            </Button>
            <Button variant="teal" size="sm" onClick={() => submitNotification('schedule')}>
              Agendar
            </Button>
            <Button variant="primary" size="sm" onClick={() => submitNotification('send')}>
              <Send className="w-3.5 h-3.5" />
              Enviar
            </Button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-bold text-[#112A4A]">Histórico de envios</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {list.map((n) => (
              <div key={n.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#536477]">
                    <Mail className="w-3.5 h-3.5 text-[#087E91]" />
                    <span>{n.canal}</span>
                    <span>·</span>
                    <span className="tabular-nums">{formatDateTimePT(n.dataEnvio)}</span>
                    <span>·</span>
                    <StatusLabel status={n.estado} />
                  </div>
                  <div className="text-sm font-semibold text-[#112A4A]">{n.assunto}</div>
                  <div className="text-xs text-[#536477]">{n.mensagem}</div>
                  <div className="text-[11px] text-slate-500">
                    Para: {n.destinatario} · Por: {n.autor}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => handleResend(n)}>
                    Reenviar
                  </Button>
                  {n.estado === 'Agendada' && (
                    <Button variant="danger" size="sm" onClick={() => handleCancel(n)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={previewOpen} title="Pré-visualização da comunicação" onClose={() => setPreviewOpen(false)}>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-[#536477]">
            Canal: <strong className="text-[#112A4A]">{form.canal}</strong> · Destinatário:{' '}
            <strong className="text-[#112A4A]">{form.destinatario || '—'}</strong>
          </div>
          <div className="font-bold text-[#112A4A] text-base">{form.assunto || '(Sem assunto)'}</div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md whitespace-pre-wrap text-xs text-[#112A4A] leading-relaxed">
            {form.mensagem || '(Mensagem vazia)'}
          </div>
          <div className="text-[11px] text-[#536477]">
            Rodapé automático: Aviso gerado via SIGEN Classificações.
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================================
 * C07 · Auditoria, privacidade e retenção
 * ========================================================================== */
export const C07AuditScreen: React.FC = () => {
  const { state, updateState, activeInstitutionId, activeInstitution, currentUser, logAudit, toast, openPrintDoc } = useSigen();

  const [filterUser, setFilterUser] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [motivoAcesso, setMotivoAcesso] = useState('');
  const [unmasked, setUnmasked] = useState(false);

  const [diffLog, setDiffLog] = useState<AuditLog | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    tipo: 'Proteção de dados' as 'Acesso indevido' | 'Ilegibilidade de prova' | 'Divergência custódia' | 'Proteção de dados',
    descricao: '',
  });

  const logs = useMemo(() => {
    return state.auditLogs.filter((l) => {
      if (l.institutionId !== activeInstitutionId) return false;
      if (filterUser && !l.utilizador.toLowerCase().includes(filterUser.toLowerCase())) return false;
      if (filterEntity && !l.entidade.toLowerCase().includes(filterEntity.toLowerCase())) return false;
      if (filterAction && !l.acao.toLowerCase().includes(filterAction.toLowerCase())) return false;
      const d = l.dataHora.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [state.auditLogs, activeInstitutionId, filterUser, filterEntity, filterAction, dateFrom, dateTo]);

  const instIncidents = state.incidents.filter((i) => i.institutionId === activeInstitutionId);

  const maskName = (name: string) => {
    if (unmasked) return name;
    const parts = name.split(' ');
    return parts.map((p, idx) => (idx === 0 ? p : `${p[0] || ''}***`)).join(' ');
  };

  const handleToggleUnmask = () => {
    if (!unmasked && !motivoAcesso.trim()) {
      toast({
        type: 'error',
        title: 'Motivo de acesso obrigatório',
        detail: 'Indique o motivo de auditoria antes de remover o mascaramento de dados pessoais.',
      });
      return;
    }
    const next = !unmasked;
    setUnmasked(next);
    if (next) {
      logAudit({
        entidade: 'Trilho de Auditoria C07',
        ecra: 'C07',
        acao: 'Consulta sem mascaramento',
        detalhe: `Motivo registado: ${motivoAcesso}`,
        motivoAcesso,
        sensivel: true,
      });
    }
  };

  const handleExportAudit = () => {
    if (!motivoAcesso.trim()) {
      toast({
        type: 'error',
        title: 'Motivo de acesso obrigatório para exportação restrita',
        detail: 'Todas as exportações de auditoria exigem motivo e são registadas no trilho.',
      });
      return;
    }
    logAudit({
      entidade: 'Relatório de Auditoria C07',
      ecra: 'C07',
      acao: 'Exportação de relatório restrito',
      detalhe: `Exportados ${logs.length} registos (${dateFrom} a ${dateTo}). Motivo: ${motivoAcesso}`,
      motivoAcesso,
      sensivel: true,
    });
    openPrintDoc({
      title: 'Relatório Restrito de Auditoria e Privacidade (C07)',
      docCode: 'C07-AUDITORIA',
      origin: 'DOCUMENTO RESTRITO · AUDITORIA',
      institutionName: activeInstitution?.designacao || '—',
      generatedBy: currentUser?.nome || '—',
      generatedAt: formatDateTimePT(nowIso()),
      version: 'v2.0',
      sections: [
        {
          heading: 'Parâmetros da Consulta Auditada',
          rows: [
            { label: 'Período', value: `${dateFrom} a ${dateTo}` },
            { label: 'Motivo de acesso', value: motivoAcesso },
            { label: 'Total de registos', value: String(logs.length) },
            { label: 'Política de retenção', value: 'Imutável · 5 a 10 anos conforme deliberação' },
          ],
        },
        {
          heading: 'Registos de Auditoria',
          table: {
            headers: ['Data/Hora', 'Ecrã', 'Utilizador', 'Entidade', 'Ação'],
            rows: logs.slice(0, 40).map((l) => [
              formatDateTimePT(l.dataHora),
              l.ecra,
              maskName(l.utilizador),
              l.entidade,
              l.acao,
            ]),
          },
        },
      ],
    });
  };

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.descricao.trim()) return;
    updateState((prev) => ({
      ...prev,
      incidents: [
        {
          id: `inc-${Date.now()}`,
          institutionId: activeInstitutionId,
          dataHora: nowIso(),
          tipo: incidentForm.tipo,
          descricao: incidentForm.descricao,
          responsavel: currentUser?.nome || 'Auditor',
          estado: 'Aberto',
        },
        ...prev.incidents,
      ],
    }));
    logAudit({
      entidade: 'Incidente de Privacidade/Segurança',
      ecra: 'C07',
      acao: 'Registo de ocorrência',
      detalhe: `${incidentForm.tipo}: ${incidentForm.descricao}`,
      sensivel: true,
    });
    setIncidentForm({ tipo: 'Proteção de dados', descricao: '' });
    setIncidentOpen(false);
    toast({ type: 'warning', title: 'Ocorrência registada e auditada' });
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        screenId="C07"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIncidentOpen(true)}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Registar incidente
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportCSV(
                  `auditoria_${activeInstitution?.codigoEscola || 'sigen'}`,
                  ['DataHora', 'Ecra', 'Utilizador', 'Entidade', 'Acao', 'Detalhe'],
                  logs.map((l) => [l.dataHora, l.ecra, maskName(l.utilizador), l.entidade, l.acao, l.detalhe])
                )
              }
            >
              Exportar CSV
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportAudit}>
              <ShieldAlert className="w-3.5 h-3.5" />
              Exportar relatório restrito
            </Button>
          </>
        }
      />

      {/* Search & Privacy Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <FormField label="Utilizador">
            <input value={filterUser} onChange={(e) => setFilterUser(e.target.value)} placeholder="Filtrar..." className={inputClass} />
          </FormField>
          <FormField label="Entidade">
            <input value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} placeholder="Lote, Prova..." className={inputClass} />
          </FormField>
          <FormField label="Ação">
            <input value={filterAction} onChange={(e) => setFilterAction(e.target.value)} placeholder="Submissão, MFA..." className={inputClass} />
          </FormField>
          <FormField label="Período início" required>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Período fim" required>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </FormField>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex-1 max-w-xl">
            <FormField label="Motivo de acesso" conditional hint="Obrigatório para desmascarar identidades ou exportar relatório restrito.">
              <input
                value={motivoAcesso}
                onChange={(e) => setMotivoAcesso(e.target.value)}
                placeholder="Ex.: Auditoria periódica RGPD · Pedido n.º 2026-04"
                className={inputClass}
              />
            </FormField>
          </div>
          <Button variant={unmasked ? 'teal' : 'secondary'} size="sm" onClick={handleToggleUnmask}>
            {unmasked ? 'Reativar mascaramento' : 'Desmascarar identidades'}
          </Button>
        </div>
      </div>

      {/* Immutable Audit Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-[#536477]">
          <span className="font-semibold text-[#112A4A]">Registos imutáveis (append-only)</span>
          <span className="tabular-nums">{logs.length} eventos encontrados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-[#536477]">
                <th className="text-left py-3 px-4 font-semibold">Data/Hora</th>
                <th className="text-left py-3 px-3 font-semibold">Ecrã</th>
                <th className="text-left py-3 px-4 font-semibold">Utilizador</th>
                <th className="text-left py-3 px-4 font-semibold">Entidade</th>
                <th className="text-left py-3 px-4 font-semibold">Ação</th>
                <th className="text-right py-3 px-4 font-semibold">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap text-[#536477]">
                    {formatDateTimePT(l.dataHora)}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs font-semibold text-[#087E91]">{l.ecra}</td>
                  <td className="py-3 px-4 text-xs font-medium text-[#112A4A]">{maskName(l.utilizador)}</td>
                  <td className="py-3 px-4 text-xs text-[#112A4A]">{l.entidade}</td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-semibold text-[#112A4A]">{l.acao}</div>
                    <div className="text-[11px] text-[#536477]">{l.detalhe}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {l.antes || l.depois ? (
                      <Button variant="secondary" size="sm" onClick={() => setDiffLog(l)}>
                        Ver diferença
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incidents */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-bold text-[#112A4A]">
          Ocorrências e incidentes de privacidade / segurança ({instIncidents.length})
        </div>
        <div className="divide-y divide-slate-200">
          {instIncidents.map((inc) => (
            <div key={inc.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-[#112A4A]">{inc.tipo}</span>
                <span className="mx-2 text-slate-300">·</span>
                <span className="text-[#536477] tabular-nums">{formatDateTimePT(inc.dataHora)}</span>
                <p className="text-[#112A4A] mt-1">{inc.descricao}</p>
              </div>
              <StatusLabel status={inc.estado} />
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!diffLog} title="Diferença de registo (Antes / Depois)" subtitle={diffLog?.entidade} onClose={() => setDiffLog(null)} size="lg">
        {diffLog && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold text-[#536477] mb-1.5">Antes</div>
              <pre className="p-3 rounded bg-slate-50 border border-slate-200 overflow-x-auto font-mono">
                {JSON.stringify(diffLog.antes || {}, null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-semibold text-[#087E91] mb-1.5">Depois</div>
              <pre className="p-3 rounded bg-[#F0F9FA] border border-[#B6DFE5] overflow-x-auto font-mono">
                {JSON.stringify(diffLog.depois || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={incidentOpen} title="Registar incidente ou ocorrência" onClose={() => setIncidentOpen(false)}>
        <form onSubmit={handleCreateIncident} className="space-y-4">
          <FormField label="Tipologia" required>
            <select
              value={incidentForm.tipo}
              onChange={(e) => setIncidentForm({ ...incidentForm, tipo: e.target.value as typeof incidentForm.tipo })}
              className={inputClass}
            >
              <option value="Proteção de dados">Proteção de dados (RGPD)</option>
              <option value="Acesso indevido">Acesso indevido</option>
              <option value="Divergência custódia">Divergência de custódia</option>
              <option value="Ilegibilidade de prova">Ilegibilidade de prova</option>
            </select>
          </FormField>
          <FormField label="Descrição da ocorrência" required>
            <textarea rows={4} value={incidentForm.descricao} onChange={(e) => setIncidentForm({ ...incidentForm, descricao: e.target.value })} className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIncidentOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="danger">Registar ocorrência</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
