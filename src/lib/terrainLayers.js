// Builds drape textures from a DEM: optical-like, SAR-like, hillshade, slope ramp,
// contours, drainage (DEM-derived), modelled routes, coverage gaps and the
// terrain-normalisation mask. Each layer is a canvas at DEM resolution, cached per DEM.
import { mulberry32, hashString } from './rng'

const cache = new Map()

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function noiseField(W, H, seed, grids = [8, 32, 128]) {
  const out = new Float32Array(W * H)
  const rng = mulberry32(seed)
  let norm = 0
  grids.forEach((g, k) => {
    const amp = 1 / (k + 1)
    norm += amp
    const vals = new Float32Array((g + 1) * (g + 1)).map(() => rng())
    for (let y = 0; y < H; y++) {
      const gy = (y / H) * g, y0 = Math.floor(gy), ty = gy - y0, sy = ty * ty * (3 - 2 * ty)
      for (let x = 0; x < W; x++) {
        const gx = (x / W) * g, x0 = Math.floor(gx), tx = gx - x0, sx = tx * tx * (3 - 2 * tx)
        const i = y0 * (g + 1) + x0
        const a = vals[i], b = vals[i + 1], c = vals[i + g + 1], d = vals[i + g + 2]
        out[y * W + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy)
      }
    }
  })
  for (let i = 0; i < out.length; i++) out[i] /= norm
  return out
}

// Two-pass chamfer distance (pixels) from any cell where mask[i] is true.
function distanceTo(W, H, isSrc) {
  const d = new Float32Array(W * H).fill(1e9)
  for (let i = 0; i < W * H; i++) if (isSrc(i)) d[i] = 0
  const D1 = 1, D2 = 1.4142
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    if (x > 0) d[i] = Math.min(d[i], d[i - 1] + D1)
    if (y > 0) {
      d[i] = Math.min(d[i], d[i - W] + D1)
      if (x > 0) d[i] = Math.min(d[i], d[i - W - 1] + D2)
      if (x < W - 1) d[i] = Math.min(d[i], d[i - W + 1] + D2)
    }
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x
    if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + D1)
    if (y < H - 1) {
      d[i] = Math.min(d[i], d[i + W] + D1)
      if (x < W - 1) d[i] = Math.min(d[i], d[i + W + 1] + D2)
      if (x > 0) d[i] = Math.min(d[i], d[i + W - 1] + D2)
    }
  }
  return d
}

// D8 flow accumulation on a downsampled grid -> stream raster.
function streams(dem, step = 2, minCells = 900) {
  const W = Math.floor(dem.W / step), H = Math.floor(dem.H / step)
  const e = new Float32Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) e[y * W + x] = dem.elev[y * step * dem.W + x * step]
  const order = Array.from({ length: W * H }, (_, i) => i).sort((a, b) => e[b] - e[a])
  const acc = new Float32Array(W * H).fill(1)
  const to = new Int32Array(W * H).fill(-1)
  const nb = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0
    let best = -1, drop = 0
    for (const [ox, oy] of nb) {
      const nx = x + ox, ny = y + oy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      const dd = (e[i] - e[j]) / (ox && oy ? 1.414 : 1)
      if (dd > drop) { drop = dd; best = j }
    }
    to[i] = best
  }
  for (const i of order) if (to[i] >= 0) acc[to[i]] += acc[i]
  return { W, H, step, acc, to, minCells }
}

// Least-cost routes between gentle, dry anchor points (modelled, not surveyed).
function routes(dem, seed) {
  const G = 128, sx = dem.W / G, sy = dem.H / G
  const cost = new Float32Array(G * G)
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const i = Math.floor(y * sy) * dem.W + Math.floor(x * sx)
    cost[y * G + x] = 1 + (dem.slope[i] / 7) ** 2 + (dem.water[i] ? 40 : 0)
  }
  const r = mulberry32(seed)
  const pick = (fx, fy) => {
    let best = null
    for (let k = 0; k < 60; k++) {
      const x = Math.min(G - 3, Math.max(2, Math.round((fx + (r() - 0.5) * 0.25) * G)))
      const y = Math.min(G - 3, Math.max(2, Math.round((fy + (r() - 0.5) * 0.25) * G)))
      if (!best || cost[y * G + x] < cost[best[1] * G + best[0]]) best = [x, y]
    }
    return best
  }
  const anchors = [pick(0.04, 0.3), pick(0.5, 0.5), pick(0.96, 0.7), pick(0.45, 0.04), pick(0.6, 0.96)]
  const path = (a, b) => {
    const dist = new Float32Array(G * G).fill(Infinity)
    const prev = new Int32Array(G * G).fill(-1)
    const heap = [[0, a[1] * G + a[0]]]
    dist[a[1] * G + a[0]] = 0
    const target = b[1] * G + b[0]
    const push = (item) => {
      heap.push(item)
      let i = heap.length - 1
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p }
    }
    const pop = () => {
      const top = heap[0], last = heap.pop()
      if (heap.length) {
        heap[0] = last
        let i = 0
        for (;;) {
          const l = 2 * i + 1, rr = l + 1
          let m = i
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l
          if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr
          if (m === i) break
          ;[heap[m], heap[i]] = [heap[i], heap[m]]
          i = m
        }
      }
      return top
    }
    while (heap.length) {
      const [d, i] = pop()
      if (i === target) break
      if (d > dist[i]) continue
      const x = i % G, y = (i / G) | 0
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue
        const nx = x + ox, ny = y + oy
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue
        const j = ny * G + nx
        const nd = d + cost[j] * (ox && oy ? 1.414 : 1)
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push([nd, j]) }
      }
    }
    const pts = []
    for (let i = target; i >= 0; i = prev[i]) pts.push([((i % G) + 0.5) / G, (((i / G) | 0) + 0.5) / G])
    return pts.reverse()
  }
  return [path(anchors[0], anchors[1]), path(anchors[1], anchors[2]), path(anchors[3], anchors[1]), path(anchors[1], anchors[4])]
}

const PALETTE = {
  'coastal-urban': { ocean: [20, 38, 48], river: [40, 58, 62], lake: [36, 60, 70] },
  floodplain: { ocean: [30, 50, 60], river: [98, 100, 88], lake: [52, 70, 72] },
  plateau: { ocean: [30, 60, 80], river: [60, 90, 104], lake: [44, 86, 112] },
  alpine: { ocean: [30, 60, 80], river: [70, 104, 110], lake: [40, 80, 96] },
  foothills: { ocean: [30, 50, 60], river: [104, 108, 96], lake: [52, 74, 80] },
  generic: { ocean: [24, 44, 56], river: [52, 72, 80], lake: [44, 70, 84] },
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function paint(W, H, fn) {
  const c = canvas(W, H)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  for (let i = 0; i < W * H; i++) {
    const col = fn(i)
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = col[3] ?? 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export function contourInterval(dem) {
  const range = dem.max - dem.min
  const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]
  return nice.find((n) => range / n <= 24) ?? 500
}

export function buildLayers(dem, terrain = dem.terrain ?? 'generic') {
  const key = dem.id
  if (cache.has(key)) return cache.get(key)
  const { W, H, elev, water, slope, shade, aspect } = dem
  const seed = hashString(dem.id)
  // Every product is computed on first access and then cached, so opening a
  // workspace only pays for the layers actually shown.
  const memo = (fn) => { let v; return () => (v ??= fn()) }
  const N1 = memo(() => noiseField(W, H, seed, [6, 24, 96]))
  const N2 = memo(() => noiseField(W, H, seed + 7, [48, 160]))
  const DW = memo(() => distanceTo(W, H, (i) => water[i] > 0))
  const ST = memo(() => streams(dem))
  const streamAt = (i) => {
    const st = ST()
    const x = Math.floor((i % W) / st.step), y = Math.floor(i / W / st.step)
    return x < st.W && y < st.H && st.acc[y * st.W + x] > st.minCells
  }
  const DS = memo(() => distanceTo(W, H, (i) => water[i] > 0 || streamAt(i)))
  const pal = PALETTE[terrain] ?? PALETTE.generic
  const range = Math.max(1, dem.max - dem.min)

  const L = {}
  const lazy = (name, fn) => Object.defineProperty(L, name, {
    configurable: true, enumerable: true,
    get() { const v = fn(); Object.defineProperty(L, name, { value: v, enumerable: true }); return v },
  })
  lazy('optical', () => { const n1 = N1(), n2 = N2(), distWater = DW(); return paint(W, H, (i) => {
    const w = water[i], e = elev[i], s = slope[i], sh = shade[i], n = n1[i], m = n2[i]
    let c
    if (w === 1) c = mix(pal.ocean, [12, 24, 32], Math.min(1, distWater[i] / 60))
    else if (w === 2) c = pal.lake
    else if (w === 3) c = mix(pal.river, [pal.river[0] * 0.8, pal.river[1] * 0.85, pal.river[2] * 0.9], m)
    else if (terrain === 'coastal-urban') {
      const urban = e < 30 && s < 4 && n > 0.52
      if (distWater[i] < 6 && e < 4) c = [36, 56, 40] // mangrove fringe
      else if (urban) c = mix([118, 116, 110], [156, 150, 140], m)
      else if (s > 10) c = mix([34, 54, 34], [46, 66, 40], m)
      else c = mix([62, 84, 50], [92, 104, 62], n * m * 1.6)
    } else if (terrain === 'floodplain') {
      const rel = (e - dem.min) / range
      if (distWater[i] < 10 && rel < 0.25) c = mix([176, 166, 138], [196, 186, 158], m)
      else {
        const x = i % W, y = (i / W) | 0
        const jx = x + Math.round(n * 14), jy = y + Math.round(m * 10)
        const cell = mulberry32(((jx >> 3) * 73856093) ^ ((jy >> 2) * 19349663))()
        c = cell < 0.33 ? [96, 116, 64] : cell < 0.66 ? [124, 130, 74] : [146, 142, 92]
        c = mix(c, [70, 92, 56], n * 0.5)
        if (m > 0.82) c = [120, 116, 104]
      }
    } else if (terrain === 'plateau') {
      const t = (e - dem.min) / range
      c = mix([168, 150, 118], [124, 108, 88], Math.min(1, t * 1.6))
      if (s < 6) c = mix(c, [186, 172, 142], 0.5)
      const northness = Math.cos(aspect[i])
      const snowLine = (dem.snowline ?? 5750) - northness * 250 - n * 200
      if (e > snowLine) c = mix(c, [228, 231, 236], Math.min(1, (e - snowLine) / 150))
    } else if (terrain === 'alpine') {
      // valley fields / conifer forest / alpine meadow / rock / snow
      if (s < 7 && e < dem.min + 450) c = mix([108, 122, 70], [140, 134, 84], m)
      else if (e < 3200) c = mix([30, 50, 36], [44, 66, 44], n)
      else if (e < 3700) c = mix([88, 100, 66], [112, 116, 82], m)
      else c = mix([122, 116, 106], [150, 142, 128], n)
      const snowLine = (dem.snowline ?? 4100) - Math.cos(aspect[i]) * 300 - n * 180
      if (e > snowLine) c = mix(c, [226, 230, 236], Math.min(1, (e - snowLine) / 160))
      if (s < 7 && e < dem.min + 450 && m > 0.8) c = [126, 122, 112]
    } else if (terrain === 'foothills') {
      if (s < 3) {
        const x = i % W, y = (i / W) | 0
        const jx = x + Math.round(n * 12), jy = y + Math.round(m * 8)
        const cell = mulberry32(((jx >> 3) * 73856093) ^ ((jy >> 2) * 19349663))()
        c = cell < 0.33 ? [104, 118, 66] : cell < 0.66 ? [132, 128, 80] : [150, 138, 100]
        if (distWater[i] < 8) c = mix([172, 160, 132], c, distWater[i] / 8)
        if (m > 0.84) c = [128, 120, 108]
      } else c = mix([76, 90, 56], [118, 108, 80], Math.min(1, s / 25))
    } else {
      const t = (e - dem.min) / range
      c = mix([74, 92, 58], [138, 124, 96], t)
    }
    const lit = w ? 0.9 : 0.46 + 0.78 * sh
    const g = 0.92 + n2[i] * 0.16
    return [c[0] * lit * g, c[1] * lit * g, c[2] * lit * g]
  }) })

  const look = [Math.sin(37 * (Math.PI / 180)), 0, Math.cos(37 * (Math.PI / 180))] // sensor to the east
  lazy('sar', () => { const sr = mulberry32(seed + 3), n1 = N1(); return paint(W, H, (i) => {
    const w = water[i]
    // 5-look speckle: textured but readable at drape scale
    let speckle = 0
    for (let k = 0; k < 5; k++) speckle -= Math.log(1 - sr() * 0.999)
    speckle /= 5
    let v
    if (w) v = 0.04
    else {
      const s = slope[i] * (Math.PI / 180), a = aspect[i]
      const nx = Math.sin(s) * Math.sin(a), nz = Math.cos(s)
      const cosI = Math.max(0.02, nx * look[0] + nz * look[2])
      v = Math.pow(cosI, 2.2) * 0.62 + 0.1 + (n1[i] - 0.5) * 0.12
      if (terrain === 'coastal-urban' && elev[i] < 30 && slope[i] < 4 && n1[i] > 0.52) v = 0.95
    }
    const g = Math.min(255, (v * (0.55 + 0.45 * speckle)) * 185)
    return [g * 0.93, g * 0.96, g]
  }) })

  lazy('hillshade', () => paint(W, H, (i) => {
    const g = water[i] ? 22 : 26 + shade[i] * 190
    return [g * 0.95, g * 0.98, g]
  }))

  const ramp = [[0, [46, 107, 79]], [5, [127, 166, 80]], [15, [217, 196, 81]], [25, [217, 138, 61]], [35, [194, 80, 62]], [45, [122, 58, 140]]]
  lazy('slope', () => paint(W, H, (i) => {
    if (water[i]) return [22, 30, 36]
    const s = slope[i]
    let k = ramp.length - 1
    while (k > 0 && s < ramp[k][0]) k--
    const c = k === ramp.length - 1 ? ramp[k][1] : mix(ramp[k][1], ramp[k + 1][1], (s - ramp[k][0]) / (ramp[k + 1][0] - ramp[k][0]))
    const lit = 0.5 + 0.6 * shade[i]
    return [c[0] * lit, c[1] * lit, c[2] * lit]
  }))

  const ci = contourInterval(dem)
  lazy('contours', () => paint(W, H, (i) => {
    const x = i % W
    if (x === W - 1 || i + W >= W * H) return [0, 0, 0, 0]
    const a = Math.floor(elev[i] / ci), b = Math.floor(elev[i + 1] / ci), c = Math.floor(elev[i + W] / ci)
    if (a === b && a === c) return [0, 0, 0, 0]
    const idx = Math.max(a, b, c) % 5 === 0
    return idx ? [238, 226, 196, 230] : [230, 220, 200, 120]
  }))

  // Drainage: WBM water edges + D8 streams.
  lazy('drainage', () => paint(W, H, (i) => {
    if (water[i] > 1) {
      const x = i % W
      const edge = (x > 0 && !water[i - 1]) || (x < W - 1 && !water[i + 1]) || (i >= W && !water[i - W]) || (i + W < W * H && !water[i + W])
      if (edge) return [110, 190, 235, 255]
      return [70, 150, 210, 70]
    }
    if (!water[i] && streamAt(i)) return [95, 175, 225, 220]
    return [0, 0, 0, 0]
  }))

  lazy('routeLines', () => routes(dem, seed))
  lazy('distStream', DS)
  lazy('normalised', () => paint(W, H, (i) => {
    const bad = slope[i] > 28 || shade[i] < 0.2
    if (!bad || water[i]) return [0, 0, 0, 0]
    const x = i % W, y = (i / W) | 0
    return (x + y) % 7 < 2 ? [214, 162, 74, 210] : [214, 162, 74, 38]
  }))
  L.contourInterval = ci
  cache.set(key, L)
  return L
}

// Data URL of a whole-AOI layer, for 2D mini-maps.
const urlCache = new Map()
export function layerUrl(dem, terrain, name = 'optical') {
  const key = `${dem.id}|${name}`
  if (!urlCache.has(key)) urlCache.set(key, buildLayers(dem, terrain)[name].toDataURL('image/jpeg', 0.85))
  return urlCache.get(key)
}

// Buffer zone ("near river"): within `km` of water or a DEM-derived stream.
export function bufferLayer(dem, layers, km = 1) {
  const px = (km * 1000) / (dem.widthM / dem.W)
  const { W, H } = dem
  return paint(W, H, (i) => {
    const d = layers.distStream[i]
    if (d > px || dem.water[i]) return [0, 0, 0, 0]
    return d > px - 1.5 ? [62, 178, 168, 230] : [62, 178, 168, 46]
  })
}

// Cloud overlay for a given cover fraction (optical looks on cloudy dates).
const cloudCache = new Map()
export function cloudLayer(dem, cover) {
  const bucket = Math.round(cover * 10) / 10
  const key = `${dem.id}|${bucket}`
  if (cloudCache.has(key)) return cloudCache.get(key)
  const W = 256, H = 256
  const n = noiseField(W, H, hashString(dem.id) + Math.round(bucket * 10), [3, 7, 17, 41])
  const c = paint(W, H, (i) => {
    const t = Math.max(0, Math.min(1, (n[i] - (1 - bucket) * 0.62 - 0.12) * 5))
    return [236, 238, 240, t * 235]
  })
  cloudCache.set(key, c)
  return c
}

// Composite a drape texture from base + overlays + dynamic drawing.
export function composeDrape(target, dem, layers, { base = 'optical', overlays = {}, cloud = 0, gaps = null, extras = null }) {
  const S = target.width
  const ctx = target.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.globalAlpha = 1
  ctx.drawImage(layers[base], 0, 0, S, S)
  if (cloud > 0.05 && base === 'optical') ctx.drawImage(cloudLayer(dem, cloud), 0, 0, S, S)
  if (overlays.buffer) ctx.drawImage(overlays.buffer, 0, 0, S, S)
  if (overlays.contours) ctx.drawImage(layers.contours, 0, 0, S, S)
  if (overlays.drainage) {
    ctx.drawImage(layers.drainage, 0, 0, S, S)
    ctx.lineJoin = 'round'
    for (const [w, col] of [[S / 340, 'rgba(10,14,19,0.75)'], [S / 700, '#E3D9BF']]) {
      ctx.strokeStyle = col
      ctx.lineWidth = w
      for (const line of layers.routeLines) {
        ctx.beginPath()
        line.forEach(([x, y], k) => (k ? ctx.lineTo(x * S, y * S) : ctx.moveTo(x * S, y * S)))
        ctx.stroke()
      }
    }
  }
  if (overlays.gaps && gaps) {
    const cols = 14, rows = 9
    gaps.forEach((g) => {
      if (g.days <= 30) return
      const x = (g.x / cols) * S, y = (g.y / rows) * S, w = S / cols, h = S / rows
      ctx.fillStyle = `rgba(201,143,58,${Math.min(0.42, g.days / 300)})`
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = 'rgba(201,143,58,0.55)'
      ctx.lineWidth = S / 900
      ctx.beginPath()
      for (let k = -h; k < w; k += S / 90) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y) }
      ctx.save(); ctx.rect(x, y, w, h); ctx.clip(); ctx.stroke(); ctx.restore()
    })
  }
  if (overlays.normalised) ctx.drawImage(layers.normalised, 0, 0, S, S)
  // AOI boundary
  ctx.strokeStyle = 'rgba(238,242,245,0.85)'
  ctx.lineWidth = S / 500
  ctx.setLineDash([S / 80, S / 120])
  ctx.strokeRect(S * 0.01, S * 0.01, S * 0.98, S * 0.98)
  ctx.setLineDash([])
  extras?.(ctx, S)
  return target
}
