// DEM runtime: loads offline heightmap tiles (Copernicus GLO-30, pre-converted by
// scripts/fetch-dem.mjs) and derives slope / aspect / hillshade. Regions without an
// offline tile get a procedural DEM with the same shape, flagged `procedural: true`.
import { mulberry32, hashString } from './rng'

const DEMS = new Map()
let theatre = null

const DEG = Math.PI / 180

function derive(dem) {
  const { W, H, elev } = dem
  const dx = dem.widthM / W
  const dy = dem.heightM / H
  const slope = new Float32Array(W * H)
  const aspect = new Float32Array(W * H)
  const shade = new Float32Array(W * H)
  const az = 315 * DEG, alt = 42 * DEG
  const L = [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)]
  let min = Infinity, max = -Infinity
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(W - 1, x + 1)
      const i = y * W + x
      const gx = (elev[y * W + x1] - elev[y * W + x0]) / ((x1 - x0) * dx)
      const gy = (elev[y1 * W + x] - elev[y0 * W + x]) / ((y1 - y0) * dy) // +y = south
      // Surface normal in (east, north, up); dz/dNorth = -gy.
      const n = 1 / Math.sqrt(gx * gx + gy * gy + 1)
      slope[i] = Math.atan(Math.sqrt(gx * gx + gy * gy)) / DEG
      aspect[i] = Math.atan2(-gx, gy) // downslope azimuth, clockwise from north
      shade[i] = Math.max(0, (-gx * L[0] + gy * L[1] + L[2]) * n)
      if (elev[i] < min) min = elev[i]
      if (elev[i] > max) max = elev[i]
    }
  }
  Object.assign(dem, { slope, aspect, shade, min, max })
  return dem
}

const pending = new Map()
export function loadDem(id, base = './dem/') {
  if (DEMS.has(id)) return Promise.resolve(DEMS.get(id))
  if (!pending.has(id)) pending.set(id, fetchDem(id, base))
  return pending.get(id)
}

async function fetchDem(id, base) {
  const [meta, demBuf, wbmBuf] = await Promise.all([
    fetch(`${base}${id}.json`).then((r) => r.json()),
    fetch(`${base}${id}.dem.bin`).then((r) => r.arrayBuffer()),
    fetch(`${base}${id}.wbm.bin`).then((r) => r.arrayBuffer()),
  ])
  const i16 = new Int16Array(demBuf)
  const elev = new Float32Array(i16.length)
  for (let i = 0; i < i16.length; i++) elev[i] = i16[i]
  const dem = derive({
    id, meta, procedural: false, W: meta.width, H: meta.height, elev,
    water: new Uint8Array(wbmBuf), bbox: meta.bbox, widthM: meta.widthM, heightM: meta.heightM,
    source: meta.source,
  })
  DEMS.set(id, dem)
  return dem
}

let theatrePending = null
export function loadTheatre(base = './theatre/') {
  if (theatre) return Promise.resolve(theatre)
  theatrePending ??= fetchTheatre(base)
  return theatrePending
}
async function fetchTheatre(base) {
  const [meta, buf] = await Promise.all([
    fetch(`${base}relief.json`).then((r) => r.json()),
    fetch(`${base}elev.bin`).then((r) => r.arrayBuffer()),
  ])
  theatre = { meta, elev: new Int16Array(buf), url: `${base}relief.png` }
  return theatre
}
export const getTheatre = () => theatre

export const getDem = (id) => DEMS.get(id) ?? null

// Real (non-procedural) DEM whose window contains the point.
export function demAt(lat, lon) {
  for (const d of DEMS.values()) {
    if (!d.procedural && lat <= d.bbox.north && lat >= d.bbox.south && lon >= d.bbox.west && lon <= d.bbox.east) return d
  }
  return null
}

// ---------- procedural fallback (same interface as a real tile) ----------
function valueNoise(rng, grid) {
  const g = new Float32Array((grid + 1) * (grid + 1)).map(() => rng())
  return (x, y) => {
    const gx = x * grid, gy = y * grid
    const x0 = Math.min(grid - 1, Math.floor(gx)), y0 = Math.min(grid - 1, Math.floor(gy))
    const tx = gx - x0, ty = gy - y0
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    const i = y0 * (grid + 1) + x0
    const a = g[i], b = g[i + 1], c = g[i + grid + 1], d = g[i + grid + 2]
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

export function proceduralDem(id, bbox, { size = 512, relief = 900, baseElev = 300 } = {}) {
  if (DEMS.has(id)) return DEMS.get(id)
  const rng = mulberry32(hashString(id))
  const octaves = [3, 6, 12, 24, 48].map((g) => valueNoise(rng, g))
  const W = size, H = size
  const elev = new Float32Array(W * H)
  const water = new Uint8Array(W * H)
  const phase = rng() * 6.28, amp = 0.08 + rng() * 0.06, rx = 0.3 + rng() * 0.4
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H
      let n = 0, a = 0.55, norm = 0
      for (let k = 0; k < octaves.length; k++) {
        const o = octaves[k](u, v)
        n += (k < 2 ? 1 - Math.abs(o * 2 - 1) : o) * a // ridged low octaves
        norm += a
        a *= 0.5
      }
      n /= norm
      const cx = rx + Math.sin(v * 4 + phase) * amp
      const d = Math.abs(u - cx)
      const valley = Math.min(1, d / 0.18)
      let h = baseElev + relief * Math.pow(n, 1.6) * (0.25 + 0.75 * valley)
      // Gentle floodplain towards the channel instead of a vertical cut.
      const bank = Math.min(1, Math.max(0, (d - 0.012) / 0.05))
      h = baseElev + (h - baseElev) * (bank * bank * (3 - 2 * bank))
      if (d < 0.012) { h = baseElev - 2; water[y * W + x] = 3 }
      elev[y * W + x] = h
    }
  }
  const midLat = (bbox.north + bbox.south) / 2
  const dem = derive({
    id, procedural: true, W, H, elev, water, bbox,
    widthM: Math.round((bbox.east - bbox.west) * 111320 * Math.cos(midLat * DEG)),
    heightM: Math.round((bbox.north - bbox.south) * 110574),
    source: 'Procedural DEM (no offline tile for this region)',
  })
  DEMS.set(id, dem)
  return dem
}

// ---------- sampling ----------
export function toFrac(dem, lat, lon) {
  const b = dem.bbox
  return [(lon - b.west) / (b.east - b.west), (b.north - lat) / (b.north - b.south)]
}
export function fromFrac(dem, fx, fy) {
  const b = dem.bbox
  return [b.north - fy * (b.north - b.south), b.west + fx * (b.east - b.west)]
}
export function sampleFrac(dem, fx, fy) {
  const x = Math.max(0, Math.min(dem.W - 1, fx * dem.W - 0.5))
  const y = Math.max(0, Math.min(dem.H - 1, fy * dem.H - 0.5))
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const x1 = Math.min(dem.W - 1, x0 + 1), y1 = Math.min(dem.H - 1, y0 + 1)
  const ax = x - x0, ay = y - y0
  const e = dem.elev, W = dem.W
  const elev = e[y0 * W + x0] * (1 - ax) * (1 - ay) + e[y0 * W + x1] * ax * (1 - ay) + e[y1 * W + x0] * (1 - ax) * ay + e[y1 * W + x1] * ax * ay
  const i = Math.round(y) * W + Math.round(x)
  return { elev, slope: dem.slope[i], water: dem.water[i], aspect: dem.aspect[i] }
}
export const sample = (dem, lat, lon) => sampleFrac(dem, ...toFrac(dem, lat, lon))

// Snap a point to the nearest dry, gentle ground (structures don't sit in rivers or on cliffs).
export function snapToLand(dem, lat, lon, maxSlope = 14) {
  let [fx, fy] = toFrac(dem, lat, lon)
  fx = Math.min(0.94, Math.max(0.06, fx))
  fy = Math.min(0.94, Math.max(0.06, fy))
  const cx = Math.round(fx * dem.W), cy = Math.round(fy * dem.H)
  const ok = (x, y) => x >= 0 && y >= 0 && x < dem.W && y < dem.H && dem.water[y * dem.W + x] === 0 && dem.slope[y * dem.W + x] < maxSlope
  for (let r = 0; r < 160; r += 2) {
    for (let a = 0; a < 16; a++) {
      const x = Math.round(cx + Math.cos((a / 16) * Math.PI * 2) * r)
      const y = Math.round(cy + Math.sin((a / 16) * Math.PI * 2) * r)
      if (ok(x, y)) return fromFrac(dem, (x + 0.5) / dem.W, (y + 0.5) / dem.H)
    }
  }
  return fromFrac(dem, fx, fy)
}

export function areaKm2(bbox) {
  const midLat = (bbox.north + bbox.south) / 2
  return ((bbox.east - bbox.west) * 111.32 * Math.cos(midLat * DEG)) * ((bbox.north - bbox.south) * 110.574)
}
