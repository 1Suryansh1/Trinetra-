import { useMemo, useState } from 'react'
import { RAW_DIFF, CORE_CHANGES as CHANGES } from '../../data/mock'
import { mulberry32 } from '../../lib/rng'
import { renderScene } from '../../lib/imagery'
import { Btn, Kbd, StatusPill } from '../../components/ui/primitives'
import { useStore } from '../../state/AppStore'

const REASON_COLORS = ['#9FB3C8', '#B7A77A', '#6FA79A', '#8C7FB0', '#C2625C']

function rawPoints() {
  const r = mulberry32(2026)
  const pts = []
  RAW_DIFF.ignored.forEach((g, gi) => {
    for (let i = 0; i < g.count; i++) {
      let x, y
      if (gi === 0) { x = 8 + r() * 40; y = 6 + r() * 30 } // snow: north-west high ground
      else if (gi === 1) { const px = [62, 78, 55][i % 3], py = [58, 70, 80][i % 3]; x = px + (r() - 0.5) * 16; y = py + (r() - 0.5) * 12 }
      else if (gi === 2) { const t = r(); x = 20 + t * 70; y = 50 + Math.sin(t * 7) * 8 + (r() - 0.5) * 5 }
      else if (gi === 3) { const t = r(); x = 50 + t * 40; y = 10 + t * 28 + (r() - 0.5) * 4 }
      else { const edge = r() < 0.5; x = edge ? 2 + r() * 5 : r() * 96 + 2; y = edge ? r() * 96 + 2 : 92 + r() * 5 }
      pts.push({ x, y, g: gi })
    }
  })
  return pts
}

function keptPoints() {
  const r = mulberry32(12)
  return CHANGES.map((c) => ({ id: c.id, x: 12 + r() * 76, y: 12 + r() * 76 }))
}

function Board({ title, count, sub, children, accent }) {
  const bg = useMemo(() => renderScene({ seed: 4242, terrain: 'floodplain', variant: 'before', change: 'none', size: 512 }), [])
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-end gap-4 mb-3">
        <div className={`text-[64px] leading-none font-extralight num ${accent}`}>{count}</div>
        <div className="pb-1.5">
          <div className="text-base text-fg-hi">{title}</div>
          <div className="text-xs text-fg-dim">{sub}</div>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 border border-ink-600 brackets overflow-hidden">
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45 saturate-[.4] brightness-[.7]" />
        {children}
      </div>
    </div>
  )
}

export function RawComparison({ onClose }) {
  const { changes } = useStore()
  const [hover, setHover] = useState(null)
  const raw = useMemo(rawPoints, [])
  const kept = useMemo(keptPoints, [])
  const statusOf = (id) => changes.find((c) => c.id === id)?.status ?? 'pending'
  const ignoredTotal = RAW_DIFF.ignored.reduce((s, g) => s + g.count, 0)

  return (
    <div className="flex-1 min-h-0 flex flex-col gridlines fade-in">
      <div className="flex items-center gap-4 px-8 pt-6 pb-4">
        <div>
          <div className="label">Same AOIs · same 12 days · same scenes</div>
          <h1 className="text-[28px] font-light text-fg-hi mt-1 tracking-tight">Raw differencing vs Trinetra</h1>
        </div>
        <span className="flex-1" />
        <div className="text-right mr-4">
          <div className="text-[40px] leading-none font-extralight text-teal num">−94%</div>
          <div className="label mt-1">analyst load</div>
        </div>
        <Btn variant="outline" onClick={onClose}>Back to queue <Kbd>D</Kbd></Btn>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_1fr_340px] gap-6 px-8 pb-6">
        <Board title="Raw pixel-differencing alerts" count={RAW_DIFF.total} sub="Every changed pixel cluster above threshold" accent="text-rej">
          {raw.map((p, i) => (
            <span
              key={i}
              className="absolute w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 transition-opacity"
              style={{
                left: `${p.x}%`, top: `${p.y}%`,
                background: hover === null ? '#C2625C' : REASON_COLORS[p.g],
                opacity: hover === null ? 0.75 : hover === p.g ? 1 : 0.1,
              }}
            />
          ))}
        </Board>
        <Board title="Trinetra alerts" count={RAW_DIFF.trinetra} sub="3 independent detectors, terrain-normalised, ranked" accent="text-amber">
          {kept.map((p) => {
            const st = statusOf(p.id)
            const col = st === 'confirmed' ? '#3EB2A8' : st === 'rejected' ? '#C2625C' : '#D6A24A'
            return (
              <span key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <span className="w-3 h-3 border" style={{ borderColor: col, background: `${col}55` }} />
                <span className="mono text-2xs px-1 bg-ink-950/80" style={{ color: col }}>{p.id.slice(4)}</span>
              </span>
            )
          })}
        </Board>
        <div className="flex flex-col min-h-0">
          <div className="label mb-1">Correctly ignored</div>
          <div className="text-[40px] leading-none font-extralight num text-fg-hi">{ignoredTotal}</div>
          <div className="text-xs text-fg-dim mb-4">Hover a reason to see where it fired</div>
          <div className="space-y-1">
            {RAW_DIFF.ignored.map((g, i) => (
              <div
                key={g.reason}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={`px-3 py-2.5 border cursor-default transition-colors ${hover === i ? 'border-fg-muted bg-ink-750' : 'border-ink-600 bg-ink-850'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5" style={{ background: REASON_COLORS[i] }} />
                  <span className="text-sm text-fg">{g.reason}</span>
                  <span className="flex-1" />
                  <span className="mono text-base text-fg-hi">{g.count}</span>
                </div>
                <div className="h-1 bg-ink-600 mt-2"><div className="h-full" style={{ width: `${(g.count / 61) * 100}%`, background: REASON_COLORS[i] }} /></div>
                <div className="text-2xs text-fg-dim mt-1.5">{g.note}</div>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t border-ink-600">
            <div className="label mb-2">Trinetra alerts by decision</div>
            <div className="flex flex-wrap gap-1.5">
              {['pending', 'confirmed', 'rejected', 'needs-data'].map((s) => {
                const n = CHANGES.filter((c) => statusOf(c.id) === s).length
                return n ? <span key={s} className="flex items-center gap-1.5"><StatusPill status={s} /><span className="mono text-xs">{n}</span></span> : null
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
