import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SITES, aoiById, siteById } from '../data/mock'
import { useStore } from '../state/AppStore'
import { Btn, Coord, Modal, Panel, StatusPill, Tag } from '../components/ui/primitives'
import { MapView, SceneChip } from '../components/imagery/Imagery'
import { BriefDocument } from '../components/Brief'
import { InfoPop } from '../components/evidence/Widgets'

const STAGES = ['clearing', 'construction', 'occupied', 'abandoned']
const dayNum = (d) => new Date(d + 'T00:00:00Z').getTime() / 864e5
const TODAY = '2026-09-28'

export function LifecycleTimeline({ site }) {
  const dates = [site.bracket.lastWithout, ...site.lifecycle.map((l) => l.from).filter(Boolean), ...site.gaps.map((g) => g.from)]
  const min = Math.min(...dates.map(dayNum)) - 8
  const max = dayNum(TODAY)
  const y = (d) => ((dayNum(d) - min) / (max - min)) * 100
  const months = []
  for (let d = Math.ceil(min); d <= max; d++) {
    const iso = new Date(d * 864e5).toISOString().slice(0, 10)
    if (iso.endsWith('-01')) months.push(iso)
  }
  const current = site.stage
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-[520px] relative grid grid-cols-[46px_1fr_18px_34px] gap-x-2 pr-1">
        {/* axis */}
        <div className="relative border-r border-ink-500">
          {months.map((m) => (
            <span key={m} className="absolute right-1.5 -translate-y-1/2 mono text-[9.5px] text-fg-dim" style={{ top: `${y(m)}%` }}>
              {new Date(m).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()}
            </span>
          ))}
          <span className="absolute right-1.5 bottom-0 translate-y-1/2 mono text-[9.5px] text-fg">NOW</span>
        </div>
        {/* lifecycle stages */}
        <div className="relative">
          {site.lifecycle.filter((l) => l.from).map((l) => {
            const top = y(l.from)
            const bottom = l.to ? y(l.to) : 100
            const isCur = l.stage === current
            return (
              <div
                key={l.stage}
                className={`absolute left-0 right-0 border px-2 py-1 overflow-hidden ${isCur ? 'border-amber bg-amber-dim' : 'border-ink-500 bg-ink-750'}`}
                style={{ top: `${top}%`, height: `calc(${bottom - top}% - 2px)` }}
              >
                <div className={`text-2xs uppercase tracking-wider ${isCur ? 'text-amber' : 'text-fg-muted'}`}>{l.stage}</div>
                <div className="mono text-[10px] text-fg-dim">{l.from.slice(5)} · {l.conf}%</div>
              </div>
            )
          })}
        </div>
        {/* cloud / data gaps */}
        <div className="relative border-x border-ink-600">
          {site.gaps.map((g) => (
            <div
              key={g.from}
              title={`${g.reason}: ${g.from} → ${g.to}`}
              className="absolute left-0 right-0"
              style={{ top: `${y(g.from)}%`, height: `${y(g.to) - y(g.from)}%`, backgroundImage: 'repeating-linear-gradient(135deg, #5D6A78 0 2px, transparent 2px 5px)' }}
            />
          ))}
        </div>
        {/* dated bracket */}
        <div className="relative">
          {(() => {
            const a = y(site.bracket.lastWithout)
            const b = site.bracket.firstWith ? y(site.bracket.firstWith) : 100
            return (
              <div className="absolute left-0 w-2 border-y border-r border-teal" style={{ top: `${a}%`, height: `${Math.max(1.5, b - a)}%` }}>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-teal tracking-wider [writing-mode:vertical-rl] rotate-180">ONSET</span>
              </div>
            )
          })()}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-2xs text-fg-dim flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-2 border border-amber bg-amber-dim" /> current stage</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #5D6A78 0 2px, transparent 2px 5px)' }} /> data gap</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 border-y border-r border-teal" /> onset bracket</span>
      </div>
      <div className="mt-3 border border-ink-600 divide-y divide-ink-600">
        {STAGES.map((s, i) => {
          const l = site.lifecycle.find((x) => x.stage === s)
          const cur = s === current
          const past = STAGES.indexOf(current) > i
          return (
            <div key={s} className={`flex items-center gap-2 px-2.5 h-7 text-xs ${cur ? 'bg-amber-dim' : ''}`}>
              <span className="mono text-[10px] text-fg-dim w-4">{i + 1}</span>
              <span className={`uppercase tracking-wider text-[10.5px] ${cur ? 'text-amber' : past ? 'text-fg-muted' : 'text-fg-dim'}`}>{s}</span>
              {i < 3 && <span className="text-fg-dim text-[10px]">→</span>}
              <span className="flex-1" />
              <span className="mono text-[10.5px] text-fg-muted">{l.from ? l.from.slice(5) : '—'}</span>
              <span className={`mono text-[10.5px] w-9 text-right ${cur ? 'text-amber' : 'text-fg-dim'}`}>{l.conf != null ? `${l.conf}%` : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RelatedGraph({ site }) {
  const nodes = [
    { id: site.id, name: site.name, x: 50, y: 50, main: true },
    { ...site.related[0], x: 16, y: 20 },
    { ...site.related[1], x: 84, y: 76 },
  ]
  return (
    <div className="relative h-[190px] border border-ink-600 bg-ink-950">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {nodes.slice(1).map((n) => (
          <line key={n.id} x1="50" y1="50" x2={n.x} y2={n.y} stroke="#5D6A78" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {nodes.slice(1).map((n) => (
        <span key={`${n.id}-e`} className="absolute -translate-x-1/2 -translate-y-1/2 mono text-[10px] px-1 bg-ink-950 text-fg-muted border border-ink-600 whitespace-nowrap" style={{ left: `${(50 + n.x) / 2}%`, top: `${(50 + n.y) / 2}%` }}>
          Δt {n.gapDays} d · {n.distanceKm} km
        </span>
      ))}
      {nodes.map((n) => (
        <div key={n.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          <span className={`w-3 h-3 border ${n.main ? 'border-amber bg-amber-dim' : 'border-fg-muted bg-ink-750'}`} />
          <span className={`mono text-[10px] mt-1 ${n.main ? 'text-amber' : 'text-fg-muted'}`}>{n.id}</span>
        </div>
      ))}
    </div>
  )
}

export default function SiteDossier() {
  const { id } = useParams()
  const nav = useNavigate()
  const { changes, confirmedSites, confirmSite, addWatch, watches, user, now, log, coord, audit } = useStore()
  const site = siteById(id) ?? SITES[0]
  const aoi = aoiById(site.aoi)
  const [brief, setBrief] = useState(false)
  const linked = site.changes.map((cid) => changes.find((c) => c.id === cid)).filter(Boolean)
  const lead = linked[0]
  const lit = !!confirmedSites[site.id]
  const watching = watches.some((w) => w.site === site.id)

  const chipDates = [site.bracket.lastWithout, ...site.lifecycle.filter((l) => l.from).map((l) => l.from), TODAY].slice(0, 4)
  while (chipDates.length < 4) {
    const a = dayNum(chipDates[chipDates.length - 2]), b = dayNum(chipDates[chipDates.length - 1])
    chipDates.splice(chipDates.length - 1, 0, new Date(Math.round((a + b) / 2) * 864e5).toISOString().slice(0, 10))
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[232px_minmax(0,1fr)]">
      <aside className="border-r border-ink-600 bg-ink-850 overflow-auto">
        <div className="px-3 h-10 flex items-center border-b border-ink-600"><span className="label text-fg-muted">Sites · {SITES.length}</span></div>
        {SITES.map((s, i) => (
          <button key={s.id} onClick={() => nav(`/sites/${s.id}`)} style={{ '--i': i }} className={`stagger relative w-full text-left px-3 py-2.5 border-b border-ink-600 whitespace-normal ${s.id === site.id ? 'bg-ink-700' : 'hover:bg-ink-750'}`}>
            {s.id === site.id && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-fg-hi" />}
            <div className="flex items-center gap-2"><span className="mono text-xs text-fg-hi">{s.id}</span><span className="text-2xs text-fg-dim">{s.aoi}</span><span className="flex-1" /><span className={`text-[10px] uppercase tracking-wider ${s.stage === 'abandoned' ? 'text-fg-dim' : 'text-amber'}`}>{s.stage}</span></div>
            <div className="text-sm text-fg mt-0.5 truncate">{s.name}</div>
          </button>
        ))}
      </aside>

      <div className="min-h-0 overflow-auto">
        {/* header */}
        <div className="px-5 pt-4 pb-4 border-b border-ink-600 bg-ink-950 flex items-end gap-6">
          <div className="min-w-0 flex-1">
            <div className="label flex items-center gap-2"><span className="mono">03</span> Site dossier · {aoi.id} {aoi.name}</div>
            <div className="flex items-baseline gap-3 mt-1">
              <h1 className="text-[24px] 2xl:text-[28px] font-light text-fg-hi tracking-tight truncate">{site.name}</h1>
              <span className="mono text-sm text-fg-muted">{site.id}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-fg-muted">
              <Coord lat={site.lat} lon={site.lon} className="text-fg" />
              <span>Stage <span className="text-amber uppercase tracking-wider">{site.stage}</span> <span className="mono">{site.stageConf}%</span></span>
              <span>{linked.length} linked changes</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Btn icon={watching ? 'check' : 'watch'} disabled={watching} onClick={() => addWatch({ id: `W-${String(watches.length + 1).padStart(2, '0')}`, name: `${site.name} · any change`, kind: 'Polygon', aoi: site.aoi, lastRun: 'just now', hits: 0, cadence: 'Every ingest', site: site.id })}>
              {watching ? 'Watching' : 'Add to watch'}
            </Btn>
            <Btn icon="file" onClick={() => { setBrief(true); log('BRIEF_PREVIEW', site.id, 'One-page brief') }}>Generate brief</Btn>
            <Btn variant="primary" icon="handoff" onClick={() => nav(`/handoff?site=${site.id}`)}>Generate tasking cue</Btn>
          </div>
        </div>

        <div className="p-5 grid grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start">
          <Panel title="Lifecycle" index="A" bodyClass="p-3" className="self-start">
            <LifecycleTimeline site={site} />
          </Panel>

          <div className="min-w-0 space-y-5 2xl:space-y-0 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_400px] 2xl:gap-5 2xl:items-start">
          <div className="space-y-5 min-w-0">
            <Panel title="Imagery chips" index="B" right={<span className="text-2xs text-fg-dim">optical · dated</span>} bodyClass="p-3">
              <div className="grid grid-cols-4 gap-2">
                {chipDates.map((d, i) => (
                  <div key={d}>
                    <SceneChip seed={site.seed} terrain={aoi.terrain} change={lead?.render ?? 'structure'} variant={i === 0 ? 'before' : 'after'} size={224} lat={site.lat} lon={site.lon} date={d} cloud={aoi.monsoon && i > 0 ? 0.55 : 0} box={i > 0} className="aspect-square border border-ink-600" />
                    <div className="flex justify-between mt-1 text-2xs"><span className="mono text-fg">{d}</span><span className="text-fg-dim">{i === 0 ? 'baseline' : i === 3 ? 'latest' : [...site.lifecycle].reverse().find((l) => l.from && l.from <= d)?.stage}</span></div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="SAR evidence" index="C" right={<span className="text-2xs text-sar">Sentinel-1 VV · EOS-04</span>} bodyClass="p-3">
              <div className="grid grid-cols-4 gap-2">
                {(linked.length ? linked : [null]).concat([null, null, null]).slice(0, 4).map((c, i) => (
                  <div key={i}>
                    <SceneChip seed={c?.seed ?? site.seed + i} terrain={aoi.terrain} change={c?.render ?? 'structure'} variant={i === 0 && !c ? 'before' : 'after'} sensor="sar" size={192} lat={c?.lat ?? site.lat} lon={c?.lon ?? site.lon} className="aspect-[4/3] border border-ink-600" />
                    <div className="flex justify-between mt-1 text-2xs">
                      <span className="mono text-fg-muted">{c ? c.id : `pass ${i + 1}`}</span>
                      <span className="mono text-sar">{c ? c.votes[1].value : `γ ${(0.7 - i * 0.12).toFixed(2)}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Analyst decisions" index="D" bodyClass="divide-y divide-ink-600">
              {linked.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="mono text-xs text-fg-hi w-[74px]">{c.id}</span>
                  <span className="text-sm text-fg flex-1 truncate">{c.type}</span>
                  <span className="mono text-xs text-fg-muted">{c.conf}%</span>
                  <StatusPill status={c.status} />
                  <button className="text-2xs text-fg-muted hover:text-fg" onClick={() => nav(`/review?id=${c.id}`)}>open →</button>
                </div>
              ))}
              {site.decisions.map((d) => (
                <div key={d.t} className="px-3 py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-fg">{d.who}</span><Tag>{d.role}</Tag>
                    <span className="text-fg-muted">{d.action}</span>
                    <span className="flex-1" />
                    <span className="mono text-2xs text-fg-dim">{d.t}</span>
                  </div>
                  <div className="text-xs text-fg-muted mt-1 truncate" title={d.remark}>“{d.remark}”</div>
                </div>
              ))}
            </Panel>
          </div>

          <div className="space-y-5 min-w-0">
            <Panel
              title="Similar sites"
              index="E"
              right={lit ? <span className="text-2xs text-teal">4 lit · confirmed</span> : <span className="text-2xs text-fg-dim">confirm to search</span>}
              bodyClass="p-3 space-y-3"
            >
              <MapView
                aoiId={site.aoi}
                className="h-[240px] border border-ink-600"
                seed={site.seed}
                markers={[
                  { id: site.id, lat: site.lat, lon: site.lon, tone: lit ? 'teal' : 'fg', active: true, label: site.id },
                  ...site.similar.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, tone: 'amber', dim: !lit, showLabel: lit, label: `${s.id} · ${Math.round(s.score * 100)}` })),
                ]}
                onMarkerClick={(sid) => siteById(sid) && nav(`/sites/${sid}`)}
              />
              {lit ? (
                <div className="divide-y divide-ink-600 border border-ink-600 fade-in">
                  {site.similar.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                      <span className="w-1.5 h-1.5 bg-amber" />
                      <span className="mono text-fg-hi">{s.id}</span>
                      <span className="text-fg-muted truncate flex-1">{s.name}</span>
                      <span className="mono text-fg">{Math.round(s.score * 100)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Btn variant="confirm" className="w-full" icon="check" onClick={() => confirmSite(site.id)}>Confirm this site and find similar</Btn>
              )}
            </Panel>

            <Panel title="Possible related activity" index="F" right={<Tag className="border-amber-line text-amber">Stretch</Tag>} bodyClass="p-3 space-y-2">
              <RelatedGraph site={site} />
              <div className="flex items-center gap-2 flex-wrap">
                {site.related.map((r) => (
                  <span key={r.id} className="h-6 px-2 flex items-center gap-1.5 border border-ink-600 text-[10.5px]">
                    <span className="mono text-fg">{r.id}</span><span className="mono text-fg-dim">Δ{r.gapDays} d · {r.distanceKm} km</span>
                    <InfoPop>{r.relation}</InfoPop>
                  </span>
                ))}
                <span className="flex-1" />
                <InfoPop label="Why?">Linked by time gap and distance only. A cue for follow-up, not an assessment of intent.</InfoPop>
              </div>
            </Panel>
          </div>
          </div>
        </div>
      </div>

      <Modal
        open={brief}
        onClose={() => setBrief(false)}
        title={`Brief preview · ${site.id} · PDF`}
        width="max-w-4xl"
        footer={
          <>
            <span className="text-2xs text-fg-dim">Grid refs shown in all three systems regardless of current setting ({coord}).</span>
            <span className="flex-1" />
            <Btn variant="ghost" onClick={() => setBrief(false)}>Close</Btn>
            <Btn variant="primary" icon="print" onClick={() => { log('EXPORT', `BRIEF ${site.id}`, 'PDF via local print'); window.print() }}>Export PDF</Btn>
          </>
        }
      >
        <div className="p-6 bg-ink-950">
          <BriefDocument site={site} change={lead} user={user} now={now()} chainHead={audit[audit.length - 1].hash} />
        </div>
      </Modal>
    </div>
  )
}
