import { formatIndianGrid, formatMGRS, formatWGS84 } from '../lib/coords'
import { aoiById } from '../data/mock'
import { SceneChip } from './imagery/Imagery'

// Printable one-page brief. Rendered on a light "paper" surface so it previews
// the exported PDF; window.print() prints only `.print-area`.
export function BriefDocument({ site, change, user, now, remarks, chainHead = '', printable = true }) {
  const aoi = aoiById(site.aoi)
  const lat = change?.lat ?? site.lat
  const lon = change?.lon ?? site.lon
  const briefId = `BRIEF-${String(92 + (site.id.charCodeAt(6) % 7)).padStart(4, '0')}`
  return (
    <div className={`${printable ? 'print-area' : ''} bg-[#F4F3EF] text-[#1B1F24] w-full max-w-[760px] mx-auto shadow-[0_0_0_1px_#2A3744] font-sans`}>
      <div className="flex items-center justify-between px-8 py-2 bg-[#1B1F24] text-[#F4F3EF] text-[10px] tracking-[0.2em] font-semibold">
        <span>DEMO DATA · NOT FOR OPERATIONAL USE</span>
        <span className="font-mono">{briefId}</span>
      </div>
      <div className="px-8 pt-6 pb-8">
        <div className="flex items-start justify-between border-b border-[#1B1F24] pb-3">
          <div>
            <div className="text-[10px] tracking-[0.24em] text-[#5B636C]">TRINETRA · SITE BRIEF</div>
            <div className="text-[22px] font-light mt-1">{site.name}</div>
            <div className="text-[11px] text-[#5B636C] mt-0.5">{site.id} · {aoi.id} {aoi.name} · stage: {site.stage} ({site.stageConf}%)</div>
          </div>
          <div className="text-right">
            <div className="text-[34px] leading-none font-extralight">{change?.conf ?? site.stageConf}%</div>
            <div className="text-[9px] tracking-[0.2em] text-[#5B636C] mt-1">CONFIDENCE</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {[['BEFORE', 'before', change?.bracket.lastClear ?? site.bracket.lastWithout], ['AFTER', 'after', change?.bracket.firstClear ?? change?.detected ?? site.bracket.firstWith]].map(([l, v, d]) => (
            <div key={l}>
              <SceneChip seed={change?.seed ?? site.seed} terrain={aoi.terrain} change={change?.render ?? 'structure'} variant={v} sensor={change?.monsoon ? 'sar' : 'optical'} size={320} lat={lat} lon={lon} box={v === 'after'} className="aspect-[4/3]" />
              <div className="flex justify-between text-[10px] mt-1 font-mono text-[#5B636C]"><span>{l}</span><span>{d}</span></div>
            </div>
          ))}
        </div>

        <table className="w-full mt-5 text-[11px]">
          <tbody>
            {[
              ['WGS84', formatWGS84(lat, lon)],
              ['MGRS', formatMGRS(lat, lon)],
              ['Indian Grid (approx.)', formatIndianGrid(lat, lon)],
              ['Change', change ? `${change.id} · ${change.type} · ${change.agree}/3 detectors agree` : '—'],
              ['Evidence bracket', change ? `${change.bracket.lastClear} → ${change.bracket.firstClear ?? change.bracket.firstSar} (${change.bracket.gapDays} d gap)` : '—'],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-[#D5D3CC]">
                <td className="py-1.5 pr-4 text-[#5B636C] w-[150px] align-top">{k}</td>
                <td className="py-1.5 font-mono">{v}</td>
              </tr>
            ))}
            <tr className="border-b border-[#D5D3CC]">
              <td className="py-1.5 pr-4 text-[#5B636C] align-top">Scene IDs</td>
              <td className="py-1.5 font-mono text-[10px] leading-relaxed">{(change?.scenes ?? []).map((s) => <div key={s.id}>{s.id}</div>)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4">
          <div className="text-[9px] tracking-[0.2em] text-[#5B636C] mb-1">REMARKS</div>
          <p className="text-[12px] leading-relaxed">{remarks || site.decisions[site.decisions.length - 1]?.remark}</p>
          {change?.flags?.length > 0 && (
            <p className="text-[11px] mt-2 text-[#7A5A1E]">Cues noted: {change.flags.join('; ')}.</p>
          )}
        </div>

        <div className="flex justify-between mt-6 pt-2 border-t border-[#1B1F24] text-[9.5px] font-mono text-[#5B636C]">
          <span>Prepared by {user.name} ({user.id}) · {now.replace('T', ' ')}</span>
          <span>Audit chain head {chainHead.slice(0, 12)} · page 1/1</span>
        </div>
      </div>
    </div>
  )
}
