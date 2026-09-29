import { useState } from 'react'
import { AOIS, aoiById } from '../data/mock'
import { useStore } from '../state/AppStore'
import { Btn, Modal, Panel, Tag } from '../components/ui/primitives'
import { MapView } from '../components/imagery/Imagery'

export function WatchesTable({ compact = false, selected, onSelect }) {
  const { watches } = useStore()
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="label text-left border-b border-ink-600">
          <th className="font-medium px-3 h-8">ID</th>
          <th className="font-medium px-3">Watch</th>
          {!compact && <th className="font-medium px-3">Type</th>}
          <th className="font-medium px-3">AOI</th>
          {!compact && <th className="font-medium px-3">Cadence</th>}
          <th className="font-medium px-3">Last run</th>
          <th className="font-medium px-3 text-right">New hits</th>
        </tr>
      </thead>
      <tbody>
        {watches.map((w) => (
          <tr
            key={w.id}
            onClick={() => onSelect?.(w.id)}
            className={`border-b border-ink-600 last:border-0 ${onSelect ? 'cursor-pointer' : ''} ${selected === w.id ? 'bg-ink-700' : 'hover:bg-ink-750'}`}
          >
            <td className="px-3 py-2 mono text-xs text-fg-hi">{w.id}</td>
            <td className="px-3 py-2 text-fg">{w.name}</td>
            {!compact && <td className="px-3 py-2"><Tag>{w.kind}</Tag></td>}
            <td className="px-3 py-2 mono text-xs text-fg-muted">{w.aoi}</td>
            {!compact && <td className="px-3 py-2 text-xs text-fg-muted">{w.cadence}</td>}
            <td className="px-3 py-2 mono text-xs text-fg-muted">{w.lastRun}</td>
            <td className="px-3 py-2 text-right">
              <span className={`mono text-sm ${w.hits ? 'text-amber' : 'text-fg-dim'}`}>{w.hits}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function watchPolygon(w) {
  const a = aoiById(w.aoi)
  const s = (w.id.charCodeAt(3) % 5) * 0.02
  const [la, lo] = a.center
  return [[la + 0.08 + s, lo - 0.1], [la + 0.1 - s, lo + 0.06], [la - 0.02, lo + 0.14 - s], [la - 0.09 + s, lo + 0.02], [la - 0.05, lo - 0.12 + s]]
}

export default function Watches() {
  const { watches, addWatch, log } = useStore()
  const [sel, setSel] = useState(watches[0]?.id)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', aoi: 'AOI-03', kind: 'Query', cadence: 'Every ingest' })
  const [runs, setRuns] = useState({})
  const w = watches.find((x) => x.id === sel) ?? watches[0]

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-5 h-12 flex items-center gap-4 border-b border-ink-600 bg-ink-950 shrink-0">
        <span className="mono text-2xs text-fg-dim">04</span>
        <span className="text-sm text-fg-hi tracking-wide">Watches</span>

        <span className="flex-1" />
        <Btn variant="primary" icon="plus" onClick={() => setCreating(true)}>New watch</Btn>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_440px] gap-5 p-5">
        <Panel title={`${watches.length} watches`} index="A" className="self-start" bodyClass="">
          <WatchesTable selected={w?.id} onSelect={setSel} />
        </Panel>
        {w && (
          <Panel title={w.id} index="B" right={<Tag>{w.kind}</Tag>} bodyClass="p-3 space-y-3" className="self-start">
            <div className="text-base text-fg-hi">{w.name}</div>
            <MapView aoiId={w.aoi} className="h-[280px] border border-ink-600" polygons={[{ points: watchPolygon(w), tone: 'amber', dashed: true, fillOpacity: 0.1 }]} />
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><div className="label">AOI</div><div className="mono mt-1">{w.aoi}</div></div>
              <div><div className="label">Last run</div><div className="mono mt-1">{runs[w.id] ?? w.lastRun}</div></div>
              <div><div className="label">New hits</div><div className={`mono mt-1 text-lg ${w.hits ? 'text-amber' : 'text-fg-dim'}`}>{w.hits}</div></div>
            </div>
            <div className="flex gap-2">
              <Btn size="sm" icon="refresh" onClick={() => { setRuns((r) => ({ ...r, [w.id]: 'just now' })); log('WATCH_RUN', w.id, 'Manual run') }}>Run now</Btn>
              <Btn size="sm" variant="ghost">Edit polygon</Btn>
            </div>
          </Panel>
        )}
      </div>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New watch"
        width="max-w-lg"
        footer={
          <>
            <span className="flex-1" />
            <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={!form.name.trim()}
              onClick={() => {
                const id = `W-${String(watches.length + 1).padStart(2, '0')}`
                addWatch({ id, ...form, lastRun: 'never', hits: 0 })
                setSel(id)
                setCreating(false)
                setForm({ ...form, name: '' })
              }}
            >
              Save watch
            </Btn>
          </>
        }
      >
        <div className="p-4 space-y-3">
          <label className="block"><span className="label">Name or query</span><input className="input w-full mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. new structures within 3 km of stream crossings" autoFocus /></label>
          <div className="grid grid-cols-3 gap-3">
            <label><span className="label">AOI</span><select className="select w-full mt-1 h-8" value={form.aoi} onChange={(e) => setForm({ ...form, aoi: e.target.value })}>{AOIS.map((a) => <option key={a.id}>{a.id}</option>)}</select></label>
            <label><span className="label">Type</span><select className="select w-full mt-1 h-8" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{['Query', 'Polygon', 'Polygon + query'].map((k) => <option key={k}>{k}</option>)}</select></label>
            <label><span className="label">Cadence</span><select className="select w-full mt-1 h-8" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })}>{['Every ingest', 'Every SAR pass', 'Daily'].map((k) => <option key={k}>{k}</option>)}</select></label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
