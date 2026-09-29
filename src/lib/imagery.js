// Procedural, aerial-style placeholder chips. No image files, no network.
// Every chip is deterministic for (seed, terrain, variant, sensor), so a real
// Sentinel/Cartosat chip can later replace `renderScene` with a URL lookup.
import { mulberry32 } from './rng'
import { demAt, toFrac } from './dem'
import { buildLayers } from './terrainLayers'

// Chips are cut from the DEM-derived drape of whichever offline tile contains the location.
const CHIP_M = 5200

const cache = new Map()

const PALETTES = {
  'coastal-urban': {
    optical: {
      water: [30, 44, 52], shore: [52, 66, 58], veg: [[44, 62, 42], [60, 78, 50], [74, 88, 58]],
      urban: [[112, 110, 104], [132, 128, 118], [96, 96, 94]], bare: [150, 132, 106],
      road: [168, 164, 156], roof: [[196, 190, 178], [120, 150, 172], [176, 96, 76]], snow: null,
    },
  },
  floodplain: {
    optical: {
      water: [88, 100, 96], shore: [184, 174, 146], veg: [[92, 110, 62], [118, 128, 76], [140, 138, 88]],
      urban: [[126, 120, 106], [140, 132, 116], [110, 106, 96]], bare: [170, 152, 118],
      road: [176, 166, 146], roof: [[200, 196, 184], [104, 140, 170], [150, 110, 84]], snow: null,
    },
  },
  plateau: {
    optical: {
      water: [46, 70, 86], shore: [120, 112, 96], veg: [[128, 112, 86], [146, 128, 98], [108, 94, 74]],
      urban: [[150, 140, 124], [138, 128, 112], [160, 150, 134]], bare: [176, 160, 132],
      road: [186, 176, 158], roof: [[214, 210, 200], [110, 130, 120], [170, 170, 164]], snow: [226, 228, 230],
    },
  },
}

PALETTES.alpine = PALETTES.plateau
PALETTES.foothills = PALETTES.floodplain
PALETTES.generic = PALETTES.floodplain

const SAR_PALETTE = {
  water: [10, 10, 10], shore: [70, 70, 70], veg: [[92, 92, 92], [108, 108, 108], [80, 80, 80]],
  urban: [[150, 150, 150], [170, 170, 170], [130, 130, 130]], bare: [58, 58, 58],
  road: [28, 28, 28], roof: [[245, 245, 245], [235, 235, 235], [250, 250, 250]], snow: [120, 120, 120],
}

function makeNoise(rng, grid) {
  const g = new Float32Array((grid + 1) * (grid + 1))
  for (let i = 0; i < g.length; i++) g[i] = rng()
  return (x, y) => {
    const gx = x * grid
    const gy = y * grid
    const x0 = Math.floor(gx)
    const y0 = Math.floor(gy)
    const tx = gx - x0
    const ty = gy - y0
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const i = y0 * (grid + 1) + x0
    const a = g[i], b = g[i + 1], c = g[i + grid + 1], d = g[i + grid + 2]
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

function fbm(layers, x, y) {
  let v = 0, amp = 0.5, norm = 0
  for (const n of layers) {
    v += n(x, y) * amp
    norm += amp
    amp *= 0.5
  }
  return v / norm
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`

export function changeBox(seed) {
  const r = mulberry32(seed * 7 + 3)
  const w = 0.2 + r() * 0.1
  const h = 0.18 + r() * 0.1
  return { x: 0.36 + r() * 0.12, y: 0.34 + r() * 0.12, w, h }
}

export function renderScene({ seed = 1, terrain = 'floodplain', variant = 'after', sensor = 'optical', change = 'structure', size = 256, cloud = 0, date = '', lat = null, lon = null }) {
  const key = [seed, terrain, variant, sensor, change, size, cloud, date, lat?.toFixed?.(4), lon?.toFixed?.(4)].join('|')
  if (cache.has(key)) return cache.get(key)
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const P = sensor === 'sar' ? { ...SAR_PALETTE, snow: PALETTES[terrain].optical.snow ? SAR_PALETTE.snow : null } : PALETTES[terrain].optical
  const rng = mulberry32(seed)
  const S = size

  const dem = lat != null ? demAt(lat, lon) : null
  if (dem) drawDemBase(ctx, dem, terrain, sensor, lat, lon, size, seed, date)
  else {
  // --- base land cover from fBm fields ---
  const land = [makeNoise(rng, 3), makeNoise(rng, 7), makeNoise(rng, 15), makeNoise(rng, 31)]
  const cover = [makeNoise(rng, 4), makeNoise(rng, 9), makeNoise(rng, 19)]
  const grain = [makeNoise(rng, 48), makeNoise(rng, 96)]
  const img = ctx.createImageData(size, size)
  const riverPhase = rng() * Math.PI * 2
  const riverAmp = 0.08 + rng() * 0.08
  const riverX = 0.15 + rng() * 0.2
  const dateShift = date ? (mulberry32(seed + date.length * 31 + date.charCodeAt(date.length - 1))() - 0.5) * 10 : 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const h = fbm(land, u, v)
      const c = fbm(cover, u, v)
      const gr = fbm(grain, u, v)
      let col
      if (terrain === 'floodplain') {
        const cx = riverX + Math.sin(v * 5 + riverPhase) * riverAmp
        const braid = Math.abs(u - cx) + (h - 0.5) * 0.16
        if (braid < 0.05) col = P.water
        else if (braid < 0.11) col = mix(P.shore, P.water, gr * 0.4)
        else col = c > 0.55 ? mix(P.veg[1], P.veg[2], gr) : mix(P.veg[0], P.veg[1], gr)
      } else if (terrain === 'coastal-urban') {
        if (h < 0.34) col = P.water
        else if (h < 0.38) col = P.shore
        else if (c > 0.56) col = mix(P.urban[0], P.urban[1], gr > 0.5 ? 1 : 0.2)
        else col = mix(P.veg[0], P.veg[2], Math.min(1, gr * 1.2 * (h - 0.2)))
      } else {
        const ridge = Math.abs(h - 0.5) * 2
        col = mix(P.veg[2], P.veg[1], gr)
        col = mix(col, P.veg[0], ridge)
        if (P.snow && h > 0.75) col = mix(col, P.snow, Math.min(0.7, (h - 0.75) * 5))
        const shade = (fbm(land, u + 0.01, v + 0.01) - h) * 6
        col = mix(col, [0, 0, 0], Math.max(0, Math.min(0.5, shade)))
      }
      const i = (y * size + x) * 4
      const jitter = (gr - 0.5) * 14 + dateShift
      img.data[i] = col[0] + jitter
      img.data[i + 1] = col[1] + jitter
      img.data[i + 2] = col[2] + jitter
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // --- vector features: fields, roads, settlements ---
  ctx.lineCap = 'round'
  if (terrain !== 'plateau') {
    for (let k = 0; k < 18; k++) {
      const fx = rng() * S, fy = rng() * S
      const fw = 12 + rng() * 28, fh = 8 + rng() * 22
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate((rng() - 0.5) * 0.5)
      ctx.globalAlpha = 0.25 + rng() * 0.25
      ctx.fillStyle = rgb(P.veg[Math.floor(rng() * 3)])
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
  const roadCount = terrain === 'plateau' ? 1 : 2
  for (let k = 0; k < roadCount; k++) {
    ctx.strokeStyle = rgb(P.road)
    ctx.lineWidth = Math.max(1, S / 170)
    ctx.beginPath()
    let px = rng() * S * 0.2, py = rng() * S
    ctx.moveTo(px, py)
    for (let s = 0; s < 6; s++) {
      px += S / 5
      py += (rng() - 0.5) * S * 0.3
      ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  const clusters = terrain === 'coastal-urban' ? 5 : terrain === 'floodplain' ? 3 : 1
  for (let k = 0; k < clusters; k++) {
    const cx = rng() * S, cy = rng() * S
    const inBox = changeBox(seed)
    if (Math.abs(cx / S - (inBox.x + inBox.w / 2)) < 0.2 && Math.abs(cy / S - (inBox.y + inBox.h / 2)) < 0.2) continue
    for (let b = 0; b < 8; b++) {
      ctx.fillStyle = rgb(P.roof[b % 3 === 0 ? 0 : 2])
      ctx.globalAlpha = 0.85
      const bx = cx + (rng() - 0.5) * S * 0.12, by = cy + (rng() - 0.5) * S * 0.12
      ctx.fillRect(bx, by, S / 90 + rng() * S / 90, S / 110 + rng() * S / 110)
    }
  }
  ctx.globalAlpha = 1
  }

  // --- the change itself ---
  const box = changeBox(seed)
  const bx = box.x * S, by = box.y * S, bw = box.w * S, bh = box.h * S
  const cr = mulberry32(seed * 13 + 1)
  const drawStructures = (n, palIdx) => {
    for (let b = 0; b < n; b++) {
      ctx.fillStyle = rgb(P.roof[palIdx ?? Math.floor(cr() * 2)])
      const w = bw * (0.12 + cr() * 0.14), h = bh * (0.1 + cr() * 0.12)
      ctx.fillRect(bx + cr() * (bw - w), by + cr() * (bh - h), w, h)
    }
  }
  const drawClearing = (alpha = 0.9) => {
    ctx.fillStyle = rgb(P.bare)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
      const rr = 0.42 + cr() * 0.16
      ctx.lineTo(bx + bw / 2 + Math.cos(a) * bw * rr, by + bh / 2 + Math.sin(a) * bh * rr)
    }
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
  const drawTrack = () => {
    ctx.strokeStyle = rgb(P.bare)
    ctx.lineWidth = Math.max(1, S / 200)
    ctx.setLineDash([S / 60, S / 120])
    ctx.beginPath()
    ctx.moveTo(bx + bw / 2, by + bh / 2)
    ctx.quadraticCurveTo(bx + bw * 1.4, by - bh * 0.4, S * 0.95, by - bh * 0.8)
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (change === 'removed') {
    if (variant === 'before') { drawClearing(0.6); drawStructures(6, 0) } else drawClearing(0.7)
  } else if (variant === 'after') {
    if (change === 'structure') { drawClearing(0.85); drawStructures(6); drawTrack() }
    else if (change === 'structure-noaccess') { drawStructures(4, 0) }
    else if (change === 'clearing') { drawClearing(0.95) }
    else if (change === 'track') { drawTrack(); ctx.lineWidth = S / 120; drawTrack() }
    else if (change === 'shelter') { drawStructures(5, 1) }
    else if (change === 'earthwork') {
      drawClearing(0.6)
      ctx.strokeStyle = sensor === 'sar' ? '#f2f2f2' : rgb(P.bare.map((c) => c + 30))
      ctx.lineWidth = S / 90
      ctx.beginPath()
      ctx.moveTo(bx, by + bh * 0.3); ctx.lineTo(bx + bw, by + bh * 0.2); ctx.lineTo(bx + bw * 0.95, by + bh * 0.85)
      ctx.stroke()
    } else if (change === 'water') {
      ctx.fillStyle = rgb(P.water)
      ctx.globalAlpha = 0.9
      ctx.beginPath(); ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.55, bh * 0.45, 0.3, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    } else if (change === 'disturbed') {
      drawClearing(0.7)
      for (let t = 0; t < 30; t++) {
        ctx.fillStyle = sensor === 'sar' ? '#dcdcdc' : rgb(P.road)
        ctx.fillRect(bx + cr() * bw, by + cr() * bh, S / 180, S / 180)
      }
    }
  }

  // --- sensor finish ---
  if (sensor === 'sar') {
    const d = ctx.getImageData(0, 0, S, S)
    const sr = mulberry32(seed * 3 + (variant === 'after' ? 11 : 5))
    for (let i = 0; i < d.data.length; i += 4) {
      const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11
      const speckle = dem
        ? 0.7 + 0.3 * ((-Math.log(1 - sr() * 0.98) - Math.log(1 - sr() * 0.98) - Math.log(1 - sr() * 0.98)) / 3)
        : -Math.log(1 - sr() * 0.98) * 0.9 + 0.1
      const val = Math.min(255, l * speckle)
      d.data[i] = val * 0.96; d.data[i + 1] = val * 0.98; d.data[i + 2] = val
    }
    ctx.putImageData(d, 0, 0)
  }
  if (cloud > 0 && sensor === 'optical') {
    const cn = [makeNoise(mulberry32(seed + 99 + date.length), 4), makeNoise(mulberry32(seed + 7), 9), makeNoise(mulberry32(seed + 5), 21)]
    const d = ctx.getImageData(0, 0, S, S)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fbm(cn, x / S, y / S)
      const t = Math.max(0, Math.min(1, (n - (1 - cloud) * 0.7) * 4))
      const i = (y * S + x) * 4
      d.data[i] += (232 - d.data[i]) * t
      d.data[i + 1] += (234 - d.data[i + 1]) * t
      d.data[i + 2] += (236 - d.data[i + 2]) * t
    }
    ctx.putImageData(d, 0, 0)
  }

  const url = canvas.toDataURL('image/jpeg', 0.86)
  cache.set(key, url)
  return url
}

// Cloud-mask overlay: hatched translucent regions where optical is unusable.
export function renderCloudMask({ seed = 1, coverage = 0.4, size = 256 }) {
  const key = `mask|${seed}|${coverage}|${size}`
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const cn = [makeNoise(mulberry32(seed + 99), 4), makeNoise(mulberry32(seed + 7), 9)]
  const d = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(cn, x / size, y / size)
    if (n > 1 - coverage * 0.9) {
      const i = (y * size + x) * 4
      const hatch = (x + y) % 8 < 2
      d.data[i] = 214; d.data[i + 1] = 162; d.data[i + 2] = 74
      d.data[i + 3] = hatch ? 200 : 46
    }
  }
  ctx.putImageData(d, 0, 0)
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

// Change-likelihood heatmap: sequential ramp concentrated on the detected change.
export function renderHeatmap({ seed = 1, size = 256 }) {
  const key = `heat|${seed}|${size}`
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const box = changeBox(seed)
  const r = mulberry32(seed + 404)
  const blobs = [{ x: box.x + box.w / 2, y: box.y + box.h / 2, s: 0.16, w: 1 }]
  for (let k = 0; k < 4; k++) blobs.push({ x: r(), y: r(), s: 0.05 + r() * 0.06, w: 0.25 + r() * 0.25 })
  const d = ctx.createImageData(size, size)
  const ramp = [[40, 30, 90], [150, 60, 110], [220, 120, 60], [250, 220, 120]]
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0
    for (const b of blobs) {
      const dx = x / size - b.x, dy = y / size - b.y
      v += b.w * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s))
    }
    v = Math.min(1, v)
    if (v < 0.12) continue
    const t = v * (ramp.length - 1)
    const i0 = Math.min(ramp.length - 2, Math.floor(t))
    const c = mix(ramp[i0], ramp[i0 + 1], t - i0)
    const i = (y * size + x) * 4
    d.data[i] = c[0]; d.data[i + 1] = c[1]; d.data[i + 2] = c[2]; d.data[i + 3] = Math.min(190, v * 220)
  }
  ctx.putImageData(d, 0, 0)
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

function drawDemBase(ctx, dem, terrain, sensor, lat, lon, size, seed, date) {
  const layers = buildLayers(dem, dem.terrain ?? terrain)
  const src = layers[sensor === 'sar' ? 'sar' : 'optical']
  const [fx, fy] = toFrac(dem, lat, lon)
  const win = CHIP_M / (dem.widthM / dem.W)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, fx * dem.W - win / 2, fy * dem.H - win / 2, win, win, 0, 0, size, size)
  // Sub-DEM detail so upsampled 30 m pixels read as ground texture.
  const rng = mulberry32(seed * 5 + 1)
  const n1 = makeNoise(rng, 24), n2 = makeNoise(rng, 90)
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const shift = date ? (mulberry32(seed + date.charCodeAt(date.length - 1) * 7)() - 0.5) * 8 : 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4
    const g = 0.82 + n1(x / size, y / size) * 0.16 + n2(x / size, y / size) * 0.16 + (rng() - 0.5) * 0.12
    d[i] = d[i] * g + shift; d[i + 1] = d[i + 1] * g + shift; d[i + 2] = d[i + 2] * g + shift
  }
  ctx.putImageData(img, 0, 0)
}
