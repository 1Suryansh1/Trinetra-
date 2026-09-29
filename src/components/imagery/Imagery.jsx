import { useCallback, useMemo, useRef, useState } from 'react'
import { changeBox, renderScene } from '../../lib/imagery'
import { aoiById } from '../../data/mock'
import { getDem } from '../../lib/dem'
import { layerUrl } from '../../lib/terrainLayers'

// Placeholder chip. Swap `renderScene` for a real chip URL when wiring the backend.
export function SceneChip({ seed, terrain, variant = 'after', sensor = 'optical', change = 'structure', size = 192, cloud = 0, date = '', box = false, className = '', imgClass = '', lat = null, lon = null }) {
  const src = useMemo(() => renderScene({ seed, terrain, variant, sensor, change, size, cloud, date, lat, lon }), [seed, terrain, variant, sensor, change, size, cloud, date, lat, lon])
  const b = changeBox(seed)
  return (
    <div className={`relative overflow-hidden bg-ink-950 ${className}`}>
      <img src={src} alt="" draggable={false} className={`w-full h-full object-cover select-none ${imgClass}`} />
      {box && <ChangeBox b={b} />}
    </div>
  )
}

export function ChangeBox({ b, tone = '#D6A24A', label }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
    >
      {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'left-0 bottom-0 border-l border-b', 'right-0 bottom-0 border-r border-b'].map((c) => (
        <span key={c} className={`absolute w-2.5 h-2.5 ${c}`} style={{ borderColor: tone, borderWidth: undefined }} />
      ))}
      {label && (
        <span className="absolute -top-5 left-0 mono text-2xs px-1 bg-ink-950/80" style={{ color: tone }}>
          {label}
        </span>
      )}
    </div>
  )
}

// Before/after viewer with a draggable swipe divider or a side-by-side layout.
export function SwipeViewer({ before, after, mode = 'swipe', overlays = null, beforeLabel, afterLabel, box, boxLabel }) {
  const [pos, setPos] = useState(50)
  const ref = useRef(null)
  const dragging = useRef(false)

  const move = useCallback((clientX) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }, [])

  const Caption = ({ children, side }) => (
    <div className={`absolute top-2 ${side === 'l' ? 'left-2' : 'right-2'} z-10 mono text-2xs px-1.5 py-0.5 bg-ink-950/85 border border-ink-600 text-fg-muted pointer-events-none`}>
      {children}
    </div>
  )

  if (mode === 'side') {
    return (
      <div className="grid grid-cols-2 gap-px bg-ink-600 w-full h-full">
        {[[before, beforeLabel, false], [after, afterLabel, true]].map(([src, lab, showBox], i) => (
          <div key={i} className="relative bg-ink-950 overflow-hidden">
            <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
            {overlays}
            {showBox && box && <ChangeBox b={box} label={boxLabel} />}
            <Caption side="l">{lab}</Caption>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden bg-ink-950 cursor-ew-resize select-none"
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
    >
      <img src={after} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      <img
        src={before}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      {overlays}
      {box && <ChangeBox b={box} label={boxLabel} />}
      <Caption side="l">{beforeLabel}</Caption>
      <Caption side="r">{afterLabel}</Caption>
      <div className="absolute top-0 bottom-0 z-20" style={{ left: `${pos}%` }}>
        <div className="absolute top-0 bottom-0 -translate-x-1/2 w-px bg-fg-hi/90" />
        <button
          type="button"
          aria-label="Swipe divider"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 2))
            if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 2))
          }}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-ink-900 border border-fg-hi/80 flex items-center justify-center text-fg-hi"
        >
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 1 0.8 5 4 9M10 1l3.2 4L10 9" /></svg>
        </button>
      </div>
    </div>
  )
}

const TONES = { amber: '#D6A24A', teal: '#3EB2A8', rej: '#C2625C', fg: '#D6DDE4', dim: '#5D6A78', sar: '#8FA3C7' }

// Map view over a darkened synthetic basemap with a graticule and crosshair markers.
export function MapView({ aoiId, markers = [], polygons = [], onMarkerClick, className = '', seed = 9001, showGrid = true, children, labels = true }) {
  const aoi = aoiById(aoiId === 'ALL' || !aoiId ? 'AOI-03' : aoiId)
  // Basemap = the AOI's DEM-derived drape (falls back to a procedural chip).
  const base = useMemo(() => {
    const dem = getDem(aoi.dem)
    return dem ? layerUrl(dem, aoi.terrain, 'optical') : renderScene({ seed: seed + aoi.id.charCodeAt(5), terrain: aoi.terrain, variant: 'before', sensor: 'optical', change: 'none', size: 384 })
  }, [aoi, seed])
  const [lat0, lon0] = aoi.center
  const [sLat, sLon] = aoi.span
  const toXY = (lat, lon) => [((lon - (lon0 - sLon)) / (2 * sLon)) * 100, (((lat0 + sLat) - lat) / (2 * sLat)) * 100]
  const ticksLat = [-0.5, 0, 0.5].map((t) => lat0 + t * sLat * 1.5)
  const ticksLon = [-0.5, 0, 0.5].map((t) => lon0 + t * sLon * 1.5)

  return (
    <div className={`relative overflow-hidden bg-ink-950 ${className}`}>
      <img src={base} alt="" className="absolute inset-0 w-full h-full object-fill opacity-60 saturate-[.6] brightness-[.75]" draggable={false} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {showGrid &&
          [10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
            <g key={v} stroke="#D6DDE4" strokeOpacity={v === 50 ? 0.12 : 0.06} strokeWidth="0.15" vectorEffect="non-scaling-stroke">
              <line x1={v} y1="0" x2={v} y2="100" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1={v} x2="100" y2={v} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        {polygons.map((p, i) => (
          <polygon
            key={i}
            points={p.points.map(([la, lo]) => toXY(la, lo).join(',')).join(' ')}
            fill={TONES[p.tone ?? 'amber']}
            fillOpacity={p.fillOpacity ?? 0.12}
            stroke={TONES[p.tone ?? 'amber']}
            strokeWidth="1"
            strokeDasharray={p.dashed ? '4 3' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {labels && (
        <>
          {ticksLon.map((lo) => (
            <span key={lo} className="absolute top-1 mono text-[9.5px] text-fg-dim -translate-x-1/2" style={{ left: `${toXY(lat0, lo)[0]}%` }}>
              {lo.toFixed(2)}°E
            </span>
          ))}
          {ticksLat.map((la) => (
            <span key={la} className="absolute left-1 mono text-[9.5px] text-fg-dim -translate-y-1/2" style={{ top: `${toXY(la, lon0)[1]}%` }}>
              {la.toFixed(2)}°N
            </span>
          ))}
        </>
      )}
      {markers.map((m) => {
        const [x, y] = toXY(m.lat, m.lon)
        const c = TONES[m.tone ?? 'amber']
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onMarkerClick?.(m.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${x}%`, top: `${y}%`, opacity: m.dim ? 0.35 : 1, zIndex: m.active ? 5 : 1 }}
            title={m.label ?? m.id}
          >
            <span className={`block ${m.active ? 'w-4 h-4' : 'w-2.5 h-2.5'} border`} style={{ borderColor: c, background: m.active ? `${c}33` : `${c}AA` }} />
            {m.active && (
              <>
                <span className="absolute left-1/2 -top-2.5 h-1.5 w-px -translate-x-1/2" style={{ background: c }} />
                <span className="absolute left-1/2 -bottom-2.5 h-1.5 w-px -translate-x-1/2" style={{ background: c }} />
                <span className="absolute top-1/2 -left-2.5 w-1.5 h-px -translate-y-1/2" style={{ background: c }} />
                <span className="absolute top-1/2 -right-2.5 w-1.5 h-px -translate-y-1/2" style={{ background: c }} />
              </>
            )}
            {(m.active || m.showLabel) && (
              <span className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap mono text-2xs px-1 bg-ink-950/85 border border-ink-600" style={{ color: c }}>
                {m.label ?? m.id}
              </span>
            )}
          </button>
        )
      })}
      {children}
      <div className="absolute bottom-1.5 right-2 flex items-center gap-2 mono text-[9.5px] text-fg-dim">
        <span className="inline-block w-10 border-t border-fg-dim" /> 5 km
      </div>
    </div>
  )
}

export function toMapXY(aoiId, lat, lon) {
  const aoi = aoiById(aoiId)
  const [lat0, lon0] = aoi.center
  const [sLat, sLon] = aoi.span
  return [((lon - (lon0 - sLon)) / (2 * sLon)) * 100, (((lat0 + sLat) - lat) / (2 * sLat)) * 100]
}
