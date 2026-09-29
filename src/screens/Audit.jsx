import { useEffect, useMemo, useState } from 'react'
import { CAPABILITY } from '../data/mock'
import { entryHash, useStore } from '../state/AppStore'
import { fmtTs, shortHash } from '../lib/format'
import { Btn, CopyButton, Panel, SectionHead } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { InfoPop } from '../components/evidence/Widgets'

const ACTION_TONE = {
  CONFIRM: 'text-teal', REJECT: 'text-rej', NEEDS_DATA: 'text-fg-muted', SENSITIVITY: 'text-teal', EXPORT: 'text-sar',
  TASKING_EXPORT: 'text-sar', INGEST: 'text-fg-muted', BUNDLE_APPLY: 'text-fg-muted', SITE_CONFIRM: 'text-teal',
}

function verify(entries) {
  let prev = '0'.repeat(64)
  for (const e of entries) {
    if (e.prev !== prev || entryHash(e) !== e.hash) return { ok: false, at: e.seq }
    prev = e.hash
  }
  return { ok: true }
}

function AuditLog() {
  const { audit, log } = useStore()
  const [q, setQ] = useState('')
  const [tamper, setTamper] = useState(false)
  const [state, setState] = useState({ phase: 'idle' }) // idle | running | done
  const entries = useMemo(
    () => (tamper ? audit.map((e) => (e.seq === 4 ? { ...e, detail: 'Edited after the fact' } : e)) : audit),
    [audit, tamper],
  )
  const shown = entries.filter((e) => !q || `${e.user} ${e.action} ${e.object} ${e.detail}`.toLowerCase().includes(q.toLowerCase())).slice().reverse()

  useEffect(() => { setState({ phase: 'idle' }) }, [tamper])

  const run = () => {
    setState({ phase: 'running', n: 0 })
    let n = 0
    const step = () => {
      n = Math.min(entries.length, n + 3)
      setState({ phase: 'running', n })
      if (n < entries.length) setTimeout(step, 40)
      else {
        const res = verify(entries)
        setState({ phase: 'done', count: entries.length, head: entries[entries.length - 1].hash, ...res })
        if (!tamper) log('VERIFY_CHAIN', `${entries.length} entries`, res.ok ? 'Chain intact' : `Break at #${res.at}`)
      }
    }
    setTimeout(step, 40)
  }

  const res = state.phase === 'done' ? state : null
  return (
    <Panel
      title="Hash-chained audit log"
      index="A"
      className="h-full"
      bodyClass="flex flex-col h-[calc(100%-36px)]"
      right={<span className="mono text-2xs text-fg-dim">SHA-256 · {entries.length} entries</span>}
    >
      <div className="flex items-center gap-2 p-3 border-b border-ink-600 shrink-0">
        <input className="input flex-1 h-7 text-xs" placeholder="Filter by user, action, object…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Btn size="sm" variant={tamper ? 'reject' : 'ghost'} onClick={() => setTamper(!tamper)} title="Edits entry #4 in this view only, to show verification catching it">
          {tamper ? 'Undo tamper test' : 'Tamper test'}
        </Btn>
        <Btn size="sm" variant="primary" icon="shield" onClick={run} disabled={state.phase === 'running'}>Verify chain</Btn>
      </div>
      {state.phase !== 'idle' && (
        <div className={`mx-3 mt-3 px-3 py-2.5 border flex items-center gap-3 shrink-0 fade-in ${!res ? 'border-ink-500' : res.ok ? 'border-ok-line bg-ok-dim' : 'border-rej-line bg-rej-dim'}`}>
          {!res ? (
            <>
              <span className="w-2 h-2 bg-amber pulse" />
              <span className="text-sm text-fg">Recomputing hashes… <span className="mono">{state.n}/{entries.length}</span></span>
            </>
          ) : res.ok ? (
            <>
              <Icon name="check" size={16} className="text-ok" strokeWidth={2} />
              <span className="text-sm text-ok font-medium">Chain intact</span>
              <span className="text-xs text-fg-muted">{res.count} entries verified · head <span className="mono">{shortHash(res.head)}</span></span>
            </>
          ) : (
            <>
              <Icon name="x" size={16} className="text-rej" strokeWidth={2} />
              <span className="text-sm text-rej font-medium">Chain broken at entry #{res.at}</span>
              <span className="text-xs text-fg-muted">Recomputed hash does not match the stored hash; every later entry is suspect.</span>
            </>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto mt-2">
        <table className="w-full text-xs table-fixed">
          <thead className="sticky top-0 bg-ink-850 z-[1]">
            <tr className="label text-left border-b border-ink-600">
              <th className="font-medium px-3 h-8 w-10">#</th>
              <th className="font-medium px-2 w-[118px]">Timestamp</th>
              <th className="font-medium px-2 w-[64px]">User</th>
              <th className="font-medium px-2 w-[108px]">Action</th>
              <th className="font-medium px-2">Object</th>
              <th className="font-medium px-2 w-[92px]">Prev hash</th>
              <th className="font-medium px-2 w-[112px]">Hash</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => {
              const broken = res && !res.ok && e.seq >= res.at
              return (
                <tr key={e.seq} className={`border-b border-ink-600 align-top ${broken ? 'bg-rej-dim/60' : 'hover:bg-ink-750'} ${e.seq > 13 ? 'fade-in' : ''}`}>
                  <td className="px-3 py-1.5 mono text-fg-dim">{e.seq}</td>
                  <td className="px-2 py-1.5 mono text-fg-muted">{fmtTs(e.ts).slice(5)}</td>
                  <td className="px-2 py-1.5 mono text-fg">{e.user}</td>
                  <td className={`px-2 py-1.5 mono ${ACTION_TONE[e.action] ?? 'text-fg'}`}>{e.action}</td>
                  <td className="px-2 py-1.5">
                    <div className="mono text-fg truncate">{e.object}</div>
                    <div className="text-2xs text-fg-dim truncate" title={e.detail}>{e.detail}</div>
                  </td>
                  <td className="px-2 py-1.5 mono text-fg-dim">{shortHash(e.prev, 6)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      <span className={`mono ${broken ? 'text-rej' : 'text-fg-muted'}`}>{shortHash(e.hash, 6)}</span>
                      <CopyButton text={e.hash} />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function PR({ p, r }) {
  return (
    <div className="flex items-center gap-4 mt-1.5">
      {[[p, 'P'], [r, 'R']].map(([v, k]) => (
        <div key={k} className="flex items-center gap-1.5 flex-1">
          <span className="text-[9.5px] text-fg-dim w-2">{k}</span>
          <div className="h-1.5 flex-1 bg-ink-600"><div className={`h-full ${v >= 0.85 ? 'bg-teal' : v >= 0.72 ? 'bg-fg-muted' : 'bg-amber'}`} style={{ width: `${v * 100}%` }} /></div>
          <span className="mono text-2xs text-fg w-7 text-right">{v.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

function Capability() {
  const [tab, setTab] = useState('type')
  const rows = tab === 'type' ? CAPABILITY.byType.map((x) => ({ k: x.type, p: x.p, r: x.r, n: x.n })) : tab === 'terrain' ? CAPABILITY.byTerrain : CAPABILITY.bySensor
  return (
    <Panel title="Capability envelope" index="B" bodyClass="p-4 space-y-5" right={<span className="text-2xs text-fg-dim">held-out validation · 2026-08</span>}>
      <div>
        <div className="flex items-center gap-1 mb-3">
          {[['type', 'By change type'], ['terrain', 'By terrain'], ['sensor', 'By sensor']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={`h-7 px-3 text-xs border ${tab === v ? 'border-fg-muted text-fg-hi bg-ink-750' : 'border-ink-600 text-fg-muted hover:text-fg'}`}>{l}</button>
          ))}
          <span className="flex-1" />
          <span className="text-2xs text-fg-dim">P precision · R recall</span>
        </div>
        <div className="border border-ink-600 divide-y divide-ink-600">
          {rows.map((x) => (
            <div key={x.k} className="px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-fg flex-1 min-w-0 truncate">{x.k}</span>
                {x.n && <span className="mono text-2xs text-fg-dim">n={x.n}</span>}
              </div>
              <PR p={x.p} r={x.r} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionHead title="Cannot detect at 10 m" />
        <ul className="mt-2 space-y-2">
          {CAPABILITY.cannot.map(([a, b]) => (
            <li key={a} className="flex items-center gap-2.5 h-7">
              <span className="w-3.5 h-3.5 border border-rej-line flex items-center justify-center shrink-0"><span className="w-1.5 h-px bg-rej" /></span>
              <span className="text-sm text-fg flex-1 truncate">{a}</span>
              <InfoPop>{b}</InfoPop>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}

export default function Audit() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-5 h-12 flex items-center gap-4 border-b border-ink-600 bg-ink-950 shrink-0">
        <span className="mono text-2xs text-fg-dim">07</span>
        <span className="text-sm text-fg-hi tracking-wide">Audit &amp; trust</span>
        <InfoPop label="Why?" align="left">Every decision, export and query is hash-chained. Editing any entry breaks every hash after it.</InfoPop>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_520px] gap-5 p-5">
        <div className="min-h-0"><AuditLog /></div>
        <div className="min-h-0 overflow-auto"><Capability /></div>
      </div>
    </div>
  )
}
