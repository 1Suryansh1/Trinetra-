// Runs once after the offline DEMs load: re-projects mock objects into each AOI's
// DEM window and snaps them to dry, gentle ground so pins sit on plausible terrain.
import { AOIS, CHANGES, INGEST, SITES, aoiById } from './mock'
import { fromFrac, getDem, snapToLand } from '../lib/dem'

const LEGACY_SPREAD = 0.42 // degrees covered by the legacy mock offsets

function place(aoiId, obj, maxSlope) {
  const aoi = aoiById(aoiId)
  const dem = getDem(aoi.dem)
  if (!dem) return
  const [la0, lo0] = aoi.legacyCenter
  obj._legacy ??= [obj.lat, obj.lon] // idempotent across re-runs
  const [la, lo] = obj._legacy
  const fx = Math.min(0.9, Math.max(0.1, 0.5 + (lo - lo0) / LEGACY_SPREAD))
  const fy = Math.min(0.9, Math.max(0.1, 0.5 - (la - la0) / LEGACY_SPREAD))
  const [lat, lon] = fromFrac(dem, fx, fy)
  ;[obj.lat, obj.lon] = snapToLand(dem, lat, lon, maxSlope)
}

export function placeOnDem() {
  for (const c of [...CHANGES, ...INGEST]) place(c.aoi, c, c.aoi === 'AOI-03' ? 12 : 6)
  for (const s of SITES) {
    const lead = CHANGES.find((c) => c.id === s.changes[0])
    if (lead) { s.lat = lead.lat; s.lon = lead.lon } else place(s.aoi, s, 10)
    for (const sim of s.similar) place(s.aoi, sim, 12)
  }
  return AOIS.length
}
