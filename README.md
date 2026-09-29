# Trinetra

**Air-gapped satellite-imagery intelligence prototype for the Indian Army.** Trinetra watches areas of interest
in any weather and raises an alert only when the evidence holds up: three independent detectors (optical,
SAR backscatter, SAR coherence) must agree, and terrain effects are normalised out first. Analysts pick a region
on an India theatre map and fly into a 3D workspace built from real Copernicus GLO-30 elevation data. From there
they review alerts, follow site timelines, save watches and hand off tasking cues. Every decision goes into a
hash-chained audit log, and nothing leaves the machine.

Built with React 18, Tailwind 3, react-three-fiber (three.js) and Vite.
**All alerts, sites and imagery chips are synthetic (DEMO DATA). The terrain is real.**

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static bundle in dist/ (serve with `npm run preview`)
```

At runtime the app makes no off-origin requests. Fonts are bundled, DEM tiles ship in `public/`,
and a Content-Security-Policy in `index.html` blocks anything else.

## DEM data (real, offline)

| AOI | Area | Source | Relief |
| --- | --- | --- | --- |
| AOI-01 | Navi Mumbai (Thane Creek, Parsik ridge) | Copernicus GLO-30 + WBM | −10 to 487 m |
| AOI-02 | Brahmaputra floodplain (Majuli) | Copernicus GLO-30 + WBM | 76 to 122 m |
| AOI-03 | Ladakh plateau | Copernicus GLO-30 + WBM | 4,250 to 6,638 m |
| AOI-04 | Uri–Kupwara (Jhelum valley), Northern Border | Copernicus GLO-30 + WBM | 1,065 to 4,384 m |
| AOI-05 | Kargil–Drass, Northern Border | Copernicus GLO-30 + WBM | 2,597 to 5,892 m |
| AOI-06 | Akhnoor–Samba (Chenab, Tawi, Shivaliks), Northern Border | Copernicus GLO-30 + WBM | 245 to 999 m |
| AOI-07 | Amritsar–Wagah (Ravi, canals), Northern Border | Copernicus GLO-30 + WBM | 207 to 249 m |
| Theatre | India shaded relief | Terrarium tiles z5 (SRTM/GMTED) | — |

These are pre-converted once, on a connected machine, into offline heightmap tiles:

```bash
node scripts/fetch-dem.mjs         # COG range reads -> public/dem/<AOI>.dem.bin / .wbm.bin / .json (skips AOIs already converted; --force to redo)
python3 scripts/fetch_theatre.py   # -> public/theatre/relief.png + elev.bin
```

To add an AOI, add its bbox to `scripts/fetch-dem.mjs` and to `AOIS` in `src/data/mock.js`. A sector can hold
several AOIs (`aois: [...]`, as in "Northern Border"); selecting it zooms the theatre and offers an AOI picker.
No boundary line is drawn. If you need one, drape an official Survey of India boundary layer as an overlay.
Regions with no offline tile (Central Plateau, Southern Ghats, or boxes you draw elsewhere) fall back to a
**procedural DEM**. Its relief is seeded from the theatre elevation, and the UI labels it "DEM · procedural".

Everything else is derived in the browser from the DEM (`src/lib/dem.js`, `src/lib/terrainLayers.js`):
slope, aspect, hillshade, contours, D8 drainage, a SAR-like drape from local incidence angle,
the terrain-normalisation mask, least-cost "modelled routes" (not surveyed roads), and the
DEM-cut imagery chips.

## Login

The app opens on a sign-in landing page. It shows a live 3D render of the real Kargil–Drass DEM while the
offline tiles load in the background. Sign in with the **smart-card** flow (read card, then a 6-digit PIN) or
**service number + PIN**. The **Demo access** buttons skip both. This is a demo gate only: nothing is checked
against a directory, and the PIN is never stored or sent anywhere. Every sign-in and sign-out is written to the
hash-chained audit log. To integrate real authentication, plug a PKI or smart-card provider into
`authenticate()` in `src/screens/Login.jsx`.
No official insignia is used. The footer states that this is a prototype, not an official Indian Army system.

## Motion

Screen transitions, staggered list entrances, count-up numbers, sliding stepper and rail indicators, eased
theatre zoom and spring-style panels all use a shared easing curve (`--ease-out` in `src/styles/index.css`).
Animations use the individual `translate` / `scale` CSS properties, so they compose with Tailwind's centring
transforms. `prefers-reduced-motion` turns them all off.

## Flow

**Theatre → Region → 3D workspace**, with a stepper for Region › Ask › Review › Site › Handoff.

| Route | Screen |
| --- | --- |
| `#/theatre` | India relief, 5 sectors, box / polygon / circle drawing with live km² and tile count, fly-in |
| `#/workspace` | 3D DEM terrain: layers, exaggeration, pins, inspector, Ask bar, profile tool, normalise funnel, time scrubber with monsoon auto-SAR |
| `#/review` | Review queue (swipe, date scrubber, visual evidence panel); `?view=raw` opens the 200 → 12 comparison |
| `#/sites/:id`, `#/watches`, `#/gaps`, `#/handoff`, `#/audit`, `#/ask` | The earlier screens, trimmed down to cards and icons |

Onboarding: a 6-step spotlight tour on first launch; **Demo** in the top bar runs the scripted Navi Mumbai
scenario; **?** opens the help drawer (flow, daily checklist, keys).

Keys: `J/K` move · `C` confirm · `R` reject · `N` more data · `F` find similar · `/` ask · `?` help · `1–9` screens.

## Wiring a backend

- `src/data/mock.js`: API-shaped mock records. `src/state/AppStore.jsx`: one action per endpoint.
- `src/lib/dem.js`: `loadDem(id)` is the single place to swap in a tile server or GeoTIFF reader.
- `src/lib/imagery.js`: `renderScene()` is where real Sentinel/Cartosat chips replace the DEM-cut placeholders.
- Named components: `TheatreMap` (screens/Theatre, includes the region picker), `TerrainScene`, `LayerChips`, `Inspector`, `TimeScrubber`,
  `FunnelGraphic`, `CrossSection`, `GuidedTour`, `DemoDirector`, `HelpDrawer`.
