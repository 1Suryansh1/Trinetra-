import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../../state/AppStore'
import { useHotkeys } from '../../lib/useHotkeys'
import { Btn, Kbd } from '../../components/ui/primitives'
import { QueueList } from './QueueList'
import { ImageryViewer } from './ImageryViewer'
import { EvidencePanel } from './EvidencePanel'
import { RawComparison } from './RawComparison'

function FeedbackFooter() {
  const { rejectsByType, ingestRuns, runIngest } = useStore()
  const entries = Object.entries(rejectsByType)
  return (
    <div className="border-t border-ink-600 p-3 space-y-2 shrink-0 bg-ink-850">
      <div className="label">Analyst feedback this session</div>
      {entries.length === 0 ? (
        <div className="text-2xs text-fg-dim">No rejections yet. 3 rejections of one type lower its sensitivity on the next ingest.</div>
      ) : (
        entries.map(([t, n]) => (
          <div key={t} className="flex items-center gap-2 text-xs">
            <span className="text-fg-muted flex-1 truncate">{t}</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => <span key={i} className={`w-3 h-1.5 ${i < n ? 'bg-rej' : 'bg-ink-600'}`} />)}
            </span>
            <span className={`mono text-2xs w-8 text-right ${n >= 3 ? 'text-teal' : 'text-fg-dim'}`}>{Math.min(n, 3)}/3</span>
          </div>
        ))
      )}
      <Btn size="sm" variant={ingestRuns ? 'outline' : 'primary'} className="w-full" onClick={runIngest} disabled={ingestRuns > 0}>
        {ingestRuns ? 'Ingest applied' : 'Next ingest'}
      </Btn>
    </div>
  )
}

export default function ReviewQueue() {
  const { changes, aoi, decide, ingestNote } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState('pending')
  const [selectedId, setSelectedId] = useState(params.get('id') ?? 'CHG-0142')
  const [mode, setMode] = useState('swipe')
  const [sensor, setSensor] = useState('optical')
  const [cloudMask, setCloudMask] = useState(false)
  const [heat, setHeat] = useState(false)
  const [raw, setRaw] = useState(params.get('view') === 'raw')
  const [remark, setRemark] = useState('')

  const inAoi = changes.filter((c) => aoi === 'ALL' || c.aoi === aoi)
  const items = useMemo(
    () => inAoi.filter((c) => filter === 'all' || c.status === filter).sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.conf - a.conf),
    [inAoi, filter],
  )
  const counts = {
    pending: inAoi.filter((c) => c.status === 'pending').length,
    confirmed: inAoi.filter((c) => c.status === 'confirmed').length,
    rejected: inAoi.filter((c) => c.status === 'rejected').length,
    all: inAoi.length,
  }
  const selected = changes.find((c) => c.id === selectedId && items.some((i) => i.id === c.id)) ?? items[0] ?? null

  useEffect(() => {
    if (selected) {
      setSensor(selected.monsoon ? 'sar' : 'optical')
      setCloudMask(false)
      setRemark('')
    }
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const move = (d) => {
    if (!items.length) return
    const i = Math.max(0, items.findIndex((c) => c.id === selected?.id))
    setSelectedId(items[Math.max(0, Math.min(items.length - 1, i + d))].id)
  }

  const onDecide = (decision) => {
    if (!selected) return
    if (decision !== 'pending' && selected.status !== 'pending') return
    const i = items.findIndex((c) => c.id === selected.id)
    decide(selected.id, decision, remark.trim())
    if (filter === 'pending' && decision !== 'pending') {
      const next = items[i + 1] ?? items[i - 1]
      if (next) setSelectedId(next.id)
    }
  }

  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    c: () => onDecide('confirmed'),
    r: () => onDecide('rejected'),
    n: () => onDecide('needs-data'),
    f: () => selected && nav(`/ask?similar=${selected.id}`),
    s: () => setMode((m) => (m === 'swipe' ? 'side' : 'swipe')),
    o: () => setSensor((s) => (s === 'sar' ? 'optical' : 'sar')),
    m: () => setCloudMask((v) => !v),
    h: () => setHeat((v) => !v),
    d: () => setRaw((v) => !v),
    Escape: () => setRaw(false),
  })

  if (raw) return <RawComparison onClose={() => setRaw(false)} />

  return (
    <div className="flex-1 min-h-0 flex flex-col">
    <div className="h-10 shrink-0 flex items-center gap-4 px-4 border-b border-ink-600 bg-ink-950">
      <span className="mono text-2xs text-fg-dim">02</span>
      <span className="text-sm text-fg-hi tracking-wide">Review queue</span>
      <span className="text-xs text-fg-dim"><span className="num text-amber">{counts.pending}</span> awaiting decision · {aoi === 'ALL' ? 'all AOIs' : aoi}</span>
      <span className="flex-1" />
      <button onClick={() => setRaw(true)} className="h-7 px-2.5 text-xs border border-ink-500 text-fg hover:border-fg-muted flex items-center gap-2">
        <span className="w-6 h-3 border border-ink-400 relative"><span className="absolute left-0 top-0 bottom-0 w-1/2 bg-fg-dim" /></span>
        Compare with raw differencing <Kbd>D</Kbd>
      </button>
    </div>
    <div className="flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)_372px] 2xl:grid-cols-[340px_minmax(0,1fr)_420px]">
      <aside className="border-r border-ink-600 bg-ink-850 flex flex-col min-h-0">
        <div className="flex-1 min-h-0">
          <QueueList items={items} selectedId={selected?.id} onSelect={setSelectedId} filter={filter} onFilter={setFilter} counts={counts} ingestNote={ingestNote} />
        </div>
        <FeedbackFooter />
      </aside>

      <section className="min-w-0 min-h-0 flex flex-col">
        {selected ? (
          <ImageryViewer
            c={selected}
            mode={mode} setMode={setMode}
            sensor={sensor} setSensor={setSensor}
            cloudMask={cloudMask} setCloudMask={setCloudMask}
            heat={heat} setHeat={setHeat}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center gridlines text-fg-dim text-sm">Queue clear for this filter.</div>
        )}
        <div className="h-8 shrink-0 border-t border-ink-600 flex items-center gap-4 px-3 text-2xs text-fg-dim bg-ink-950 whitespace-nowrap overflow-hidden">
          <span className="flex items-center gap-1"><Kbd>J</Kbd><Kbd>K</Kbd> move</span>
          <span className="flex items-center gap-1"><Kbd>C</Kbd> confirm</span>
          <span className="flex items-center gap-1"><Kbd>R</Kbd> reject</span>
          <span className="flex items-center gap-1"><Kbd>N</Kbd> more data</span>
          <span className="flex items-center gap-1"><Kbd>F</Kbd> find similar</span>
          <span className="hidden 2xl:flex items-center gap-1"><Kbd>S</Kbd> swipe/side</span>
          <span className="hidden 2xl:flex items-center gap-1"><Kbd>O</Kbd> optical/SAR</span>
          <span className="flex-1" />
          {selected && (
            <button className="text-fg-muted hover:text-fg" onClick={() => nav(`/sites/${selected.site}`)}>
              Dossier {selected.site} →
            </button>
          )}
        </div>
      </section>

      <aside className="border-l border-ink-600 bg-ink-850 min-h-0">
        {selected && <EvidencePanel key={selected.id} c={selected} remark={remark} setRemark={setRemark} onDecide={onDecide} />}
      </aside>
    </div>
    </div>
  )
}
