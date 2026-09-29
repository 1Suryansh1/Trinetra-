import { useEffect, useRef } from 'react'
import { fmtAge } from '../../lib/format'
import { ConfBar, STATUS, Seg } from '../../components/ui/primitives'
import { SceneChip } from '../../components/imagery/Imagery'
import { Icon } from '../../components/ui/Icon'

export function QueueList({ items, selectedId, onSelect, filter, onFilter, counts, ingestNote }) {
  const listRef = useRef(null)
  useEffect(() => {
    listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 py-2.5 border-b border-ink-600 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="label text-fg-muted">Queue</span>
          <span className="mono text-2xs text-fg-dim">{items.length} shown</span>
          <span className="flex-1" />
          <span className="text-2xs text-fg-dim">rank = confidence × novelty</span>
        </div>
        <Seg
          value={filter}
          onChange={onFilter}
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'pending', label: `Review ${counts.pending}` },
            { value: 'confirmed', label: `Conf ${counts.confirmed}` },
            { value: 'rejected', label: `Rej ${counts.rejected}` },
            { value: 'all', label: `All ${counts.all}` },
          ]}
        />
      </div>
      {ingestNote && (
        <div className="mx-3 mt-2.5 px-2.5 py-2 border border-teal-line bg-teal-dim text-xs text-teal fade-in shrink-0">
          <div className="font-medium">{ingestNote.text}</div>
          <div className="text-fg-muted mt-0.5">
            {ingestNote.held} alert{ingestNote.held === 1 ? '' : 's'} held below threshold; 1 demoted and kept visible. Reversible in Audit.
          </div>
        </div>
      )}
      <div ref={listRef} className="flex-1 overflow-auto">
        <div className="grid grid-cols-[28px_40px_1fr_44px] gap-x-2 px-3 h-7 items-center label border-b border-ink-600 sticky top-0 bg-ink-850 z-[1]">
          <span>#</span><span /><span>Change</span><span className="text-right">Conf</span>
        </div>
        {items.map((c, i) => {
          const active = c.id === selectedId
          const s = STATUS[c.status]
          return (
            <button
              key={c.id}
              data-id={c.id}
              onClick={() => onSelect(c.id)}
              style={{ '--i': i }}
              className={`stagger relative w-full grid grid-cols-[28px_40px_1fr_44px] gap-x-2 items-center px-3 py-2 text-left border-b border-ink-600 transition-colors ${
                active ? 'bg-ink-700' : 'hover:bg-ink-750'
              }`}
            >
              {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-fg-hi" />}
              <span className="mono text-xs text-fg-dim">{String(i + 1).padStart(2, '0')}</span>
              <SceneChip seed={c.seed} terrain={c.terrain} change={c.render} sensor={c.monsoon ? 'sar' : 'optical'} size={80} lat={c.lat} lon={c.lon} className="w-10 h-10 border border-ink-600" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 shrink-0 ${s.dot}`} title={s.label} />
                  <span className="text-sm text-fg truncate">{c.type}</span>
                  {c.isNew && <span className="text-[9px] px-1 border border-fg-dim text-fg-muted tracking-wider">NEW</span>}
                  {c.demoted && <span className="text-[9px] px-1 border border-teal-line text-teal tracking-wider">DEMOTED</span>}
                </span>
                <span className="flex items-center gap-2 mt-0.5 text-2xs text-fg-dim whitespace-nowrap overflow-hidden">
                  <span className="mono text-fg-muted">{c.id}</span>
                  <span className="hidden 2xl:inline">{c.aoi}</span>
                  <span>{fmtAge(c.ageH)}</span>
                  {c.monsoon && <span className="text-sar flex items-center" title="SAR-first (monsoon)"><Icon name="radar" size={10} /></span>}
                  {c.flags.length > 0 && <span className="text-amber flex items-center gap-0.5" title="Consistency cues"><Icon name="flag" size={10} />{c.flags.length}</span>}
                </span>
              </span>
              <span className="text-right">
                <span className="mono text-sm text-fg-hi num">{c.conf}</span>
                <ConfBar value={c.conf} className="mt-1" />
              </span>
            </button>
          )
        })}
        {items.length === 0 && <div className="p-6 text-center text-sm text-fg-dim">Nothing in this view.</div>}
      </div>
    </div>
  )
}
