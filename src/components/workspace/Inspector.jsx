import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../state/AppStore'
import { changeBox, renderScene } from '../../lib/imagery'
import { Icon } from '../ui/Icon'
import { Coord, Kbd, StatusPill } from '../ui/primitives'
import { SwipeViewer } from '../imagery/Imagery'
import { BracketBar, FlagBadges, RingGauge, VoteDots } from '../evidence/Widgets'

// Compact pin inspector: answer first (ring, dots, verdict buttons), evidence on click.
export function Inspector({ change, onClose, onBrief }) {
  const { changes, decide } = useStore()
  const nav = useNavigate()
  const c = changes.find((x) => x.id === change.id) ?? change
  const [remarkOpen, setRemarkOpen] = useState(false)
  const [remark, setRemark] = useState('')
  const sensor = c.monsoon ? 'sar' : 'optical'
  const img = (variant) => renderScene({ seed: c.seed, terrain: c.terrain, change: c.render, variant, sensor, size: 320, lat: c.lat, lon: c.lon })
  const act = (d) => { decide(c.id, d, remark.trim()); setRemark(''); setRemarkOpen(false) }

  return (
    <aside className="w-[340px] glass border border-ink-500 brackets slide-in-right flex flex-col max-h-full" data-tour="inspector">
      <header className="flex items-center gap-2 px-3 h-10 border-b border-ink-600 shrink-0">
        <span className="mono text-xs text-fg-hi">{c.id}</span>
        <span className="text-sm text-fg truncate">{c.type}</span>
        <span className="flex-1" />
        <StatusPill status={c.status} />
        <button onClick={onClose} className="text-fg-dim hover:text-fg ml-1" aria-label="Close"><Icon name="x" size={14} /></button>
      </header>
      <div className="p-3 space-y-3 overflow-auto">
        <div className="flex items-center gap-4">
          <RingGauge value={c.conf} />
          <div className="space-y-2">
            <VoteDots votes={c.votes} agree={c.agree} />
            <Coord lat={c.lat} lon={c.lon} className="text-fg-dim text-[10.5px]" />
          </div>
        </div>

        <div className="relative w-full h-[150px] border border-ink-600 overflow-hidden">
          <SwipeViewer before={img('before')} after={img('after')} beforeLabel="B" afterLabel="A" box={changeBox(c.seed)} />
          <button onClick={() => nav(`/review?id=${c.id}`)} className="absolute bottom-1.5 right-1.5 z-30 flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-ink-950/90 border border-ink-500 text-fg-muted hover:text-fg">
            <Icon name="expand" size={11} /> Review
          </button>
        </div>

        <div>
          <div className="label mb-1.5">Onset</div>
          <BracketBar bracket={c.bracket} />
        </div>

        <div className="flex items-center justify-between">
          <FlagBadges flags={c.flags} />
          {c.monsoon && <span className="flex items-center gap-1 text-[10.5px] text-sar"><Icon name="radar" size={12} /> SAR-first</span>}
        </div>

        {c.status === 'pending' ? (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => act('confirmed')} className="h-11 border border-teal-line bg-teal-dim text-teal hover:border-teal flex flex-col items-center justify-center gap-0.5" data-tour="confirm">
                <Icon name="check" size={16} /><span className="text-[10px] uppercase tracking-wider">Confirm</span>
              </button>
              <button onClick={() => act('rejected')} className="h-11 border border-rej-line bg-rej-dim text-rej hover:border-rej flex flex-col items-center justify-center gap-0.5">
                <Icon name="x" size={16} /><span className="text-[10px] uppercase tracking-wider">Reject</span>
              </button>
              <button onClick={() => act('needs-data')} className="h-11 border border-ink-500 text-fg-muted hover:text-fg flex flex-col items-center justify-center gap-0.5">
                <Icon name="radar" size={16} /><span className="text-[10px] uppercase tracking-wider">More data</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setRemarkOpen((o) => !o)} className={`flex items-center gap-1 text-2xs ${remarkOpen ? 'text-fg' : 'text-fg-dim hover:text-fg'}`}>
                <Icon name="file" size={12} /> Remark
              </button>
              <span className="flex-1" />
              <span className="flex gap-1 text-2xs text-fg-dim"><Kbd>C</Kbd><Kbd>R</Kbd><Kbd>N</Kbd></span>
            </div>
            {remarkOpen && <textarea autoFocus value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className="input w-full h-auto py-1.5 text-xs resize-none" placeholder="Written to audit log" />}
          </>
        ) : (
          <div className="flex items-center gap-2 text-2xs text-fg-dim">
            <Icon name="audit" size={12} /> {c.decidedBy ? <>by <span className="mono">{c.decidedBy}</span></> : 'On record'}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-ink-600">
          <button onClick={() => nav(`/sites/${c.site}`)} className="h-8 text-xs border border-ink-600 text-fg-muted hover:text-fg hover:border-ink-400 flex items-center justify-center gap-1.5">
            <Icon name="sites" size={13} /> Site
          </button>
          <button onClick={onBrief} className="h-8 text-xs border border-ink-600 text-fg-muted hover:text-fg hover:border-ink-400 flex items-center justify-center gap-1.5">
            <Icon name="file" size={13} /> Brief
          </button>
        </div>
      </div>
    </aside>
  )
}
