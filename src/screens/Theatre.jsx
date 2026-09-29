import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AOIS, SECTORS, aoiById, sectorById } from '../data/mock'
import { useStore } from '../state/AppStore'
import { getTheatre, areaKm2 } from '../lib/dem'
import { regionFromAoi, regionFromSector, regionFromShape, theatreElev, tilesFor } from '../lib/region'
import { getDem } from '../lib/dem'
import { formatCoord } from '../lib/coords'
import { bus } from '../lib/bus'
import { Icon } from '../components/ui/Icon'
import { HintChip } from '../components/onboarding/HintChip'
import { CountUp } from '../components/ui/primitives'

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const invMercY = (m) => ((2 * Math.atan(Math.exp(m)) - Math.PI / 2) * 180) / Math.PI

function useProjection() {
  const t = getTheatre()
  const { bbox, width: W, height: H } = t.meta
  return useMemo(() => {
    const my0 = mercY(bbox.north), my1 = mercY(bbox.south)
    return {
      W, H, url: t.url,
      toImg: (lat, lon) => [((lon - bbox.west) / (bbox.east - bbox.west)) * W, ((my0 - mercY(lat)) / (my0 - my1)) * H],
      toGeo: (x, y) => [invMercY(my0 - (y / H) * (my0 - my1)), bbox.west + (x / W) * (bbox.east - bbox.west)],
    }
  }, [t, bbox, W, H])
}

// Feathered edges so the relief tile blends into the sea colour.
const EDGE_MASK = 'linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 5%, #000 100%)'
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function polyAreaKm2(pts) {
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const xy = pts.map(([la, lo]) => [lo * 111.32 * Math.cos((lat0 * Math.PI) / 180), la * 110.574])
  let a = 0
  for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1 }
  return Math.abs(a) / 2
}
const bboxOf = (pts) => ({ south: Math.min(...pts.map((p) => p[0])), north: Math.max(...pts.map((p) => p[0])), west: Math.min(...pts.map((p) => p[1])), east: Math.max(...pts.map((p) => p[1])) })

const TOOLS = [
  { id: 'select', icon: 'pointer', label: 'Select' },
  { id: 'rect', icon: 'rect', label: 'Box' },
  { id: 'poly', icon: 'polygon', label: 'Polygon' },
  { id: 'circle', icon: 'circle', label: 'Circle' },
]

export default function TheatreMap() {
  const P = useProjection()
  const nav = useNavigate()
  const { changes, setRegion, coord } = useStore()
  const box = useRef(null)
  const [size, setSize] = useState({ w: 1200, h: 700 })
  const [view, setView] = useState(null) // { k, tx, ty }
  const [tool, setTool] = useState('select')
  const [hoverSec, setHoverSec] = useState(null)
  const [hoverAoi, setHoverAoi] = useState(null)
  const [selected, setSelected] = useState(null) // { type: 'sector' | 'aoi', id } | { type: 'shape', shape }
  const [draft, setDraft] = useState(null) // in-progress shape
  const [cursor, setCursor] = useState(null)
  const [flying, setFlying] = useState(false)
  const drag = useRef(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  const fit = useCallback((b, pad = 1) => {
    const [x0, y0] = P.toImg(b.north, b.west), [x1, y1] = P.toImg(b.south, b.east)
    const k = Math.min(size.w / (x1 - x0), size.h / (y1 - y0)) * pad
    return { k, tx: size.w / 2 - ((x0 + x1) / 2) * k, ty: size.h / 2 - ((y0 + y1) / 2) * k }
  }, [P, size])

  useEffect(() => { setView(fit({ north: 36.2, south: 7.5, west: 67.5, east: 97.8 }, 1)) }, [fit])

  const animateTo = (target, dur = 900) => new Promise((res) => {
    const from = view, t0 = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur), e = ease(t)
      const k = from.k * Math.pow(target.k / from.k, e)
      setView({ k, tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e })
      if (t < 1) requestAnimationFrame(step)
      else res()
    }
    requestAnimationFrame(step)
  })

  const pending = (aoi) => changes.filter((c) => c.aoi === aoi && c.status === 'pending').length
  const sectorPending = (s) => (s.aois ? s.aois.reduce((n, a) => n + pending(a), 0) : s.aoi ? pending(s.aoi) : 0)
  const screenToGeo = (sx, sy) => P.toGeo((sx - view.tx) / view.k, (sy - view.ty) / view.k)
  const geoToScreen = (lat, lon) => { const [x, y] = P.toImg(lat, lon); return [x * view.k + view.tx, y * view.k + view.ty] }
  const local = (e) => { const r = box.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }

  const regionFor = () => {
    if (selected?.type === 'aoi') return regionFromAoi(aoiById(selected.id))
    if (selected?.type === 'sector') { const sec = sectorById(selected.id); return sec.aois ? null : regionFromSector(sec) }
    if (selected?.type === 'shape') return regionFromShape(selected.shape)
    return null
  }
  // Multi-AOI sectors zoom in so their AOIs can be picked.
  const selectSector = (sec) => {
    setSelected({ type: 'sector', id: sec.id })
    setTool('select')
    if (sec.aois) {
      const la = sec.poly.map((p) => p[0]), lo = sec.poly.map((p) => p[1])
      animateTo(fit({ north: Math.max(...la), south: Math.min(...la), west: Math.min(...lo), east: Math.max(...lo) }, 0.8), 900)
    }
  }

  const open = async (region = regionFor()) => {
    if (!region || flying) return
    setFlying(true)
    await animateTo(fit(region.bbox, 0.9), 1100)
    setRegion(region)
    nav('/workspace')
  }

  useEffect(() => {
    const offs = [
      bus.on('theatre:select', (id) => selectSector(sectorById(id))),
      bus.on('theatre:open', () => open(regionFromSector(sectorById(selected?.id ?? 'SEC-W')))),
    ]
    return () => offs.forEach((o) => o())
  })

  // ---- pointer handling ----
  const onDown = (e) => {
    if (!view) return
    const [sx, sy] = local(e)
    const g = screenToGeo(sx, sy)
    if (tool === 'select') { zoomTarget.current = null; drag.current = { sx, sy, tx: view.tx, ty: view.ty, moved: false }; return }
    if (tool === 'rect' || tool === 'circle') { setDraft({ kind: tool, a: g, b: g }); drag.current = { draw: true } }
  }
  const onMove = (e) => {
    if (!view) return
    const [sx, sy] = local(e)
    const g = screenToGeo(sx, sy)
    setCursor({ sx, sy, lat: g[0], lon: g[1] })
    const d = drag.current
    if (d && !d.draw) {
      if (Math.abs(sx - d.sx) + Math.abs(sy - d.sy) > 3) d.moved = true
      setView((v) => ({ ...v, tx: d.tx + sx - d.sx, ty: d.ty + sy - d.sy }))
    } else if (d?.draw) setDraft((dr) => ({ ...dr, b: g }))
    else if (draft?.kind === 'poly') setDraft((dr) => ({ ...dr, hover: g }))
  }
  const finishShape = (shape) => { setSelected({ type: 'shape', shape }); setDraft(null); setTool('select') }
  const onUp = (e) => {
    const d = drag.current
    drag.current = null
    if (d?.draw && draft) {
      const { a, b } = draft
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 0.05) { setDraft(null); return }
      if (draft.kind === 'rect') {
        const pts = [a, [a[0], b[1]], b, [b[0], a[1]]]
        finishShape({ kind: 'rect', pts, bbox: bboxOf(pts), area: areaKm2(bboxOf(pts)) })
      } else {
        const rKm = Math.hypot((b[0] - a[0]) * 110.574, (b[1] - a[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180))
        const dLat = rKm / 110.574, dLon = rKm / (111.32 * Math.cos((a[0] * Math.PI) / 180))
        finishShape({ kind: 'circle', center: a, rKm, bbox: { south: a[0] - dLat, north: a[0] + dLat, west: a[1] - dLon, east: a[1] + dLon }, area: Math.PI * rKm * rKm })
      }
      return
    }
    if (tool === 'poly') {
      const [sx, sy] = local(e)
      const g = screenToGeo(sx, sy)
      const pts = draft?.pts ?? []
      if (pts.length >= 3) {
        const [fx, fy] = geoToScreen(...pts[0])
        if (Math.hypot(fx - sx, fy - sy) < 12) { finishShape({ kind: 'poly', pts, bbox: bboxOf(pts), area: polyAreaKm2(pts) }); return }
      }
      setDraft({ kind: 'poly', pts: [...pts, g], hover: g })
      return
    }
    if (d && !d.moved && tool === 'select') {
      if (hoverAoi) setSelected({ type: 'aoi', id: hoverAoi })
      else if (hoverSec) selectSector(sectorById(hoverSec))
      else setSelected(null)
    }
  }
  // Wheel zoom eases towards a target view instead of jumping.
  const zoomTarget = useRef(null)
  const zoomRaf = useRef(0)
  const viewRef = useRef(view)
  viewRef.current = view
  const glide = () => {
    const v = viewRef.current, t = zoomTarget.current
    if (!t || !v) { zoomRaf.current = 0; return }
    const nv = { k: v.k + (t.k - v.k) * 0.22, tx: v.tx + (t.tx - v.tx) * 0.22, ty: v.ty + (t.ty - v.ty) * 0.22 }
    if (Math.abs(nv.k - t.k) / t.k < 0.002 && Math.abs(nv.tx - t.tx) < 0.5 && Math.abs(nv.ty - t.ty) < 0.5) {
      zoomTarget.current = null
      zoomRaf.current = 0
      setView(t)
      return
    }
    viewRef.current = nv
    setView(nv)
    zoomRaf.current = requestAnimationFrame(glide)
  }
  const onWheel = (e) => {
    if (!view) return
    const [sx, sy] = local(e)
    const base = zoomTarget.current ?? view
    const f = Math.exp(-e.deltaY * 0.0018)
    const k = Math.min(40, Math.max(0.2, base.k * f))
    const r = k / base.k
    zoomTarget.current = { k, tx: sx - (sx - base.tx) * r, ty: sy - (sy - base.ty) * r }
    if (!zoomRaf.current) zoomRaf.current = requestAnimationFrame(glide)
  }
  useEffect(() => () => cancelAnimationFrame(zoomRaf.current), [])

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { setDraft(null); setTool('select') }
      if (e.key === 'Enter' && draft?.kind === 'poly' && draft.pts.length >= 3) finishShape({ kind: 'poly', pts: draft.pts, bbox: bboxOf(draft.pts), area: polyAreaKm2(draft.pts) })
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  if (!view) return <div ref={box} className="flex-1" />

  const pts = (arr) => arr.map(([la, lo]) => P.toImg(la, lo).join(',')).join(' ')
  const draftArea = draft
    ? draft.kind === 'rect' ? areaKm2(bboxOf([draft.a, draft.b]))
      : draft.kind === 'circle' ? Math.PI * Math.hypot((draft.b[0] - draft.a[0]) * 110.574, (draft.b[1] - draft.a[1]) * 111.32 * Math.cos((draft.a[0] * Math.PI) / 180)) ** 2
        : draft.pts.length >= 2 ? polyAreaKm2([...draft.pts, draft.hover]) : 0
    : 0
  const selRegion = regionFor()
  const selSector = selected?.type === 'sector' ? sectorById(selected.id) : null
  const totalPending = changes.filter((c) => c.status === 'pending').length
  const elev = cursor ? theatreElev(cursor.lat, cursor.lon) : null

  return (
    <div
      ref={box}
      className={`relative flex-1 min-h-0 overflow-hidden bg-[#070A0E] select-none ${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={() => setCursor(null)}
      onWheel={onWheel}
      onDoubleClick={() => draft?.kind === 'poly' && draft.pts.length >= 3 && finishShape({ kind: 'poly', pts: draft.pts, bbox: bboxOf(draft.pts), area: polyAreaKm2(draft.pts) })}
    >
      <img
        src={P.url}
        alt=""
        draggable={false}
        className="absolute top-0 left-0 origin-top-left pointer-events-none"
        style={{ width: P.W, height: P.H, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`, WebkitMaskImage: EDGE_MASK, maskImage: EDGE_MASK, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' }}
      />
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {[70, 75, 80, 85, 90, 95].map((lo) => { const [x] = P.toImg(0, lo); return <line key={lo} x1={x} x2={x} y1={0} y2={P.H} stroke="#EEF2F5" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" /> })}
          {[10, 15, 20, 25, 30, 35].map((la) => { const [, y] = P.toImg(la, 70); return <line key={la} x1={0} x2={P.W} y1={y} y2={y} stroke="#EEF2F5" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" /> })}
          {SECTORS.map((s) => {
            const on = hoverSec === s.id || selected?.id === s.id
            return (
              <polygon
                key={s.id}
                points={pts(s.poly)}
                className="pointer-events-auto"
                onPointerEnter={() => tool === 'select' && setHoverSec(s.id)}
                onPointerLeave={() => setHoverSec(null)}
                fill={selected?.id === s.id ? '#D6A24A22' : on ? '#EEF2F512' : '#EEF2F506'}
                stroke={selected?.id === s.id ? '#D6A24A' : on ? '#EEF2F5' : '#8C99A7'}
                strokeOpacity={on ? 1 : 0.55}
                strokeWidth={selected?.id === s.id ? 1.6 : 1}
                strokeDasharray={s.aoi || s.aois ? undefined : '5 4'}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
          {AOIS.map((a) => {
            const on = selected?.type === 'aoi' && selected.id === a.id
            return (
              <rect key={a.id} {...(() => { const [x0, y0] = P.toImg(a.bbox.north, a.bbox.west), [x1, y1] = P.toImg(a.bbox.south, a.bbox.east); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })()}
                className="pointer-events-auto cursor-pointer"
                onPointerEnter={() => tool === 'select' && setHoverAoi(a.id)}
                onPointerLeave={() => setHoverAoi(null)}
                fill={on ? '#D6A24A40' : hoverAoi === a.id ? '#3EB2A866' : '#3EB2A833'}
                stroke={on ? '#D6A24A' : '#3EB2A8'} strokeWidth={on ? 1.6 : 1} vectorEffect="non-scaling-stroke" />
            )
          })}
          {selected?.type === 'shape' && <Shape P={P} shape={selected.shape} tone="#D6A24A" />}
          {draft && draft.kind !== 'poly' && (
            draft.kind === 'rect'
              ? <Shape P={P} shape={{ kind: 'rect', pts: [draft.a, [draft.a[0], draft.b[1]], draft.b, [draft.b[0], draft.a[1]]] }} tone="#EEF2F5" dashed />
              : <Shape P={P} shape={{ kind: 'circle', center: draft.a, rKm: Math.hypot((draft.b[0] - draft.a[0]) * 110.574, (draft.b[1] - draft.a[1]) * 111.32 * Math.cos((draft.a[0] * Math.PI) / 180)) }} tone="#EEF2F5" dashed />
          )}
          {draft?.kind === 'poly' && <polyline points={pts([...draft.pts, draft.hover])} fill="#EEF2F510" stroke="#EEF2F5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        </g>
      </svg>

      {/* sector chips */}
      {SECTORS.map((s, si) => {
        const c = s.labelAt ?? s.poly.reduce((a, p) => [a[0] + p[0] / s.poly.length, a[1] + p[1] / s.poly.length], [0, 0])
        const [x, y] = geoToScreen(c[0], c[1])
        const n = sectorPending(s)
        if (s.aois && selected?.id === s.id) return null // its AOI chips take over when zoomed in
        return (
          <button
            key={s.id}
            data-tour={s.id === 'SEC-W' ? 'sectors' : undefined}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => selectSector(s)}
            onMouseEnter={() => setHoverSec(s.id)}
            onMouseLeave={() => setHoverSec(null)}
            className={`stagger absolute -translate-x-1/2 -translate-y-1/2 glass border flex items-center h-7 text-xs whitespace-nowrap transition-colors ${selected?.id === s.id ? 'border-amber' : 'border-ink-500 hover:border-fg-muted'}`}
            style={{ left: x, top: y, '--i': si + 4 }}
          >
            <span className="px-2 text-fg">{s.name}</span>
            {n > 0 && <span className="h-full px-1.5 flex items-center gap-1 bg-amber text-ink-950 mono font-semibold"><Icon name="flag" size={10} />{n}</span>}
            <span className="h-full px-1.5 flex items-center gap-1 border-l border-ink-600 mono text-[10.5px] text-fg-dim"><Icon name="refresh" size={10} />{s.ingest}</span>
          </button>
        )
      })}

      {/* AOI labels once zoomed in */}
      {view.k > 1.3 && AOIS.map((a) => {
        const [x, y] = geoToScreen(a.bbox.north, (a.bbox.west + a.bbox.east) / 2)
        const n = pending(a.id)
        const on = selected?.type === 'aoi' && selected.id === a.id
        return (
          <button
            key={a.id}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => setSelected({ type: 'aoi', id: a.id })}
            className={`absolute -translate-x-1/2 -translate-y-full -mt-1 glass border flex items-center h-6 text-[11px] whitespace-nowrap fade-in ${on ? 'border-amber' : 'border-teal-line hover:border-teal'}`}
            style={{ left: x, top: y - 4 }}
          >
            <span className="px-1.5 mono text-teal">{a.id}</span>
            <span className="px-1.5 text-fg border-l border-ink-600">{a.name}</span>
            {n > 0 && <span className="h-full px-1.5 flex items-center bg-amber text-ink-950 mono font-semibold">{n}</span>}
          </button>
        )
      })}

      {/* live draw chip */}
      {draft && cursor && draftArea > 0 && (
        <div className="absolute pointer-events-none glass border border-ink-500 px-2 h-7 flex items-center gap-3 text-xs" style={{ left: cursor.sx + 16, top: cursor.sy + 16 }}>
          <span className="mono text-fg-hi">{Math.round(draftArea).toLocaleString()} km²</span>
          <span className="mono text-fg-muted">{tilesFor(draftArea).toLocaleString()} tiles</span>
        </div>
      )}

      {/* top-left header + tools */}
      <div className="absolute top-4 left-4 space-y-2 rise" style={{ '--i': 1 }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <div className="glass border border-ink-600 px-3 py-2 flex items-center gap-4">
          <div>
            <div className="label">Theatre</div>
            <div className="text-lg font-light text-fg-hi leading-tight">India</div>
          </div>
          <div className="h-8 w-px bg-ink-600" />
          <div className="text-center"><div className="mono text-lg text-fg-hi leading-tight"><CountUp value={SECTORS.length} /></div><div className="text-[9.5px] text-fg-dim uppercase tracking-wider">sectors</div></div>
          <div className="text-center"><div className="mono text-lg text-teal leading-tight"><CountUp value={AOIS.length} /></div><div className="text-[9.5px] text-fg-dim uppercase tracking-wider">DEM AOIs</div></div>
          <div className="text-center"><div className="mono text-lg text-amber leading-tight"><CountUp value={totalPending} /></div><div className="text-[9.5px] text-fg-dim uppercase tracking-wider">alerts</div></div>
        </div>
        <div className="glass border border-ink-600 p-1 flex gap-1" data-tour="draw">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => { setTool(t.id); setDraft(null) }} className={`w-[58px] h-11 flex flex-col items-center justify-center gap-1 border ${tool === t.id ? 'border-fg-muted bg-ink-700 text-fg-hi' : 'border-transparent text-fg-dim hover:text-fg'}`}>
              <Icon name={t.icon} size={15} />
              <span className="text-[9.5px] uppercase tracking-wider">{t.label}</span>
            </button>
          ))}
        </div>
        {tool === 'poly' && <div className="glass border border-ink-600 text-[11px] text-fg-muted px-2 py-1">Click points · Enter to close</div>}
        <HintChip id="theatre-pick">Pick a sector or draw a region</HintChip>
      </div>

      {/* legend */}
      <div className="absolute top-4 right-4 glass border border-ink-600 px-3 py-2 space-y-1.5 text-[11px] text-fg-muted pointer-events-none rise" style={{ '--i': 2 }}>
        <div className="flex items-center gap-2"><span className="w-3 h-3 border border-teal bg-teal/20" /> Offline DEM</div>
        <div className="flex items-center gap-2"><span className="w-3 h-0 border-t border-fg-muted" /> Sector</div>
        <div className="flex items-center gap-2"><span className="w-3 h-0 border-t border-dashed border-fg-muted" /> Procedural DEM</div>
      </div>

      {/* multi-AOI sector: pick an AOI */}
      {selSector?.aois && selected.type === 'sector' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 glass border border-ink-500 brackets flex items-stretch scale-in" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <div className="px-4 py-2 border-r border-ink-600 flex flex-col justify-center">
            <div className="label">Sector</div>
            <div className="text-base text-fg-hi whitespace-nowrap">{selSector.name}</div>
          </div>
          {selSector.aois.map((id) => {
            const a = aoiById(id)
            const dem = getDem(a.dem)
            return (
              <button key={id} onClick={() => setSelected({ type: 'aoi', id })} className="px-3 py-2 border-r border-ink-600 text-left hover:bg-ink-700 min-w-[128px]">
                <div className="flex items-center gap-1.5"><span className="mono text-[10.5px] text-teal">{id}</span>{pending(id) > 0 && <span className="mono text-[10px] px-1 bg-amber text-ink-950 font-semibold">{pending(id)}</span>}</div>
                <div className="text-sm text-fg">{a.name}</div>
                <div className="mono text-[10px] text-fg-dim">{dem ? `${Math.round(dem.min)}–${Math.round(dem.max)} m` : ''}</div>
              </button>
            )
          })}
          <button onClick={() => setSelected(null)} className="w-9 text-fg-dim hover:text-fg flex items-center justify-center"><Icon name="x" size={14} /></button>
        </div>
      )}

      {/* selection card */}
      {selRegion && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 glass border border-ink-500 brackets flex items-center gap-5 pl-4 pr-2 py-2 scale-in" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <div>
            <div className="label">{selected.type === 'aoi' ? aoiById(selected.id).group ?? 'AOI' : selSector ? 'Sector' : 'Drawn region'}</div>
            <div className="text-base text-fg-hi">{selected.type === 'aoi' ? aoiById(selected.id).name : selSector ? selSector.name : selRegion.snapped ? `Snapped to ${selRegion.aoi}` : 'Custom region'}</div>
          </div>
          <Metric v={Math.round(selected.type === 'shape' ? selected.shape.area : areaKm2(selRegion.bbox)).toLocaleString()} u="km²" />
          <Metric v={tilesFor(selected.type === 'shape' ? selected.shape.area : areaKm2(selRegion.bbox)).toLocaleString()} u="tiles" />
          {selRegion.aoi && <Metric v={pending(selRegion.aoi)} u="alerts" tone="text-amber" />}
          <span className={`text-[10.5px] px-1.5 h-6 flex items-center border ${selRegion.aoi ? 'border-teal-line text-teal' : 'border-amber-line text-amber'}`}>
            {selRegion.aoi ? `GLO-30 · ${aoiById(selRegion.aoi).id}` : 'Procedural DEM'}
          </span>
          <button onClick={() => open()} className="h-10 px-4 bg-fg text-ink-900 text-sm font-medium flex items-center gap-2 hover:bg-fg-hi" data-tour="open-ws">
            <Icon name="cube" size={15} /> Open workspace
          </button>
          <button onClick={() => setSelected(null)} className="w-8 h-10 text-fg-dim hover:text-fg flex items-center justify-center"><Icon name="x" size={14} /></button>
        </div>
      )}

      {/* cursor readout */}
      {cursor && (
        <div className="absolute bottom-5 left-4 glass border border-ink-600 h-8 flex items-center text-xs pointer-events-none">
          <span className="mono px-2.5 text-fg">{formatCoord(coord, cursor.lat, cursor.lon)}</span>
          <span className="mono px-2.5 border-l border-ink-600 text-fg-muted">{elev != null ? `${Math.max(0, elev)} m` : '—'}</span>
        </div>
      )}
      <div className="absolute top-[124px] right-4 text-[10px] text-fg-dim pointer-events-none">Relief: Terrarium z5 · outlines schematic</div>

      {flying && <div className="absolute inset-0 bg-ink-950 pointer-events-none" style={{ animation: 'fade-in .9s ease-in 0.35s both' }} />}
    </div>
  )
}

function Metric({ v, u, tone = 'text-fg-hi' }) {
  return (
    <div className="text-center">
      <div className={`mono text-base leading-tight ${tone}`}>{v}</div>
      <div className="text-[9.5px] text-fg-dim uppercase tracking-wider">{u}</div>
    </div>
  )
}

function Shape({ P, shape, tone, dashed }) {
  if (shape.kind === 'circle') {
    const [cx, cy] = P.toImg(...shape.center)
    const [ex] = P.toImg(shape.center[0], shape.center[1] + shape.rKm / (111.32 * Math.cos((shape.center[0] * Math.PI) / 180)))
    return <circle cx={cx} cy={cy} r={Math.abs(ex - cx)} fill={`${tone}18`} stroke={tone} strokeDasharray={dashed ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />
  }
  return <polygon points={shape.pts.map(([la, lo]) => P.toImg(la, lo).join(',')).join(' ')} fill={`${tone}18`} stroke={tone} strokeDasharray={dashed ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />
}
