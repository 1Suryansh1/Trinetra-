import { useEffect, useMemo, useState } from 'react'
import { changeBox, renderCloudMask, renderHeatmap, renderScene } from '../../lib/imagery'
import { SwipeViewer } from '../../components/imagery/Imagery'
import { Chip, Coord, Seg } from '../../components/ui/primitives'
import { Icon } from '../../components/ui/Icon'

const dayNum = (d) => Math.round(new Date(d + 'T00:00:00Z').getTime() / 864e5)

// Timeline of looks; clear looks are selectable, cloudy ones are shown but inert.
export function DateScrubber({ looks, before, after, onPick, sensorKey }) {
  const all = looks.filter((l) => l.sensor === sensorKey)
  const start = dayNum(all[0].date)
  const end = dayNum(all[all.length - 1].date)
  const x = (d) => ((dayNum(d) - start) / Math.max(1, end - start)) * 100
  const months = []
  for (let d = start; d <= end; d++) {
    const iso = new Date(d * 864e5).toISOString().slice(0, 10)
    if (iso.endsWith('-01')) months.push(iso)
  }
  return (
    <div className="px-4 pt-2 pb-3">
      <div className="flex items-center gap-3 mb-2 text-2xs whitespace-nowrap">
        <span className="label">Looks · {sensorKey === 'S2' ? 'Sentinel-2 optical' : 'Sentinel-1 SAR'}</span>
        <span className="flex items-center gap-1 text-fg-dim"><span className="w-2 h-2 bg-fg-muted" /> clear</span>
        <span className="flex items-center gap-1 text-fg-dim"><span className="w-2 h-2 border border-fg-dim" /> cloudy (not usable)</span>
        <span className="flex-1" />
        <span className="text-fg-dim hidden 2xl:inline">Click a clear look to set before / after</span>
      </div>
      <div className="relative h-10">
        <div className="absolute left-0 right-0 top-4 h-px bg-ink-500" />
        {months.map((m) => (
          <span key={m} className="absolute top-6 mono text-[9.5px] text-fg-dim -translate-x-1/2" style={{ left: `${x(m)}%` }}>
            {new Date(m).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()}
          </span>
        ))}
        {all.map((l) => {
          const isB = l.date === before, isA = l.date === after
          return (
            <button
              key={l.date}
              disabled={!l.usable}
              onClick={() => onPick(l.date)}
              title={`${l.date} · ${l.usable ? 'clear' : `${l.cloud}% cloud`}`}
              className="absolute top-1 -translate-x-1/2 group disabled:cursor-not-allowed"
              style={{ left: `${x(l.date)}%` }}
            >
              <span
                className={`block w-2 h-6 ${
                  isB || isA ? 'bg-fg-hi' : l.usable ? 'bg-fg-muted group-hover:bg-fg' : 'border border-ink-400 bg-ink-850'
                }`}
              />
              {(isB || isA) && (
                <span className={`absolute -top-0.5 ${isB ? 'right-3' : 'left-3'} mono text-2xs text-fg-hi whitespace-nowrap bg-ink-950 px-1 border border-ink-500`}>
                  {isB ? 'B' : 'A'} {l.date.slice(5)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ImageryViewer({ c, mode, setMode, sensor, setSensor, cloudMask, setCloudMask, heat, setHeat }) {
  const sensorKey = sensor === 'sar' ? 'S1' : 'S2'
  const looks = c.looks.filter((l) => l.sensor === sensorKey)
  const usable = looks.filter((l) => l.usable)
  const evidenceDate = sensor === 'sar' ? c.bracket.firstSar : c.bracket.firstClear ?? c.detected

  const defaults = useMemo(() => {
    if (!usable.length) return { b: looks[0]?.date, a: looks[looks.length - 1]?.date }
    const beforeCands = usable.filter((l) => l.date < evidenceDate)
    return { b: (beforeCands[beforeCands.length - 1] ?? usable[0]).date, a: usable[usable.length - 1].date }
  }, [c.id, sensor]) // eslint-disable-line react-hooks/exhaustive-deps

  const [before, setBefore] = useState(defaults.b)
  const [after, setAfter] = useState(defaults.a)
  useEffect(() => { setBefore(defaults.b); setAfter(defaults.a) }, [defaults])

  const lookFor = (d) => looks.find((l) => l.date === d)
  const imgFor = (d) => {
    const l = lookFor(d)
    const opticalCloud = sensor === 'optical' && l && !l.usable ? Math.min(0.95, l.cloud / 100) : 0
    return renderScene({
      seed: c.seed, terrain: c.terrain, sensor, change: c.render, size: 640, date: d ?? '', lat: c.lat, lon: c.lon,
      variant: d && d >= evidenceDate ? 'after' : 'before',
      cloud: opticalCloud,
    })
  }
  const afterLook = lookFor(after)
  const box = changeBox(c.seed)

  const overlays = (
    <>
      {cloudMask && <img src={renderCloudMask({ seed: c.seed, coverage: sensor === 'sar' ? 0.35 : Math.max(0.2, (afterLook?.cloud ?? 30) / 100), size: 256 })} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="" />}
      {heat && <img src={renderHeatmap({ seed: c.seed, size: 256 })} className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-screen" alt="" />}
    </>
  )

  const pick = (d) => {
    if (d < after) setBefore(d)
    else if (d > before) setAfter(d)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {c.monsoon && (
        <div className="flex items-center gap-3 px-4 h-8 shrink-0 border-b border-ink-600 bg-[#121a26] text-sar">
          <Icon name="radar" size={14} />
          <span className="text-xs font-semibold tracking-[0.14em] whitespace-nowrap">MONSOON MODE: SAR-FIRST ANALYSIS</span>
          <span className="text-2xs text-fg-muted truncate">No clear optical look since {c.bracket.lastClear}<span className="hidden 2xl:inline">. Viewer defaults to SAR; optical shown for context only</span>.</span>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 h-10 border-b border-ink-600 shrink-0 overflow-hidden">
        <span className="mono text-sm text-fg-hi hidden 2xl:inline">{c.id}</span>
        <span className="label xl:inline 2xl:hidden">Viewer</span>
        <span className="text-sm text-fg-muted truncate hidden 2xl:inline">{c.type}</span>
        <span className="flex-1" />
        <Seg value={sensor} onChange={setSensor} options={[{ value: 'optical', label: 'Optical' }, { value: 'sar', label: 'SAR' }]} />
        <Seg value={mode} onChange={setMode} options={[{ value: 'swipe', label: 'Swipe' }, { value: 'side', label: 'Side-by-side' }]} />
        <Chip active={cloudMask} onClick={() => setCloudMask(!cloudMask)}><Icon name="cloud" size={12} />Cloud mask</Chip>
        <Chip active={heat} onClick={() => setHeat(!heat)}><Icon name="layers" size={12} />Heatmap</Chip>
      </div>

      <div className="flex-1 min-h-0 relative bg-ink-950">
        <SwipeViewer
          mode={mode}
          before={imgFor(before)}
          after={imgFor(after)}
          beforeLabel={`BEFORE · ${before} · ${sensor === 'sar' ? 'S1 VV' : `S2 L2A · ${lookFor(before)?.cloud ?? 0}% cl`}`}
          afterLabel={`AFTER · ${after} · ${sensor === 'sar' ? 'S1 VV' : `S2 L2A · ${afterLook?.cloud ?? 0}% cl`}`}
          overlays={overlays}
          box={box}
          boxLabel={`${c.id} · ${c.conf}%`}
        />
        {heat && (
          <div className="absolute bottom-3 left-3 panel px-2 py-1.5 flex items-center gap-2 text-2xs text-fg-muted z-10">
            Change likelihood
            <span className="flex h-2">
              {['#281E5A', '#963C6E', '#DC783C', '#FADC78'].map((col) => <span key={col} className="w-5" style={{ background: col }} />)}
            </span>
            <span className="mono">low → high</span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 panel px-2 py-1 z-10 flex items-center gap-3 text-2xs text-fg-muted">
          <Coord lat={c.lat} lon={c.lon} className="text-fg" />
          <span className="mono">{c.areaM2.toLocaleString()} m²</span>
          <span className="mono">GSD 10 m</span>
        </div>
      </div>

      <div className="border-t border-ink-600 shrink-0 bg-ink-850">
        <DateScrubber looks={c.looks} before={before} after={after} onPick={pick} sensorKey={sensorKey} />
      </div>
    </div>
  )
}
