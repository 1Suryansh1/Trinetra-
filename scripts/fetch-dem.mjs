// One-time, connected-machine step: pull Copernicus GLO-30 DEM + water-body-mask
// windows for each AOI via HTTP range reads (COG), resample to a fixed grid and
// write offline heightmap tiles to public/dem/. The app itself never goes online.
//
//   node scripts/fetch-dem.mjs            (only AOIs not yet converted)
//   node scripts/fetch-dem.mjs --force    (re-fetch everything)
//
// Output per AOI:  <id>.dem.bin (Int16 LE, metres), <id>.wbm.bin (Uint8 WBM class),
//                  <id>.json (bbox, size, stats, source)
import { fromUrl } from 'geotiff'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

const AOIS = [
  { id: 'AOI-01', bbox: { west: 72.92, south: 19.0, east: 73.17, north: 19.25 } },
  { id: 'AOI-02', bbox: { west: 94.02, south: 26.72, east: 94.34, north: 27.0 } },
  { id: 'AOI-03', bbox: { west: 78.3, south: 33.5, east: 78.62, north: 33.78 } },
  // Northern border
  { id: 'AOI-04', bbox: { west: 73.9, south: 34.05, east: 74.35, north: 34.45 } }, // Uri–Kupwara
  { id: 'AOI-05', bbox: { west: 75.7, south: 34.3, east: 76.2, north: 34.62 } }, // Kargil–Drass
  { id: 'AOI-06', bbox: { west: 74.55, south: 32.5, east: 75.05, north: 32.9 } }, // Akhnoor–Samba
  { id: 'AOI-07', bbox: { west: 74.45, south: 31.48, east: 74.85, north: 31.78 } }, // Amritsar–Wagah
]
const SIZE = 1024
const BASE = 'https://copernicus-dem-30m.s3.amazonaws.com'
const OUT = new URL('../public/dem/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const tileName = (lat, lon) =>
  `Copernicus_DSM_COG_10_${lat >= 0 ? 'N' : 'S'}${String(Math.abs(lat)).padStart(2, '0')}_00_${lon >= 0 ? 'E' : 'W'}${String(Math.abs(lon)).padStart(3, '0')}_00`

async function readWindow(url, bbox) {
  let tiff
  try { tiff = await fromUrl(url) } catch { return null }
  const img = await tiff.getImage()
  const [minX, minY, maxX, maxY] = img.getBoundingBox()
  const W = img.getWidth(), H = img.getHeight()
  const rx = (maxX - minX) / W, ry = (maxY - minY) / H
  const x0 = Math.max(0, Math.floor((Math.max(bbox.west, minX) - minX) / rx) - 1)
  const x1 = Math.min(W, Math.ceil((Math.min(bbox.east, maxX) - minX) / rx) + 1)
  const y0 = Math.max(0, Math.floor((maxY - Math.min(bbox.north, maxY)) / ry) - 1)
  const y1 = Math.min(H, Math.ceil((maxY - Math.max(bbox.south, minY)) / ry) + 1)
  if (x1 <= x0 || y1 <= y0) return null
  const [data] = await img.readRasters({ window: [x0, y0, x1, y1] })
  return { data, x0, y0, w: x1 - x0, h: y1 - y0, minX, maxY, rx, ry, extent: [minX, minY, maxX, maxY] }
}

function sampler(tiles, bilinear) {
  return (lat, lon) => {
    const t = tiles.find((t) => t && lon >= t.extent[0] && lon < t.extent[2] && lat > t.extent[1] && lat <= t.extent[3])
    if (!t) return null
    const fx = (lon - t.minX) / t.rx - 0.5 - t.x0
    const fy = (t.maxY - lat) / t.ry - 0.5 - t.y0
    if (!bilinear) {
      const x = Math.min(t.w - 1, Math.max(0, Math.round(fx))), y = Math.min(t.h - 1, Math.max(0, Math.round(fy)))
      return t.data[y * t.w + x]
    }
    const x = Math.min(t.w - 2, Math.max(0, Math.floor(fx))), y = Math.min(t.h - 2, Math.max(0, Math.floor(fy)))
    const ax = Math.min(1, Math.max(0, fx - x)), ay = Math.min(1, Math.max(0, fy - y))
    const d = t.data, w = t.w
    const a = d[y * w + x], b = d[y * w + x + 1], c = d[(y + 1) * w + x], e = d[(y + 1) * w + x + 1]
    return a * (1 - ax) * (1 - ay) + b * ax * (1 - ay) + c * (1 - ax) * ay + e * ax * ay
  }
}

const force = process.argv.includes('--force')
for (const aoi of AOIS) {
  if (!force && existsSync(new URL(`${aoi.id}.json`, OUT))) { console.log(aoi.id, 'exists, skipping'); continue }
  const { bbox } = aoi
  const names = []
  for (let lat = Math.floor(bbox.south); lat <= Math.floor(bbox.north - 1e-9); lat++)
    for (let lon = Math.floor(bbox.west); lon <= Math.floor(bbox.east - 1e-9); lon++) names.push(tileName(lat, lon))
  console.log(aoi.id, 'tiles:', names.join(', '))
  const dems = [], wbms = []
  for (const n of names) {
    dems.push(await readWindow(`${BASE}/${n}_DEM/${n}_DEM.tif`, bbox))
    wbms.push(await readWindow(`${BASE}/${n}_DEM/AUXFILES/${n}_WBM.tif`, bbox))
  }
  const sd = sampler(dems, true), sw = sampler(wbms, false)
  const dem = new Int16Array(SIZE * SIZE), wbm = new Uint8Array(SIZE * SIZE)
  let min = Infinity, max = -Infinity
  for (let j = 0; j < SIZE; j++) {
    const lat = bbox.north - ((j + 0.5) / SIZE) * (bbox.north - bbox.south)
    for (let i = 0; i < SIZE; i++) {
      const lon = bbox.west + ((i + 0.5) / SIZE) * (bbox.east - bbox.west)
      const h = sd(lat, lon)
      const v = h == null || h < -500 ? 0 : Math.round(h)
      const wv = sw(lat, lon)
      dem[j * SIZE + i] = v
      wbm[j * SIZE + i] = h == null ? 1 : wv ?? 0
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  const midLat = (bbox.north + bbox.south) / 2
  const meta = {
    id: aoi.id, bbox, width: SIZE, height: SIZE, min, max,
    widthM: Math.round((bbox.east - bbox.west) * 111320 * Math.cos((midLat * Math.PI) / 180)),
    heightM: Math.round((bbox.north - bbox.south) * 110574),
    source: 'Copernicus GLO-30 DEM (ESA, 30 m) + WBM water-body mask',
    tiles: names, resampled: 'bilinear (DEM) / nearest (WBM)',
    wbmClasses: { 0: 'land', 1: 'ocean', 2: 'lake', 3: 'river' },
  }
  writeFileSync(new URL(`${aoi.id}.dem.bin`, OUT), Buffer.from(dem.buffer))
  writeFileSync(new URL(`${aoi.id}.wbm.bin`, OUT), Buffer.from(wbm.buffer))
  writeFileSync(new URL(`${aoi.id}.json`, OUT), JSON.stringify(meta, null, 2))
  console.log(aoi.id, `min ${min} m, max ${max} m`, `${meta.widthM} x ${meta.heightM} m`)
}
