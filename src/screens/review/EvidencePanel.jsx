import { useState } from 'react'
import { Btn, CopyButton, Kbd, SectionHead, StatusPill } from '../../components/ui/primitives'
import { BracketBar, FlagBadges, InfoPop, RingGauge, VoteDots } from '../../components/evidence/Widgets'
import { Icon } from '../../components/ui/Icon'
import { useStore } from '../../state/AppStore'

export const BREAKDOWN_COLORS = { optical: '#B7A77A', sar: '#8FA3C7', coherence: '#6FA79A', context: '#6B7785' }

export function ConfidenceBreakdown({ c }) {
  return (
    <div>
      <div className="flex h-2.5 bg-ink-600">
        {c.breakdown.map((b) => (
          <div key={b.key} style={{ width: `${b.v}%`, background: BREAKDOWN_COLORS[b.key] }} className="border-r border-ink-850 last:border-0" title={`${b.label} ${b.v}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {c.breakdown.map((b) => (
          <span key={b.key} className="flex items-center gap-1.5 text-2xs text-fg-muted">
            <span className="w-2 h-2" style={{ background: BREAKDOWN_COLORS[b.key] }} />
            {b.label} <span className="mono text-fg">{b.v}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function Provenance({ c }) {
  return (
    <div className="space-y-3">
      <SectionHead title="Processing history" />
      <ol className="relative ml-1.5 border-l border-ink-500 space-y-2">
        {c.history.map((h) => (
          <li key={h.step} className="pl-3 relative">
            <span className="absolute -left-[3.5px] top-1.5 w-1.5 h-1.5 bg-fg-muted" />
            <div className="flex gap-2 text-xs"><span className="text-fg">{h.step}</span><span className="flex-1" /><span className="mono text-2xs text-fg-dim">{h.t.slice(11)}</span></div>
            <div className="text-2xs text-fg-dim">{h.detail}</div>
          </li>
        ))}
      </ol>
      <SectionHead title="Scene IDs" />
      <div className="border border-ink-600 divide-y divide-ink-600">
        {c.scenes.map((s) => (
          <div key={s.id} className="flex items-center gap-2 pl-2.5 pr-1 py-1">
            <span className="text-2xs text-fg-dim w-[88px] shrink-0">{s.role}</span>
            <span className="mono text-[10.5px] text-fg-muted truncate flex-1" title={s.id}>{s.id}</span>
            <CopyButton text={s.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function EvidencePanel({ c, remark, setRemark, onDecide }) {
  const { role, changes } = useStore()
  const live = changes.find((x) => x.id === c.id) ?? c
  const decided = live.status !== 'pending'
  const [prov, setProv] = useState(false)
  const [remarkOpen, setRemarkOpen] = useState(false)
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-3 pb-3 border-b border-ink-600 shrink-0">
        <div className="flex items-center gap-2">
          <span className="label">{c.siteType}</span>
          <span className="flex-1" />
          <StatusPill status={live.status} />
        </div>
        <div className="text-lg text-fg-hi mt-0.5">{c.type}</div>
        <div className="flex items-center gap-4 mt-3">
          <RingGauge value={c.conf} size={76} />
          <div className="flex-1 min-w-0 space-y-2.5">
            <VoteDots votes={c.votes} agree={c.agree} />
            <ConfidenceBreakdown c={c} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-5">
        <div>
          <SectionHead title="Onset" right={<InfoPop label="Why?">Last clear look without the feature, first clear look with it; hatched span is the cloud gap between them ({c.bracket.gapLooks} cloudy looks).</InfoPop>} />
          <div className="mt-2"><BracketBar bracket={c.bracket} /></div>
        </div>
        <div>
          <SectionHead title="Cues" right={<InfoPop label="Why?">Cues prompt a second look. They are never verdicts.</InfoPop>} />
          <div className="mt-2"><FlagBadges flags={c.flags} /></div>
        </div>
        <div>
          <SectionHead title="Terrain" right={<InfoPop label="Why?">{c.terrainNote}</InfoPop>} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['Slope', 'Shadow', 'Snowmelt', 'Inundation', 'Crop cycle'].filter((k) => new RegExp(k.split(' ')[0], 'i').test(c.terrainNote)).map((k) => (
              <span key={k} className="h-6 px-2 flex items-center gap-1 border border-teal-line text-teal text-[10.5px]"><Icon name="check" size={11} />{k}</span>
            ))}
            <span className="h-6 px-2 flex items-center border border-ink-500 text-fg-muted text-[10.5px]">DEM 30 m</span>
          </div>
        </div>
        <div>
          <button onClick={() => setProv(!prov)} className="w-full flex items-center gap-2">
            <span className="label text-fg-muted">Provenance</span>
            <span className="mono text-2xs text-fg-dim">{c.scenes.length} scenes · {c.history.length} steps</span>
            <span className="flex-1 h-px bg-ink-600" />
            <Icon name={prov ? 'chevronDown' : 'chevron'} size={12} className="text-fg-dim" />
          </button>
          {prov && <div className="mt-3 fade-in"><Provenance c={c} /></div>}
        </div>
      </div>

      <div className="border-t border-ink-600 p-3 shrink-0 bg-ink-850 space-y-2">
        {decided ? (
          <div className="flex items-center gap-2 text-xs">
            <StatusPill status={live.status} />
            <span className="text-fg-muted truncate">
              {live.decidedBy ? <><span className="mono">{live.decidedBy}</span> · {live.decidedAt?.slice(11, 16)}Z</> : 'On record'}
            </span>
            <span className="flex-1" />
            {role === 'Supervisor' ? <Btn size="sm" variant="outline" onClick={() => onDecide('pending')}>Reopen</Btn> : <Icon name="lock" size={13} className="text-fg-dim" />}
          </div>
        ) : (
          <>
            {remarkOpen && <textarea autoFocus value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark · written to audit" rows={2} className="input w-full h-auto py-1.5 resize-none text-xs" />}
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
              <Btn variant="confirm" onClick={() => onDecide('confirmed')}>Confirm <Kbd>C</Kbd></Btn>
              <Btn variant="reject" onClick={() => onDecide('rejected')}>Reject <Kbd>R</Kbd></Btn>
              <Btn variant="outline" onClick={() => onDecide('needs-data')} className="text-xs">More <Kbd>N</Kbd></Btn>
              <button onClick={() => setRemarkOpen(!remarkOpen)} className={`w-8 border ${remarkOpen ? 'border-fg-muted text-fg' : 'border-ink-500 text-fg-dim hover:text-fg'} flex items-center justify-center`} title="Remark"><Icon name="file" size={13} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
