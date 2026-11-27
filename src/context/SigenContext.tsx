import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { terminarSessaoCorreio } from '../utils/correioInterno';
import { INITIAL_SIGEN_STATE, SigenState } from '../data/seedData';
import { getScreenDef } from '../data/screensCatalog';
import {
  AuditLog,
  Institution,
  PrintableDocument,
  ScreenId,
  UserAccount,
} from '../types/sigen';
import { nowIso } from '../utils/exports';
import { SyncEngine, SyncStatus } from '../sync/engine';
import { CLASSIFICACOES_BINDINGS, CLASSIFICACOES_REGISTOS_FILTER } from '../sync/bindings';
import { SIGEN_SYNC_ENABLED } from '../sync/config';
import { sigenDb } from '../sync/client';
import { sair, SessaoSigen } from '../sync/auth';

/** Estado sem dados (antes do login, com a base de dados partilhada ligada). */
const estadoVazio = (): SigenState => {
  const vazio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(INITIAL_SIGEN_STATE)) vazio[k] = Array.isArray(v) ? [] : v;
  return vazio as unknown as SigenState;
};

const STORAGE_KEY = 'sigen_classificacoes_state_v3';
const SESSION_KEY = 'sigen_classificacoes_session_v3';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface SigenContextValue {
  state: SigenState;
  updateState: (updater: (prev: SigenState) => SigenState) => void;
  currentUser: UserAccount | null;
  activeInstitution: Institution | null;
  authorizedInstitutions: Institution[];
  activeInstitutionId: string;
  setActiveInstitutionId: (id: string) => void;
  activeYear: string;
  setActiveYear: (year: string) => void;
  activePhase: '1.ª Fase' | '2.ª Fase' | 'Época Especial';
  setActivePhase: (phase: '1.ª Fase' | '2.ª Fase' | 'Época Especial') => void;
  activeScreen: ScreenId;
  navigate: (screen: ScreenId) => void;
  canAccess: (screen: ScreenId) => boolean;
  login: (
    email: string,
    password: string,
    mfaCode: string,
    institutionId?: string,
    /** apenasVerificar: só valida email/palavra-passe; codigoValidado: o código veio do Correio Interno. */
    opts?: { apenasVerificar?: boolean; codigoValidado?: boolean }
  ) => { ok: boolean; error?: string; requireMfa?: boolean };
  logout: () => void;
  logAudit: (entry: Omit<AuditLog, 'id' | 'dataHora' | 'institutionId' | 'utilizador' | 'perfil'>) => void;
  toast: (msg: Omit<ToastMessage, 'id'>) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  confirmAction: (dialog: ConfirmDialogState) => void;
  confirmDialog: ConfirmDialogState | null;
  closeConfirm: () => void;
  printDoc: PrintableDocument | null;
  openPrintDoc: (doc: PrintableDocument) => void;
  closePrintDoc: () => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (v: boolean) => void;
  resetDemoData: () => void;
  isPhaseClosed: boolean;
  refreshSync: () => void;
  /** Estado da ligação à base de dados partilhada SIGEN. */
  syncStatus: SyncStatus;
  syncDetail?: string;
  /** true quando a app usa a base de dados partilhada com login real. */
  modoServidor: boolean;
  iniciarSessao: (sessao: SessaoSigen) => Promise<void>;
}

const SigenContext = createContext<SigenContextValue | null>(null);

export const SigenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SigenState>(() => {
    // Com a base de dados partilhada ligada, os dados só chegam depois do login (nada fica no browser).
    if (SIGEN_SYNC_ENABLED) return estadoVazio();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...INITIAL_SIGEN_STATE, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to seed
    }
    return INITIAL_SIGEN_STATE;
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (SIGEN_SYNC_ENABLED) return null;
    try {
      return localStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  });

  const [activeInstitutionId, setActiveInstitutionIdState] = useState<string>('inst-esc-1');
  const [activeYear, setActiveYear] = useState<string>('2025/2026');
  const [activePhase, setActivePhase] = useState<'1.ª Fase' | '2.ª Fase' | 'Época Especial'>('1.ª Fase');
  const [activeScreen, setActiveScreen] = useState<ScreenId>(() =>
    currentUserId ? 'C02' : 'C01'
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [printDoc, setPrintDoc] = useState<PrintableDocument | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    if (SIGEN_SYNC_ENABLED) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota issues
    }
  }, [state]);

  // --- Base de dados partilhada (SIGEN Exames + SIGEN Classificações) ---
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('desligado');
  const [syncDetail, setSyncDetail] = useState<string | undefined>();
  const syncRef = useRef<SyncEngine<SigenState> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const pararSincronizacao = () => {
    syncRef.current?.stop();
    syncRef.current = null;
    setSyncStatus('desligado');
  };

  /** Chamado pelo ecrã de login quando a autenticação (password + MFA + troca de password) está completa. */
  const iniciarSessao = async (sessao: SessaoSigen) => {
    if (!sigenDb) return;
    pararSincronizacao();
    const engine = new SyncEngine<SigenState>(
      sigenDb,
      CLASSIFICACOES_BINDINGS,
      (updater) => setState((prev) => ({ ...updater(prev), lastSyncAt: nowIso() })),
      (status, detail) => {
        setSyncStatus(status);
        setSyncDetail(detail);
      },
      CLASSIFICACOES_REGISTOS_FILTER
    );
    syncRef.current = engine;
    await engine.start();
    const inst = sessao.escolas.find((id) => id.startsWith('inst-esc')) ?? sessao.escolas[0] ?? 'inst-esc-1';
    setCurrentUserId(sessao.utilizador_id);
    setActiveInstitutionIdState(inst);
    setActiveScreen('C02');
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === sessao.utilizador_id ? { ...u, ultimoAcesso: nowIso() } : u)),
      auditLogs: [
        {
          id: `aud-in-${Date.now()}`,
          institutionId: inst,
          dataHora: nowIso(),
          utilizador: sessao.nome,
          perfil: (prev.users.find((u) => u.id === sessao.utilizador_id)?.perfil ?? 'SECRETARIADO'),
          entidade: 'Sessão C01',
          ecra: 'C01',
          acao: sessao.mfa_ativo ? 'Sessão iniciada com MFA' : 'Sessão iniciada',
          detalhe: 'Acesso validado na base de dados SIGEN.',
        },
        ...prev.auditLogs,
      ],
    }));
    toast({ type: 'success', title: `Sessão iniciada como ${sessao.nome}`, detail: 'Contexto institucional carregado com isolamento de dados.' });
  };

  useEffect(() => () => pararSincronizacao(), []);

  useEffect(() => {
    syncRef.current?.notifyLocalChange(state);
  }, [state]);

  useEffect(() => {
    try {
      if (currentUserId) localStorage.setItem(SESSION_KEY, currentUserId);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore
    }
  }, [currentUserId]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === currentUserId) || null,
    [state.users, currentUserId]
  );

  const authorizedInstitutions = useMemo(() => {
    if (!currentUser) return [];
    return state.institutions.filter((inst) => currentUser.escolasIds.includes(inst.id));
  }, [state.institutions, currentUser]);

  // Enforce strict multi-tenant institution isolation
  useEffect(() => {
    if (currentUser && authorizedInstitutions.length > 0) {
      const isAllowed = authorizedInstitutions.some((i) => i.id === activeInstitutionId);
      if (!isAllowed) {
        setActiveInstitutionIdState(authorizedInstitutions[0].id);
      }
    }
  }, [currentUser, authorizedInstitutions, activeInstitutionId]);

  const activeInstitution = useMemo(
    () => authorizedInstitutions.find((i) => i.id === activeInstitutionId) || authorizedInstitutions[0] || null,
    [authorizedInstitutions, activeInstitutionId]
  );

  const updateState = (updater: (prev: SigenState) => SigenState) => {
    setState((prev) => updater(prev));
  };

  const toast = (msg: Omit<ToastMessage, 'id'>) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { ...msg, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const logAudit: SigenContextValue['logAudit'] = (entry) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      dataHora: nowIso(),
      institutionId: activeInstitution?.id || currentUser.escolasIds[0] || 'inst-esc-1',
      utilizador: currentUser.nome,
      perfil: currentUser.perfil,
      ...entry,
    };
    setState((prev) => ({
      ...prev,
      auditLogs: [newLog, ...prev.auditLogs],
    }));
  };

  const setActiveInstitutionId = (id: string) => {
    if (!currentUser) return;
    if (!currentUser.escolasIds.includes(id)) {
      toast({
        type: 'error',
        title: 'Acesso negado à instituição',
        detail: 'Isolamento multi-tenant ativo: o perfil não tem autorização para esta escola.',
      });
      return;
    }
    setActiveInstitutionIdState(id);
    const inst = state.institutions.find((i) => i.id === id);
    if (inst) {
      logAudit({
        entidade: inst.designacao,
        ecra: activeScreen,
        acao: 'Mudança de contexto institucional',
        detalhe: `Contexto ativo alterado para ${inst.designacao} (${inst.codigoEscola}).`,
      });
    }
  };

  const canAccess = (screen: ScreenId): boolean => {
    if (screen === 'C01') return true;
    if (!currentUser) return false;
    const def = getScreenDef(screen);
    return def.allowedRoles.includes(currentUser.perfil);
  };

  const navigate = (screen: ScreenId) => {
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const login: SigenContextValue['login'] = (email, password, mfaCode, institutionId, opts) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = state.users.find((u) => u.email.toLowerCase() === cleanEmail);

    // Generic error message without revealing account existence (per C01 rule)
    if (!user || user.passwordDemo !== password || user.estado === 'Suspenso') {
      const failLog: AuditLog = {
        id: `aud-fail-${Date.now()}`,
        institutionId: activeInstitutionId,
        dataHora: nowIso(),
        utilizador: cleanEmail || 'Desconhecido',
        perfil: user?.perfil || 'ALUNO_EE',
        entidade: 'Autenticação C01',
        ecra: 'C01',
        acao: 'Tentativa de acesso falhada',
        detalhe: 'Credenciais inválidas ou conta suspensa.',
        sensivel: true,
      };
      setState((prev) => ({ ...prev, auditLogs: [failLog, ...prev.auditLogs] }));
      return {
        ok: false,
        error: 'Credenciais inválidas ou acesso não autorizado. Verifique os dados introduzidos.',
      };
    }

    if (opts?.apenasVerificar) return { ok: true, requireMfa: true };

    if (user.mfaAtivo && !opts?.codigoValidado) {
      if (!mfaCode.trim()) {
        return {
          ok: false,
          requireMfa: true,
          error: 'Introduza o código MFA de 6 dígitos para concluir a autenticação.',
        };
      }
      // (removido o código universal "000000", que deixava entrar qualquer conta com MFA)
      if (mfaCode.trim() !== user.mfaCodigoDemo) {
        return {
          ok: false,
          requireMfa: true,
          error: 'Código MFA inválido ou expirado.',
        };
      }
    }

    const chosenInst =
      institutionId && user.escolasIds.includes(institutionId)
        ? institutionId
        : user.escolasIds[0];

    setCurrentUserId(user.id);
    setActiveInstitutionIdState(chosenInst);
    setActiveScreen('C02');

    const loginLog: AuditLog = {
      id: `aud-in-${Date.now()}`,
      institutionId: chosenInst,
      dataHora: nowIso(),
      utilizador: user.nome,
      perfil: user.perfil,
      entidade: 'Sessão C01',
      ecra: 'C01',
      acao: user.mfaAtivo ? 'Sessão iniciada com MFA' : 'Sessão iniciada',
      detalhe: `Acesso validado na instituição selecionada.`,
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === user.id ? { ...u, ultimoAcesso: nowIso() } : u)),
      auditLogs: [loginLog, ...prev.auditLogs],
    }));

    toast({
      type: 'success',
      title: `Sessão iniciada como ${user.nome}`,
      detail: 'Contexto institucional carregado com isolamento de dados.',
    });

    return { ok: true };
  };

  const logout = () => {
    terminarSessaoCorreio();
    if (currentUser) {
      logAudit({
        entidade: 'Sessão C01',
        ecra: 'C01',
        acao: 'Sessão terminada',
        detalhe: 'Saída voluntária do utilizador.',
      });
    }
    if (SIGEN_SYNC_ENABLED) {
      // Grava o registo de saída e termina a sessão no servidor ANTES de mostrar o login
      window.setTimeout(async () => {
        await syncRef.current?.flush(stateRef.current);
        pararSincronizacao();
        await sair().catch(() => undefined);
        setState(estadoVazio());
        setCurrentUserId(null);
        setActiveScreen('C01');
      }, 100);
    } else {
      setCurrentUserId(null);
      setActiveScreen('C01');
    }
  };

  const isPhaseClosed = useMemo(() => {
    const closure = state.closures.find(
      (c) =>
        c.institutionId === activeInstitutionId &&
        c.anoLetivo === activeYear &&
        c.fase === activePhase
    );
    const cal = state.calendars.find(
      (c) =>
        c.institutionId === activeInstitutionId &&
        c.anoLetivo === activeYear &&
        c.fase === activePhase
    );
    return closure?.estado === 'Encerrada' || cal?.estado === 'Fase Fechada';
  }, [state.closures, state.calendars, activeInstitutionId, activeYear, activePhase]);

  const refreshSync = () => {
    setState((prev) => ({ ...prev, lastSyncAt: nowIso() }));
    toast({ type: 'info', title: 'Indicadores atualizados', detail: 'Última sincronização registada.' });
  };

  const resetDemoData = () => {
    if (SIGEN_SYNC_ENABLED) {
      // Nunca apaga dados partilhados: volta a carregar tudo do servidor.
      const engine = syncRef.current;
      if (!engine) return;
      engine.stop();
      setState(estadoVazio());
      void engine.start().then(() =>
        toast({ type: 'success', title: 'Dados recarregados', detail: 'Cópia local atualizada a partir da base de dados SIGEN.' })
      );
      return;
    }
    setState(INITIAL_SIGEN_STATE);
    localStorage.removeItem(STORAGE_KEY);
    toast({
      type: 'info',
      title: 'Dados de exemplo repostos',
      detail: 'A base de demonstração foi restaurada ao estado inicial.',
    });
  };

  return (
    <SigenContext.Provider
      value={{
        state,
        updateState,
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
        login,
        logout,
        logAudit,
        toast,
        toasts,
        dismissToast,
        confirmAction: (d) => setConfirmDialog(d),
        confirmDialog,
        closeConfirm: () => setConfirmDialog(null),
        printDoc,
        openPrintDoc: (d) => setPrintDoc(d),
        closePrintDoc: () => setPrintDoc(null),
        notificationsOpen,
        setNotificationsOpen,
        resetDemoData,
        isPhaseClosed,
        refreshSync,
        syncStatus,
        syncDetail,
        modoServidor: SIGEN_SYNC_ENABLED,
        iniciarSessao,
      }}
    >
      {children}
    </SigenContext.Provider>
  );
};

export function useSigen() {
  const ctx = useContext(SigenContext);
  if (!ctx) throw new Error('useSigen deve ser usado dentro de SigenProvider');
  return ctx;
}
