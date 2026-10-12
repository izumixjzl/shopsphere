import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { humanize } from '../lib/format'

/* ---------- Buttons ---------- */

const variants = {
  primary: 'bg-sphere text-white hover:bg-sphere-dark disabled:bg-sphere/50',
  dark: 'bg-ink text-white hover:bg-ink/90 disabled:bg-ink/50',
  outline: 'border border-line bg-white text-ink hover:border-ink-mute disabled:opacity-50',
  ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink disabled:opacity-50',
  danger: 'bg-coral text-white hover:bg-coral/90 disabled:bg-coral/50',
  mango: 'bg-mango text-ink hover:brightness-95 disabled:opacity-60',
}
const sizes = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-[15px] gap-2', lg: 'h-12 px-6 text-base gap-2' }

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, to, ...props }) {
  const cls = `inline-flex items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`
  if (to) return <Link to={to} className={cls}>{children}</Link>
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/* ---------- Form fields ---------- */

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-sm text-coral">{error}</span>
        : hint ? <span className="mt-1 block text-sm text-ink-mute">{hint}</span> : null}
    </label>
  )
}

export function Input({ label, error, hint, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <input className={`field ${error ? 'field-error' : ''}`} aria-invalid={Boolean(error)} {...props} />
    </Field>
  )
}

export function Textarea({ label, error, hint, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <textarea className={`field min-h-24 ${error ? 'field-error' : ''}`} aria-invalid={Boolean(error)} {...props} />
    </Field>
  )
}

export function Select({ label, error, hint, className = '', children, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <select className={`field pr-8 ${error ? 'field-error' : ''}`} aria-invalid={Boolean(error)} {...props}>{children}</select>
    </Field>
  )
}

export function Alert({ children, tone = 'error' }) {
  const t = { error: 'bg-coral-tint text-coral', info: 'bg-sphere-tint text-sphere-dark', warn: 'bg-mango-tint text-ink' }[tone]
  return <div role="alert" className={`rounded-[var(--radius-field)] px-4 py-3 text-sm ${t}`}>{children}</div>
}

/* ---------- Status badges ---------- */

const tones = {
  pending: 'bg-mango-tint text-[#8a5a00]', requested: 'bg-mango-tint text-[#8a5a00]', processing: 'bg-sphere-tint text-sphere-dark',
  confirmed: 'bg-sphere-tint text-sphere-dark', packed: 'bg-sphere-tint text-sphere-dark', partially_shipped: 'bg-sphere-tint text-sphere-dark',
  shipped: 'bg-[#e4f0ff] text-[#1d5fbf]', in_transit: 'bg-[#e4f0ff] text-[#1d5fbf]',
  delivered: 'bg-leaf-tint text-leaf', completed: 'bg-leaf-tint text-leaf', approved: 'bg-leaf-tint text-leaf', active: 'bg-leaf-tint text-leaf',
  paid: 'bg-leaf-tint text-leaf', payable: 'bg-leaf-tint text-leaf', refunded: 'bg-ink/5 text-ink-soft',
  cancelled: 'bg-coral-tint text-coral', rejected: 'bg-coral-tint text-coral', suspended: 'bg-coral-tint text-coral',
  removed: 'bg-coral-tint text-coral', failed: 'bg-coral-tint text-coral', flagged: 'bg-mango-tint text-[#8a5a00]',
  returned: 'bg-ink/5 text-ink-soft', reversed: 'bg-ink/5 text-ink-soft', draft: 'bg-ink/5 text-ink-soft',
  inactive: 'bg-ink/5 text-ink-soft', unpaid: 'bg-ink/5 text-ink-soft',
  open: 'bg-mango-tint text-[#8a5a00]', resolved: 'bg-leaf-tint text-leaf', dismissed: 'bg-ink/5 text-ink-soft',
}

export function StatusBadge({ status, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[status] || 'bg-ink/5 text-ink-soft'} ${className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {humanize(status)}
    </span>
  )
}

/* ---------- Feedback & layout helpers ---------- */

export function Spinner({ className = '' }) {
  return <Loader2 className={`size-5 animate-spin text-sphere ${className}`} aria-label="Loading" />
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="size-7" /></div>
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden />
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && <div className="mb-4 grid size-14 place-items-center rounded-full bg-sphere-tint text-sphere"><Icon className="size-6" /></div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null
  return (
    <nav className="flex items-center justify-between gap-3 pt-4 text-sm text-ink-soft" aria-label="Pagination">
      <span>Page {meta.current_page} of {meta.last_page}{meta.total != null && ` · ${meta.total} results`}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  )
}

/* ---------- Dialogs ---------- */

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null)
  // Callers usually pass a new onClose each render; read it through a ref so typing
  // (which re-renders the parent) doesn't re-run the effect and steal focus.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.()
    document.addEventListener('keydown', onKey)
    // Focus the first form field (not the header's close button) once, when the dialog opens.
    const body = ref.current?.querySelector('[data-modal-body]')
    ;(body?.querySelector('input,textarea,select') || body?.querySelector('button'))?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`w-full ${w} max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-ink-mute hover:bg-ink/5 hover:text-ink" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div data-modal-body className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', loading, onConfirm, onClose, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Keep as is</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      {message && <p className="text-ink-soft">{message}</p>}
      {children}
    </Modal>
  )
}

/* ---------- Tables ---------- */

export function Table({ columns, rows, loading, empty, rowKey = 'id', onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ink-mute">
            {columns.map((c) => <th key={c.key} className={`px-4 py-3 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {columns.map((c) => <td key={c.key} className="px-4 py-3.5"><Skeleton className="h-4 w-3/4" /></td>)}
            </tr>
          ))}
          {!loading && rows?.map((r) => (
            <tr key={r[rowKey]} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-line last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-paper' : ''}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && rows?.length === 0 && empty}
    </div>
  )
}

export function Stars({ value = 0, size = 'size-4' }) {
  return (
    <span className="inline-flex" aria-label={`${Number(value).toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={`${size} ${i <= Math.round(value) ? 'text-mango' : 'text-line'}`} fill="currentColor" aria-hidden>
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" />
        </svg>
      ))}
    </span>
  )
}
