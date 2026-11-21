import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

const STORAGE_KEY = 'sigen_classificacoes_state_v2';
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
    institutionId?: string
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
}

const SigenContext = createContext<SigenContextValue | null>(null);

export const SigenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SigenState>(() => {
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
    try {
      return localStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  });

  const [activeInstitutionId, setActiveInstitutionIdState] = useState<string>('inst-aeidh');
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota issues
    }
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
      institutionId: activeInstitution?.id || currentUser.escolasIds[0] || 'inst-aeidh',
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

  const login: SigenContextValue['login'] = (email, password, mfaCode, institutionId) => {
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

    if (user.mfaAtivo) {
      if (!mfaCode.trim()) {
        return {
          ok: false,
          requireMfa: true,
          error: 'Introduza o código MFA de 6 dígitos para concluir a autenticação.',
        };
      }
      if (mfaCode.trim() !== user.mfaCodigoDemo && mfaCode.trim() !== '000000') {
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
    if (currentUser) {
      logAudit({
        entidade: 'Sessão C01',
        ecra: 'C01',
        acao: 'Sessão terminada',
        detalhe: 'Saída voluntária do utilizador.',
      });
    }
    setCurrentUserId(null);
    setActiveScreen('C01');
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
