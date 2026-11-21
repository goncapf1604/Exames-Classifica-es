import React, { useMemo, useState } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  LogOut,
  Menu,
  Printer,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import { SCREENS_CATALOG, SECTION_TITLES, getScreenDef } from '../data/screensCatalog';
import { ROLE_LABELS, ScreenId, ScreenSection } from '../types/sigen';
import { SigenClassificacoesIcon, SigenLogo } from './SigenLogo';
import { Button, StatusLabel } from './ui/SharedUI';
import { downloadDocumentHtml, formatDateTimePT } from '../utils/exports';
import { SyncBadge } from '../sync/SyncBadge';

const SECTIONS_ORDER: ScreenSection[] = ['A', 'B', 'C', 'D', 'E'];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    currentUser,
    activeInstitution,
    authorizedInstitutions,
    activeInstitutionId,
    setActiveInstitutionId,
    activeYear,
    setActiveYear,
    activePhase,
    setActivePhase,
    activeScreen,
    navigate,
    canAccess,
    logout,
    confirmDialog,
    closeConfirm,
    printDoc,
    closePrintDoc,
    notificationsOpen,
    setNotificationsOpen,
    resetDemoData,
    confirmAction,
    isPhaseClosed,
    syncStatus,
    syncDetail,
  } = useSigen();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<ScreenSection, boolean>>({
    A: false,
    B: false,
    C: false,
    D: false,
    E: false,
  });

  const navScreens = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    return SCREENS_CATALOG.filter(
      (s) =>
        !q ||
        s.id.toLowerCase().includes(q) ||
        s.shortTitle.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q)
    );
  }, [navSearch]);

  const instNotifications = useMemo(
    () => state.notifications.filter((n) => n.institutionId === activeInstitutionId),
    [state.notifications, activeInstitutionId]
  );

  const toggleSection = (sec: ScreenSection) => {
    setCollapsedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const currentDef = getScreenDef(activeScreen);
  const authorizedForCurrent = canAccess(activeScreen);

  const handleSelectScreen = (id: ScreenId) => {
    if (id === 'C01') {
      logout();
      setMobileMenuOpen(false);
      return;
    }
    navigate(id);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleSelectScreen('C02')}
          className="text-left focus-visible:outline-2 focus-visible:outline-[#087E91] rounded cursor-pointer"
        >
          <SigenLogo variant="compact" subBrand="Classificações" />
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded text-slate-500 hover:bg-slate-100"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick screen filter */}
      <div className="px-4 py-3 border-b border-slate-200">
        <input
          type="text"
          value={navSearch}
          onChange={(e) => setNavSearch(e.target.value)}
          placeholder="Filtrar ecrã (ex. K07, pautas...)"
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-[#112A4A] placeholder:text-slate-400 focus:bg-white focus:border-[#087E91] focus:outline-none"
        />
      </div>

      {/* Grouped navigation A..E */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3" aria-label="Navegação SIGEN">
        {SECTIONS_ORDER.map((sec) => {
          const items = navScreens.filter((s) => s.section === sec);
          if (items.length === 0) return null;
          const isCollapsed = collapsedSections[sec] && !navSearch.trim();
          return (
            <div key={sec}>
              <button
                type="button"
                onClick={() => toggleSection(sec)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-[#536477] hover:text-[#112A4A] cursor-pointer"
              >
                <span className="truncate">{SECTION_TITLES[sec]}</span>
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
              {!isCollapsed && (
                <ul className="mt-1 space-y-0.5">
                  {items.map((screen) => {
                    const isActive = activeScreen === screen.id;
                    const allowed = canAccess(screen.id);
                    return (
                      <li key={screen.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectScreen(screen.id)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#112A4A] text-white font-semibold'
                              : allowed
                                ? 'text-[#112A4A] hover:bg-slate-100 font-medium'
                                : 'text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`font-mono text-[11px] shrink-0 ${
                                isActive ? 'text-[#5EEAD4]' : allowed ? 'text-[#087E91]' : 'text-slate-400'
                              }`}
                            >
                              {screen.id}
                            </span>
                            <span className="truncate">{screen.shortTitle}</span>
                          </span>
                          {!allowed && (
                            <Lock
                              className={`w-3 h-3 shrink-0 ${isActive ? 'text-slate-300' : 'text-slate-300'}`}
                              aria-label="Restrito"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar footer: active user + switch/logout */}
      {currentUser && (
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70 space-y-2.5">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#112A4A] truncate">{currentUser.nome}</div>
            <div className="text-[11px] text-[#536477] truncate">
              {ROLE_LABELS[currentUser.perfil]}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => logout()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#112A4A] bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Trocar / Sair</span>
            </button>
            <button
              type="button"
              onClick={() =>
                confirmAction({
                  title: 'Repor dados de exemplo?',
                  message:
                    'Os registos do SIGEN Classificações voltam ao conjunto inicial de exemplo. Com a base de dados partilhada ligada, isto afeta todos os utilizadores desta app.',
                  confirmLabel: 'Repor dados',
                  danger: true,
                  onConfirm: resetDemoData,
                })
              }
              title="Repor dados de exemplo"
              className="p-1.5 text-[#536477] bg-white border border-slate-300 rounded-md hover:bg-slate-100 hover:text-[#112A4A] cursor-pointer"
              aria-label="Repor dados de exemplo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#112A4A]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[272px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#112A4A]/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Workspace Header (PDF Requirement: app name, active institution, year, phase, user, profile) */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md text-[#112A4A] hover:bg-slate-100"
              aria-label="Abrir navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#536477] min-w-0">
              <SigenClassificacoesIcon size={20} className="shrink-0" />
              <span className="font-semibold text-[#112A4A] whitespace-nowrap">
                {currentDef.id}
              </span>
              <span aria-hidden="true">/</span>
              <span className="truncate max-w-[200px] xl:max-w-[280px]">{currentDef.shortTitle}</span>
              {isPhaseClosed && (
                <>
                  <span aria-hidden="true">·</span>
                  <StatusLabel status="Fase encerrada" tone="neutral" />
                </>
              )}
            </div>
          </div>

          {/* Context Selectors: Institution, Year, Phase + Notifications */}
          <div className="flex items-center gap-2.5 shrink-0">
            <select
              aria-label="Instituição ativa"
              value={activeInstitutionId}
              onChange={(e) => setActiveInstitutionId(e.target.value)}
              className="hidden md:block max-w-[230px] truncate rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#112A4A] focus:border-[#087E91] focus:outline-none"
            >
              {authorizedInstitutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.designacao} ({inst.codigoEscola})
                </option>
              ))}
            </select>

            <select
              aria-label="Ano letivo"
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#112A4A] tabular-nums focus:border-[#087E91] focus:outline-none"
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>

            <select
              aria-label="Fase de exames"
              value={activePhase}
              onChange={(e) =>
                setActivePhase(e.target.value as '1.ª Fase' | '2.ª Fase' | 'Época Especial')
              }
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#112A4A] focus:border-[#087E91] focus:outline-none"
            >
              <option value="1.ª Fase">1.ª Fase</option>
              <option value="2.ª Fase">2.ª Fase</option>
              <option value="Época Especial">Época Especial</option>
            </select>

            <SyncBadge status={syncStatus} detail={syncDetail} />

            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Abrir notificações"
              className="relative p-2 rounded-md border border-slate-200 text-[#112A4A] hover:bg-slate-50 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {instNotifications.length > 0 && (
                <span className="sr-only">{instNotifications.length} notificações</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              title="Terminar sessão (C01)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-[#112A4A] hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Mobile institution bar */}
        <div className="md:hidden px-4 py-2 bg-white border-b border-slate-200">
          <select
            aria-label="Instituição ativa"
            value={activeInstitutionId}
            onChange={(e) => setActiveInstitutionId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#112A4A]"
          >
            {authorizedInstitutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.designacao} ({inst.codigoEscola})
              </option>
            ))}
          </select>
        </div>

        {/* Screen Viewport */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {!authorizedForCurrent ? (
            <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-lg p-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-lg bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="text-xs font-mono font-semibold text-[#087E91] mb-1">
                {currentDef.id} · Controlo de acesso por perfil
              </div>
              <h1 className="font-display text-xl font-bold text-[#112A4A]">
                Acesso restrito a perfis autorizados
              </h1>
              <p className="text-sm text-[#536477] mt-2 leading-relaxed">
                O perfil atual (<strong>{currentUser ? ROLE_LABELS[currentUser.perfil] : 'Sem sessão'}</strong>)
                não tem permissão para aceder ao ecrã <strong>{currentDef.title}</strong>.
                Conforme a matriz de permissões SIGEN, o acesso está reservado a:{' '}
                <span className="text-[#112A4A] font-medium">
                  {currentDef.allowedRoles.map((r) => ROLE_LABELS[r]).join(', ')}
                </span>.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" onClick={() => navigate('C02')}>
                  Voltar ao Painel inicial (C02)
                </Button>
                <Button variant="secondary" onClick={() => logout()}>
                  <UserCheck className="w-4 h-4" />
                  Trocar de perfil (C01)
                </Button>
              </div>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Quiet Institutional Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white px-4 lg:px-8 py-3.5 text-xs text-[#536477] flex flex-wrap items-center justify-between gap-2">
          <div>
            SIGEN Classificações · Proposta de produto (Dados de exemplo — não substitui sistemas ou modelos oficiais do JNE)
          </div>
          <div className="tabular-nums">
            {activeInstitution?.designacao} · {activeYear} · {activePhase}
          </div>
        </footer>
      </div>

      {/* Notifications Drawer */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#112A4A]/40"
            onClick={() => setNotificationsOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#112A4A]">
                  Caixa de notificações
                </h2>
                <p className="text-xs text-[#536477]">
                  {instNotifications.length} registos na instituição ativa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="p-1.5 rounded text-[#536477] hover:bg-slate-100 cursor-pointer"
                aria-label="Fechar notificações"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
              {instNotifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#536477]">
                  Sem notificações nesta instituição.
                </div>
              ) : (
                instNotifications.map((n) => (
                  <div key={n.id} className="p-5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#536477]">
                      <span>{n.canal}</span>
                      <StatusLabel status={n.estado} />
                    </div>
                    <div className="text-sm font-semibold text-[#112A4A]">{n.assunto}</div>
                    <p className="text-xs text-[#536477] leading-relaxed">{n.mensagem}</p>
                    <div className="text-[11px] text-slate-500 tabular-nums pt-1">
                      Para: {n.destinatario} · {formatDateTimePT(n.dataEnvio)}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <Button
                variant="teal"
                size="sm"
                onClick={() => {
                  setNotificationsOpen(false);
                  navigate('C06');
                }}
              >
                Gerir em C06 · Notificações
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Mandatory for destructive actions per PDF) */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#112A4A]/50 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-xl p-6">
            <h3 className="font-display text-lg font-bold text-[#112A4A]">{confirmDialog.title}</h3>
            <p className="text-sm text-[#536477] mt-2 leading-relaxed">{confirmDialog.message}</p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button variant="secondary" onClick={closeConfirm}>
                Cancelar
              </Button>
              <Button
                variant={confirmDialog.danger ? 'danger' : 'primary'}
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirm();
                }}
              >
                {confirmDialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Printable PDF / Document Preview Modal (Mandatory metadata: date, origin, version, local/official) */}
      {printDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#112A4A]/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl bg-white rounded-lg border border-slate-200 shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-[#112A4A]">
                Pré-visualização de Documento / Exportação PDF · {printDoc.docCode}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => downloadDocumentHtml(printDoc)}>
                  <Download className="w-3.5 h-3.5" />
                  Descarregar HTML
                </Button>
                <Button variant="primary" size="sm" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / Guardar PDF
                </Button>
                <button
                  type="button"
                  onClick={closePrintDoc}
                  className="p-1.5 rounded text-[#536477] hover:bg-slate-200 cursor-pointer"
                  aria-label="Fechar pré-visualização"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div id="sigen-print-area" className="p-8 max-h-[75vh] overflow-y-auto bg-white">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#112A4A]">
                <SigenLogo variant="full" subBrand="Classificações" />
                <div className="text-xs text-[#536477] sm:text-right space-y-0.5 tabular-nums">
                  <div className="font-semibold text-[#087E91]">{printDoc.origin}</div>
                  <div>
                    Código: <strong className="text-[#112A4A]">{printDoc.docCode}</strong> · Versão:{' '}
                    <strong className="text-[#112A4A]">{printDoc.version}</strong>
                  </div>
                  <div>Instituição: {printDoc.institutionName}</div>
                  <div>
                    Emitido por: {printDoc.generatedBy} · {printDoc.generatedAt}
                  </div>
                </div>
              </div>

              <h2 className="font-display text-xl font-bold text-[#112A4A] mt-6 mb-4">
                {printDoc.title}
              </h2>

              <div className="space-y-6">
                {printDoc.sections.map((sec, idx) => (
                  <section key={idx}>
                    <h3 className="text-sm font-bold text-[#112A4A] border-b border-slate-200 pb-1.5 mb-3">
                      {sec.heading}
                    </h3>
                    {sec.rows && (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                        {sec.rows.map((r, i) => (
                          <div key={i} className="flex justify-between gap-3 py-1 border-b border-slate-100">
                            <dt className="text-[#536477] font-medium">{r.label}</dt>
                            <dd className="text-[#112A4A] font-semibold text-right tabular-nums">
                              {r.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {sec.table && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b-2 border-[#112A4A] bg-slate-50">
                              {sec.table.headers.map((h) => (
                                <th
                                  key={h}
                                  className="text-left py-2 px-2.5 font-semibold text-[#112A4A]"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {sec.table.rows.map((row, ri) => (
                              <tr key={ri}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="py-2 px-2.5 text-[#112A4A] tabular-nums">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {sec.note && (
                      <p className="text-xs text-[#536477] bg-slate-50 border border-slate-200 rounded p-3 mt-2">
                        {sec.note}
                      </p>
                    )}
                  </section>
                ))}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 text-[11px] text-[#536477]">
                Documento gerado por SIGEN Classificações ({printDoc.origin}). A emissão de
                documentos oficiais depende de confirmação normativa e validação de modelos em vigor.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
