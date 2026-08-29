import { useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { tStatic } from '@/src/i18n';
import { cn } from '@/src/lib/utils';

export function PageTitle({
  kicker,
  title,
  hint,
}: {
  kicker?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-6">
      {kicker ? (
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600 mb-1">{kicker}</p>
      ) : null}
      <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">{title}</h1>
      {hint ? <p className="text-sm text-[#5C6B63] mt-1">{hint}</p> : null}
    </div>
  );
}

export function PanelCard({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
  key?: Key;
}) {
  return (
    <section className={cn('bg-white border border-[#E8DFD0] rounded-2xl p-5 shadow-[0_8px_30px_rgba(11,61,46,0.06)]', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title ? <h2 className="font-bold text-ink">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#3d4a43] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#F8F4EC] border border-[#E8DFD0] text-ink placeholder:text-[#9AA59D] outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800';

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxH: 240, up: false });
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const up = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxH = Math.min(280, Math.max(140, up ? spaceAbove : spaceBelow));
    setBox({
      top: up ? r.top - 8 : r.bottom + 6,
      left: r.left,
      width: Math.max(r.width, 180),
      maxH,
      up,
    });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-custom-select-menu]')) return;
      setOpen(false);
      setQuery('');
    };
    const onScroll = () => place();
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <Field label={label}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery('');
          } else {
            place();
            setOpen(true);
          }
        }}
        className={cn(inputClass, 'flex items-center justify-between gap-2 text-left cursor-pointer')}
      >
        <span className={cn('truncate', selected?.value ? 'text-ink' : 'text-[#8A968E]')}>
          {selected?.label || tStatic('common_select')}
        </span>
        <ChevronDown size={18} className={cn('shrink-0 text-[#5C6B63] transition-transform', open ? 'rotate-180' : '')} />
      </button>
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  data-custom-select-menu
                  initial={{ opacity: 0, y: box.up ? 6 : -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: box.up ? 6 : -6, scale: 0.98 }}
                  transition={{ duration: 0.08 }}
                  className="fixed z-[90] bg-white border border-[#E8DFD0] rounded-xl shadow-[0_16px_48px_rgba(7,38,28,0.18)] overflow-hidden"
                  style={{
                    left: box.left,
                    width: box.width,
                    maxHeight: box.maxH,
                    ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }),
                  }}
                >
                  {options.length > 7 ? (
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F0E8D8]">
                      <Search size={14} className="text-[#8A968E] shrink-0" />
                      <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={tStatic('common_search')}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink py-1 placeholder:text-[#9AA59D]"
                      />
                    </div>
                  ) : null}
                  <div className="overflow-y-auto" style={{ maxHeight: options.length > 7 ? box.maxH - 44 : box.maxH }}>
                    {filtered.map((o) => {
                      const on = o.value === value;
                      return (
                        <button
                          key={o.value || o.label}
                          type="button"
                          onClick={() => {
                            onChange(o.value);
                            setOpen(false);
                            setQuery('');
                          }}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left hover:bg-[#F8F4EC]',
                            on ? 'bg-brand-50 text-brand-800 font-semibold' : 'text-ink'
                          )}
                        >
                          <span className="truncate">{o.label}</span>
                          {on ? <Check size={16} className="shrink-0" /> : null}
                        </button>
                      );
                    })}
                    {filtered.length === 0 ? (
                      <p className="px-3.5 py-3 text-sm text-[#8A968E]">{tStatic('common_select')}</p>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </Field>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'gold';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary: 'bg-brand-900 text-white hover:bg-brand-800',
    outline: 'bg-white border border-[#E8DFD0] text-ink hover:bg-cream',
    ghost: 'bg-transparent text-[#5C6B63] hover:bg-white/60',
    danger: 'bg-danger-50 text-danger-500 hover:bg-red-100',
    gold: 'bg-gold-100 text-brand-900 hover:bg-[#ead9b0]',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
        styles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'ok' }) {
  return (
    <p className={cn('text-sm mb-3', tone === 'error' ? 'text-danger-500' : 'text-brand-700')}>{children}</p>
  );
}

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'open' | 'wait' | 'ok' | 'done' | 'danger' | 'neutral';
  children: ReactNode;
}) {
  const tones = {
    open: 'bg-brand-50 text-brand-800',
    wait: 'bg-[#F4EAD4] text-[#7A5A1E]',
    ok: 'bg-[#E3F4EA] text-[#1B7A4A]',
    done: 'bg-[#E8EEF2] text-[#3d4a43]',
    danger: 'bg-danger-50 text-danger-500',
    neutral: 'bg-cream text-[#5C6B63]',
  };
  return (
    <span className={cn('inline-flex text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  );
}

export function FilterChips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-bold transition',
              active ? 'bg-brand-900 text-white' : 'bg-white border border-[#E8DFD0] text-[#5C6B63] hover:bg-cream'
            )}
          >
            {o.label}
            {typeof o.count === 'number' ? <span className="ml-1 opacity-70">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.08 }}
        >
          <button type="button" className="absolute inset-0 bg-[#07261c]/45" onClick={onClose} aria-label={tStatic('common_close')} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className={cn(
              'relative w-full bg-white rounded-t-2xl sm:rounded-2xl border border-[#E8DFD0] shadow-[0_24px_80px_rgba(7,38,28,0.22)] max-h-[92vh] flex flex-col',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
            )}
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[#F0E8D8]">
              <h3 className="font-extrabold text-ink">{title}</h3>
              <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-cream flex items-center justify-center text-[#5C6B63]">
                <X size={18} />
              </button>
            </div>
            <div className="px-4 sm:px-5 py-4 overflow-y-auto">{children}</div>
            {footer ? <div className="px-4 sm:px-5 py-4 border-t border-[#F0E8D8] flex flex-col-reverse sm:flex-row justify-end gap-2">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto max-w-full rounded-2xl border border-[#E8DFD0] bg-white shadow-[0_8px_30px_rgba(11,61,46,0.06)]', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn('text-left font-semibold text-[#5C6B63] px-3 sm:px-4 py-3 bg-[#F8F4EC] border-b border-[#E8DFD0] whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('px-3 sm:px-4 py-3 border-b border-[#F7F1E6] text-ink align-middle', className)}>{children}</td>;
}

export function IconBtn({
  children,
  onClick,
  danger,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'w-9 h-9 rounded-xl inline-flex items-center justify-center transition',
        danger ? 'text-danger-500 hover:bg-danger-50' : 'text-brand-800 hover:bg-brand-50'
      )}
    >
      {children}
    </button>
  );
}
