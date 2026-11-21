/** Indicador do estado da base de dados partilhada SIGEN (idêntico nas duas apps). */
import React from 'react';
import type { SyncStatus } from './engine';

const STYLE: Record<SyncStatus, { dot: string; label: string }> = {
  desligado: { dot: 'bg-slate-400', label: 'Só local' },
  'a ligar': { dot: 'bg-amber-400 animate-pulse', label: 'A ligar…' },
  sincronizado: { dot: 'bg-emerald-500', label: 'Sincronizado' },
  'a enviar': { dot: 'bg-sky-500 animate-pulse', label: 'A guardar…' },
  erro: { dot: 'bg-red-500', label: 'Erro de sincronização' },
  offline: { dot: 'bg-amber-500', label: 'Sem ligação (local)' },
};

export const SyncBadge: React.FC<{ status: SyncStatus; detail?: string }> = ({ status, detail }) => {
  const s = STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-[#536477] bg-slate-50 border border-slate-200 rounded-md whitespace-nowrap"
      title={`Base de dados partilhada SIGEN (Exames + Classificações): ${s.label}${detail ? ` — ${detail}` : ''}`}
      role="status"
    >
      <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />
      <span className="hidden lg:inline">{s.label}</span>
    </span>
  );
};
