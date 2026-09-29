// Visual evidence primitives: answer first, detail on hover/click.
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/Icon'

export function RingGauge({ value, size = 72, stroke = 5, label = 'conf' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const col = value >= 80 ? '#3EB2A8' : value >= 60 ? '#D6A24A' : '#8C99A7'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Confidence ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1F2A35" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeDasharray={`${(value / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-light num text-fg-hi">{value}</span>
        <span className="text-[9px] tracking-[0.14em] text-fg-dim uppercase mt-0.5">{label}</span>
      </div>
    </div>
  )
}

const VOTE_LABEL = { optical: 'Optical', sar: 'SAR Δ', coherence: 'Coherence' }

export function VoteDots({ votes, agree, size = 'md' }) {
  const big = size === 'md'
  return (
    <div className="flex items-center gap-3">
      {votes.map((v) => (
        <div key={v.key} className="flex flex-col items-center gap-1 group relative">
          <span
            className={`${big ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} rounded-full border ${
              v.pass === true ? 'bg-teal border-teal' : v.pass === false ? 'border-rej' : 'border-dashed border-fg-dim'
            }`}
          />
          {big && <span className="text-[9.5px] text-fg-dim uppercase tracking-wider">{VOTE_LABEL[v.key]}</span>}
          <span className="pointer-events-none absolute bottom-full mb-1.5 hidden group-hover:block whitespace-nowrap mono text-[10.5px] px-1.5 py-0.5 bg-ink-950 border border-ink-500 text-fg z-20">
            {v.value}
          </span>
        </div>
      ))}
      <span className={`mono text-xs px-1.5 border ${agree === 3 ? 'text-teal border-teal-line' : agree === 2 ? 'text-amber border-amber-line' : 'text-rej border-rej-line'}`}>
        {agree}/3
      </span>
    </div>
  )
}

export function BracketBar({ bracket }) {
  const end = bracket.firstClear ?? bracket.firstSar
  return (
    <div>
      <div className="flex items-center h-3">
        <span className="w-2 h-3 bg-fg-muted" />
        <span className="flex-1 h-2" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #3A4958 0 2px, transparent 2px 5px)' }} />
        <span className={`w-2 h-3 ${bracket.firstClear ? 'bg-amber' : 'border border-sar'}`} />
      </div>
      <div className="flex justify-between mt-1 mono text-[10.5px]">
        <span className="text-fg-muted">{bracket.lastClear.slice(5)}</span>
        <span className="text-fg-dim">{bracket.gapDays} d</span>
        <span className={bracket.firstClear ? 'text-amber' : 'text-sar'}>{end.slice(5)}{bracket.firstClear ? '' : ' SAR'}</span>
      </div>
    </div>
  )
}

const FLAG_META = [
  [/no access/i, 'path', 'Access cue'],
  [/disagree/i, 'swap', 'Sensors disagree'],
  [/coverage gap/i, 'cloud', 'Near coverage gap'],
]
export function FlagBadges({ flags }) {
  if (!flags.length) return <span className="text-2xs text-fg-dim">No cues</span>
  return (
    <div className="flex gap-1.5">
      {flags.map((f) => {
        const [, icon, short] = FLAG_META.find(([re]) => re.test(f)) ?? [null, 'flag', 'Cue']
        return (
          <span key={f} className="group relative flex items-center gap-1 h-6 px-1.5 border border-amber-line bg-amber-dim text-amber text-[10.5px]">
            <Icon name={icon} size={12} />
            {short}
            <span className="pointer-events-none absolute top-full mt-1.5 right-0 hidden group-hover:block w-[220px] whitespace-normal text-[11px] leading-snug px-2 py-1.5 bg-ink-950 border border-ink-500 text-fg z-30">
              {f}
            </span>
          </span>
        )
      })}
    </div>
  )
}

// "i" / "Why?" popover so explanations never sit on the main surface.
export function InfoPop({ children, label, className = '', align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="inline-flex items-center gap-1 text-fg-dim hover:text-fg text-2xs"
        aria-label="More information"
      >
        <Icon name="info" size={13} />
        {label}
      </button>
      {open && (
        <span className={`absolute top-full mt-1.5 ${align === 'right' ? 'right-0' : 'left-0'} w-[260px] whitespace-normal panel brackets p-2.5 text-xs text-fg-muted leading-relaxed z-40 fade-in`}>
          {children}
        </span>
      )}
    </span>
  )
}

export function Sparkline({ values, w = 80, h = 20, color = '#8C99A7' }) {
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  )
}

export function Trend({ value, unit = '', good = 'down' }) {
  const up = value > 0
  const ok = (good === 'down') !== up
  return (
    <span className={`inline-flex items-center gap-0.5 mono text-[10.5px] ${value === 0 ? 'text-fg-dim' : ok ? 'text-teal' : 'text-amber'}`}>
      {value !== 0 && <Icon name={up ? 'arrowUp' : 'arrowDown'} size={10} />}
      {Math.abs(value)}{unit}
    </span>
  )
}
