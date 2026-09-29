import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useStore } from '../../state/AppStore'
import { formatCoord } from '../../lib/coords'

// Eases a number from its previous value to the new one.
export function CountUp({ value, duration = 900, format = (v) => Math.round(v).toLocaleString() }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = from.current, t0 = performance.now()
    let raf
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / duration)
      const e = 1 - Math.pow(1 - t, 4)
      const v = start + (value - start) * e
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, duration])
  return <span className="num">{format(shown)}</span>
}

export function Label({ children, className = '' }) {
  return <div className={`label ${className}`}>{children}</div>
}

// Gotham-style section header: index number, hairline, uppercase title.
export function SectionHead({ index, title, right, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {index && <span className="mono text-2xs text-fg-dim">{index}</span>}
      <span className="label text-fg-muted">{title}</span>
      <span className="h-px flex-1 bg-ink-600" />
      {right}
    </div>
  )
}

export function Panel({ title, index, right, children, className = '', bodyClass = '', bracket = false }) {
  return (
    <section className={`panel flex flex-col min-h-0 ${bracket ? 'brackets' : ''} ${className}`}>
      {title && (
        <header className="flex items-center gap-3 px-3 h-9 border-b border-ink-600 shrink-0">
          {index && <span className="mono text-2xs text-fg-dim">{index}</span>}
          <span className="label text-fg-muted">{title}</span>
          <span className="flex-1" />
          {right}
        </header>
      )}
      <div className={`min-h-0 ${bodyClass}`}>{children}</div>
    </section>
  )
}

const BTN = {
  default: 'border-ink-500 bg-ink-750 text-fg hover:bg-ink-700 hover:border-ink-400',
  ghost: 'border-transparent bg-transparent text-fg-muted hover:text-fg hover:bg-ink-750',
  primary: 'border-fg/70 bg-fg text-ink-900 hover:bg-fg-hi',
  confirm: 'border-teal-line bg-teal-dim text-teal hover:border-teal',
  reject: 'border-rej-line bg-rej-dim text-rej hover:border-rej',
  amber: 'border-amber-line bg-amber-dim text-amber hover:border-amber',
  outline: 'border-ink-500 bg-transparent text-fg hover:border-fg-muted',
}

export function Btn({ variant = 'default', size = 'md', kbd, icon, children, className = '', ...rest }) {
  const sz = size === 'sm' ? 'h-7 px-2.5 text-xs gap-1.5' : size === 'lg' ? 'h-10 px-4 text-sm gap-2' : 'h-8 px-3 text-sm gap-2'
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center border font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${sz} ${BTN[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
      {kbd && <Kbd className="ml-1">{kbd}</Kbd>}
    </button>
  )
}

export function Kbd({ children, className = '' }) {
  return (
    <kbd className={`mono inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-2xs border border-ink-500 bg-ink-900 text-fg-muted ${className}`}>
      {children}
    </kbd>
  )
}

export const STATUS = {
  pending: { label: 'Needs review', cls: 'text-amber border-amber-line bg-amber-dim', dot: 'bg-amber' },
  confirmed: { label: 'Confirmed', cls: 'text-teal border-teal-line bg-teal-dim', dot: 'bg-teal' },
  rejected: { label: 'Rejected', cls: 'text-rej border-rej-line bg-rej-dim', dot: 'bg-rej' },
  'needs-data': { label: 'More data', cls: 'text-fg-muted border-ink-500 bg-ink-750', dot: 'bg-fg-muted' },
}

export function StatusPill({ status, className = '' }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 h-5 px-1.5 border text-2xs uppercase tracking-wider font-medium whitespace-nowrap shrink-0 ${s.cls} ${className}`}>
      <span className={`w-1.5 h-1.5 ${s.dot}`} />
      {s.label}
    </span>
  )
}

export function Chip({ children, active, onClick, className = '', tone }) {
  const toneCls = tone === 'amber' ? 'border-amber-line text-amber' : tone === 'teal' ? 'border-teal-line text-teal' : tone === 'rej' ? 'border-rej-line text-rej' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-6 px-2 border text-xs transition-colors ${
        active ? 'border-fg-muted bg-ink-700 text-fg-hi' : `border-ink-600 bg-ink-850 text-fg-muted hover:text-fg hover:border-ink-400 ${toneCls}`
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Seg({ value, options, onChange, className = '', size = 'sm' }) {
  return (
    <div className={`inline-flex border border-ink-600 bg-ink-950 ${className}`}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`${size === 'sm' ? 'h-6 px-2 text-2xs' : 'h-7 px-3 text-xs'} uppercase tracking-wider font-medium transition-colors ${
              value === v ? 'bg-ink-600 text-fg-hi' : 'text-fg-dim hover:text-fg'
            }`}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

export function ConfBar({ value, className = '', tone }) {
  const color = tone ?? (value >= 80 ? 'bg-teal' : value >= 60 ? 'bg-amber' : 'bg-fg-dim')
  return (
    <div className={`h-1 bg-ink-600 ${className}`}>
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

export function Meter({ label, value, tone = 'bg-fg-muted', suffix = '' }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-fg-dim w-20 shrink-0">{label}</span>
      <div className="h-1.5 flex-1 bg-ink-600">
        <div className={`h-full ${tone}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="mono text-2xs text-fg-muted w-8 text-right">{Math.round(value * 100)}{suffix}</span>
    </div>
  )
}

export function CopyButton({ text, className = '' }) {
  const [done, setDone] = useState(false)
  const { toast } = useStore()
  return (
    <button
      type="button"
      title="Copy"
      onClick={async (e) => {
        e.stopPropagation()
        try { await navigator.clipboard.writeText(text) } catch { /* clipboard may be blocked offline */ }
        setDone(true)
        toast('Copied to clipboard')
        setTimeout(() => setDone(false), 1200)
      }}
      className={`inline-flex items-center justify-center w-6 h-6 shrink-0 text-fg-dim hover:text-fg hover:bg-ink-700 ${className}`}
    >
      <Icon name={done ? 'check' : 'copy'} size={12} />
    </button>
  )
}

export function MonoId({ children, copy = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      <span className="mono text-xs text-fg-muted truncate">{children}</span>
      {copy && <CopyButton text={String(children)} />}
    </span>
  )
}

export function Coord({ lat, lon, className = '' }) {
  const { coord } = useStore()
  return <span className={`mono text-xs ${className}`}>{formatCoord(coord, lat, lon)}</span>
}

export function Modal({ open, onClose, title, children, width = 'max-w-3xl', footer }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-8 backdrop-in" onMouseDown={onClose}>
      <div className={`panel brackets w-full ${width} max-h-full flex flex-col scale-in`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center h-10 px-4 border-b border-ink-600 shrink-0">
          <span className="label text-fg-muted">{title}</span>
          <span className="flex-1" />
          <button className="text-fg-dim hover:text-fg" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </header>
        <div className="overflow-auto min-h-0">{children}</div>
        {footer && <footer className="flex items-center gap-2 px-4 h-12 border-t border-ink-600 shrink-0">{footer}</footer>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink-950/60 backdrop-in" onMouseDown={onClose}>
      <aside className="w-[420px] h-full panel border-y-0 border-r-0 flex flex-col slide-in" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center h-11 px-4 border-b border-ink-600 shrink-0">
          <span className="label text-fg-muted">{title}</span>
          <span className="flex-1" />
          <button className="text-fg-dim hover:text-fg" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
        {footer && <footer className="flex items-center gap-2 px-4 h-14 border-t border-ink-600 shrink-0">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'text-fg-hi' }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className={`text-2xl font-light num mt-1 ${tone}`}>{value}</div>
      {sub && <div className="text-2xs text-fg-dim mt-0.5">{sub}</div>}
    </div>
  )
}

export function Tag({ children, className = '' }) {
  return <span className={`inline-flex items-center h-[18px] px-1.5 border border-ink-500 text-2xs uppercase tracking-wider text-fg-muted whitespace-nowrap ${className}`}>{children}</span>
}
