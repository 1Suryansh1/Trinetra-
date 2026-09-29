// Offline boot: loads DEM tiles + theatre relief once, places mock objects on the
// terrain, then warms drape layers in idle time. Exposed as a hook so the login
// screen can show progress while the analyst signs in.
import { useEffect, useState } from 'react'
import { AOIS } from '../../data/mock'
import { placeOnDem } from '../../data/placement'
import { getDem, loadDem, loadTheatre } from '../../lib/dem'
import { buildLayers } from '../../lib/terrainLayers'

const nextFrame = () => new Promise((r) => setTimeout(r, 16))

function warmLayers() {
  const jobs = []
  for (const a of AOIS) for (const k of ['optical', 'sar', 'drainage', 'distStream', 'routeLines']) jobs.push([a, k])
  const run = () => {
    const job = jobs.shift()
    if (!job) return
    const [a, k] = job
    const dem = getDem(a.dem)
    if (dem) void buildLayers(dem, a.terrain)[k]
    ;(window.requestIdleCallback ?? ((f) => setTimeout(f, 60)))(run, { timeout: 800 })
  }
  setTimeout(run, 1200)
}

const state = { steps: [], ready: false, error: null, started: false }
const subs = new Set()
const emit = () => subs.forEach((f) => f({ ...state }))

async function start() {
  if (state.started) return
  state.started = true
  const add = (s) => { state.steps = [...state.steps, s]; emit() }
  try {
    const all = [loadTheatre(), ...AOIS.map((a) => loadDem(a.dem))]
    await all[0]
    add({ k: 'Theatre relief', v: 'Terrarium z5' })
    for (const a of AOIS) {
      const dem = await loadDem(a.dem)
      Object.assign(dem, { terrain: a.terrain, snowline: a.snowline })
      add({ k: `${a.id} DEM`, v: `GLO-30 · ${Math.round(dem.min)}–${Math.round(dem.max)} m`, aoi: a.id })
      await nextFrame()
    }
    placeOnDem()
    add({ k: 'Pins placed', v: 'snapped to terrain' })
    state.ready = true
    emit()
    warmLayers()
  } catch (e) {
    state.error = String(e)
    emit()
  }
}

export function useBoot() {
  const [s, set] = useState({ ...state })
  useEffect(() => {
    subs.add(set)
    start()
    set({ ...state })
    return () => subs.delete(set)
  }, [])
  return s
}
