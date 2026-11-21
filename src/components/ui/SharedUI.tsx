import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  Search,
  X,
} from 'lucide-react';
import { ScreenId } from '../../types/sigen';
import { getScreenDef } from '../../data/screensCatalog';

export const ScreenHeader: React.FC<{
  screenId: ScreenId;
  actions?: React.ReactNode;
  badgeText?: string;
}> = ({ screenId, actions, badgeText }) => {
  const def = getScreenDef(screenId);
  return (
    <div className="flex flex-col gap-4 pb-6 mb-6 border-b border-slate-200 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#536477] mb-1.5">
          <span className="font-mono font-semibold text-[#087E91]">{def.id}</span>
          <span aria-hidden="true">·</span>
          <span>Saída: {def.outputDoc}</span>
          {badgeText && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#112A4A]">{badgeText}</span>
            </>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#112A4A] text-balance">
          {def.title}
        </h1>
        <p className="text-sm text-[#536477] mt-1 max-w-2xl">{def.objective}</p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>
      )}
    </div>
  );
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'teal' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
  }
> = ({ variant = 'secondary', size = 'md', className = '', children, ...props }) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087E91]';
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-xs min-h-[34px]' : 'px-4 py-2 text-sm min-h-[40px]';
  const variants = {
    primary: 'bg-[#112A4A] text-white hover:bg-[#0B1E36]',
    teal: 'bg-[#087E91] text-white hover:bg-[#066373]',
    secondary: 'bg-white text-[#112A4A] border border-slate-300 hover:bg-slate-50',
    danger: 'bg-[#B91C1C] text-white hover:bg-[#991B1B]',
    ghost: 'text-[#536477] hover:text-[#112A4A] hover:bg-slate-100',
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const StatusLabel: React.FC<{
  status: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}> = ({ status, tone }) => {
  const inferTone = (): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (tone) return tone;
    const s = status.toLowerCase();
    if (
      s.includes('ativ') ||
      s.includes('aprov') ||
      s.includes('valid') ||
      s.includes('public') ||
      s.includes('confirm') ||
      s.includes('aceite') ||
      s.includes('conclu') ||
      s.includes('conferid') ||
      s.includes('conforme') ||
      s.includes('entregue') ||
      s.includes('enviad') ||
      s.includes('atualizado')
    ) {
      return 'success';
    }
    if (
      s.includes('diverg') ||
      s.includes('erro') ||
      s.includes('discrep') ||
      s.includes('recus') ||
      s.includes('suspens') ||
      s.includes('inativ') ||
      s.includes('rejei') ||
      s.includes('revog') ||
      s.includes('cancel') ||
      s.includes('revert') ||
      s.includes('falha')
    ) {
      return 'danger';
    }
    if (
      s.includes('pendente') ||
      s.includes('rascunho') ||
      s.includes('proposto') ||
      s.includes('agendad') ||
      s.includes('análise') ||
      s.includes('retifica') ||
      s.includes('encaminh') ||
      s.includes('aguardar') ||
      s.includes('preparação')
    ) {
      return 'warning';
    }
    if (s.includes('bloq') || s.includes('encerr') || s.includes('fechad') || s.includes('arquiv')) {
      return 'neutral';
    }
    return 'info';
  };

  const resolved = inferTone();
  const styles = {
    success: 'text-[#286B42]',
    warning: 'text-[#9A6B00]',
    danger: 'text-[#B91C1C]',
    info: 'text-[#087E91]',
    neutral: 'text-[#536477]',
  };

  const Icon =
    resolved === 'success'
      ? CheckCircle2
      : resolved === 'danger'
        ? AlertCircle
        : resolved === 'warning'
          ? Clock
          : resolved === 'neutral'
            ? Lock
            : Info;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${styles[resolved]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};

export const NoticeBar: React.FC<{
  tone?: 'info' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
}> = ({ tone = 'info', title, children }) => {
  const styles = {
    info: 'bg-[#F0F9FA] border-[#B6DFE5] text-[#112A4A]',
    warning: 'bg-[#FFFBEB] border-[#F3D78B] text-[#7A5400]',
    danger: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
  };
  const Icon = tone === 'danger' ? AlertCircle : tone === 'warning' ? AlertTriangle : Info;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${styles[tone]}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 leading-relaxed">
        {title && <span className="font-semibold mr-1.5">{title}:</span>}
        {children}
      </div>
    </div>
  );
};

export const FormField: React.FC<{
  label: string;
  required?: boolean;
  conditional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, conditional, hint, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-[#112A4A] flex items-center gap-1.5">
      <span>{label}</span>
      {required && (
        <span className="text-[#B91C1C]" title="Campo obrigatório">
          *
        </span>
      )}
      {conditional && (
        <span className="font-normal text-[#536477]">(condicional)</span>
      )}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-[#536477]">{hint}</p>}
    {error && <p className="text-xs text-[#B91C1C] font-medium">{error}</p>}
  </div>
);

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#112A4A] placeholder:text-slate-400 focus:border-[#087E91] focus:ring-2 focus:ring-[#087E91]/20 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 min-h-[40px]';

export const Modal: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}> = ({ open, title, subtitle, onClose, size = 'md', children }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const maxW = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#112A4A]/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className={`w-full ${maxW} bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden my-auto`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-lg font-bold text-[#112A4A]">{title}</h2>
            {subtitle && <p className="text-xs text-[#536477] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-1.5 rounded-md text-[#536477] hover:bg-slate-100 hover:text-[#112A4A] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = 'Pesquisar...' }) => (
  <div className="relative flex-1 min-w-[200px] max-w-sm">
    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputClass} pl-9`}
    />
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-slate-300 rounded-lg bg-white">
    <p className="font-display text-base font-semibold text-[#112A4A]">{title}</p>
    <p className="text-sm text-[#536477] mt-1 max-w-md">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const StatStrip: React.FC<{
  items: { label: string; value: string | number; sub?: string; accent?: 'navy' | 'teal' | 'green' | 'gold' | 'danger' }[];
}> = ({ items }) => {
  const accentMap = {
    navy: 'text-[#112A4A]',
    teal: 'text-[#087E91]',
    green: 'text-[#398B58]',
    gold: 'text-[#D99A00]',
    danger: 'text-[#B91C1C]',
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-lg bg-white divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
      {items.map((item) => (
        <div key={item.label} className="p-5">
          <div className="text-xs font-medium text-[#536477]">{item.label}</div>
          <div className={`font-display text-2xl font-bold tabular-nums mt-1.5 ${accentMap[item.accent || 'navy']}`}>
            {item.value}
          </div>
          {item.sub && <div className="text-xs text-[#536477] mt-1">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
};
