import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../state/AppStore'
import { formatCoord } from '../../lib/coords'
import { fromFrac, sampleFrac } from '../../lib/dem'
import { Icon } from '../ui/Icon'
import { InfoPop } from '../evidence/Widgets'

// ---------------- LayerChips ----------------
const BASES = [
  { id: 'optical', icon: 'sun', label: 'Optical' },
  { id: 'sar', icon: 'radar', label: 'SAR' },
  { id: 'hillshade', icon: 'mountain', label: 'Shade' },
  { id: 'slope', icon: 'slope', label: 'Slope' },
]
const OVERLAYS = [
  { id: 'contours', icon: 'contour', label: 'Contours' },
  { id: 'drainage', icon: 'river', label: 'Rivers' },
  { id: 'pins', icon: 'pin', label: 'Pins' },
  { id: 'gaps', icon: 'cloud', label: 'Gaps' },
]
const SLOPE_RAMP = [['0°', '#2E6B4F'], ['5°', '#7FA650'], ['15°', '#D9C451'], ['25°', '#D98A3D'], ['35°', '#C2503E'], ['45°', '#7A3A8C']]

function Chip({ active, icon, label, onClick, tone = 'fg', tour }) {
  const on = tone === 'amber' ? 'border-amber text-amber bg-amber-dim' : 'border-fg-muted text-fg-hi bg-ink-700'
  return (
    <button
      data-tour={tour}
      onClick={onClick}
      className={`w-[68px] h-[46px] flex flex-col items-center justify-center gap-1 border transition-colors ${active ? on : 'border-ink-600 text-fg-dim hover:text-fg hover:border-ink-400'}`}
    >
      <Icon name={icon} size={15} />
      <span className="text-[9.5px] tracking-[0.06em] uppercase">{label}</span>
    </button>
  )
}

export function LayerChips({ base, effectiveBase, setBase, overlays, toggle, tool, setTool, normalised, setNormalised, contourInterval }) {
  return (
    <div className="glass border border-ink-600 p-1.5 space-y-1.5" data-tour="layers">
      <div className="grid grid-cols-2 gap-1">
        {BASES.map((b) => (
          <Chip key={b.id} icon={b.icon} label={b.label} active={effectiveBase === b.id || base === b.id} onClick={() => setBase(b.id)} />
        ))}
      </div>
      <div className="h-px bg-ink-600" />
      <div className="grid grid-cols-2 gap-1">
        {OVERLAYS.map((o) => (
          <Chip key={o.id} icon={o.icon} label={o.label} active={overlays[o.id]} onClick={() => toggle(o.id)} />
        ))}
      </div>
      <div className="h-px bg-ink-600" />
      <div className="grid grid-cols-2 gap-1">
        <Chip icon="profile" label="Profile" active={tool === 'profile'} tone="amber" onClick={() => setTool(tool === 'profile' ? null : 'profile')} />
        <Chip icon="funnel" label="Normalise" active={normalised} tone="amber" onClick={() => setNormalised(!normalised)} tour="normalise" />
      </div>
      {effectiveBase === 'slope' && (
        <div className="pt-1">
          <div className="flex h-1.5">{SLOPE_RAMP.map(([, c]) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
          <div className="flex justify-between mono text-[9px] text-fg-dim mt-0.5">{SLOPE_RAMP.filter((_, i) => i % 2 === 0).map(([l]) => <span key={l}>{l}</span>)}</div>
        </div>
      )}
      {overlays.contours && <div className="mono text-[9.5px] text-fg-dim text-center">{contourInterval} m interval</div>}
      {overlays.drainage && (
        <div className="flex justify-center">
          <InfoPop label="Rivers/roads" align="left">
            Rivers and water bodies come from the GLO-30 water-body mask; streams are DEM flow accumulation. Pale lines are modelled least-cost routes, not surveyed roads.
          </InfoPop>
        </div>
      )}
    </div>
  )
}

// ---------------- TimeScrubber ----------------
export const T0 = '2026-06-01'
export const T1 = '2026-09-28'
const day = (iso) => Math.round(new Date(iso + 'T00:00:00Z').getTime() / 864e5)
const iso = (d) => new Date(d * 864e5).toISOString().slice(0, 10)

export function TimeScrubber({ date, onDate, playing, onPlay, looks, events, cloudNow, monsoonActive, monsoonAuto, onMonsoon }) {
  const a = day(T0), b = day(T1)
  const x = (d) => ((day(d) - a) / (b - a)) * 100
  const track = useRef(null)
  const drag = useRef(false)
  const set = (clientX) => {
    const r = track.current.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    onDate(iso(Math.round(a + t * (b - a))))
  }
  const weeks = useMemo(() => {
    const n = Math.ceil((b - a) / 7)
    const bins = new Array(n).fill(0)
    events.forEach((e) => {
      const k = Math.floor((day(e) - a) / 7)
      if (k >= 0 && k < n) bins[k]++
    })
    return bins
  }, [events, a, b])
  const maxBin = Math.max(1, ...weeks)
  const months = ['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01']

  return (
    <div className="glass border border-ink-600 flex items-stretch h-[62px]" data-tour="timeline">
      <button onClick={onPlay} className="w-12 border-r border-ink-600 flex items-center justify-center text-fg hover:bg-ink-700" aria-label={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} size={16} />
      </button>
      <div className="w-[92px] border-r border-ink-600 flex flex-col justify-center px-2.5">
        <span className="mono text-sm text-fg-hi">{date.slice(5)}</span>
        <span className="mono text-[10px] text-fg-dim">{date.slice(0, 4)}</span>
      </div>
      <div
        ref={track}
        className="relative flex-1 mx-3 cursor-ew-resize select-none"
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); set(e.clientX) }}
        onPointerMove={(e) => drag.current && set(e.clientX)}
        onPointerUp={() => (drag.current = false)}
      >
        {/* change-density histogram */}
        <div className="absolute left-0 right-0 top-1.5 h-5 flex items-end gap-px">
          {weeks.map((v, i) => (
            <span key={i} className="flex-1 bg-amber/60" style={{ height: `${(v / maxBin) * 100}%`, minHeight: v ? 2 : 0 }} />
          ))}
        </div>
        {/* cloud pips */}
        <div className="absolute left-0 right-0 top-[30px] h-2">
          {looks.map((l) => (
            <span
              key={l.date}
              title={`${l.date} · ${l.cloud}% cloud`}
              className={`absolute w-1.5 h-1.5 -translate-x-1/2 ${l.cloud < 20 ? 'bg-fg-hi' : l.cloud < 60 ? 'bg-fg-dim' : 'border border-fg-dim'}`}
              style={{ left: `${x(l.date)}%` }}
            />
          ))}
        </div>
        <div className="absolute left-0 right-0 top-[40px] h-px bg-ink-500" />
        {months.map((m) => (
          <span key={m} className="absolute top-[44px] mono text-[9.5px] text-fg-dim" style={{ left: `${x(m)}%` }}>
            {new Date(m).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()}
          </span>
        ))}
        <div className="absolute top-0 bottom-0 w-px bg-fg-hi pointer-events-none" style={{ left: `${x(date)}%` }}>
          <span className="absolute -top-0.5 -left-[5px] w-[11px] h-[5px] bg-fg-hi" />
        </div>
      </div>
      <div className="w-[76px] border-l border-ink-600 flex flex-col justify-center items-center">
        <span className="flex items-center gap-1 text-fg-muted"><Icon name="cloud" size={13} /><span className="mono text-sm">{cloudNow}%</span></span>
        <span className="text-[9.5px] text-fg-dim uppercase tracking-wider">cloud</span>
      </div>
      <button
        onClick={onMonsoon}
        className={`w-[92px] border-l border-ink-600 flex flex-col justify-center items-center gap-0.5 ${monsoonActive ? 'bg-[#121a26] text-sar' : monsoonAuto ? 'text-fg-muted hover:text-fg' : 'text-fg-dim'}`}
        title="Auto-switch to SAR when optical is clouded"
      >
        <Icon name="radar" size={14} />
        <span className="text-[9.5px] uppercase tracking-wider">{monsoonActive ? 'Monsoon · SAR' : monsoonAuto ? 'Monsoon auto' : 'Monsoon off'}</span>
      </button>
    </div>
  )
}

// ---------------- FunnelGraphic ----------------
const IGNORED = [
  { k: 'Snow', icon: 'snow', n: 61 },
  { k: 'Crops', icon: 'grid', n: 48 },
  { k: 'Braiding', icon: 'river', n: 34 },
  { k: 'Shadow', icon: 'mountain', n: 27 },
  { k: 'Registration', icon: 'swap', n: 18 },
]
export function FunnelGraphic() {
  const [t, setT] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1800)
      setT(k)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const shown = Math.round(200 - (200 - 12) * t)
  return (
    <div className="glass border border-ink-600 px-3 py-2 flex items-center gap-3 fade-in">
      <div className="text-center">
        <div className="mono text-lg text-rej leading-none">200</div>
        <div className="text-[9px] text-fg-dim uppercase tracking-wider mt-0.5">raw</div>
      </div>
      <svg width="120" height="34" viewBox="0 0 120 34">
        <path d="M0 2 L120 12 L120 22 L0 32 Z" fill="#D6A24A22" stroke="#D6A24A88" />
        <path d={`M0 2 L${120 * t} ${2 + 10 * t} L${120 * t} ${32 - 10 * t} L0 32 Z`} fill="#D6A24A33" />
      </svg>
      <div className="flex gap-2">
        {IGNORED.map((g, i) => (
          <span key={g.k} className="flex flex-col items-center transition-opacity" style={{ opacity: t > i / 6 ? 1 : 0.15 }} title={`${g.k}: ${g.n} ignored`}>
            <Icon name={g.icon} size={13} className="text-fg-muted" />
            <span className="mono text-[9.5px] text-fg-dim">−{g.n}</span>
          </span>
        ))}
      </div>
      <Icon name="chevron" size={14} className="text-fg-dim" />
      <div className="text-center">
        <div className="mono text-lg text-amber leading-none">{shown}</div>
        <div className="text-[9px] text-fg-dim uppercase tracking-wider mt-0.5">raised</div>
      </div>
    </div>
  )
}

// ---------------- CrossSection ----------------
export function CrossSection({ dem, pts, changes, onClose }) {
  const W = 560, H = 128, P = 30
  const data = useMemo(() => {
    const [A, B] = pts
    const lenM = Math.hypot((B.fx - A.fx) * dem.widthM, (B.fy - A.fy) * dem.heightM)
    const samples = Array.from({ length: 200 }, (_, k) => {
      const t = k / 199
      const s = sampleFrac(dem, A.fx + (B.fx - A.fx) * t, A.fy + (B.fy - A.fy) * t)
      return { t, e: s.elev, slope: s.slope }
    })
    const near = changes
      .map((c) => {
        const vx = (B.fx - A.fx) * dem.widthM, vy = (B.fy - A.fy) * dem.heightM
        const wx = (c.fx - A.fx) * dem.widthM, wy = (c.fy - A.fy) * dem.heightM
        const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
        const off = Math.hypot(wx - vx * t, wy - vy * t)
        return { ...c, t, off }
      })
      .filter((c) => c.off < 2000)
    const lo = Math.min(...samples.map((s) => s.e)), hi = Math.max(...samples.map((s) => s.e))
    return { samples, lenM, lo, hi, near, maxSlope: Math.max(...samples.map((s) => s.slope)) }
  }, [dem, pts, changes])
  const span = Math.max(1, data.hi - data.lo)
  const X = (t) => P + t * (W - P - 8)
  const Y = (e) => H - 18 - ((e - data.lo) / span) * (H - 34)
  const line = data.samples.map((s) => `${X(s.t)},${Y(s.e)}`).join(' ')
  return (
    <div className="glass border border-ink-600 slide-in-right">
      <div className="flex items-center gap-4 px-3 h-8 border-b border-ink-600 text-xs">
        <span className="label text-fg-muted">Profile A–B</span>
        <span className="mono text-fg">{(data.lenM / 1000).toFixed(1)} km</span>
        <span className="mono text-fg-muted">{Math.round(data.lo)}–{Math.round(data.hi)} m</span>
        <span className="mono text-fg-muted">max {Math.round(data.maxSlope)}°</span>
        <span className="flex-1" />
        <button onClick={onClose} className="text-fg-dim hover:text-fg"><Icon name="x" size={13} /></button>
      </div>
      <svg width={W} height={H}>
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1={P} x2={W - 8} y1={Y(data.lo + span * k)} y2={Y(data.lo + span * k)} stroke="#1F2A35" />
            <text x={P - 4} y={Y(data.lo + span * k) + 3} textAnchor="end" className="mono" fontSize="9" fill="#5D6A78">{Math.round(data.lo + span * k)}</text>
          </g>
        ))}
        <polygon points={`${X(0)},${H - 18} ${line} ${X(1)},${H - 18}`} fill="#D6A24A1c" />
        <polyline points={line} fill="none" stroke="#D6A24A" strokeWidth="1.5" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={X(t)} y={H - 5} textAnchor="middle" className="mono" fontSize="9" fill="#5D6A78">{((data.lenM * t) / 1000).toFixed(1)}</text>
        ))}
        {data.near.map((c) => {
          const e = sampleFrac(dem, c.fx, c.fy).elev
          return (
            <g key={c.id}>
              <line x1={X(c.t)} x2={X(c.t)} y1={Y(e)} y2={12} stroke="#EEF2F5" strokeDasharray="2 2" />
              <rect x={X(c.t) - 3.5} y={Y(e) - 3.5} width="7" height="7" fill="#07090C" stroke="#EEF2F5" />
              <text x={X(c.t) + 4} y={10} className="mono" fontSize="9.5" fill="#EEF2F5">{c.id.slice(4)} · {(c.off / 1000).toFixed(1)} km</text>
            </g>
          )
        })}
        <text x={P} y={11} fontSize="9.5" fill="#D6A24A" className="mono">A</text>
        <text x={W - 14} y={11} fontSize="9.5" fill="#D6A24A" className="mono">B</text>
      </svg>
    </div>
  )
}

// ---------------- CursorReadout ----------------
export function CursorReadout({ dem, hover }) {
  const { coord, setCoord } = useStore()
  const s = hover ? sampleFrac(dem, hover.fx, hover.fy) : null
  const [lat, lon] = hover ? fromFrac(dem, hover.fx, hover.fy) : [null, null]
  const next = { WGS84: 'MGRS', MGRS: 'IG', IG: 'WGS84' }
  return (
    <div className="glass border border-ink-600 flex items-center h-8 text-xs">
      <button onClick={() => setCoord(next[coord])} className="h-full px-2 border-r border-ink-600 text-[9.5px] tracking-wider text-fg-muted hover:text-fg w-14" title="Switch grid">
        {coord === 'IG' ? 'IND GRID' : coord}
      </button>
      <span className="mono px-2.5 text-fg w-[210px] truncate">{hover ? formatCoord(coord, lat, lon) : '—'}</span>
      <span className="mono px-2.5 border-l border-ink-600 text-fg-muted w-[78px]">{s ? `${Math.round(s.elev)} m` : '— m'}</span>
      <span className="mono px-2.5 border-l border-ink-600 text-fg-muted w-[58px]">{s ? `${Math.round(s.slope)}°` : '—°'}</span>
    </div>
  )
}

// ---------------- NavWidgets ----------------
export function NavWidgets({ azimuth, distance, mpu, exag, setExag, onReset }) {
  const vh = window.innerHeight * 0.75
  const metersPerPx = (2 * distance * Math.tan((19 * Math.PI) / 180) * mpu) / vh
  const nice = [100, 200, 500, 1000, 2000, 5000, 10000]
  const m = nice.find((n) => n / metersPerPx >= 60) ?? 10000
  const px = m / metersPerPx
  return (
    <div className="glass border border-ink-600 flex items-center h-10 text-xs">
      <div className="w-10 h-full flex items-center justify-center border-r border-ink-600" title="North">
        <svg width="22" height="22" viewBox="-11 -11 22 22" style={{ transform: `rotate(${(azimuth * 180) / Math.PI}deg)` }}>
          <path d="M0 -9 L4 3 L0 1 L-4 3 Z" fill="#EEF2F5" />
          <path d="M0 9 L4 3 L0 1 L-4 3 Z" fill="#3A4958" />
        </svg>
      </div>
      <div className="px-3 border-r border-ink-600 h-full flex flex-col justify-center">
        <span className="block border-x border-b border-fg-muted h-1.5" style={{ width: px }} />
        <span className="mono text-[9.5px] text-fg-dim mt-0.5">{m >= 1000 ? `${m / 1000} km` : `${m} m`}</span>
      </div>
      <label className="px-3 h-full flex items-center gap-2 border-r border-ink-600" title="Vertical exaggeration">
        <Icon name="mountain" size={13} className="text-fg-dim" />
        <input type="range" className="slim w-20" min={1} max={3} step={0.1} value={exag} onChange={(e) => setExag(+e.target.value)} />
        <span className="mono text-fg w-8">{exag.toFixed(1)}×</span>
      </label>
      <button onClick={onReset} className="w-10 h-full flex items-center justify-center text-fg-muted hover:text-fg" title="Reset view">
        <Icon name="refresh" size={14} />
      </button>
    </div>
  )
}
