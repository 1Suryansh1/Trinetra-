// GuidedTour (spotlight), DemoDirector (scripted scenario) and HelpDrawer.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../state/AppStore'
import { bus } from '../../lib/bus'
import { getPref, setPref } from '../../lib/prefs'
import { Icon } from '../ui/Icon'
import { Kbd } from '../ui/primitives'

const Ctx = createContext(null)
export const useOnboarding = () => useContext(Ctx)

// ---------------- GuidedTour ----------------
const TOUR = [
  { route: '/theatre', sel: '[data-tour="sectors"]', title: 'Pick region', text: 'Click a sector or draw a box.' },
  { route: '/workspace', sel: '[data-tour="askbar"]', title: 'Ask', text: 'Type what to find. It becomes chips.' },
  { route: '/workspace', sel: '[data-tour="pin"]', title: 'Review a pin', text: 'Evidence first. Confirm or reject.' },
  { route: '/workspace', sel: '[data-tour="step-site"]', title: 'Open site', text: 'Timeline, stage, similar sites.' },
  { route: '/workspace', sel: '[data-tour="watch"]', title: 'Save watch', text: 'New scenes checked automatically.' },
  { route: '/workspace', sel: '[data-tour="step-handoff"]', title: 'Handoff', text: 'One click: brief and tasking cue.' },
]

function useRect(sel, deps) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!sel) return
    let raf
    const tick = () => {
      const el = document.querySelector(sel)
      const r = el?.getBoundingClientRect()
      setRect((prev) => {
        if (!r) return null
        const moved = !prev || Math.abs(prev.x - r.x) + Math.abs(prev.y - r.y) + Math.abs(prev.width - r.width) + Math.abs(prev.height - r.height) > 0.5
        return moved ? { x: r.x, y: r.y, width: r.width, height: r.height } : prev
      })
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [sel, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return rect
}

function GuidedTour({ step, setStep, onEnd }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const s = TOUR[step]
  useEffect(() => { if (s && !pathname.startsWith(s.route)) nav(s.route) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  const rect = useRect(s?.sel, [step, pathname])
  if (!s) return null
  const pad = 8
  const r = rect ? { x: rect.x - pad, y: rect.y - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null
  const cardLeft = r ? Math.min(window.innerWidth - 320, Math.max(12, r.x + r.w / 2 - 150)) : window.innerWidth / 2 - 150
  const below = r ? r.y + r.h + 180 < window.innerHeight : true
  const cardTop = r ? (below ? r.y + r.h + 12 : r.y - 150) : window.innerHeight / 2 - 60
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {r ? (
        <div className="absolute border border-amber transition-all duration-300" style={{ left: r.x, top: r.y, width: r.w, height: r.h, boxShadow: '0 0 0 9999px rgba(4,6,9,0.72)' }} />
      ) : (
        <div className="absolute inset-0 bg-[rgba(4,6,9,0.72)]" />
      )}
      <div className="absolute w-[300px] panel brackets p-4 pointer-events-auto fade-in" style={{ left: cardLeft, top: cardTop }}>
        <div className="flex items-center gap-2">
          <span className="mono text-2xs text-amber">{step + 1}/{TOUR.length}</span>
          <span className="flex gap-1">{TOUR.map((_, i) => <span key={i} className={`w-4 h-0.5 ${i <= step ? 'bg-amber' : 'bg-ink-500'}`} />)}</span>
          <span className="flex-1" />
          <button onClick={onEnd} className="text-2xs text-fg-dim hover:text-fg">Skip</button>
        </div>
        <div className="text-lg text-fg-hi mt-2">{s.title}</div>
        <div className="text-sm text-fg-muted">{s.text}</div>
        <div className="flex gap-2 mt-3">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="h-8 px-3 border border-ink-500 text-xs text-fg-muted hover:text-fg">Back</button>}
          <span className="flex-1" />
          <button onClick={() => (step === TOUR.length - 1 ? onEnd() : setStep(step + 1))} className="h-8 px-4 bg-fg text-ink-900 text-xs font-medium">
            {step === TOUR.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------- DemoDirector ----------------
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function useDemoSteps() {
  const nav = useNavigate()
  const store = useStore()
  const ref = useRef(store)
  ref.current = store
  return [
    { caption: 'Pick the West Coast sector', hold: 2000, run: async () => { nav('/theatre'); await wait(500); bus.emit('theatre:select', 'SEC-W') } },
    { caption: 'Fly into Navi Mumbai · real GLO-30 terrain', hold: 3600, run: () => bus.emit('theatre:open') },
    { caption: 'Ask: cleared ground near the creek', hold: 2800, run: () => bus.emit('ws:ask', 'cleared ground within 2 km of creek since 2026') },
    { caption: 'Monsoon cloud · drape switches to SAR', hold: 2400, run: () => bus.emit('ws:date', '2026-09-27') },
    { caption: 'Open the alert', hold: 2800, run: () => bus.emit('ws:select', 'CHG-0143') },
    { caption: '2 of 3 detectors agree · confirm', hold: 2400, run: () => { const c = ref.current.changes.find((x) => x.id === 'CHG-0143'); if (c?.status === 'pending') ref.current.decide('CHG-0143', 'confirmed', 'Guided demo: SAR-first confirmation') } },
    { caption: 'Similar sites light up', hold: 2800, run: () => ref.current.confirmSite('SITE-03') },
    { caption: 'Generate the brief', hold: 3200, run: () => bus.emit('ws:brief') },
    { caption: 'Hand off the tasking cue', hold: 3200, run: () => { bus.emit('ws:closeBrief'); nav('/handoff?site=SITE-03') } },
  ]
}

function DemoBar({ idx, total, caption, paused, onPause, onNext, onExit }) {
  return (
    <div className="fixed bottom-[150px] left-1/2 -translate-x-1/2 z-[55] glass border border-amber-line brackets flex items-center h-11 fade-in">
      <span className="px-3 flex items-center gap-2 border-r border-ink-600 h-full">
        <span className={`w-2 h-2 ${paused ? 'bg-fg-dim' : 'bg-amber pulse'}`} />
        <span className="text-[10px] tracking-[0.14em] text-amber font-semibold">DEMO</span>
        <span className="mono text-2xs text-fg-dim">{idx + 1}/{total}</span>
      </span>
      <span className="px-4 text-sm text-fg-hi min-w-[320px]">{caption}</span>
      <button onClick={onPause} className="w-10 h-full border-l border-ink-600 text-fg hover:bg-ink-700 flex items-center justify-center" aria-label={paused ? 'Play' : 'Pause'}><Icon name={paused ? 'play' : 'pause'} size={14} /></button>
      <button onClick={onNext} className="w-10 h-full border-l border-ink-600 text-fg hover:bg-ink-700 flex items-center justify-center" aria-label="Next step"><Icon name="next" size={14} /></button>
      <button onClick={onExit} className="w-10 h-full border-l border-ink-600 text-fg-dim hover:text-fg flex items-center justify-center" aria-label="Exit demo"><Icon name="x" size={14} /></button>
    </div>
  )
}

function DemoDirector({ onExit }) {
  const steps = useDemoSteps()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const ranRef = useRef(-1)
  useEffect(() => {
    if (ranRef.current !== idx) { ranRef.current = idx; steps[idx]?.run() }
    if (paused) return
    const t = setTimeout(() => (idx >= steps.length - 1 ? onExit() : setIdx(idx + 1)), steps[idx]?.hold ?? 2000)
    return () => clearTimeout(t)
  }, [idx, paused]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = steps[idx]
  return (
    <DemoBar
      idx={idx} total={steps.length} caption={s?.caption} paused={paused}
      onPause={() => setPaused((p) => !p)}
      onNext={() => (idx >= steps.length - 1 ? onExit() : setIdx(idx + 1))}
      onExit={onExit}
    />
  )
}

// ---------------- HelpDrawer ----------------
const FLOW = [
  ['map', 'Pick region'], ['ask', 'Ask'], ['pin', 'Review'], ['sites', 'Site'], ['bell', 'Watch'], ['handoff', 'Handoff'],
]
const DAY = ['Open digest', 'Review top 5', 'Confirm / reject', 'Save watch', 'Send cue']
const KEYS = [['J / K', 'Next / previous'], ['C', 'Confirm'], ['R', 'Reject'], ['N', 'More data'], ['F', 'Find similar'], ['/', 'Search'], ['?', 'Help'], ['1–9', 'Screens']]

function HelpDrawer({ onClose, onTour, onDemo }) {
  const [done, setDone] = useState(() => getPref('day', []))
  const toggle = (k) => { const n = done.includes(k) ? done.filter((x) => x !== k) : [...done, k]; setDone(n); setPref('day', n) }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/60" onMouseDown={onClose}>
      <aside className="w-[440px] h-full panel border-y-0 border-r-0 flex flex-col slide-in" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center h-12 px-4 border-b border-ink-600 shrink-0">
          <span className="label text-fg-muted">How Trinetra works</span>
          <span className="flex-1" />
          <button className="text-fg-dim hover:text-fg" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </header>
        <div className="flex-1 overflow-auto p-4 space-y-6">
          <section>
            <div className="label mb-3">Flow</div>
            <div className="grid grid-cols-6 gap-0 items-start">
              {FLOW.map(([icon, l], i) => (
                <div key={l} className="flex flex-col items-center relative">
                  {i < FLOW.length - 1 && <span className="absolute top-5 left-1/2 w-full h-px bg-ink-500" />}
                  <span className="relative w-10 h-10 border border-fg-muted bg-ink-850 flex items-center justify-center text-fg-hi"><Icon name={icon} size={17} /></span>
                  <span className="mono text-[9.5px] text-amber mt-1.5">{i + 1}</span>
                  <span className="text-[10.5px] text-fg-muted text-center leading-tight">{l}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="label mb-2">A day in the life</div>
            <div className="border border-ink-600 divide-y divide-ink-600">
              {DAY.map((d, i) => (
                <label key={d} className="flex items-center gap-3 px-3 h-9 cursor-pointer hover:bg-ink-750">
                  <input type="checkbox" className="accent-[#3EB2A8]" checked={done.includes(d)} onChange={() => toggle(d)} />
                  <span className="mono text-2xs text-fg-dim">{i + 1}</span>
                  <span className={`text-sm ${done.includes(d) ? 'text-fg-dim line-through' : 'text-fg'}`}>{d}</span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <div className="label mb-2">Keys</div>
            <div className="grid grid-cols-2 gap-x-4">
              {KEYS.map(([k, d]) => (
                <div key={k} className="flex items-center justify-between h-8 border-b border-ink-600 text-xs">
                  <span className="text-fg-muted">{d}</span>
                  <span className="flex gap-1">{k.split(' / ').map((x) => <Kbd key={x}>{x}</Kbd>)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <footer className="flex gap-2 p-4 border-t border-ink-600">
          <button onClick={onTour} className="flex-1 h-9 border border-ink-500 text-sm text-fg hover:border-fg-muted flex items-center justify-center gap-2"><Icon name="pointer" size={14} />Replay tour</button>
          <button onClick={onDemo} className="flex-1 h-9 bg-fg text-ink-900 text-sm font-medium flex items-center justify-center gap-2"><Icon name="play" size={14} />Guided demo</button>
        </footer>
      </aside>
    </div>
  )
}

// ---------------- Provider ----------------
export function OnboardingProvider({ children }) {
  const [tour, setTour] = useState(() => (getPref('tourDone', false) ? null : 0))
  const [demo, setDemo] = useState(false)
  const [help, setHelp] = useState(false)
  const endTour = () => { setTour(null); setPref('tourDone', true) }
  const api = {
    openHelp: () => setHelp(true),
    toggleHelp: () => setHelp((h) => !h),
    startTour: () => { setHelp(false); setDemo(false); setTour(0) },
    startDemo: () => { setHelp(false); setTour(null); setPref('tourDone', true); setDemo(true) },
    demo,
  }
  return (
    <Ctx.Provider value={api}>
      {children}
      {tour != null && <GuidedTour step={tour} setStep={setTour} onEnd={endTour} />}
      {demo && <DemoDirector onExit={() => setDemo(false)} />}
      {help && <HelpDrawer onClose={() => setHelp(false)} onTour={api.startTour} onDemo={api.startDemo} />}
    </Ctx.Provider>
  )
}
