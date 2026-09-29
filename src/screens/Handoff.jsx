import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SITES, aoiById, siteById } from '../data/mock'
import { useStore } from '../state/AppStore'
import { mulberry32 } from '../lib/rng'
import { downloadFile } from '../lib/format'
import { formatIndianGrid, formatMGRS, formatWGS84 } from '../lib/coords'
import { Btn, CopyButton, Drawer, Label, Modal, Panel, SectionHead, Seg, Tag } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { MapView } from '../components/imagery/Imagery'
import { BriefDocument } from '../components/Brief'
import { InfoPop } from '../components/evidence/Widgets'

const ASSETS = [
  { id: 'C3-PAN', label: 'Cartosat-3 · PAN 0.28 m', kind: 'optical', revisit: 2 },
  { id: 'C2S-PAN', label: 'Cartosat-2S · PAN 0.65 m', kind: 'optical', revisit: 3 },
  { id: 'EOS04-HRS', label: 'EOS-04 · SAR high-res spotlight', kind: 'sar', revisit: 3 },
  { id: 'COMM-VHR', label: 'Commercial VHR · via liaison cell', kind: 'optical', revisit: 1 },
]

function footprint(site) {
  const d = 0.018
  return [[site.lat + d, site.lon - d * 1.3], [site.lat + d * 0.8, site.lon + d * 1.2], [site.lat - d, site.lon + d * 1.4], [site.lat - d * 1.1, site.lon - d]]
}

function windows(site, asset) {
  const r = mulberry32(site.seed + asset.id.length * 13)
  const aoi = aoiById(site.aoi)
  const days = []
  for (let i = 0; i < 10; i++) {
    const date = new Date(Date.UTC(2026, 8, 29 + i)).toISOString().slice(0, 10)
    const cloud = asset.kind === 'sar' ? 0 : Math.round(aoi.monsoon ? 60 + r() * 38 : r() < 0.3 ? 50 + r() * 40 : r() * 30)
    const pass = i % asset.revisit === (site.seed % asset.revisit)
    days.push({ date, cloud, pass, offNadir: Math.round(4 + r() * 22), time: `${String(4 + Math.floor(r() * 3)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}Z` })
  }
  const candidates = days.filter((d) => d.pass).sort((a, b) => a.cloud + a.offNadir * 0.5 - (b.cloud + b.offNadir * 0.5))
  return { days, best: candidates[0] }
}

function CollectionWindow({ site, asset }) {
  const { days, best } = useMemo(() => windows(site, asset), [site, asset])
  return (
    <div>
      <SectionHead title="Best collection window" right={best && <span className="mono text-xs text-teal">{best.date} · {best.time}</span>} />
      <div className="mt-3 grid grid-cols-10 gap-1 items-end h-[92px]">
        {days.map((d) => {
          const isBest = best && d.date === best.date
          return (
            <div key={d.date} className="flex flex-col items-center justify-end h-full" title={`${d.date} · ${asset.kind === 'sar' ? 'SAR, cloud-independent' : `${d.cloud}% cloud forecast`}`}>
              <div className="w-full bg-ink-600 relative flex-1 flex items-end">
                <div className="w-full" style={{ height: `${asset.kind === 'sar' ? 4 : d.cloud}%`, background: '#3A4958' }} />
              </div>
              <div className={`w-full h-4 mt-1 flex items-center justify-center border ${isBest ? 'border-teal bg-teal-dim' : d.pass ? 'border-ink-400' : 'border-transparent'}`}>
                {d.pass && <span className={`w-1.5 h-1.5 ${isBest ? 'bg-teal' : 'bg-fg-muted'}`} />}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-10 gap-1 mt-1">
        {days.map((d) => <span key={d.date} className="mono text-[9.5px] text-fg-dim text-center">{d.date.slice(8)}</span>)}
      </div>
      <div className="flex gap-4 mt-2 text-2xs text-fg-dim">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-ink-400" /> cloud forecast (local NWP bundle)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-fg-muted" /> pass opportunity</span>
        {best && <span className="text-fg-muted">Best: off-nadir {best.offNadir}°, {asset.kind === 'sar' ? 'cloud-independent' : `${best.cloud}% cloud`}</span>}
      </div>
    </div>
  )
}

const FORMATS = [
  { id: 'geotiff', label: 'GeoTIFF', sub: 'Before/after chips, COG, EPSG:32643' },
  { id: 'gpkg', label: 'GeoPackage', sub: 'Footprints, changes, attributes' },
  { id: 'kml', label: 'KML', sub: 'Footprint + placemark' },
  { id: 'geojson', label: 'GeoJSON', sub: 'Footprint + change properties' },
  { id: 'wms', label: 'WMS / WFS URL', sub: 'On-prem GeoServer layer' },
]

function ExportDrawer({ open, onClose, site, change }) {
  const { log, toast } = useStore()
  const [sel, setSel] = useState(['geotiff', 'geojson', 'kml'])
  const [prov, setProv] = useState(true)
  const wms = `http://trinetra.local:8080/geoserver/trinetra/wms?layers=trinetra:${site.id.toLowerCase()}`
  const doExport = () => {
    const props = { site: site.id, name: site.name, stage: site.stage, change: change?.id, confidence: change?.conf, demo: true }
    if (prov && change) Object.assign(props, { scenes: change.scenes.map((s) => s.id), bracket: change.bracket, votes: change.votes.map((v) => ({ [v.key]: v.value, pass: v.pass })) })
    const ring = footprint(site).map(([la, lo]) => [lo, la])
    ring.push(ring[0])
    if (sel.includes('geojson')) {
      downloadFile(`${site.id}.geojson`, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring] } }] }, null, 2), 'application/geo+json')
    }
    if (sel.includes('kml')) {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${site.id}</name><Placemark><name>${site.name}</name><description>DEMO DATA</description><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring.map(([lo, la]) => `${lo},${la},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`
      setTimeout(() => downloadFile(`${site.id}.kml`, kml, 'application/vnd.google-earth.kml+xml'), 300)
    }
    log('EXPORT', site.id, `${sel.join(', ')}${prov ? ' + provenance' : ''}`)
    toast(`Export written locally · ${sel.length} format${sel.length > 1 ? 's' : ''}`)
    onClose()
  }
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Export · ${site.id}`}
      footer={<><span className="text-2xs text-fg-dim flex-1">Writes to local disk only</span><Btn variant="primary" icon="download" disabled={!sel.length} onClick={doExport}>Write files</Btn></>}
    >
      <div className="p-4 space-y-2">
        {FORMATS.map((f) => (
          <label key={f.id} className={`flex gap-3 items-start p-2.5 border cursor-pointer ${sel.includes(f.id) ? 'border-fg-muted bg-ink-750' : 'border-ink-600 hover:border-ink-400'}`}>
            <input type="checkbox" className="mt-1 accent-[#D6DDE4]" checked={sel.includes(f.id)} onChange={() => setSel((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : [...s, f.id]))} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-fg">{f.label}</span>
              <span className="block text-2xs text-fg-dim">{f.sub}</span>
              {f.id === 'wms' && sel.includes('wms') && (
                <span className="flex items-center gap-1 mt-1.5 bg-ink-950 border border-ink-600 pl-2">
                  <span className="mono text-[10px] text-fg-muted truncate flex-1">{wms}</span>
                  <CopyButton text={wms} />
                </span>
              )}
            </span>
          </label>
        ))}
        <label className="flex gap-3 items-start p-2.5 border border-teal-line bg-teal-dim cursor-pointer mt-4">
          <input type="checkbox" className="mt-1 accent-[#3EB2A8]" checked={prov} onChange={() => setProv(!prov)} />
          <span>
            <span className="block text-sm text-teal">Include full provenance</span>
            <span className="block text-2xs text-fg-muted">Scene IDs, processing history, detector votes, audit-chain head hash.</span>
          </span>
        </label>
        <div className="mt-4 p-3 border border-ink-600 text-xs text-fg-muted space-y-1.5">
          <div className="flex items-center gap-2 text-fg"><Icon name="layers" size={14} /> Open in QGIS</div>
          <div>Drag the GeoPackage into QGIS, or add the WMS URL under Layer → Add WMS/WMTS. Styles (.qml) are bundled with the export.</div>
          <div className="mono text-[10.5px] text-fg-dim">/mnt/export/{site.id}/</div>
        </div>
        <div className="text-2xs text-fg-dim">Demo: GeoJSON and KML files are generated for real; raster formats are listed only.</div>
      </div>
    </Drawer>
  )
}

const KITS = [
  {
    icon: 'shield', title: 'Signed offline update bundle', status: 'Verified', tone: 'text-teal',
    rows: [['Bundle', '2026.09-b'], ['Signature', 'ed25519 · TRN-OPS-02'], ['Contents', 'models, DEM tiles, NWP'], ['Size', '4.2 GB']],
    action: 'Verify again',
  },
  {
    icon: 'refresh', title: 'Sovereign retraining kit', status: 'Ready', tone: 'text-amber',
    rows: [['Analyst labels', '1,284 since last cycle'], ['Base model', 'trinetra-cd v2.3.1'], ['Compute', 'on-prem, 2 × GPU'], ['Est. time', '6 h 40 m']],
    action: 'Prepare kit',
  },
  {
    icon: 'satellite', title: 'Sensor onboarding kit', status: '3 sensors', tone: 'text-fg',
    rows: [['EOS-04 (RISAT-1A)', 'Onboarded'], ['Cartosat-3', 'Onboarded'], ['RISAT-2B', 'Calibration pending'], ['Template', 'band map, noise model']],
    action: 'Open kit',
  },
]

export default function Handoff() {
  const [params] = useSearchParams()
  const { changes, user, now, log, toast, audit } = useStore()
  const [siteId, setSiteId] = useState(params.get('site') ?? 'SITE-07')
  const site = siteById(siteId) ?? SITES[0]
  const change = changes.find((c) => c.id === site.changes[0])
  const [priority, setPriority] = useState('Priority')
  const [assetId, setAssetId] = useState(aoiById(site.aoi).monsoon ? 'EOS04-HRS' : 'C3-PAN')
  const asset = ASSETS.find((a) => a.id === assetId)
  const [drawer, setDrawer] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const reqId = `TASK-${site.id.slice(5)}-${String(20260928).slice(2)}`

  const exportRequest = () => {
    const { best } = windows(site, asset)
    const req = {
      request_id: reqId,
      demo_data: true,
      priority,
      target_asset: asset.label,
      site: { id: site.id, name: site.name, stage: site.stage },
      footprint_wgs84: footprint(site).map(([la, lo]) => [+lo.toFixed(5), +la.toFixed(5)]),
      grid_refs: { wgs84: formatWGS84(site.lat, site.lon), mgrs: formatMGRS(site.lat, site.lon), indian_grid: formatIndianGrid(site.lat, site.lon) },
      best_window: best,
      evidence: change && { change: change.id, confidence: change.conf, votes_agree: `${change.agree}/3`, bracket: change.bracket, scenes: change.scenes.map((s) => s.id), cues: change.flags },
      prepared_by: user.id,
      prepared_at: now(),
      audit_chain_head: audit[audit.length - 1].hash,
    }
    downloadFile(`${reqId}.json`, JSON.stringify(req, null, 2))
    log('TASKING_EXPORT', reqId, `${asset.label} · ${priority} · file only`)
    toast(`${reqId}.json written. Nothing was transmitted.`)
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="px-5 h-12 flex items-center gap-4 border-b border-ink-600 bg-ink-950 sticky top-0 z-10">
        <span className="mono text-2xs text-fg-dim">06</span>
        <span className="text-sm text-fg-hi tracking-wide">Handoff</span>
        <select className="select" value={site.id} onChange={(e) => setSiteId(e.target.value)}>
          {SITES.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
        </select>
        <span className="flex-1" />
        <Btn icon="download" onClick={() => setDrawer(true)}>Export data</Btn>
      </div>

      <div className="p-5 grid grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_480px] gap-5">
        <Panel
          title="Tasking cue package"
          index="A"
          bracket
          right={<span className="mono text-xs text-fg-muted">{reqId}</span>}
          bodyClass="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div className="border-r border-ink-600 flex flex-col">
            <MapView
              aoiId={site.aoi}
              seed={site.seed}
              className="h-[340px]"
              polygons={[{ points: footprint(site), tone: 'amber', fillOpacity: 0.16 }]}
              markers={[{ id: site.id, lat: site.lat, lon: site.lon, tone: 'amber', active: true, label: `${site.id} · footprint 4.1 km²` }]}
            />
            <div className="p-3 space-y-1 text-xs border-t border-ink-600">
              {[['WGS84', formatWGS84(site.lat, site.lon)], ['MGRS', formatMGRS(site.lat, site.lon)], ['Indian Grid', formatIndianGrid(site.lat, site.lon)]].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-fg-dim w-20">{k}</span>
                  <span className="mono text-fg flex-1">{v}</span>
                  <CopyButton text={v} />
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-5">
            <div className="grid grid-cols-1 2xl:grid-cols-[auto_minmax(0,1fr)] gap-3 2xl:gap-4">
              <div>
                <Label className="mb-1.5">Priority</Label>
                <Seg value={priority} onChange={setPriority} options={['Routine', 'Priority', 'Immediate']} />
              </div>
              <div>
                <Label className="mb-1.5">Target asset</Label>
                <select className="select w-full h-7" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  {ASSETS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <SectionHead title="Supporting evidence" />
              {change ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className="flex gap-2"><span className="text-fg-dim w-24 shrink-0">Change</span><span><span className="mono">{change.id}</span> · {change.type} · <span className="mono">{change.conf}%</span></span></li>
                  <li className="flex gap-2"><span className="text-fg-dim w-24 shrink-0">Detectors</span><span className={`whitespace-nowrap ${change.agree === 3 ? 'text-teal' : 'text-amber'}`}>{change.agree}/3 agree</span><span className="text-fg-muted text-xs pt-px">{change.votes.map((v) => v.value).join(' · ')}</span></li>
                  <li className="flex gap-2"><span className="text-fg-dim w-24 shrink-0">Onset</span><span className="mono text-xs pt-px">{change.bracket.lastClear} → {change.bracket.firstClear ?? change.bracket.firstSar}</span></li>
                  <li className="flex gap-2"><span className="text-fg-dim w-24 shrink-0">Stage</span><span>{site.stage} <span className="mono text-fg-muted">{site.stageConf}%</span></span></li>
                  {change.flags.length > 0 && <li className="flex gap-2"><span className="text-fg-dim w-24 shrink-0">Cues</span><span className="text-amber text-xs pt-px">{change.flags.join('; ')}</span></li>}
                </ul>
              ) : <div className="text-xs text-fg-dim mt-2">No linked change.</div>}
            </div>
            <CollectionWindow site={site} asset={asset} />
            <div className="flex items-center gap-3 pt-2 border-t border-ink-600">
              <Btn variant="primary" size="lg" icon="download" onClick={exportRequest}>Export request</Btn>
              <span className="text-2xs text-fg-dim flex items-center gap-1.5"><Icon name="lock" size={12} />File only · nothing sent</span>
            </div>
          </div>
        </Panel>

        <Panel
          title="Brief preview"
          index="B"
          className="self-start"
          right={<Btn size="sm" variant="ghost" onClick={() => setBriefOpen(true)}>Open full</Btn>}
          bodyClass="p-3 bg-ink-950 overflow-hidden"
        >
          <div style={{ zoom: 0.52 }} className="pointer-events-none">
            <BriefDocument site={site} change={change} user={user} now={now()} chainHead={audit[audit.length - 1].hash} printable={false} />
          </div>
        </Panel>

        <div className="col-span-2">
          <SectionHead index="C" title="Sovereignty kit" className="mb-3" right={<InfoPop label="Why?">Everything needed to run, update and extend Trinetra without outside help.</InfoPop>} />
          <div className="grid grid-cols-3 gap-5">
            {KITS.map((k) => (
              <div key={k.title} className="panel brackets p-4">
                <div className="flex items-center gap-2">
                  <Icon name={k.icon} size={16} className="text-fg-muted" />
                  <span className="text-sm text-fg-hi">{k.title}</span>
                  <span className="flex-1" />
                  <Tag className={k.tone}>{k.status}</Tag>
                </div>
                <div className="mt-3 space-y-1">
                  {k.rows.map(([a, b]) => (
                    <div key={a} className="flex text-xs border-b border-ink-600 pb-1">
                      <span className="text-fg-dim flex-1">{a}</span>
                      <span className={`mono ${b.includes('pending') ? 'text-amber' : 'text-fg'}`}>{b}</span>
                    </div>
                  ))}
                </div>
                <Btn size="sm" variant="outline" className="mt-3" onClick={() => { log('KIT', k.title, k.action); toast(`${k.action}: done (demo)`) }}>{k.action}</Btn>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ExportDrawer open={drawer} onClose={() => setDrawer(false)} site={site} change={change} />
      <Modal
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        title={`Brief · ${site.id}`}
        width="max-w-4xl"
        footer={<><span className="flex-1" /><Btn variant="primary" icon="print" onClick={() => { log('EXPORT', `BRIEF ${site.id}`, 'PDF via local print'); window.print() }}>Export PDF</Btn></>}
      >
        <div className="p-6 bg-ink-950"><BriefDocument site={site} change={change} user={user} now={now()} chainHead={audit[audit.length - 1].hash} /></div>
      </Modal>
    </div>
  )
}
