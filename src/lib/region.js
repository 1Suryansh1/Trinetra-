// A "region" is what the analyst works in: a sector, or a drawn shape. Regions over an
// AOI use its offline GLO-30 tile; anywhere else gets a procedural DEM whose relief is
// seeded from the coarse theatre elevation so it stays plausible.
import { AOIS, aoiById } from '../data/mock'
import { getDem, getTheatre, proceduralDem, areaKm2 } from './dem'
import { hashString } from './rng'

export function regionFromAoi(a, name = a.name) {
  return { id: a.id, name, kind: 'sector', aoi: a.id, bbox: a.bbox, terrain: a.terrain, demId: a.dem }
}

export function regionFromSector(sec) {
  const aoiId = sec.aoi ?? sec.aois?.[0]
  if (aoiId) {
    const a = aoiById(aoiId)
    return { ...regionFromAoi(a, sec.aois ? a.name : sec.name), id: sec.aois ? a.id : sec.id }
  }
  return {
    id: sec.id, name: sec.name, kind: 'sector', aoi: null, bbox: sec.bbox, terrain: 'generic',
    demId: `PROC-${sec.id}`, relief: sec.relief, baseElev: sec.baseElev,
  }
}

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

export function theatreElev(lat, lon) {
  const t = getTheatre()
  if (!t) return null
  const { bbox, elevWidth: W, elevHeight: H } = t.meta
  const fx = (lon - bbox.west) / (bbox.east - bbox.west)
  const fy = (mercY(bbox.north) - mercY(lat)) / (mercY(bbox.north) - mercY(bbox.south))
  if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return null
  return t.elev[Math.floor(fy * H) * W + Math.floor(fx * W)]
}

export function regionFromShape(shape) {
  const { bbox } = shape
  const c = [(bbox.north + bbox.south) / 2, (bbox.east + bbox.west) / 2]
  const hit = AOIS.find((a) => c[0] > a.bbox.south - 0.3 && c[0] < a.bbox.north + 0.3 && c[1] > a.bbox.west - 0.3 && c[1] < a.bbox.east + 0.3)
  const area = areaKm2(bbox)
  if (hit) {
    return {
      id: `REG-${hit.id}`, name: `${hit.name} (drawn)`, kind: 'drawn', aoi: hit.id, bbox: hit.bbox,
      terrain: hit.terrain, demId: hit.dem, shape, drawnArea: area, snapped: true,
    }
  }
  // Keep workspace windows to ~0.3° so the procedural DEM keeps 30 m-like detail.
  const half = Math.min(0.15, Math.max((bbox.north - bbox.south) / 2, (bbox.east - bbox.west) / 2))
  const wb = { south: c[0] - half, north: c[0] + half, west: c[1] - half, east: c[1] + half }
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
    const e = theatreElev(bbox.south + ((bbox.north - bbox.south) * i) / 6, bbox.west + ((bbox.east - bbox.west) * j) / 6)
    if (e != null) { lo = Math.min(lo, e); hi = Math.max(hi, e) }
  }
  const baseElev = Number.isFinite(lo) ? Math.max(0, lo) : 300
  const relief = Number.isFinite(hi) ? Math.max(120, (hi - lo) * 1.4) : 600
  const id = `REG-${(hashString(JSON.stringify(bbox)) % 1e6).toString(36).toUpperCase()}`
  return { id, name: 'Custom region', kind: 'drawn', aoi: null, bbox: wb, terrain: 'generic', demId: `PROC-${id}`, relief, baseElev, shape, drawnArea: area }
}

export function regionDem(region) {
  if (region.aoi) return getDem(region.demId)
  return proceduralDem(region.demId, region.bbox, { relief: region.relief ?? 800, baseElev: region.baseElev ?? 300 })
}

export const tilesFor = (km2) => Math.round(km2 * 10)
