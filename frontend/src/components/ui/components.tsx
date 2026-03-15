'use client';
import { X, ChevronLeft, ChevronRight, AlertTriangle, Inbox } from 'lucide-react';
import { useEffect, ReactNode, Component, ErrorInfo } from 'react';
import { cn } from '@/lib/utils';

export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm'|'md'|'lg'|'xl';
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', h); };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]', sizes[size], 'rounded-t-2xl sm:rounded-2xl')}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger=false, loading=false, confirmLabel='Confirm' }: {
  open: boolean; onClose: ()=>void; onConfirm: ()=>void; title: string; message: string; danger?: boolean; loading?: boolean; confirmLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, loading, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !loading && onClose()} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', danger?'bg-red-100':'bg-amber-100')}>
            <AlertTriangle className={cn('w-5 h-5', danger?'text-red-600':'text-amber-600')} />
          </div>
          <div><h3 className="text-base font-bold text-gray-900">{title}</h3><p className="text-sm text-gray-500 mt-1">{message}</p></div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary flex-1 sm:flex-none justify-center" disabled={loading}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={cn('btn flex-1 sm:flex-none justify-center', danger?'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500':'btn-primary')}>
            {loading ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Processing…</span> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatCard({ title, value, subtitle, icon, color='blue' }: {
  title: string; value: string|number; subtitle?: string; icon: ReactNode; color?: 'blue'|'green'|'yellow'|'red'|'purple';
}) {
  const colors = { blue:'bg-blue-50 text-blue-600', green:'bg-emerald-50 text-emerald-600', yellow:'bg-amber-50 text-amber-600', red:'bg-red-50 text-red-600', purple:'bg-purple-50 text-purple-600' };
  return (
    <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', colors[color])}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide truncate">{title}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 leading-tight truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Input({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}
      <input className={cn('input', error&&'border-red-300 focus:ring-red-400', className)} {...props} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}
      <select className={cn('input', error&&'border-red-300', className)} {...props}>{children}</select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}
      <textarea rows={3} className={cn('input resize-none', error&&'border-red-300', className)} {...props} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta: { page: number; totalPages: number; total: number; limit: number }; onPageChange: (p: number) => void }) {
  if (meta.totalPages <= 1) return null;
  const start = (meta.page-1)*meta.limit+1, end = Math.min(meta.page*meta.limit, meta.total);
  const pages = Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
    if (meta.totalPages <= 5) return i+1;
    if (meta.page <= 3) return i+1;
    if (meta.page >= meta.totalPages-2) return meta.totalPages-4+i;
    return meta.page-2+i;
  });
  return (
    <div className="flex items-center justify-between px-1 py-3 flex-wrap gap-2">
      <p className="text-sm text-gray-500">Showing {start}–{end} of {meta.total.toLocaleString()}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(meta.page-1)} disabled={meta.page<=1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
        {pages.map(p => <button key={p} onClick={() => onPageChange(p)} className={cn('w-8 h-8 rounded-lg text-sm font-semibold transition-colors', p===meta.page?'bg-blue-600 text-white':'hover:bg-gray-100 text-gray-600')}>{p}</button>)}
        <button onClick={() => onPageChange(meta.page+1)} disabled={meta.page>=meta.totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"><ChevronRight className="w-4 h-4"/></button>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows=5, cols=5 }: { rows?: number; cols?: number }) {
  return <>{Array.from({length:rows}).map((_,i) => <tr key={i}>{Array.from({length:cols}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded-lg animate-pulse"/></td>)}</tr>)}</>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-gray-300"/></div>
      <p className="text-base font-semibold text-gray-600">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
      <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>{subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}</div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder='Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-10"/>
    </div>
  );
}

export function FormField({ label, error, children, required, className }: { label: string; error?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-semibold text-gray-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      {children}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function Spinner({ size='md' }: { size?: 'sm'|'md'|'lg' }) {
  const s = { sm:'w-4 h-4 border', md:'w-6 h-6 border-2', lg:'w-10 h-10 border-3' };
  return <div className={cn('border-blue-600 border-t-transparent rounded-full animate-spin', s[size])} aria-label="Loading"/>;
}

const STATUS_BADGE_COLORS: Record<string,string> = {
  PAID:'badge-green', UNPAID:'badge-red', PARTIAL:'badge-yellow', CANCELLED:'badge-gray',
  RECEIVED:'badge-blue', DIAGNOSING:'badge-yellow', WAITING_FOR_PARTS:'badge-orange',
  IN_REPAIR:'badge-blue', READY:'badge-green', DELIVERED:'badge-gray',
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={cn('badge', STATUS_BADGE_COLORS[status]||'badge-gray')}>{status.replace(/_/g,' ')}</span>;
}

export class ErrorBoundary extends Component<{children: ReactNode; fallback?: ReactNode}, {hasError: boolean}> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('ErrorBoundary:', e, i); }
  render() {
    if (this.state.hasError) return this.props.fallback || (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-2xl border border-red-100">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-2"/>
        <p className="text-sm font-semibold text-red-700">Something went wrong.</p>
        <button onClick={() => this.setState({hasError:false})} className="mt-3 text-xs text-red-600 underline">Try again</button>
      </div>
    );
    return this.props.children;
  }
}
