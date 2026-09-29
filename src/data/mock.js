// DEMO DATA. Every record here is synthetic. Shapes mirror what the backend
// API is expected to return so screens can be wired to real endpoints later.
import { mulberry32 } from '../lib/rng'
import { getDem, snapToLand } from '../lib/dem'

export const NOW = '2026-09-28T09:42:00Z'

// Each AOI's bbox matches its offline DEM tile window (public/dem/<id>.json).
const box = (south, west, north, east) => ({ south, west, north, east })
const withGeom = (a) => ({
  ...a,
  center: [(a.bbox.north + a.bbox.south) / 2, (a.bbox.east + a.bbox.west) / 2],
  span: [(a.bbox.north - a.bbox.south) / 2, (a.bbox.east - a.bbox.west) / 2],
})

export const AOIS = [
  {
    id: 'AOI-01', name: 'Navi Mumbai', desc: 'Monsoon-cloud rehearsal area', terrain: 'coastal-urban',
    bbox: box(19.0, 72.92, 19.25, 73.17), legacyCenter: [19.033, 73.029], monsoon: true, areaKm2: 727, tiles: 7270,
    tile: 'T43QCA', relOrbit: 'R076', dem: 'AOI-01',
  },
  {
    id: 'AOI-02', name: 'Brahmaputra floodplain', desc: 'Assam · braided channel', terrain: 'floodplain',
    bbox: box(26.72, 94.02, 27.0, 94.34), legacyCenter: [26.952, 94.168], monsoon: false, areaKm2: 984, tiles: 9840,
    tile: 'T46RDR', relOrbit: 'R090', dem: 'AOI-02',
  },
  {
    id: 'AOI-03', name: 'High-altitude plateau', desc: 'Ladakh · 4,250–6,640 m', terrain: 'plateau',
    bbox: box(33.5, 78.3, 33.78, 78.62), legacyCenter: [33.618, 78.452], monsoon: false, areaKm2: 918, tiles: 9180,
    tile: 'T44SKD', relOrbit: 'R019', dem: 'AOI-03',
  },
  // ---- Northern border (GLO-30, offline) ----
  {
    id: 'AOI-04', name: 'Uri–Kupwara', desc: 'Kashmir · Jhelum valley, 1,065–4,384 m', terrain: 'alpine', group: 'Northern Border',
    bbox: box(34.05, 73.9, 34.45, 74.35), monsoon: false, areaKm2: 1832, tiles: 18320, snowline: 4050,
    tile: 'T43SDT', relOrbit: 'R005', dem: 'AOI-04',
  },
  {
    id: 'AOI-05', name: 'Kargil–Drass', desc: 'Drass and Suru valleys, 2,600–5,890 m', terrain: 'plateau', group: 'Northern Border',
    bbox: box(34.3, 75.7, 34.62, 76.2), monsoon: false, areaKm2: 1624, tiles: 16240, snowline: 5050,
    tile: 'T43SFT', relOrbit: 'R034', dem: 'AOI-05',
  },
  {
    id: 'AOI-06', name: 'Akhnoor–Samba', desc: 'Jammu · Chenab, Tawi, Shivaliks', terrain: 'foothills', group: 'Northern Border',
    bbox: box(32.5, 74.55, 32.9, 75.05), monsoon: false, areaKm2: 2072, tiles: 20720,
    tile: 'T43SDS', relOrbit: 'R034', dem: 'AOI-06',
  },
  {
    id: 'AOI-07', name: 'Amritsar–Wagah', desc: 'Punjab plains · Ravi, canals', terrain: 'floodplain', group: 'Northern Border',
    bbox: box(31.48, 74.45, 31.78, 74.85), monsoon: false, areaKm2: 1258, tiles: 12580,
    tile: 'T43RDQ', relOrbit: 'R005', dem: 'AOI-07',
  },
].map(withGeom).map((a) => ({ ...a, legacyCenter: a.legacyCenter ?? a.center }))

// Theatre sectors. Polygons are schematic working areas, not boundaries.
export const SECTORS = [
  {
    id: 'SEC-NB', name: 'Northern Border', aoi: null, aois: ['AOI-04', 'AOI-05', 'AOI-06', 'AOI-07'], ingest: '38m', labelAt: [31.6, 72.6],
    poly: [[35.0, 73.4], [35.0, 76.5], [33.9, 76.5], [32.9, 75.5], [31.9, 75.2], [30.9, 74.9], [30.9, 74.1], [31.9, 74.2], [32.6, 74.2], [33.6, 73.5]],
  },
  {
    id: 'SEC-N', name: 'Northern Highlands', aoi: 'AOI-03', ingest: '2h', labelAt: [34.9, 79.6],
    poly: [[35.1, 76.8], [35.2, 77.9], [34.4, 79.4], [32.7, 79.2], [32.4, 77.4], [33.7, 76.8]],
  },
  {
    id: 'SEC-NE', name: 'Northeast', aoi: 'AOI-02', ingest: '10h',
    poly: [[28.1, 91.8], [28.2, 95.9], [26.7, 96.3], [25.1, 94.6], [25.3, 92.0]],
  },
  {
    id: 'SEC-W', name: 'West Coast', aoi: 'AOI-01', ingest: '51m',
    poly: [[20.8, 72.5], [20.8, 74.7], [18.2, 74.9], [16.4, 73.9], [16.4, 73.0], [18.6, 72.4]],
  },
  {
    id: 'SEC-C', name: 'Central Plateau', aoi: null, ingest: '3d', terrain: 'generic',
    bbox: box(22.3, 78.2, 22.55, 78.45), relief: 900, baseElev: 420,
    poly: [[24.4, 76.8], [24.6, 81.4], [21.4, 82.0], [20.9, 77.4]],
  },
  {
    id: 'SEC-S', name: 'Southern Ghats', aoi: null, ingest: '5d', terrain: 'generic',
    bbox: box(11.35, 76.6, 11.6, 76.85), relief: 1600, baseElev: 900,
    poly: [[14.4, 75.2], [14.6, 78.6], [10.4, 78.9], [9.2, 77.2], [11.4, 75.4]],
  },
]
export const sectorById = (id) => SECTORS.find((s) => s.id === id)

export const aoiById = (id) => AOIS.find((a) => a.id === id)

export const USERS = {
  Analyst: { id: 'a.rao', name: 'A. Rao', title: 'Imagery Analyst', serviceNo: 'IC-51234K' },
  Supervisor: { id: 's.negi', name: 'S. Negi', title: 'Intelligence Officer', serviceNo: 'IC-48817M' },
}

export const CHANGE_TYPES = {
  'New structure': { key: 'structure', siteType: 'Built structure' },
  'Ground clearing': { key: 'clearing', siteType: 'Cleared ground' },
  'Track extension': { key: 'track', siteType: 'Track / route' },
  'Earthwork / berm': { key: 'earthwork', siteType: 'Earthwork' },
  'Temporary shelter': { key: 'shelter', siteType: 'Temporary shelter' },
  'Disturbed ground': { key: 'disturbed', siteType: 'Disturbed ground' },
  'Water body change': { key: 'water', siteType: 'Water body' },
  'Structure removed': { key: 'removed', siteType: 'Built structure' },
}

// ---------- scene id helpers ----------
const pad = (n, w = 2) => String(n).padStart(w, '0')
const compact = (d) => d.replaceAll('-', '')
export function s2Id(date, tile, orbit, seed = 1) {
  const r = mulberry32(seed)
  const t = `${pad(5)}${pad(Math.floor(r() * 60))}${pad(Math.floor(r() * 60))}`
  const sat = r() > 0.5 ? 'S2B' : 'S2A'
  return `${sat}_MSIL2A_${compact(date)}T${t}_N0511_${orbit}_${tile}_${compact(date)}T0915${pad(Math.floor(r() * 60))}`
}
export function s1Id(date, seed = 1) {
  const r = mulberry32(seed + 17)
  const hh = pad(Math.floor(r() * 24)), mm = pad(Math.floor(r() * 60)), ss = pad(Math.floor(r() * 50))
  const orb = String(55000 + Math.floor(r() * 900)).padStart(6, '0')
  const hex = Math.floor(r() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')
  return `S1A_IW_GRDH_1SDV_${compact(date)}T${hh}${mm}${ss}_${compact(date)}T${hh}${mm}${pad(+ss + 25)}_${orb}_${hex}_${hex.slice(0, 4)}`
}
export function eos4Id(date, seed = 1) {
  const r = mulberry32(seed + 5)
  return `EOS04_SAR_MRS_${compact(date)}_O${String(12000 + Math.floor(r() * 3000))}_L2B`
}

function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Optical + SAR looks across the last ~75 days; cloud % drives "clear look" status.
function makeLooks(seed, endDate, monsoon, tile, orbit) {
  const r = mulberry32(seed * 31)
  const looks = []
  for (let d = -75; d <= 0; d += 5) {
    const date = addDays(endDate, d)
    const cloud = monsoon ? Math.round(55 + r() * 45) : Math.round(r() < 0.35 ? 45 + r() * 50 : r() * 18)
    looks.push({ date, sensor: 'S2', cloud, usable: cloud < 20, id: s2Id(date, tile, orbit, seed + d) })
  }
  for (let d = -72; d <= 0; d += 6) {
    const date = addDays(endDate, d)
    looks.push({ date, sensor: 'S1', cloud: 0, usable: true, id: s1Id(date, seed + d) })
  }
  return looks.sort((a, b) => a.date.localeCompare(b.date))
}

// ---------- change records ----------
const RAW = [
  {
    id: 'CHG-0142', aoi: 'AOI-03', type: 'New structure', conf: 94, status: 'pending', ageH: 5, off: [0.06, -0.04],
    votes: [true, true, true], vals: ['ΔNDBI +0.21', '+5.4 dB VV', 'γ 0.81 → 0.27'],
    detected: '2026-09-27', lastClear: '2026-08-29', firstClear: '2026-09-23',
    terrain: 'Slope and shadow normalised (DEM 30 m, sun elevation 41°). Seasonal snowmelt mask applied; 3 % of footprint masked.',
    flags: [], site: 'SITE-07',
  },
  {
    id: 'CHG-0143', aoi: 'AOI-01', type: 'Ground clearing', conf: 88, status: 'pending', ageH: 9, off: [-0.05, 0.07],
    votes: [null, true, true], vals: ['No clear look · 97 % cloud', '−3.9 dB VH', 'γ 0.74 → 0.22'],
    detected: '2026-09-27', lastClear: '2026-06-02', firstClear: null,
    terrain: 'Flat terrain; no slope correction required. Tidal-water mask applied along creek edge.',
    flags: ['Activity concentrated in coverage gaps'], site: 'SITE-03',
  },
  {
    id: 'CHG-0144', aoi: 'AOI-02', type: 'Temporary shelter', conf: 58, status: 'pending', ageH: 14, off: [0.08, 0.1],
    votes: [true, false, true], vals: ['ΔNDBI +0.09', '+1.2 dB VV', 'γ 0.62 → 0.30'],
    detected: '2026-09-26', lastClear: '2026-09-06', firstClear: '2026-09-21',
    terrain: 'Floodplain; seasonal inundation mask applied from SAR water index.',
    flags: ['SAR and optical disagree'], site: 'SITE-11',
  },
  {
    id: 'CHG-0145', aoi: 'AOI-03', type: 'Track extension', conf: 91, status: 'confirmed', ageH: 30, off: [0.02, 0.09],
    votes: [true, true, true], vals: ['ΔBSI +0.14', '+3.6 dB VV', 'γ 0.77 → 0.35'],
    detected: '2026-09-26', lastClear: '2026-08-24', firstClear: '2026-09-18',
    terrain: 'Slope normalised on 18–26° hillside; terrain-shadow pixels (6 %) excluded.',
    flags: [], site: 'SITE-12',
  },
  {
    id: 'CHG-0146', aoi: 'AOI-02', type: 'Temporary shelter', conf: 52, status: 'pending', ageH: 17, off: [-0.1, 0.03],
    votes: [true, false, false], vals: ['ΔNDBI +0.08', '+0.7 dB VV', 'γ 0.58 → 0.49'],
    detected: '2026-09-26', lastClear: '2026-09-06', firstClear: '2026-09-21',
    terrain: 'Floodplain; crop-cycle phenology model applied (kharif harvest window).',
    flags: [], site: 'SITE-11',
  },
  {
    id: 'CHG-0147', aoi: 'AOI-01', type: 'New structure', conf: 72, status: 'pending', ageH: 21, off: [0.04, -0.09],
    votes: [false, true, true], vals: ['ΔNDBI +0.03 (thin cloud)', '+4.1 dB VV', 'γ 0.69 → 0.31'],
    detected: '2026-09-26', lastClear: '2026-08-12', firstClear: null,
    terrain: 'Flat terrain; urban layover corrected with building-height prior.',
    flags: ['SAR and optical disagree', 'Activity concentrated in coverage gaps'], site: 'SITE-03',
    fixedScene: 'S2B_MSIL2A_20260812T050659_N0511_R076_T43QCA_20260812T091523',
  },
  {
    id: 'CHG-0148', aoi: 'AOI-03', type: 'Earthwork / berm', conf: 83, status: 'needs-data', ageH: 40, off: [-0.08, -0.06],
    votes: [true, true, false], vals: ['ΔBSI +0.12', '+3.3 dB VV', 'γ 0.52 → 0.41'],
    detected: '2026-09-25', lastClear: '2026-08-19', firstClear: '2026-09-18',
    terrain: 'Terrain shadow on north aspect; 11 % of footprint excluded. Snowmelt corrected.',
    flags: ['Activity concentrated in coverage gaps'], site: 'SITE-07',
  },
  {
    id: 'CHG-0149', aoi: 'AOI-02', type: 'Temporary shelter', conf: 47, status: 'pending', ageH: 22, off: [0.12, -0.08],
    votes: [false, true, false], vals: ['ΔNDBI +0.04', '+3.1 dB VV', 'γ 0.60 → 0.52'],
    detected: '2026-09-26', lastClear: '2026-09-06', firstClear: '2026-09-21',
    terrain: 'Floodplain; river-braiding channel mask applied (channel shift 140 m).',
    flags: ['SAR and optical disagree'], site: 'SITE-14',
  },
  {
    id: 'CHG-0150', aoi: 'AOI-03', type: 'New structure', render: 'structure-noaccess', conf: 64, status: 'pending', ageH: 26, off: [-0.02, 0.12],
    votes: [true, true, true], vals: ['ΔNDBI +0.16', '+4.4 dB VV', 'γ 0.79 → 0.36'],
    detected: '2026-09-25', lastClear: '2026-08-29', firstClear: '2026-09-23',
    terrain: 'Slope normalised; high-albedo snow patch within 200 m masked.',
    flags: ['Evidence-consistency cue: no access track or disturbed ground around this structure'], site: 'SITE-12',
  },
  {
    id: 'CHG-0151', aoi: 'AOI-02', type: 'Water body change', conf: 41, status: 'rejected', ageH: 52, off: [-0.14, -0.1],
    votes: [true, false, false], vals: ['ΔMNDWI +0.19', '−0.8 dB VV', 'γ 0.21 → 0.18'],
    detected: '2026-09-24', lastClear: '2026-09-01', firstClear: '2026-09-16',
    terrain: 'Seasonal inundation; channel migration model applied.',
    flags: [], site: 'SITE-14',
  },
  {
    id: 'CHG-0152', aoi: 'AOI-01', type: 'Disturbed ground', conf: 69, status: 'pending', ageH: 11, off: [-0.09, -0.03],
    votes: [null, true, true], vals: ['No clear look · 91 % cloud', '+2.8 dB VV', 'γ 0.71 → 0.33'],
    detected: '2026-09-27', lastClear: '2026-06-02', firstClear: null,
    terrain: 'Flat terrain; wet-soil backscatter normalised using rainfall prior.',
    flags: [], site: 'SITE-03',
  },
  {
    id: 'CHG-0153', aoi: 'AOI-02', type: 'Temporary shelter', conf: 55, status: 'pending', ageH: 8, off: [0.03, 0.15],
    votes: [true, true, false], vals: ['ΔNDBI +0.10', '+3.4 dB VV', 'γ 0.61 → 0.44'],
    detected: '2026-09-27', lastClear: '2026-09-06', firstClear: '2026-09-21',
    terrain: 'Floodplain; crop-cycle phenology model applied.',
    flags: [], site: 'SITE-14',
  },
]

// Records that arrive on "Next ingest". Temporary shelters dominate so that
// analyst rejections of that type visibly change the next queue.
const INGEST_POOL = [
  { id: 'CHG-0154', aoi: 'AOI-02', type: 'Temporary shelter', conf: 56, ageH: 0, off: [0.15, 0.05], votes: [true, false, true], vals: ['ΔNDBI +0.09', '+1.4 dB VV', 'γ 0.63 → 0.31'], detected: '2026-09-28', lastClear: '2026-09-21', firstClear: '2026-09-26', terrain: 'Floodplain; crop-cycle phenology model applied.', flags: [], site: 'SITE-14' },
  { id: 'CHG-0155', aoi: 'AOI-02', type: 'Temporary shelter', conf: 51, ageH: 0, off: [-0.06, 0.17], votes: [true, false, false], vals: ['ΔNDBI +0.08', '+0.9 dB VV', 'γ 0.59 → 0.50'], detected: '2026-09-28', lastClear: '2026-09-21', firstClear: '2026-09-26', terrain: 'Floodplain; seasonal inundation mask applied.', flags: [], site: 'SITE-11' },
  { id: 'CHG-0156', aoi: 'AOI-03', type: 'New structure', conf: 87, ageH: 0, off: [0.1, 0.02], votes: [true, true, true], vals: ['ΔNDBI +0.18', '+4.9 dB VV', 'γ 0.80 → 0.30'], detected: '2026-09-28', lastClear: '2026-09-23', firstClear: '2026-09-28', terrain: 'Slope normalised; snowmelt mask applied.', flags: [], site: 'SITE-07' },
  { id: 'CHG-0157', aoi: 'AOI-02', type: 'Temporary shelter', conf: 49, ageH: 0, off: [0.0, -0.14], votes: [false, true, false], vals: ['ΔNDBI +0.05', '+3.0 dB VV', 'γ 0.57 → 0.49'], detected: '2026-09-28', lastClear: '2026-09-21', firstClear: '2026-09-26', terrain: 'Floodplain; river-braiding mask applied.', flags: ['SAR and optical disagree'], site: 'SITE-11' },
  { id: 'CHG-0158', aoi: 'AOI-01', type: 'Ground clearing', conf: 76, ageH: 0, off: [0.07, 0.04], votes: [null, true, true], vals: ['No clear look · 99 % cloud', '−3.1 dB VH', 'γ 0.70 → 0.28'], detected: '2026-09-28', lastClear: '2026-06-02', firstClear: null, terrain: 'Flat terrain; tidal-water mask applied.', flags: ['Activity concentrated in coverage gaps'], site: 'SITE-03' },
  { id: 'CHG-0159', aoi: 'AOI-03', type: 'Track extension', conf: 81, ageH: 0, off: [-0.12, 0.06], votes: [true, true, false], vals: ['ΔBSI +0.11', '+3.2 dB VV', 'γ 0.55 → 0.40'], detected: '2026-09-28', lastClear: '2026-09-18', firstClear: '2026-09-28', terrain: 'Slope normalised on 20° hillside.', flags: [], site: 'SITE-12' },
  { id: 'CHG-0160', aoi: 'AOI-02', type: 'Temporary shelter', conf: 53, ageH: 0, off: [-0.16, -0.02], votes: [true, true, false], vals: ['ΔNDBI +0.10', '+3.3 dB VV', 'γ 0.60 → 0.45'], detected: '2026-09-28', lastClear: '2026-09-21', firstClear: '2026-09-26', terrain: 'Floodplain; crop-cycle phenology model applied.', flags: [], site: 'SITE-14' },
]

// Northern-border alerts (synthetic, placed on the real GLO-30 terrain at boot).
const BORDER_RAW = [
  {
    id: 'CHG-0161', aoi: 'AOI-04', type: 'New structure', conf: 86, status: 'pending', ageH: 6, off: [0.05, -0.04],
    votes: [true, true, true], vals: ['ΔNDBI +0.17', '+4.6 dB VV', 'γ 0.78 → 0.30'],
    detected: '2026-09-26', lastClear: '2026-09-02', firstClear: '2026-09-21',
    terrain: 'Steep slopes normalised (28–35°); conifer-shadow mask; early snow masked above 3,900 m.',
    flags: [], site: 'SITE-31',
  },
  {
    id: 'CHG-0162', aoi: 'AOI-04', type: 'Track extension', conf: 74, status: 'pending', ageH: 19, off: [-0.06, 0.07],
    votes: [true, false, true], vals: ['ΔBSI +0.10', '+1.9 dB VV', 'γ 0.66 → 0.35'],
    detected: '2026-09-25', lastClear: '2026-08-28', firstClear: '2026-09-21',
    terrain: 'Terrain shadow on north aspects excluded (9 % of footprint).',
    flags: ['Activity concentrated in coverage gaps'], site: 'SITE-31',
  },
  {
    id: 'CHG-0163', aoi: 'AOI-05', type: 'Earthwork / berm', conf: 81, status: 'pending', ageH: 4, off: [0.03, 0.05],
    votes: [true, true, false], vals: ['ΔBSI +0.13', '+3.5 dB VV', 'γ 0.49 → 0.38'],
    detected: '2026-09-27', lastClear: '2026-09-05', firstClear: '2026-09-24',
    terrain: 'Slope and shadow normalised; snowmelt corrected on north faces.',
    flags: [], site: 'SITE-32',
  },
  {
    id: 'CHG-0164', aoi: 'AOI-05', type: 'New structure', render: 'structure-noaccess', conf: 67, status: 'pending', ageH: 28, off: [-0.04, -0.06],
    votes: [true, true, true], vals: ['ΔNDBI +0.12', '+4.0 dB VV', 'γ 0.74 → 0.37'],
    detected: '2026-09-24', lastClear: '2026-09-05', firstClear: '2026-09-19',
    terrain: 'Slope normalised; high-albedo snow patch within 300 m masked.',
    flags: ['Evidence-consistency cue: no access track or disturbed ground around this structure'], site: 'SITE-32',
  },
  {
    id: 'CHG-0165', aoi: 'AOI-06', type: 'Ground clearing', conf: 78, status: 'pending', ageH: 10, off: [0.04, -0.05],
    votes: [true, true, true], vals: ['ΔNDVI −0.22', '−3.2 dB VH', 'γ 0.71 → 0.29'],
    detected: '2026-09-26', lastClear: '2026-09-11', firstClear: '2026-09-24',
    terrain: 'Gentle slope; post-monsoon crop-cycle model applied.',
    flags: [], site: 'SITE-33',
  },
  {
    id: 'CHG-0166', aoi: 'AOI-06', type: 'Disturbed ground', conf: 58, status: 'pending', ageH: 7, off: [-0.05, 0.04],
    votes: [false, true, false], vals: ['ΔNDVI −0.05', '+2.9 dB VV', 'γ 0.58 → 0.47'],
    detected: '2026-09-27', lastClear: '2026-09-11', firstClear: '2026-09-24',
    terrain: 'Riverine sand; Chenab channel-shift mask applied.',
    flags: ['SAR and optical disagree'], site: 'SITE-33',
  },
  {
    id: 'CHG-0167', aoi: 'AOI-07', type: 'Earthwork / berm', conf: 72, status: 'pending', ageH: 5, off: [0.02, 0.06],
    votes: [true, true, false], vals: ['ΔBSI +0.09', '+3.1 dB VV', 'γ 0.55 → 0.41'],
    detected: '2026-09-27', lastClear: '2026-09-12', firstClear: '2026-09-25',
    terrain: 'Flat terrain; canal water masked; kharif harvest phenology applied.',
    flags: [], site: 'SITE-34',
  },
  {
    id: 'CHG-0168', aoi: 'AOI-07', type: 'Water body change', conf: 55, status: 'pending', ageH: 22, off: [-0.04, -0.03],
    votes: [true, false, false], vals: ['ΔMNDWI +0.16', '−0.9 dB VV', 'γ 0.33 → 0.29'],
    detected: '2026-09-25', lastClear: '2026-09-08', firstClear: '2026-09-22',
    terrain: 'Paddy flooding mask applied; residual water after irrigation.',
    flags: ['SAR and optical disagree'], site: 'SITE-34',
  },
]

const VOTE_META = [
  { key: 'optical', label: 'Optical index change', threshold: 'Δ index > 0.08', sensor: 'Sentinel-2 L2A' },
  { key: 'sar', label: 'SAR backscatter change', threshold: '|Δσ⁰| > 2.5 dB', sensor: 'Sentinel-1 / EOS-04' },
  { key: 'coherence', label: 'SAR coherence loss', threshold: 'Δγ > 0.25', sensor: 'Sentinel-1 IW SLC' },
]

function build(raw, idx, total = RAW.length) {
  const aoi = aoiById(raw.aoi)
  const seed = 1000 + parseInt(raw.id.slice(4), 10) * 17
  const monsoon = aoi.monsoon
  const looks = makeLooks(seed, raw.detected, monsoon, aoi.tile, aoi.relOrbit)
  // Make the optical record agree with the evidence bracket: clear at both ends, cloud in between.
  const cr = mulberry32(seed + 71)
  looks.forEach((l) => {
    if (l.sensor !== 'S2') return
    const inGap = l.date > raw.lastClear && (!raw.firstClear || l.date < raw.firstClear)
    if (inGap) { l.cloud = Math.max(l.cloud, Math.round(58 + cr() * 40)); l.usable = false }
    else if (raw.firstClear && l.date >= raw.firstClear) { l.cloud = Math.min(l.cloud, Math.round(3 + cr() * 12)); l.usable = true } // post-onset looks are clear
  })
  for (const d of [raw.lastClear, raw.firstClear]) {
    if (!d) continue
    const hit = looks.find((l) => l.sensor === 'S2' && l.date === d)
    if (hit) { hit.cloud = Math.round(2 + cr() * 8); hit.usable = true }
    else looks.push({ date: d, sensor: 'S2', cloud: Math.round(2 + cr() * 8), usable: true, id: s2Id(d, aoi.tile, aoi.relOrbit, seed + 9) })
  }
  looks.sort((a, b) => a.date.localeCompare(b.date))
  const gapLooks = looks.filter((l) => l.sensor === 'S2' && !l.usable && l.date > raw.lastClear && (!raw.firstClear || l.date < raw.firstClear)).length
  const votes = VOTE_META.map((m, i) => ({ ...m, pass: raw.votes[i], value: raw.vals[i] }))
  const agree = votes.filter((v) => v.pass === true).length
  const opticalW = raw.votes[0] === true ? 0.34 : 0.08
  const sarW = raw.votes[1] === true ? 0.3 : 0.1
  const cohW = raw.votes[2] === true ? 0.24 : 0.08
  const ctxW = 0.12
  const tot = opticalW + sarW + cohW + ctxW
  const breakdown = [
    { key: 'optical', label: 'Optical', v: Math.round((raw.conf * opticalW) / tot) },
    { key: 'sar', label: 'SAR σ⁰', v: Math.round((raw.conf * sarW) / tot) },
    { key: 'coherence', label: 'Coherence', v: Math.round((raw.conf * cohW) / tot) },
  ]
  breakdown.push({ key: 'context', label: 'Context', v: raw.conf - breakdown.reduce((s, b) => s + b.v, 0) })
  const beforeScene = s2Id(raw.lastClear, aoi.tile, aoi.relOrbit, seed + 1)
  const afterScene = raw.fixedScene ?? (raw.firstClear ? s2Id(raw.firstClear, aoi.tile, aoi.relOrbit, seed + 2) : null)
  const sarBefore = s1Id(addDays(raw.detected, -12), seed + 3)
  const sarAfter = s1Id(raw.detected, seed + 4)
  const gapDays = raw.firstClear
    ? Math.round((new Date(raw.firstClear) - new Date(raw.lastClear)) / 864e5)
    : Math.round((new Date(raw.detected) - new Date(raw.lastClear)) / 864e5)
  // Legacy offsets; re-projected into the DEM window and snapped to land at boot (data/placement.js).
  const lat = aoi.legacyCenter[0] + raw.off[0]
  const lon = aoi.legacyCenter[1] + raw.off[1]
  return {
    ...raw,
    terrainNote: raw.terrain,
    status: raw.status ?? 'pending',
    render: raw.render ?? CHANGE_TYPES[raw.type].key,
    siteType: CHANGE_TYPES[raw.type].siteType,
    seed, monsoon, terrain: aoi.terrain, lat, lon, looks, votes, agree, breakdown,
    areaM2: 900 + Math.round(mulberry32(seed)() * 5400),
    bracket: {
      lastClear: raw.lastClear, lastScene: beforeScene,
      firstClear: raw.firstClear, firstScene: afterScene,
      gapDays,
      gapLooks,
      firstSar: raw.detected,
    },
    scenes: [
      { role: 'Optical before', id: beforeScene },
      ...(afterScene ? [{ role: 'Optical after', id: afterScene }] : []),
      { role: 'SAR reference', id: sarBefore },
      { role: 'SAR detection', id: sarAfter },
      ...(raw.aoi === 'AOI-02' ? [{ role: 'SAR cross-check', id: eos4Id(raw.detected, seed) }] : []),
    ],
    history: [
      { t: `${raw.detected} 04:12:07Z`, step: 'Ingest', detail: `${looks.length} looks for ${aoi.tile}; checksums verified against sneaker-net manifest` },
      { t: `${raw.detected} 04:19:44Z`, step: 'Co-registration', detail: `Sub-pixel alignment, RMSE ${(0.18 + (seed % 17) / 60).toFixed(2)} px` },
      { t: `${raw.detected} 04:23:10Z`, step: 'Terrain normalisation', detail: 'Slope / shadow / snowmelt / inundation masks' },
      { t: `${raw.detected} 04:31:55Z`, step: 'Change scoring', detail: 'trinetra-cd v2.3.1 · 3 independent detectors' },
      { t: `${raw.detected} 04:32:02Z`, step: 'Queue', detail: `Ranked ${idx + 1} of ${total} by confidence × novelty` },
    ],
    footprint: 'Polygon, 5 vertices',
    mgrsTile: aoi.tile.slice(1),
  }
}

// CORE_CHANGES are the 12 alerts behind the "200 raw → 12" comparison.
export const CORE_CHANGES = RAW.map((r, i) => build(r, i))
export const CHANGES = [...CORE_CHANGES, ...BORDER_RAW.map((r, i) => build(r, i, BORDER_RAW.length))]
export const INGEST = INGEST_POOL.map((r, i) => build({ ...r, status: 'pending' }, RAW.length + i))

// ---------- sites ----------
export const SITES = [
  {
    id: 'SITE-07', name: 'Plateau compound K-7', aoi: 'AOI-03', lat: 33.678, lon: 78.412, stage: 'construction', stageConf: 86,
    changes: ['CHG-0142', 'CHG-0148'], seed: 3311,
    lifecycle: [
      { stage: 'clearing', from: '2026-06-14', to: '2026-07-20', conf: 91 },
      { stage: 'construction', from: '2026-07-20', to: null, conf: 86 },
      { stage: 'occupied', from: null, to: null, conf: null },
      { stage: 'abandoned', from: null, to: null, conf: null },
    ],
    gaps: [
      { from: '2026-07-02', to: '2026-07-14', reason: 'Snow' },
      { from: '2026-08-02', to: '2026-08-17', reason: 'Terrain shadow' },
      { from: '2026-09-04', to: '2026-09-15', reason: 'Cloud' },
    ],
    bracket: { lastWithout: '2026-06-09', firstWith: '2026-06-19' },
    decisions: [
      { who: 'S. Negi', role: 'Supervisor', action: 'Site opened', t: '2026-07-22 10:14Z', remark: 'Cleared pad consistent with prepared foundation.' },
      { who: 'A. Rao', role: 'Analyst', action: 'Confirmed CHG-0131', t: '2026-08-21 06:02Z', remark: 'Three rectilinear footprints, SAR bright returns persist across 4 passes.' },
      { who: 'K. Bora', role: 'Analyst', action: 'Needs more data CHG-0148', t: '2026-09-26 15:40Z', remark: 'Berm edge in terrain shadow; request morning pass.' },
    ],
    similar: [
      { id: 'SITE-12', name: 'Ridge track head', lat: 33.52, lon: 78.55, score: 0.88 },
      { id: 'SITE-19', name: 'Shelf pad N-2', lat: 33.74, lon: 78.29, score: 0.84 },
      { id: 'SITE-21', name: 'Valley compound V-3', lat: 33.44, lon: 78.31, score: 0.79 },
      { id: 'SITE-23', name: 'Saddle clearing S-1', lat: 33.8, lon: 78.62, score: 0.74 },
    ],
    related: [
      { id: 'SITE-12', name: 'Ridge track head', gapDays: 9, distanceKm: 14.2, relation: 'Track extension began 9 days after compound construction; heading toward K-7.' },
      { id: 'SITE-19', name: 'Shelf pad N-2', gapDays: 23, distanceKm: 21.7, relation: 'Similar clearing footprint and orientation; lagged 23 days.' },
    ],
  },
  {
    id: 'SITE-03', name: 'Creek-side clearing, Ulwe edge', aoi: 'AOI-01', lat: 19.0, lon: 73.07, stage: 'clearing', stageConf: 78,
    changes: ['CHG-0143', 'CHG-0147', 'CHG-0152'], seed: 2207,
    lifecycle: [
      { stage: 'clearing', from: '2026-07-09', to: null, conf: 78 },
      { stage: 'construction', from: null, to: null, conf: 34 },
      { stage: 'occupied', from: null, to: null, conf: null },
      { stage: 'abandoned', from: null, to: null, conf: null },
    ],
    gaps: [
      { from: '2026-06-08', to: '2026-09-27', reason: 'Cloud' },
    ],
    bracket: { lastWithout: '2026-06-02', firstWith: null },
    decisions: [
      { who: 'A. Rao', role: 'Analyst', action: 'Site opened (SAR-only)', t: '2026-08-02 08:31Z', remark: 'Monsoon mode. Coherence loss across 3 consecutive pairs.' },
    ],
    similar: [
      { id: 'SITE-04', name: 'Mudflat fill, Panvel creek', lat: 18.98, lon: 73.12, score: 0.81 },
      { id: 'SITE-05', name: 'Mangrove edge cut', lat: 19.08, lon: 72.97, score: 0.77 },
      { id: 'SITE-08', name: 'Quarry spoil pad', lat: 19.12, lon: 73.14, score: 0.72 },
      { id: 'SITE-09', name: 'Levelled plot, Kharghar', lat: 19.05, lon: 73.08, score: 0.7 },
    ],
    related: [
      { id: 'SITE-04', name: 'Mudflat fill, Panvel creek', gapDays: 12, distanceKm: 6.1, relation: 'Fill activity started 12 days later, same creek system.' },
      { id: 'SITE-08', name: 'Quarry spoil pad', gapDays: 4, distanceKm: 9.8, relation: 'Spoil volume rose within 4 days of clearing onset.' },
    ],
  },
  {
    id: 'SITE-11', name: 'Char settlement, north bank', aoi: 'AOI-02', lat: 27.03, lon: 94.2, stage: 'occupied', stageConf: 64,
    changes: ['CHG-0144', 'CHG-0146'], seed: 4410,
    lifecycle: [
      { stage: 'clearing', from: '2026-03-02', to: '2026-03-30', conf: 88 },
      { stage: 'construction', from: '2026-03-30', to: '2026-05-11', conf: 81 },
      { stage: 'occupied', from: '2026-05-11', to: null, conf: 64 },
      { stage: 'abandoned', from: null, to: null, conf: 22 },
    ],
    gaps: [{ from: '2026-06-20', to: '2026-08-08', reason: 'Cloud' }],
    bracket: { lastWithout: '2026-02-24', firstWith: '2026-03-06' },
    decisions: [
      { who: 'K. Bora', role: 'Analyst', action: 'Rejected CHG-0122', t: '2026-08-14 11:20Z', remark: 'Seasonal crop shelters; recurs every kharif.' },
    ],
    similar: [
      { id: 'SITE-14', name: 'Sandbar huts, south channel', lat: 26.95, lon: 94.18, score: 0.86 },
      { id: 'SITE-15', name: 'Char cluster C-4', lat: 26.84, lon: 94.02, score: 0.8 },
      { id: 'SITE-16', name: 'Embankment camp', lat: 27.1, lon: 94.36, score: 0.73 },
      { id: 'SITE-17', name: 'Ferry ghat clearing', lat: 26.78, lon: 94.29, score: 0.69 },
    ],
    related: [
      { id: 'SITE-14', name: 'Sandbar huts, south channel', gapDays: 6, distanceKm: 8.7, relation: 'Shelters appeared 6 days after north-bank cluster.' },
      { id: 'SITE-16', name: 'Embankment camp', gapDays: 31, distanceKm: 19.4, relation: 'Abandoned 31 days before this cluster formed.' },
    ],
  },
  {
    id: 'SITE-12', name: 'Ridge track head', aoi: 'AOI-03', lat: 33.52, lon: 78.55, stage: 'construction', stageConf: 72,
    changes: ['CHG-0145', 'CHG-0150'], seed: 5120,
    lifecycle: [
      { stage: 'clearing', from: '2026-08-01', to: '2026-08-24', conf: 84 },
      { stage: 'construction', from: '2026-08-24', to: null, conf: 72 },
      { stage: 'occupied', from: null, to: null, conf: null },
      { stage: 'abandoned', from: null, to: null, conf: null },
    ],
    gaps: [{ from: '2026-08-26', to: '2026-09-10', reason: 'Snow' }],
    bracket: { lastWithout: '2026-07-27', firstWith: '2026-08-06' },
    decisions: [{ who: 'S. Negi', role: 'Supervisor', action: 'Confirmed CHG-0145', t: '2026-09-27 07:55Z', remark: 'Track now 2.4 km, graded surface.' }],
    similar: [
      { id: 'SITE-07', name: 'Plateau compound K-7', lat: 33.678, lon: 78.412, score: 0.88 },
      { id: 'SITE-19', name: 'Shelf pad N-2', lat: 33.74, lon: 78.29, score: 0.8 },
      { id: 'SITE-24', name: 'Col approach', lat: 33.4, lon: 78.66, score: 0.75 },
      { id: 'SITE-25', name: 'Stream crossing X-2', lat: 33.58, lon: 78.7, score: 0.7 },
    ],
    related: [
      { id: 'SITE-07', name: 'Plateau compound K-7', gapDays: 9, distanceKm: 14.2, relation: 'Compound construction preceded track work by 9 days.' },
      { id: 'SITE-24', name: 'Col approach', gapDays: 17, distanceKm: 16.3, relation: 'Parallel grading on adjacent slope.' },
    ],
  },
  {
    id: 'SITE-14', name: 'Sandbar huts, south channel', aoi: 'AOI-02', lat: 26.95, lon: 94.18, stage: 'abandoned', stageConf: 58,
    changes: ['CHG-0149', 'CHG-0151', 'CHG-0153'], seed: 6021,
    lifecycle: [
      { stage: 'clearing', from: '2026-01-10', to: '2026-01-25', conf: 80 },
      { stage: 'construction', from: '2026-01-25', to: '2026-02-20', conf: 76 },
      { stage: 'occupied', from: '2026-02-20', to: '2026-06-01', conf: 70 },
      { stage: 'abandoned', from: '2026-06-01', to: null, conf: 58 },
    ],
    gaps: [{ from: '2026-06-10', to: '2026-08-20', reason: 'Cloud' }],
    bracket: { lastWithout: '2026-01-04', firstWith: '2026-01-14' },
    decisions: [{ who: 'K. Bora', role: 'Analyst', action: 'Rejected CHG-0151', t: '2026-09-26 12:18Z', remark: 'Channel migration, not a new water body.' }],
    similar: [
      { id: 'SITE-11', name: 'Char settlement, north bank', lat: 27.03, lon: 94.2, score: 0.86 },
      { id: 'SITE-15', name: 'Char cluster C-4', lat: 26.84, lon: 94.02, score: 0.78 },
      { id: 'SITE-17', name: 'Ferry ghat clearing', lat: 26.78, lon: 94.29, score: 0.71 },
      { id: 'SITE-18', name: 'Island camp I-2', lat: 27.08, lon: 94.05, score: 0.66 },
    ],
    related: [
      { id: 'SITE-11', name: 'Char settlement, north bank', gapDays: 6, distanceKm: 8.7, relation: 'Occupancy shifted north as this site went quiet.' },
      { id: 'SITE-18', name: 'Island camp I-2', gapDays: 14, distanceKm: 15.9, relation: 'Similar hut footprint appeared 14 days later.' },
    ],
  },
]
const borderSite = (id, name, aoi, changes, stage, stageConf, seed, lifecycle, gaps, bracket, decision, similar, related) => ({
  id, name, aoi, lat: 0, lon: 0, stage, stageConf, changes, seed,
  lifecycle: ['clearing', 'construction', 'occupied', 'abandoned'].map((st) => lifecycle[st] ?? { stage: st, from: null, to: null, conf: null }),
  gaps, bracket, decisions: [decision],
  similar: similar.map(([sid, sname, fx, fy, score]) => {
    const a = aoiById(aoi)
    return { id: sid, name: sname, lat: a.bbox.north - fy * (a.bbox.north - a.bbox.south), lon: a.bbox.west + fx * (a.bbox.east - a.bbox.west), score }
  }),
  related,
})

SITES.push(
  borderSite('SITE-31', 'Ridge clearing R-4', 'AOI-04', ['CHG-0161', 'CHG-0162'], 'construction', 81, 7101,
    { clearing: { stage: 'clearing', from: '2026-08-04', to: '2026-09-02', conf: 88 }, construction: { stage: 'construction', from: '2026-09-02', to: null, conf: 81 } },
    [{ from: '2026-07-06', to: '2026-07-30', reason: 'Cloud' }, { from: '2026-09-03', to: '2026-09-20', reason: 'Terrain shadow' }],
    { lastWithout: '2026-07-31', firstWith: '2026-08-09' },
    { who: 'S. Negi', role: 'Supervisor', action: 'Site opened', t: '2026-08-12 07:40Z', remark: 'Cleared bench on spur; SAR bright returns from 2 passes.' },
    [['SITE-41', 'Spur bench S-2', 0.3, 0.35, 0.83], ['SITE-42', 'Saddle pad K-1', 0.7, 0.28, 0.79], ['SITE-43', 'Nala crossing N-6', 0.62, 0.7, 0.74], ['SITE-44', 'Ridge track T-9', 0.22, 0.72, 0.7]],
    [{ id: 'SITE-41', name: 'Spur bench S-2', gapDays: 11, distanceKm: 9.4, relation: 'Similar bench cut on adjacent spur, 11 days later.' }, { id: 'SITE-43', name: 'Nala crossing N-6', gapDays: 5, distanceKm: 12.8, relation: 'Track grading started 5 days after clearing.' }]),
  borderSite('SITE-32', 'Spur pad D-2', 'AOI-05', ['CHG-0163', 'CHG-0164'], 'clearing', 76, 7202,
    { clearing: { stage: 'clearing', from: '2026-09-05', to: null, conf: 76 } },
    [{ from: '2026-09-06', to: '2026-09-18', reason: 'Snow' }],
    { lastWithout: '2026-09-05', firstWith: '2026-09-19' },
    { who: 'A. Rao', role: 'Analyst', action: 'Site opened', t: '2026-09-25 09:10Z', remark: 'Fresh spoil on south-facing spur.' },
    [['SITE-45', 'Col pad C-3', 0.35, 0.3, 0.8], ['SITE-46', 'Valley shelf V-7', 0.7, 0.62, 0.77], ['SITE-47', 'Glacis cut G-1', 0.25, 0.7, 0.72], ['SITE-48', 'Suru bank B-2', 0.78, 0.25, 0.68]],
    [{ id: 'SITE-45', name: 'Col pad C-3', gapDays: 8, distanceKm: 11.2, relation: 'Same spoil signature, 8 days apart.' }, { id: 'SITE-46', name: 'Valley shelf V-7', gapDays: 19, distanceKm: 16.5, relation: 'Earlier clearing on valley shelf.' }]),
  borderSite('SITE-33', 'Riverine earthwork C-1', 'AOI-06', ['CHG-0165', 'CHG-0166'], 'clearing', 72, 7303,
    { clearing: { stage: 'clearing', from: '2026-09-12', to: null, conf: 72 } },
    [{ from: '2026-07-01', to: '2026-09-10', reason: 'Cloud' }],
    { lastWithout: '2026-09-11', firstWith: '2026-09-24' },
    { who: 'K. Bora', role: 'Analyst', action: 'Site opened', t: '2026-09-26 11:05Z', remark: 'Clearing on river terrace after monsoon.' },
    [['SITE-49', 'Terrace cut T-2', 0.3, 0.45, 0.78], ['SITE-50', 'Nullah bund N-1', 0.6, 0.3, 0.74], ['SITE-51', 'Foothill pad F-4', 0.72, 0.62, 0.71], ['SITE-52', 'Sand bar camp S-5', 0.2, 0.25, 0.66]],
    [{ id: 'SITE-50', name: 'Nullah bund N-1', gapDays: 6, distanceKm: 7.9, relation: 'Bund raised 6 days after clearing.' }, { id: 'SITE-51', name: 'Foothill pad F-4', gapDays: 14, distanceKm: 13.3, relation: 'Similar pad on Shivalik toe.' }]),
  borderSite('SITE-34', 'Canal-side bund P-3', 'AOI-07', ['CHG-0167', 'CHG-0168'], 'construction', 69, 7404,
    { clearing: { stage: 'clearing', from: '2026-09-01', to: '2026-09-14', conf: 80 }, construction: { stage: 'construction', from: '2026-09-14', to: null, conf: 69 } },
    [{ from: '2026-07-04', to: '2026-08-28', reason: 'Cloud' }],
    { lastWithout: '2026-08-29', firstWith: '2026-09-08' },
    { who: 'S. Negi', role: 'Supervisor', action: 'Site opened', t: '2026-09-16 06:30Z', remark: 'Linear bund parallel to canal; paddy flooding nearby.' },
    [['SITE-53', 'Drain bund D-6', 0.35, 0.4, 0.75], ['SITE-54', 'Field bund F-2', 0.65, 0.55, 0.7], ['SITE-55', 'Ravi bank R-1', 0.2, 0.2, 0.68], ['SITE-56', 'Canal ramp C-4', 0.75, 0.3, 0.64]],
    [{ id: 'SITE-53', name: 'Drain bund D-6', gapDays: 9, distanceKm: 6.2, relation: 'Parallel bund 9 days later.' }, { id: 'SITE-55', name: 'Ravi bank R-1', gapDays: 21, distanceKm: 14.8, relation: 'Earlier earthwork on river bank.' }]),
)

export const siteById = (id) => SITES.find((s) => s.id === id)

// ---------- watches ----------
export const WATCHES = [
  { id: 'W-01', name: 'New structures within 5 km of plateau track', kind: 'Polygon + query', aoi: 'AOI-03', lastRun: '2026-09-28 06:10Z', hits: 3, cadence: 'Every ingest' },
  { id: 'W-02', name: 'Clearing along creek edge (SAR-first)', kind: 'Query', aoi: 'AOI-01', lastRun: '2026-09-28 05:48Z', hits: 2, cadence: 'Every SAR pass' },
  { id: 'W-03', name: 'Char land shelters, north bank', kind: 'Polygon', aoi: 'AOI-02', lastRun: '2026-09-27 22:15Z', hits: 0, cadence: 'Daily' },
  { id: 'W-04', name: 'Earthwork near stream crossings', kind: 'Custom detector', aoi: 'AOI-03', lastRun: '2026-09-27 18:02Z', hits: 1, cadence: 'Every ingest' },
]

// ---------- collection gaps ----------
const GAP_REASONS = ['Cloud', 'Snow', 'Terrain shadow', 'No pass']
export function gapGrid(aoiId, cols = 14, rows = 9) {
  const r = mulberry32(aoiId.charCodeAt(5) * 97)
  const aoi = aoiById(aoiId)
  const cells = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    let days, reason
    if (aoi.monsoon) {
      days = Math.round(40 + r() * 80)
      reason = r() < 0.9 ? 'Cloud' : 'No pass'
      if (x > cols - 4 && y < 3) { days = Math.round(6 + r() * 10); reason = 'Cloud' }
    } else if (aoi.terrain === 'plateau' || aoi.terrain === 'alpine') {
      const ridge = Math.sin(x * 0.7 + y * 0.4) + r() * 0.6
      if (ridge > 1.1) { days = Math.round(24 + r() * 30); reason = 'Snow' }
      else if (ridge > 0.6) { days = Math.round(14 + r() * 18); reason = 'Terrain shadow' }
      else { days = Math.round(2 + r() * 9); reason = r() < 0.5 ? 'Cloud' : 'No pass' }
    } else {
      days = Math.round(3 + r() * 20 + (y > 5 ? 12 : 0))
      reason = r() < 0.7 ? 'Cloud' : 'No pass'
    }
    cells.push({ x, y, days, reason, id: `${aoi.tile.slice(1)}-${String.fromCharCode(65 + y)}${String(x + 1).padStart(2, '0')}` })
  }
  return cells
}
export { GAP_REASONS }

// ---------- raw differencing comparison ----------
export const RAW_DIFF = {
  total: 200,
  trinetra: 12,
  ignored: [
    { reason: 'Snow / snowmelt', count: 61, note: 'Seasonal albedo change on north aspects' },
    { reason: 'Crop cycle', count: 48, note: 'Kharif harvest and field flooding' },
    { reason: 'River braiding', count: 34, note: 'Channel migration within active floodplain' },
    { reason: 'Terrain shadow', count: 27, note: 'Sun-angle change between looks' },
    { reason: 'Registration error', count: 18, note: 'Sub-pixel misalignment along edges' },
  ],
}

// ---------- capability envelope ----------
export const CAPABILITY = {
  byType: [
    { type: 'New structure (> 300 m²)', p: 0.91, r: 0.87, n: 412 },
    { type: 'Ground clearing (> 0.5 ha)', p: 0.88, r: 0.9, n: 356 },
    { type: 'Track extension (> 200 m)', p: 0.84, r: 0.79, n: 221 },
    { type: 'Earthwork / berm', p: 0.8, r: 0.72, n: 138 },
    { type: 'Temporary shelter', p: 0.63, r: 0.7, n: 190 },
    { type: 'Disturbed ground (proxy)', p: 0.71, r: 0.66, n: 174 },
    { type: 'Water body change', p: 0.86, r: 0.83, n: 97 },
  ],
  byTerrain: [
    { k: 'Coastal urban', p: 0.86, r: 0.82 },
    { k: 'Floodplain', p: 0.74, r: 0.8 },
    { k: 'High-altitude plateau', p: 0.87, r: 0.78 },
    { k: 'Steep slope (> 30°)', p: 0.69, r: 0.61 },
  ],
  bySensor: [
    { k: 'Optical only (Sentinel-2, 10 m)', p: 0.82, r: 0.76 },
    { k: 'SAR only (Sentinel-1 / EOS-04)', p: 0.77, r: 0.81 },
    { k: 'Optical + SAR (fused)', p: 0.9, r: 0.86 },
    { k: 'Cartosat-3 tasked (0.3 m)', p: 0.94, r: 0.9 },
  ],
  cannot: [
    ['Individual vehicles, equipment or people', 'Below 10 m ground sample distance; proxies only (disturbed ground, tracks).'],
    ['Objects under canopy or matched camouflage', 'No spectral or backscatter contrast at this resolution.'],
    ['Activity inside existing buildings', 'Roof footprint unchanged.'],
    ['Changes smaller than about 3 × 3 pixels', 'Roughly 900 m² at 10 m; below this, noise dominates.'],
    ['Short events between two clear looks', 'Leaves no persistent trace for either sensor.'],
    ['Height change without footprint change', 'No stereo or InSAR DEM differencing onboarded yet.'],
    ['Night-only or thermal signatures', 'No thermal sensor onboarded.'],
  ],
}

// ---------- digest ----------
export const DIGEST = {
  week: '2026-09-21 → 2026-09-27',
  newSites: [
    { id: 'SITE-07', label: 'Clearing → build', metric: '86%', icon: 'box', note: 'Plateau compound K-7 moved from clearing to construction' },
    { id: 'SITE-12', label: 'Track opened', metric: '2.4 km', icon: 'path', note: 'Ridge track head opened on a 2.4 km graded track' },
  ],
  quiet: [
    { id: 'SITE-14', label: 'Abandoned', metric: '6 passes', icon: 'pause', note: 'No change across 6 SAR passes; stage now abandoned (58 %)' },
    { id: 'SITE-16', label: 'No activity', metric: '31 d', icon: 'pause', note: 'Embankment camp: no activity for 31 days' },
  ],
  gaps: [
    { aoi: 'AOI-01', label: 'Cloud', metric: '82% > 60 d', icon: 'cloud', note: 'SAR-first in effect.' },
    { aoi: 'AOI-03', label: 'Shadow', metric: 'N aspects', icon: 'mountain', note: 'Morning pass recommended.' },
  ],
  stats: [
    { k: 'Confirmed', v: 7, trend: 2, good: 'up' },
    { k: 'New sites', v: 2, trend: 1, good: 'up' },
    { k: 'Gone quiet', v: 2, trend: 0, good: 'down' },
    { k: 'Gap tiles', v: '41%', trend: 6, good: 'down' },
  ],
  spark: [3, 5, 4, 7, 6, 9, 12],
}

// ---------- ingest / notifications ----------
export const INGEST_STATUS = [
  { id: s1Id('2026-09-28', 71), sensor: 'Sentinel-1A', aoi: 'AOI-01', t: '08:51Z' },
  { id: s2Id('2026-09-28', 'T44SKD', 'R019', 72), sensor: 'Sentinel-2B', aoi: 'AOI-03', t: '07:18Z' },
  { id: eos4Id('2026-09-27', 73), sensor: 'EOS-04', aoi: 'AOI-02', t: '23:40Z' },
]

export const NOTIFICATIONS = [
  { id: 'N1', t: '09:31Z', from: 'Watch W-01', text: '3 new hits: new structures within 5 km of plateau track', to: '/review' },
  { id: 'N2', t: '08:55Z', from: 'S. Negi', text: 'Please prioritise CHG-0142 before the 11:00 brief', to: '/review' },
  { id: 'N3', t: '07:02Z', from: 'Ingest', text: 'Offline bundle 2026.09-b verified and applied', to: '/audit' },
]

// ---------- audit seed ----------
export const AUDIT_SEED = [
  { ts: '2026-09-26T05:58:12Z', user: 'system', action: 'BUNDLE_APPLY', object: 'bundle 2026.09-a', detail: 'Signature verified (ed25519, key TRN-OPS-02)' },
  { ts: '2026-09-26T06:04:31Z', user: 'a.rao', action: 'LOGIN', object: 'ws-07', detail: 'Smart-card auth, role Analyst' },
  { ts: '2026-09-26T06:40:02Z', user: 'system', action: 'INGEST', object: 'T44SKD', detail: '14 looks indexed' },
  { ts: '2026-09-26T11:12:45Z', user: 'k.bora', action: 'REJECT', object: 'CHG-0151', detail: 'Channel migration, not a new water body' },
  { ts: '2026-09-26T15:40:09Z', user: 'k.bora', action: 'NEEDS_DATA', object: 'CHG-0148', detail: 'Berm edge in terrain shadow' },
  { ts: '2026-09-27T05:55:18Z', user: 's.negi', action: 'LOGIN', object: 'ws-02', detail: 'Smart-card auth, role Supervisor' },
  { ts: '2026-09-27T07:55:40Z', user: 's.negi', action: 'CONFIRM', object: 'CHG-0145', detail: 'Track now 2.4 km, graded surface' },
  { ts: '2026-09-27T08:20:03Z', user: 's.negi', action: 'EXPORT', object: 'BRIEF-0091', detail: 'PDF, provenance included' },
  { ts: '2026-09-27T18:02:11Z', user: 'system', action: 'WATCH_RUN', object: 'W-04', detail: '1 new hit' },
  { ts: '2026-09-27T23:40:57Z', user: 'system', action: 'INGEST', object: 'EOS-04 MRS', detail: '1 scene indexed (AOI-02)' },
  { ts: '2026-09-28T06:10:30Z', user: 'system', action: 'WATCH_RUN', object: 'W-01', detail: '3 new hits' },
  { ts: '2026-09-28T07:02:14Z', user: 'system', action: 'BUNDLE_APPLY', object: 'bundle 2026.09-b', detail: 'Signature verified (ed25519, key TRN-OPS-02)' },
  { ts: '2026-09-28T09:05:47Z', user: 'a.rao', action: 'LOGIN', object: 'ws-07', detail: 'Smart-card auth, role Analyst' },
]

// ---------- Ask: tile corpus ----------
export function searchCorpus(aoiFilter) {
  const r = mulberry32(777)
  const tiles = []
  AOIS.forEach((aoi, ai) => {
    if (aoiFilter && aoiFilter !== 'ALL' && aoi.id !== aoiFilter) return
    for (let i = 0; i < 12; i++) {
      const seed = 5000 + ai * 100 + i * 7
      const dateOff = Math.floor(r() * 80)
      const date = addDays('2026-09-27', -dateOff)
      const sensor = aoi.monsoon ? (r() < 0.8 ? 'S1 SAR' : 'S2 MSI') : r() < 0.7 ? 'S2 MSI' : 'S1 SAR'
      const renderKeys = ['structure', 'clearing', 'track', 'shelter', 'earthwork', 'disturbed']
      tiles.push({
        id: `${aoi.tile.slice(1)}_${String(120 + i * 13).padStart(4, '0')}_${String(40 + ai * 31 + i * 3).padStart(4, '0')}`,
        aoi: aoi.id, terrain: aoi.terrain, seed, date, sensor,
        cloud: sensor === 'S1 SAR' ? 0 : Math.round(r() * 18),
        render: renderKeys[Math.floor(r() * renderKeys.length)],
        base: 0.55 + r() * 0.42,
        visual: 0.5 + r() * 0.48,
        context: { terrain: r(), elevation: r(), road: r(), activity: r() },
        ...(() => {
          const la = aoi.center[0] + (r() - 0.5) * aoi.span[0] * 1.6
          const lo = aoi.center[1] + (r() - 0.5) * aoi.span[1] * 1.6
          const dem = getDem(aoi.dem)
          const [lat, lon] = dem ? snapToLand(dem, la, lo, 12) : [la, lo]
          return { lat, lon }
        })(),
        riverDist: r(),
      })
    }
  })
  return tiles
}
