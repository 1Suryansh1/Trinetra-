// Coordinate formatting: WGS84 decimal degrees, MGRS (WGS84 UTM), Indian Grid (Everest 1830 LCC).
// Indian Grid output ignores the Everest/WGS84 datum shift and is marked approximate in the UI.

const deg = Math.PI / 180

export function formatWGS84(lat, lon, dp = 5) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(dp)}°${ns} ${Math.abs(lon).toFixed(dp)}°${ew}`
}

function toUTM(lat, lon) {
  const a = 6378137
  const f = 1 / 298.257223563
  const k0 = 0.9996
  const e2 = f * (2 - f)
  const ep2 = e2 / (1 - e2)
  let zone = Math.floor((lon + 180) / 6) + 1
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32
  const lon0 = ((zone - 1) * 6 - 180 + 3) * deg
  const phi = lat * deg
  const lam = lon * deg
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2)
  const T = Math.tan(phi) ** 2
  const C = ep2 * Math.cos(phi) ** 2
  const A = Math.cos(phi) * (lam - lon0)
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi))
  const easting =
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000
  let northing =
    k0 *
    (M +
      N *
        Math.tan(phi) *
        (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720))
  if (lat < 0) northing += 10000000
  return { zone, easting, northing }
}

export function formatMGRS(lat, lon, digits = 5) {
  const { zone, easting, northing } = toUTM(lat, lon)
  const bands = 'CDEFGHJKLMNPQRSTUVWXX'
  const band = bands[Math.floor((lat + 80) / 8)]
  const setIdx = zone % 6 || 6
  const colSets = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ']
  const col = colSets[(setIdx - 1) % 3][Math.floor(easting / 100000) - 1]
  const rowLetters = 'ABCDEFGHJKLMNPQRSTUV'
  const rowOffset = setIdx % 2 === 0 ? 5 : 0
  const row = rowLetters[(Math.floor(northing / 100000) + rowOffset) % 20]
  const div = 10 ** (5 - digits)
  const e = String(Math.floor((easting % 100000) / div)).padStart(digits, '0')
  const n = String(Math.floor((northing % 100000) / div)).padStart(digits, '0')
  return `${zone}${band} ${col}${row} ${e} ${n}`
}

const IG_ZONES = {
  I: { lat0: 32.5, lon0: 68 },
  IIa: { lat0: 26, lon0: 74 },
  IIb: { lat0: 26, lon0: 90 },
  IIIa: { lat0: 19, lon0: 80 },
  IVa: { lat0: 12, lon0: 80 },
}

function igZone(lat, lon) {
  if (lat >= 28) return 'I'
  if (lat >= 21) return lon < 82 ? 'IIa' : 'IIb'
  if (lat >= 15) return 'IIIa'
  return 'IVa'
}

export function formatIndianGrid(lat, lon) {
  const zoneName = igZone(lat, lon)
  const { lat0, lon0 } = IG_ZONES[zoneName]
  const a = 6377276.345
  const f = 1 / 300.8017
  const e = Math.sqrt(f * (2 - f))
  const k0 = 0.99878641
  const FE = 2743195.5
  const FN = 914398.5
  const tf = (p) => Math.tan(Math.PI / 4 - p / 2) / ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2)
  const mf = (p) => Math.cos(p) / Math.sqrt(1 - e * e * Math.sin(p) ** 2)
  const p0 = lat0 * deg
  const n = Math.sin(p0)
  const F = mf(p0) / (n * tf(p0) ** n)
  const r0 = a * F * tf(p0) ** n * k0
  const r = a * F * tf(lat * deg) ** n * k0
  const theta = n * (lon - lon0) * deg
  const E = FE + r * Math.sin(theta)
  const N = FN + r0 - r * Math.cos(theta)
  return `IG ${zoneName} ${Math.round(E)}E ${Math.round(N)}N`
}

export function formatCoord(system, lat, lon) {
  if (system === 'MGRS') return formatMGRS(lat, lon)
  if (system === 'IG') return formatIndianGrid(lat, lon)
  return formatWGS84(lat, lon)
}
