import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AOIS, DIGEST, GAP_REASONS, aoiById, gapGrid, siteById } from '../data/mock'
import { useStore } from '../state/AppStore'
import { renderScene } from '../lib/imagery'
import { getDem } from '../lib/dem'
import { layerUrl } from '../lib/terrainLayers'
import { downloadFile } from '../lib/format'
import { Btn, Chip, CountUp, Panel, Seg, Stat } from '../components/ui/primitives'
import { WatchesTable } from './Watches'
import { Icon } from '../components/ui/Icon'
import { RingGauge, Sparkline, Trend, VoteDots } from '../components/evidence/Widgets'

export const GAP_BUCKETS = [
  { max: 7, label: '≤ 7 d', color: '#1E3533' },
  { max: 14, label: '8–14 d', color: '#2F4A3F' },
  { max: 30, label: '15–30 d', color: '#5A5530' },
  { max: 60, label: '31–60 d', color: '#8C6A2C' },
  { max: Infinity, label: '> 60 d', color: '#C98F3A' },
]
const bucket = (d) => GAP_BUCKETS.find((b) => d <= b.max)

export function GapMap({ aoiId, reasons, onHover, hover }) {
  const aoi = aoiById(aoiId)
  const cells = useMemo(() => gapGrid(aoiId), [aoiId])
  const base = useMemo(() => { const dem = getDem(aoi.dem); return dem ? layerUrl(dem, aoi.terrain, 'hillshade') : renderScene({ seed: 77 + aoiId.charCodeAt(5), terrain: aoi.terrain, variant: 'before', change: 'none', size: 448 }) }, [aoi, aoiId])
  const cols = 14
  return (
    <div className="relative w-full aspect-[14/9] border border-ink-600 overflow-hidden bg-ink-950">
      <img src={base} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 saturate-50" />
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cells.map((c) => {
          const on = reasons.length === 0 || reasons.includes(c.reason)
          const b = bucket(c.days)
          return (
            <div
              key={c.id}
              onMouseEnter={() => onHover(c)}
              onMouseLeave={() => onHover(null)}
              className="border-r border-b border-ink-950/70 transition-opacity relative"
              style={{ background: b.color, opacity: on ? 0.7 : 0.1, outline: hover?.id === c.id ? '1px solid #EEF2F5' : undefined, outlineOffset: -1 }}
            >
              {on && c.days > 30 && <span className="absolute bottom-0.5 right-1 mono text-[9px] text-ink-950/80">{c.days}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GapsDigest() {
  const { aoi: storeAoi, log, toast } = useStore()
  const nav = useNavigate()
  const [aoiId, setAoiId] = useState(storeAoi === 'ALL' ? 'AOI-01' : storeAoi)
  const [reasons, setReasons] = useState([])
  const [hover, setHover] = useState(null)
  const cells = useMemo(() => gapGrid(aoiId), [aoiId])
  const stale = cells.filter((c) => c.days > 30).length
  const sorted = [...cells].map((c) => c.days).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const byReason = GAP_REASONS.map((r) => ({ r, n: cells.filter((c) => c.reason === r && c.days > 14).length }))

  const exportDigest = () => {
    const md = [
      `# Trinetra weekly digest (${DIGEST.week})`,
      '',
      'DEMO DATA',
      '',
      '## New sites',
      ...DIGEST.newSites.map((s) => `- ${s.id}: ${s.note}`),
      '',
      '## Sites gone quiet',
      ...DIGEST.quiet.map((s) => `- ${s.id}: ${s.note}`),
      '',
      '## Data gaps',
      ...DIGEST.gaps.map((g) => `- ${g.aoi}: ${g.note}`),
    ].join('\n')
    downloadFile('trinetra-digest-2026-W39.md', md, 'text/markdown')
    log('EXPORT', 'DIGEST 2026-W39', 'Markdown, local file')
    toast('Digest exported to local file')
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="px-5 h-12 flex items-center gap-4 border-b border-ink-600 bg-ink-950 sticky top-0 z-10">
        <span className="mono text-2xs text-fg-dim">05</span>
        <span className="text-sm text-fg-hi tracking-wide">Gaps &amp; digest</span>
        <Seg value={aoiId} onChange={setAoiId} options={AOIS.map((a) => ({ value: a.id, label: a.id }))} size="md" />
        <span className="text-xs text-fg-dim">{aoiById(aoiId).name} · {aoiById(aoiId).desc}</span>
      </div>

      <div className="p-5 grid grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_440px] gap-5">
        <div className="space-y-5 min-w-0">
          <Panel title="Collection gaps · days since last usable clear look" index="A" bodyClass="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-4 pb-1">
              <Stat label="Median gap" value={`${median} d`} />
              <Stat label="Tiles > 30 d" value={`${Math.round((stale / cells.length) * 100)}%`} tone={stale / cells.length > 0.5 ? 'text-amber' : 'text-fg-hi'} />
              <Stat label="Tiles in view" value={cells.length} sub={`${aoiById(aoiId).tile} · 14 × 9 blocks`} />
              <Stat label="Fallback" value={aoiById(aoiId).monsoon ? 'SAR-first' : 'Optical + SAR'} tone={aoiById(aoiId).monsoon ? 'text-sar' : 'text-fg-hi'} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label mr-1">Reason</span>
              {byReason.map(({ r, n }) => (
                <Chip key={r} active={reasons.includes(r)} onClick={() => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))}>
                  {r} <span className="mono text-fg-dim">{n}</span>
                </Chip>
              ))}
              {reasons.length > 0 && <button className="text-2xs text-fg-dim hover:text-fg ml-1" onClick={() => setReasons([])}>clear</button>}
              <span className="flex-1" />
              <div className="flex items-center">
                {GAP_BUCKETS.map((b) => (
                  <span key={b.label} className="flex flex-col items-center">
                    <span className="w-12 h-2" style={{ background: b.color }} />
                    <span className="mono text-[9.5px] text-fg-dim mt-0.5">{b.label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="relative">
              <GapMap aoiId={aoiId} reasons={reasons} onHover={setHover} hover={hover} />
              {hover && (
                <div className="absolute top-2 right-2 panel brackets px-3 py-2 text-xs w-[220px] pointer-events-none">
                  <div className="mono text-fg-hi">{hover.id}</div>
                  <div className="flex justify-between mt-1"><span className="text-fg-dim">Last clear look</span><span className="mono">{hover.days} d ago</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Reason</span><span>{hover.reason}</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Next S2 pass</span><span className="mono">{1 + (hover.x % 5)} d</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">SAR cover</span><span className="mono text-sar">{hover.reason === 'No pass' ? 'partial' : 'yes'}</span></div>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Watches" index="C" right={<Btn size="sm" variant="ghost" onClick={() => nav('/watches')}>Manage →</Btn>}>
            <WatchesTable compact />
          </Panel>
        </div>

        <Panel
          title="Weekly digest · 2026-W39"
          index="B"
          right={<Btn size="sm" icon="download" onClick={exportDigest}>Export</Btn>}
          className="self-start"
          bodyClass="divide-y divide-ink-600"
        >
          <div className="grid grid-cols-4 divide-x divide-ink-600 border-b border-ink-600">
            {DIGEST.stats.map((x) => (
              <div key={x.k} className="px-3 py-2.5">
                <div className="text-[9.5px] uppercase tracking-wider text-fg-dim">{x.k}</div>
                <div className="flex items-baseline gap-1.5 mt-0.5"><span className="text-xl font-light num text-fg-hi">{typeof x.v === 'number' ? <CountUp value={x.v} /> : x.v}</span><Trend value={x.trend} good={x.good} /></div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-ink-600">
            <span className="label">Alerts / day</span>
            <Sparkline values={DIGEST.spark} w={160} h={22} color="#D6A24A" />
            <span className="mono text-xs text-fg">{DIGEST.spark[DIGEST.spark.length - 1]}</span>
          </div>
          <DigestSection title="Top confirmed">
            <TopConfirmed />
          </DigestSection>
          <DigestSection title="New sites">
            {DIGEST.newSites.map((s) => <DigestCard key={s.id} item={s} id={s.id} tone="amber" onClick={() => nav(`/sites/${s.id}`)} />)}
          </DigestSection>
          <DigestSection title="Gone quiet">
            {DIGEST.quiet.map((s) => <DigestCard key={s.id} item={s} id={s.id} tone="dim" onClick={siteById(s.id) ? () => nav(`/sites/${s.id}`) : undefined} />)}
          </DigestSection>
          <DigestSection title="Data gaps">
            {DIGEST.gaps.map((g) => <DigestCard key={g.aoi} item={g} id={g.aoi} tone="sar" onClick={() => setAoiId(g.aoi)} />)}
          </DigestSection>
        </Panel>
      </div>
    </div>
  )
}

function DigestSection({ title, children }) {
  return (
    <div className="px-4 py-3">
      <div className="label mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function DigestCard({ item, id, tone, onClick }) {
  const col = { amber: 'text-amber', dim: 'text-fg-muted', sar: 'text-sar', teal: 'text-teal' }[tone]
  return (
    <button disabled={!onClick} onClick={onClick} title={item.note} className="lift w-full flex items-center gap-3 h-10 px-2.5 border border-ink-600 hover:border-ink-400 disabled:hover:border-ink-600 text-left">
      <Icon name={item.icon} size={15} className={col} />
      <span className="mono text-xs text-fg-hi w-[64px]">{id}</span>
      <span className="text-xs text-fg-muted flex-1 truncate">{item.label}</span>
      <span className={`mono text-xs ${col}`}>{item.metric}</span>
    </button>
  )
}

function DigestRow({ id, text, onClick, tone }) {
  const dot = { amber: 'bg-amber', dim: 'bg-fg-dim', sar: 'bg-sar', teal: 'bg-teal' }[tone]
  return (
    <button disabled={!onClick} onClick={onClick} className="w-full text-left flex gap-2.5 py-1 group whitespace-normal disabled:cursor-default">
      <span className={`w-1.5 h-1.5 mt-1.5 shrink-0 ${dot}`} />
      <span className="mono text-xs text-fg-hi w-[62px] shrink-0 pt-px group-enabled:group-hover:underline">{id}</span>
      <span className="text-xs text-fg-muted">{text}</span>
    </button>
  )
}

function TopConfirmed() {
  const { changes } = useStore()
  const nav = useNavigate()
  const top = changes.filter((c) => c.status === 'confirmed').sort((a, b) => b.conf - a.conf).slice(0, 4)
  if (!top.length) return <div className="text-xs text-fg-dim">None confirmed this week.</div>
  return top.map((c) => (
    <button key={c.id} onClick={() => nav(`/review?id=${c.id}`)} className="w-full flex items-center gap-3 h-10 px-2.5 border border-ink-600 hover:border-ink-400 text-left">
      <RingGauge value={c.conf} size={30} stroke={3} label="" />
      <span className="mono text-xs text-fg-hi w-[64px]">{c.id}</span>
      <span className="text-xs text-fg-muted flex-1 truncate">{c.type}</span>
      <VoteDots votes={c.votes} agree={c.agree} size="sm" />
    </button>
  ))
}
