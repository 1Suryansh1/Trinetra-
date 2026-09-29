import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CHANGES, SITES, aoiById, gapGrid } from '../data/mock'
import { useStore } from '../state/AppStore'
import { useHotkeys } from '../lib/useHotkeys'
import { bus } from '../lib/bus'
import { toFrac } from '../lib/dem'
import { regionDem } from '../lib/region'
import { buildLayers, bufferLayer, composeDrape } from '../lib/terrainLayers'
import { mulberry32, hashString } from '../lib/rng'
import { TerrainScene, sceneDims } from '../components/workspace/TerrainScene'
import { CrossSection, CursorReadout, FunnelGraphic, LayerChips, NavWidgets, T1, TimeScrubber } from '../components/workspace/Controls'
import { Inspector } from '../components/workspace/Inspector'
import { InfoPop } from '../components/evidence/Widgets'
import { HintChip } from '../components/onboarding/HintChip'
import { Icon } from '../components/ui/Icon'
import { Btn, Modal } from '../components/ui/primitives'
import { QueryChips, parseQuery } from './Ask'
import { BriefDocument } from '../components/Brief'

const SUB_RES = /\b(vehicles?|trucks?|cars?|tanks?|people|personnel|troops|tents?)\b/i
const TYPE_WORDS = [
  [/struct|build|compound|hut|shelter|camp/i, ['structure', 'structure-noaccess', 'shelter']],
  [/clear|ground|disturb|vehicle|park/i, ['clearing', 'disturbed']],
  [/track|road|route/i, ['track']],
  [/berm|earth|trench/i, ['earthwork']],
  [/water|pond|lake/i, ['water']],
]
const EXAMPLES = ['new structures near river since 2023', 'cleared ground within 2 km of creek']
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

// Scores region changes (and candidate tiles) against the parsed query.
function runQuery(chips, dem, layers, regionChanges, region) {
  const obj = chips.find((c) => c.kind === 'OBJECT')?.text ?? ''
  const rel = chips.find((c) => c.kind === 'SPATIAL RELATION')?.text ?? ''
  const time = chips.find((c) => c.kind === 'TIME')?.text ?? ''
  const kinds = TYPE_WORDS.find(([re]) => re.test(obj))?.[1]
  const km = +(rel.match(/(\d+(?:\.\d+)?)\s*km/)?.[1] ?? 1)
  const nearWater = /river|creek|water|channel|stream|bank/i.test(rel)
  const mpp = dem.widthM / dem.W
  const since = time.match(/\d{4}/)?.[0]
  const distAt = (fx, fy) => layers.distStream[Math.min(dem.H - 1, Math.floor(fy * dem.H)) * dem.W + Math.min(dem.W - 1, Math.floor(fx * dem.W))] * mpp
  const pool = regionChanges.map((c) => ({ ...c, kind: 'change' }))
  const r = mulberry32(hashString(obj + rel + region.id))
  for (let k = 0; k < 60; k++) {
    const fx = 0.06 + r() * 0.88, fy = 0.06 + r() * 0.88
    const i = Math.floor(fy * dem.H) * dem.W + Math.floor(fx * dem.W)
    if (dem.water[i] || dem.slope[i] > 15) continue
    pool.push({ id: `T${String(1000 + k * 37).slice(0, 4)}`, kind: 'tile', fx, fy, conf: Math.round(45 + r() * 40), render: kinds?.[0] ?? 'structure' })
  }
  const scored = pool
    .filter((c) => !kinds || kinds.includes(c.render))
    .filter((c) => !since || c.kind === 'tile' || (c.detected ?? '9999') >= `${since}-01-01`)
    .map((c) => {
      const d = distAt(c.fx, c.fy)
      if (nearWater && d > km * 1000) return null
      const s = (c.conf / 100) * 0.7 + (nearWater ? (1 - d / (km * 1000)) * 0.3 : 0.3) + (c.kind === 'change' ? 0.15 : 0)
      return { ...c, score: Math.min(0.99, s), dist: d }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((c, i) => ({ ...c, n: i + 1 }))
  return { results: scored, buffer: nearWater ? km : null }
}

function regionLooks(region) {
  if (region.aoi) {
    const lead = CHANGES.find((c) => c.aoi === region.aoi)
    if (lead) return lead.looks.filter((l) => l.sensor === 'S2' && l.date >= '2026-06-01')
  }
  const r = mulberry32(hashString(region.id))
  return Array.from({ length: 24 }, (_, k) => ({ date: addDays('2026-06-02', k * 5), cloud: Math.round(r() < 0.5 ? 60 + r() * 40 : r() * 30) }))
}

export default function Workspace() {
  const store = useStore()
  // store is read field-by-field below
  const { region, changes, confirmedSites, addWatch, watches, decide, user, now, audit, log } = store
  const nav = useNavigate()
  const loc = useLocation()
  const dem = useMemo(() => regionDem(region), [region])
  const layers = useMemo(() => buildLayers(dem, region.terrain), [dem, region.terrain])
  const d = useMemo(() => sceneDims(dem), [dem])
  const drape = useMemo(() => { const c = document.createElement('canvas'); c.width = c.height = 2048; return c }, [])
  const [drapeVersion, setDrapeVersion] = useState(0)

  const [base, setBase] = useState('optical')
  const [overlays, setOverlays] = useState({ contours: false, drainage: true, pins: true, gaps: false })
  const [normalised, setNormalised] = useState(false)
  const [tool, setTool] = useState(null)
  const [profile, setProfile] = useState([])
  const [exag, setExag] = useState({ floodplain: 3, plateau: 1.2, alpine: 1.2, foothills: 2 }[region.terrain] ?? 1.6)
  const [date, setDate] = useState(T1)
  const [playing, setPlaying] = useState(false)
  const [monsoonAuto, setMonsoonAuto] = useState(true)
  const [hover, setHover] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [brief, setBrief] = useState(false)
  const [text, setText] = useState('')
  const [chips, setChips] = useState([])
  const [query, setQuery] = useState(null) // { results, buffer }
  const [fly, setFly] = useState(null)
  const [view, setView] = useState({ az: 0, dist: 100 })
  const viewRef = useRef({ az: 0, dist: 100, t: 0 })
  const inputRef = useRef(null)

  const flyIn = useCallback(() => setFly({ from: [0, d.Du * 1.55, 0.01], to: [0, d.Du * 0.6, d.Du * 0.8], dur: 2400, k: Math.random() }), [d])
  useEffect(() => { flyIn(); setSelectedId(null); setQuery(null); setChips([]); setText(''); setProfile([]) }, [region.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (loc.state?.focus) inputRef.current?.focus() }, [loc.state?.focus])
  const looks = useMemo(() => regionLooks(region), [region])
  const cloudNow = useMemo(() => {
    const past = looks.filter((l) => l.date <= date)
    return (past[past.length - 1] ?? looks[0])?.cloud ?? 0
  }, [looks, date])
  const monsoonActive = monsoonAuto && base === 'optical' && cloudNow >= 60
  const effectiveBase = monsoonActive ? 'sar' : base

  const regionChanges = useMemo(
    () => changes.filter((c) => c.aoi && c.aoi === region.aoi).map((c) => { const [fx, fy] = toFrac(dem, c.lat, c.lon); return { ...c, fx, fy } }),
    [changes, region.aoi, dem],
  )
  const visible = regionChanges.filter((c) => c.detected <= date)
  const resultIds = query ? new Set(query.results.map((r) => r.id)) : null
  const pins = overlays.pins
    ? visible.map((c, i) => ({
        ...c,
        selected: c.id === selectedId,
        pulse: c.isNew || (new Date(date) - new Date(c.detected)) / 864e5 <= 3,
        dim: resultIds ? !resultIds.has(c.id) : false,
        tour: i === 0,
      }))
    : []
  const footprints = query ? query.results.filter((r) => r.kind === 'tile').map((r) => ({ id: r.id, n: r.n, fx: r.fx, fy: r.fy })) : []
  const similar = SITES.filter((s) => s.aoi === region.aoi && confirmedSites[s.id]).flatMap((s) =>
    s.similar.map((m) => { const [fx, fy] = toFrac(dem, m.lat, m.lon); return { id: m.id, fx, fy } }),
  )
  // Histogram: detections plus site lifecycle / decision history in this region.
  const timelineEvents = useMemo(() => [
    ...regionChanges.map((c) => c.detected),
    ...SITES.filter((s) => s.aoi === region.aoi).flatMap((s) => [...s.lifecycle.map((l) => l.from).filter(Boolean), ...s.decisions.map((x) => x.t.slice(0, 10)), ...s.gaps.map((g) => g.to)]),
  ], [regionChanges, region.aoi])
  const gaps = useMemo(() => (region.aoi ? gapGrid(region.aoi) : gapGrid('AOI-03')), [region.aoi])
  const buffer = useMemo(() => (query?.buffer ? bufferLayer(dem, layers, query.buffer) : null), [query, dem, layers])

  // Re-compose the drape whenever inputs change.
  useEffect(() => {
    composeDrape(drape, dem, layers, {
      base: effectiveBase,
      cloud: effectiveBase === 'optical' ? cloudNow / 100 : 0,
      overlays: { ...overlays, normalised, buffer },
      gaps,
      extras: (ctx, S) => {
        if (!query) return
        query.results.forEach((r) => {
          const s = S * 0.018
          ctx.strokeStyle = r.kind === 'change' ? 'rgba(214,162,74,0.95)' : 'rgba(238,242,245,0.95)'
          ctx.lineWidth = S / 700
          ctx.strokeRect(r.fx * S - s, r.fy * S - s, s * 2, s * 2)
        })
      },
    })
    setDrapeVersion((v) => v + 1)
  }, [drape, dem, layers, effectiveBase, cloudNow, overlays, normalised, buffer, gaps, query])

  // Playback
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setDate((dt) => {
        const n = addDays(dt, 3)
        if (n >= T1) { setPlaying(false); return T1 }
        return n
      })
    }, 220)
    return () => clearInterval(id)
  }, [playing])

  const ask = useCallback((q) => {
    const c = parseQuery(q)
    setText(q)
    setChips(c)
    const res = runQuery(c, dem, layers, regionChanges, region)
    setQuery(res)
    setSelectedId(null)
    log('QUERY', region.aoi ?? region.id, q)
  }, [dem, layers, regionChanges, region, log])

  const selected = regionChanges.find((c) => c.id === selectedId)
  const selectPin = useCallback((id) => {
    setSelectedId(id)
    const c = regionChanges.find((x) => x.id === id)
    if (c) {
      const x = (c.fx - 0.5) * d.Wu, z = (c.fy - 0.5) * d.Du
      setFly({ target: [x, 0, z], to: [x + d.Wu * 0.12, d.Du * 0.32, z + d.Du * 0.36], dur: 1100, k: Math.random() })
    }
  }, [regionChanges, d])

  // Guided-demo hooks
  useEffect(() => {
    const offs = [
      bus.on('ws:ask', (q) => ask(q)),
      bus.on('ws:select', (id) => selectPin(id)),
      bus.on('ws:date', (dt) => setDate(dt)),
      bus.on('ws:brief', () => setBrief(true)),
      bus.on('ws:closeBrief', () => setBrief(false)),
      bus.on('ws:layer', (b) => setBase(b)),
      bus.on('ws:normalise', (v) => setNormalised(v)),
    ]
    return () => offs.forEach((o) => o())
  }, [ask, selectPin])

  useHotkeys({
    c: () => selected?.status === 'pending' && decide(selected.id, 'confirmed'),
    r: () => selected?.status === 'pending' && decide(selected.id, 'rejected'),
    n: () => selected?.status === 'pending' && decide(selected.id, 'needs-data'),
    j: () => { const i = visible.findIndex((c) => c.id === selectedId); const n = visible[i + 1] ?? visible[0]; n && selectPin(n.id) },
    k: () => { const i = visible.findIndex((c) => c.id === selectedId); const n = visible[i - 1] ?? visible[visible.length - 1]; n && selectPin(n.id) },
    Escape: () => { setSelectedId(null); setTool(null) },
    f: () => selected && nav(`/ask?similar=${selected.id}`),
  })

  const onAzimuth = useCallback((az, dist) => {
    const v = viewRef.current
    const t = performance.now()
    if (t - v.t > 120 && (Math.abs(az - v.az) > 0.03 || Math.abs(dist - v.dist) / v.dist > 0.03)) {
      viewRef.current = { az, dist, t }
      setView({ az, dist })
    }
  }, [])

  const onTerrainClick = (p) => {
    if (tool === 'profile') setProfile((pts) => (pts.length >= 2 ? [p] : [...pts, p]))
  }

  const site = selected ? SITES.find((s) => s.id === selected.site) : null
  const watching = watches.some((w) => w.region === region.id)
  const infeasible = chips.some((c) => c.kind === 'OBJECT' && SUB_RES.test(c.text))

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-ink-950">
      <div className="absolute inset-0">
        <TerrainScene
          dem={dem} drape={drape} drapeVersion={drapeVersion} exag={exag}
          pins={pins} footprints={footprints} similar={similar} profile={profile}
          hover={hover} fly={fly} onHover={setHover} onClick={onTerrainClick} onPin={selectPin} onAzimuth={onAzimuth}
        />
      </div>

      {/* top-left: region card */}
      <div className="absolute top-3 left-3 glass border border-ink-600 px-3 py-2 w-[232px] z-20 rise" style={{ '--i': 2 }}>
        <div className="flex items-center gap-2">
          <span className="mono text-2xs text-fg-dim">{region.aoi ?? region.id}</span>
          <span className="flex-1" />
          <button onClick={() => nav('/theatre')} className="text-2xs text-fg-dim hover:text-fg flex items-center gap-1"><Icon name="map" size={12} />Theatre</button>
        </div>
        <div className="text-base text-fg-hi mt-0.5 truncate">{region.aoi ? aoiById(region.aoi).name : region.name}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[10px] px-1.5 h-5 flex items-center border ${dem.procedural ? 'border-amber-line text-amber' : 'border-teal-line text-teal'}`}>
            {dem.procedural ? 'DEM · procedural' : 'DEM · GLO-30'}
          </span>
          <span className="mono text-[10.5px] text-fg-muted">{Math.round(dem.min)}–{Math.round(dem.max)} m</span>
          <InfoPop>{dem.source}. {dem.procedural ? 'No offline tile covers this region; relief seeded from the theatre elevation.' : `${dem.W}² grid, ${Math.round(dem.widthM / dem.W)} m cells, water mask from WBM.`}</InfoPop>
        </div>
      </div>

      {/* top-center: ask bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[min(560px,calc(100%-620px))] space-y-2 z-20 rise" style={{ '--i': 3 }}>
        <form onSubmit={(e) => { e.preventDefault(); text.trim() && ask(text) }} className="glass border border-ink-500 flex items-center h-10 focus-within:border-fg-muted" data-tour="askbar">
          <Icon name="ask" size={15} className="mx-3 text-fg-dim" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask this region…"
            className="flex-1 bg-transparent outline-none text-sm text-fg placeholder:text-fg-dim"
          />
          {query && <button type="button" onClick={() => { setQuery(null); setChips([]); setText('') }} className="px-2 text-fg-dim hover:text-fg"><Icon name="x" size={13} /></button>}
          <button className="h-full px-3 border-l border-ink-600 text-xs text-fg hover:bg-ink-700">Ask</button>
        </form>
        {(chips.length > 0 || parseQuery(text).length > 0) && (
          <div className="flex justify-center">
            <QueryChips
              chips={chips.length ? chips : parseQuery(text)}
              onEdit={(i, v) => { const n = [...chips]; n[i] = { ...n[i], text: v }; setChips(n); setQuery(runQuery(n, dem, layers, regionChanges, region)) }}
              onRemove={(i) => { const n = chips.filter((_, j) => j !== i); setChips(n); setQuery(n.length ? runQuery(n, dem, layers, regionChanges, region) : null) }}
            />
          </div>
        )}
        {infeasible && (
          <div className="flex justify-center">
            <span className="glass border border-amber-line text-amber text-xs px-2 h-7 flex items-center gap-2">
              <Icon name="eye" size={13} /> Below 10 m · showing proxies
              <InfoPop>Individual vehicles are below 10 m resolution. Showing proxies such as disturbed ground and fresh tracks.</InfoPop>
            </span>
          </div>
        )}
        {normalised && <div className="flex justify-center"><FunnelGraphic /></div>}
      </div>

      {/* top-right actions */}
      <div className="absolute top-3 right-3 flex gap-1.5 z-20 rise" style={{ '--i': 4 }}>
        <button
          onClick={() => !watching && addWatch({ id: `W-${String(watches.length + 1).padStart(2, '0')}`, name: `${region.name} · any change`, kind: 'Polygon', aoi: region.aoi ?? region.id, lastRun: 'just now', hits: 0, cadence: 'Every ingest', region: region.id })}
          className={`glass border h-9 px-3 flex items-center gap-2 text-xs ${watching ? 'border-teal-line text-teal' : 'border-ink-600 text-fg hover:border-fg-muted'}`}
          data-tour="watch"
        >
          <Icon name={watching ? 'check' : 'bell'} size={14} /> {watching ? 'Watching' : 'Save watch'}
        </button>
      </div>

      {/* left: layer chips */}
      <div className="absolute left-3 top-[108px] z-20 rise" style={{ '--i': 5 }}>
        <LayerChips
          base={base} effectiveBase={effectiveBase} setBase={setBase}
          overlays={overlays} toggle={(k) => setOverlays((o) => ({ ...o, [k]: !o[k] }))}
          tool={tool} setTool={(t) => { setTool(t); if (!t) setProfile([]) }}
          normalised={normalised} setNormalised={setNormalised}
          contourInterval={layers.contourInterval}
        />
        {tool === 'profile' && profile.length < 2 && (
          <div className="mt-2 glass border border-amber-line text-amber text-[11px] px-2 py-1.5 w-[142px]">Click A, then B</div>
        )}
      </div>

      {/* right: inspector or results */}
      <div className="absolute right-3 top-[60px] bottom-[84px] flex flex-col items-end gap-2 z-20 pointer-events-none">
        {selected ? (
          <div className="pointer-events-auto min-h-0 flex"><Inspector key={selected.id} change={selected} onClose={() => setSelectedId(null)} onBrief={() => setBrief(true)} /></div>
        ) : query ? (
          <div className="pointer-events-auto w-[280px] glass border border-ink-600 slide-in-right">
            <div className="flex items-center px-3 h-9 border-b border-ink-600">
              <span className="label text-fg-muted">{query.results.length} matches</span>
              <span className="flex-1" />
              {query.buffer && <span className="text-[10.5px] text-teal flex items-center gap-1"><span className="w-2 h-2 bg-teal/40 border border-teal" />{query.buffer} km buffer</span>}
            </div>
            {query.results.length === 0 ? (
              <div className="p-3 space-y-2">
                <div className="text-xs text-fg-muted">No matches. Try:</div>
                {EXAMPLES.map((q) => <button key={q} onClick={() => ask(q)} className="block w-full text-left text-xs px-2 py-1.5 border border-ink-600 hover:border-fg-muted text-fg">{q}</button>)}
              </div>
            ) : (
              <div className="max-h-[360px] overflow-auto">
                {query.results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => (r.kind === 'change' ? selectPin(r.id) : setFly({ target: [(r.fx - 0.5) * d.Wu, 0, (r.fy - 0.5) * d.Du], to: [(r.fx - 0.5) * d.Wu, d.Du * 0.3, (r.fy - 0.5) * d.Du + d.Du * 0.32], dur: 1000, k: Math.random() }))}
                    style={{ '--i': r.n }}
                    className="stagger w-full flex items-center gap-2 px-3 h-9 border-b border-ink-600 last:border-0 hover:bg-ink-700 text-left"
                  >
                    <span className={`w-5 h-5 flex items-center justify-center mono text-[11px] font-semibold ${r.kind === 'change' ? 'bg-amber text-ink-950' : 'bg-fg-hi text-ink-950'}`}>{r.n}</span>
                    <span className="mono text-xs text-fg w-[70px]">{r.id}</span>
                    <span className="flex-1 h-1 bg-ink-600"><span className="block h-full bg-fg-muted" style={{ width: `${r.score * 100}%` }} /></span>
                    <span className="mono text-[10.5px] text-fg-muted w-8 text-right">{r.score.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : visible.length === 0 ? (
          <div className="pointer-events-auto w-[260px] glass border border-ink-600 p-3 space-y-2">
            <div className="text-sm text-fg">No alerts yet</div>
            {EXAMPLES.map((q) => <button key={q} onClick={() => ask(q)} className="block w-full text-left text-xs px-2 py-1.5 border border-ink-600 hover:border-fg-muted text-fg-muted hover:text-fg">{q}</button>)}
          </div>
        ) : (
          <HintChip id="ws-pin" className="pointer-events-auto">Click a pin to review</HintChip>
        )}
      </div>

      {/* bottom stack */}
      <div className="absolute left-3 right-3 bottom-3 space-y-2 z-20 rise" style={{ '--i': 6 }}>
        {profile.length === 2 && (
          <div className="flex justify-center">
            <CrossSection dem={dem} pts={profile} changes={regionChanges} onClose={() => { setProfile([]); setTool(null) }} />
          </div>
        )}
        <div className="flex items-end gap-2">
          <NavWidgets azimuth={view.az} distance={view.dist} mpu={d.mpu} exag={exag} setExag={setExag} onReset={flyIn} />
          <span className="glass border border-ink-600 text-[10px] text-fg-dim px-2 h-6 flex items-center gap-1.5 whitespace-nowrap">
            <Icon name="info" size={11} /> Terrain context is indicative, not a mobility model
          </span>
          <span className="flex-1" />
          <CursorReadout dem={dem} hover={hover} />
        </div>
        <TimeScrubber
          date={date} onDate={(dt) => { setPlaying(false); setDate(dt) }}
          playing={playing} onPlay={() => { if (date >= T1) setDate('2026-06-01'); setPlaying((p) => !p) }}
          looks={looks} events={timelineEvents}
          cloudNow={cloudNow} monsoonActive={monsoonActive} monsoonAuto={monsoonAuto} onMonsoon={() => setMonsoonAuto((m) => !m)}
        />
      </div>

      <Modal
        open={brief}
        onClose={() => setBrief(false)}
        title={`Brief · ${site?.id ?? ''}`}
        width="max-w-4xl"
        footer={
          <>
            <span className="flex-1" />
            {site && <Btn variant="outline" icon="handoff" onClick={() => nav(`/handoff?site=${site.id}`)}>Tasking cue</Btn>}
            <Btn variant="primary" icon="print" onClick={() => { log('EXPORT', `BRIEF ${site?.id}`, 'PDF via local print'); window.print() }}>Export PDF</Btn>
          </>
        }
      >
        {site && selected && (
          <div className="p-6 bg-ink-950">
            <BriefDocument site={site} change={changes.find((c) => c.id === selected.id)} user={user} now={now()} chainHead={audit[audit.length - 1].hash} />
          </div>
        )}
      </Modal>
    </div>
  )
}

