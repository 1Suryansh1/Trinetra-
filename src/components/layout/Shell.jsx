import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { INGEST_STATUS } from '../../data/mock'
import { useStore } from '../../state/AppStore'
import { useHotkeys } from '../../lib/useHotkeys'
import { Icon } from '../ui/Icon'
import { OnboardingProvider, useOnboarding } from '../onboarding/Onboarding'

export const NAV = [
  { to: '/theatre', label: 'Theatre', icon: 'map', key: '1' },
  { to: '/workspace', label: '3D', icon: 'cube', key: '2' },
  { to: '/ask', label: 'Ask', icon: 'ask', key: '3' },
  { to: '/review', label: 'Review', icon: 'queue', key: '4' },
  { to: '/sites', label: 'Sites', icon: 'sites', key: '5' },
  { to: '/watches', label: 'Watches', icon: 'watch', key: '6' },
  { to: '/gaps', label: 'Gaps', icon: 'gaps', key: '7' },
  { to: '/handoff', label: 'Handoff', icon: 'handoff', key: '8' },
  { to: '/audit', label: 'Audit', icon: 'audit', key: '9' },
]

const STEPS = [
  { id: 'region', label: 'Region', to: '/theatre', match: ['/theatre'] },
  { id: 'ask', label: 'Ask', to: '/workspace', match: ['/workspace', '/ask'] },
  { id: 'review', label: 'Review', to: '/review', match: ['/review'] },
  { id: 'site', label: 'Site', to: '/sites', match: ['/sites'] },
  { id: 'handoff', label: 'Handoff', to: '/handoff', match: ['/handoff'] },
]

export function Stepper() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const cur = STEPS.findIndex((s) => s.match.some((m) => pathname.startsWith(m)))
  const wrap = useRef(null)
  const [bar, setBar] = useState(null)
  useLayoutEffect(() => {
    const el = wrap.current?.querySelectorAll('button')[cur]
    setBar(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }, [cur])
  return (
    <div ref={wrap} className="relative flex items-center h-8 border border-ink-600 bg-ink-900">
      <span className="absolute bottom-0 h-[2px] bg-amber transition-all duration-500" style={{ left: bar?.left ?? 0, width: bar?.width ?? 0, opacity: bar ? 1 : 0, transitionTimingFunction: 'var(--ease-out)' }} />
      <span className="absolute top-0 bottom-0 bg-ink-700 transition-all duration-500 -z-0" style={{ left: bar?.left ?? 0, width: bar?.width ?? 0, opacity: bar ? 1 : 0, transitionTimingFunction: 'var(--ease-out)' }} />
      {STEPS.map((s, i) => {
        const active = i === cur
        const done = cur > i
        return (
          <button
            key={s.id}
            data-tour={`step-${s.id}`}
            onClick={() => nav(s.to)}
            className={`relative z-[1] h-full flex items-center gap-1.5 px-3 text-xs border-r border-ink-600 last:border-r-0 transition-colors ${active ? 'text-fg-hi' : done ? 'text-fg-muted hover:text-fg' : 'text-fg-dim hover:text-fg'}`}
          >
            <span className={`mono text-[10px] w-4 h-4 flex items-center justify-center transition-colors duration-300 ${active ? 'bg-amber text-ink-950' : done ? 'bg-ink-500 text-fg' : 'border border-ink-500'}`}>{i + 1}</span>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 pr-4 border-r border-ink-600 h-full">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#EEF2F5" strokeWidth="1.3">
        <path d="M11 2.5 20 18.5H2Z" />
        <path d="M6.2 13.2c1.3-1.6 2.9-2.4 4.8-2.4s3.5.8 4.8 2.4c-1.3 1.6-2.9 2.4-4.8 2.4s-3.5-.8-4.8-2.4Z" />
        <circle cx="11" cy="13.2" r="1.3" fill="#EEF2F5" stroke="none" />
      </svg>
      <div className="leading-none">
        <div className="text-[13px] font-semibold tracking-[0.32em] text-fg-hi">TRINETRA</div>
        <div className="text-[9px] tracking-[0.2em] text-fg-dim mt-1 hidden 2xl:block whitespace-nowrap">IMAGERY INTELLIGENCE</div>
      </div>
    </div>
  )
}

function useOutside(open, close) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => ref.current && !ref.current.contains(e.target) && close()
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open, close])
  return ref
}

function IngestChip() {
  const { newScenes, ingestRuns, runIngest } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useOutside(open, () => setOpen(false))
  const nav = useNavigate()
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 h-8 px-2.5 border border-ink-600 hover:border-ink-400 text-xs">
        <span className={`w-1.5 h-1.5 ${newScenes ? 'bg-amber pulse' : 'bg-fg-dim'}`} />
        {ingestRuns ? <span className="text-fg-muted">Ingested</span> : <span className="text-fg whitespace-nowrap"><span className="num">{newScenes}</span> new<span className="hidden 2xl:inline"> scenes</span></span>}
      </button>
      {open && (
        <div className="absolute z-40 top-10 right-0 w-[460px] panel brackets scale-in">
          <div className="px-3 py-2 border-b border-ink-600 flex items-center">
            <span className="label">Transfer volume TV-0928 · sneaker-net</span>
          </div>
          {INGEST_STATUS.map((s) => (
            <div key={s.id} className="px-3 py-2 border-b border-ink-600 text-xs">
              <div className="flex gap-2 text-fg-muted"><span>{s.sensor}</span><span className="mono">{s.aoi}</span><span className="flex-1" /><span className="mono">{s.t}</span></div>
              <div className="mono text-2xs text-fg-dim truncate mt-0.5">{s.id}</div>
            </div>
          ))}
          <div className="p-3 flex items-center gap-2">
            <span className="text-2xs text-fg-dim flex-1">Scoring runs on-prem. Analyst feedback is applied to thresholds.</span>
            <button
              disabled={ingestRuns > 0}
              onClick={() => { runIngest(); setOpen(false); nav('/review') }}
              className="h-7 px-3 border border-fg/70 bg-fg text-ink-900 text-xs font-medium disabled:opacity-40"
            >
              Run next ingest
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Bell() {
  const { notifications, readNotifications } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useOutside(open, () => setOpen(false))
  const nav = useNavigate()
  const unread = notifications.filter((n) => !n.read).length
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) setTimeout(readNotifications, 1500) }}
        className="relative w-8 h-8 flex items-center justify-center border border-ink-600 hover:border-ink-400 text-fg-muted hover:text-fg"
        aria-label="In-network alerts"
      >
        <Icon name="bell" size={15} />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-amber text-ink-900 text-[9.5px] font-semibold flex items-center justify-center num">{unread}</span>}
      </button>
      {open && (
        <div className="absolute z-40 top-10 right-0 w-[360px] panel brackets scale-in">
          <div className="px-3 py-2 border-b border-ink-600 label">In-network alerts · LAN only</div>
          {notifications.map((n) => (
            <button key={n.id} onClick={() => { nav(n.to); setOpen(false) }} className="w-full text-left px-3 py-2.5 border-b border-ink-600 last:border-0 row-hover whitespace-normal">
              <div className="flex items-center gap-2 text-2xs">
                {!n.read && <span className="w-1.5 h-1.5 bg-amber" />}
                <span className="text-fg-muted">{n.from}</span>
                <span className="flex-1" />
                <span className="mono text-fg-dim">{n.t}</span>
              </div>
              <div className="text-sm text-fg mt-0.5">{n.text}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RegionChip() {
  const { region } = useStore()
  const nav = useNavigate()
  return (
    <button onClick={() => nav('/theatre')} className="flex items-center gap-2 h-8 pl-2.5 pr-2 border border-ink-600 bg-ink-950 hover:border-ink-400 max-w-[150px] 2xl:max-w-[230px]" title="Change region">
      <Icon name="map" size={13} className="text-fg-dim shrink-0" />
      <span className="mono text-xs text-fg-hi">{region.aoi ?? region.id}</span>
      <span className="text-xs text-fg-muted truncate">{region.name}</span>
    </button>
  )
}

function RoleMenu() {
  const { role, setRole, user, session, signOut } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useOutside(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="h-8 flex items-center gap-2 pl-1 pr-2 border border-ink-600 hover:border-ink-400" title={`${user.name} · ${role}`}>
        <span className="w-6 h-6 bg-ink-600 text-fg-hi text-[10.5px] font-semibold flex items-center justify-center">{user.name.split(' ').map((p) => p[0]).join('')}</span>
        <span className="text-[10px] tracking-wider uppercase text-fg-muted">{role === 'Analyst' ? 'ANL' : 'SUP'}</span>
      </button>
      {open && (
        <div className="absolute z-40 top-10 right-0 w-[240px] panel brackets scale-in origin-top-right">
          <div className="px-3 py-2 border-b border-ink-600">
            <div className="text-sm text-fg">{user.name}</div>
            <div className="mono text-[10px] text-fg-dim">{user.id}@ws-07</div>
          </div>
          {session && (
            <div className="px-3 py-1.5 border-b border-ink-600 text-[10.5px] text-fg-dim">
              <span className="mono">{session.serviceNo}</span> · {session.method} · <span className="mono">{session.at.slice(11, 16)}Z</span>
            </div>
          )}
          {['Analyst', 'Supervisor'].map((r) => (
            <button key={r} onClick={() => { setRole(r); setOpen(false) }} className={`w-full text-left px-3 h-9 text-sm flex items-center gap-2 row-hover ${role === r ? 'text-fg-hi' : 'text-fg-muted'}`}>
              {role === r ? <Icon name="check" size={13} /> : <span className="w-[13px]" />}{r}
            </button>
          ))}
          <button onClick={() => { setOpen(false); signOut() }} className="w-full text-left px-3 h-9 text-sm flex items-center gap-2 row-hover text-rej border-t border-ink-600">
            <Icon name="lock" size={13} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function TopBar({ onHelp, onDemo, demo }) {
  const { coord, setCoord } = useStore()
  const next = { WGS84: 'MGRS', MGRS: 'IG', IG: 'WGS84' }
  return (
    <header className="h-12 shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 pl-4 pr-3 border-b border-ink-600 bg-ink-950 relative z-30">
      <div className="flex items-center gap-2.5 min-w-0 h-full">
        <Logo />
        <RegionChip />
      </div>
      <Stepper />
      <div className="flex items-center gap-2 justify-end min-w-0">
        <button onClick={onDemo} className={`h-8 px-2.5 flex items-center gap-1.5 text-xs border ${demo ? 'border-amber text-amber' : 'border-ink-600 text-fg hover:border-ink-400'}`}>
          <Icon name="play" size={12} /><span className="hidden 2xl:inline">Guided </span>Demo
        </button>
        <div className="flex items-center gap-1.5 h-8 px-2 border border-ok-line bg-ok-dim text-ok text-[10px] font-semibold tracking-[0.12em] whitespace-nowrap" title="Air-gapped: no external calls">
          <span className="w-1.5 h-1.5 bg-ok" />
          OFFLINE<span className="hidden 2xl:inline"> · NO EXTERNAL CALLS</span>
        </div>
        <IngestChip />
        <button onClick={() => setCoord(next[coord])} className="hidden 2xl:block h-8 px-2 border border-ink-600 hover:border-ink-400 text-[10px] tracking-wider text-fg-muted w-[64px]" title="Coordinate grid (WGS84 / MGRS / Indian Grid)">
          {coord === 'IG' ? 'IND GRID' : coord}
        </button>
        <RoleMenu />
        <Bell />
        <button onClick={onHelp} className="w-8 h-8 flex items-center justify-center border border-ink-600 hover:border-ink-400 text-fg-muted hover:text-fg" aria-label="Help" data-tour="help">
          <Icon name="help" size={15} />
        </button>
      </div>
    </header>
  )
}

export function LeftRail() {
  const { changes } = useStore()
  const { pathname } = useLocation()
  const pending = changes.filter((c) => c.status === 'pending').length
  const navRef = useRef(null)
  const cur = NAV.findIndex((n) => pathname.startsWith(n.to))
  const [bar, setBar] = useState(null)
  useLayoutEffect(() => {
    const el = navRef.current?.querySelectorAll('a')[cur]
    setBar(el ? { top: el.offsetTop, height: el.offsetHeight } : null)
  }, [cur])
  return (
    <nav ref={navRef} className="relative w-[68px] shrink-0 border-r border-ink-600 bg-ink-950 flex flex-col py-2">
      <span className="absolute left-1.5 right-1.5 bg-ink-750 transition-all duration-500" style={{ top: bar?.top ?? 0, height: bar?.height ?? 0, opacity: bar ? 1 : 0, transitionTimingFunction: 'var(--ease-out)' }} />
      <span className="absolute left-0 w-[2px] bg-fg-hi transition-all duration-500" style={{ top: (bar?.top ?? 0) + 6, height: Math.max(0, (bar?.height ?? 0) - 12), opacity: bar ? 1 : 0, transitionTimingFunction: 'var(--ease-out)' }} />
      {NAV.map((n) => {
        const active = pathname.startsWith(n.to)
        return (
          <NavLink
            key={n.label}
            to={n.to}
            className={`relative flex flex-col items-center gap-1 py-2 mx-1.5 my-px transition-colors duration-300 ${active ? 'text-fg-hi' : 'text-fg-dim hover:text-fg hover:bg-ink-850'}`}
          >
            <Icon name={n.icon} size={16} />
            <span className="text-[9.5px] tracking-[0.08em] uppercase">{n.label}</span>
            {n.to === '/review' && pending > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[14px] px-0.5 text-[9px] num font-semibold bg-amber text-ink-900 flex items-center justify-center">{pending}</span>
            )}
          </NavLink>
        )
      })}
      <span className="flex-1" />
      <div className="flex flex-col items-center gap-1 pb-1 text-fg-dim">
        <Icon name="lock" size={14} />
        <span className="text-[8.5px] tracking-wider">ON-PREM</span>
      </div>
    </nav>
  )
}

export function Footer() {
  const { now, audit } = useStore()
  const [t, setT] = useState(now())
  useEffect(() => {
    const i = setInterval(() => setT(now()), 1000)
    return () => clearInterval(i)
  }, [now])
  return (
    <footer className="h-6 shrink-0 flex items-center gap-4 px-3 border-t border-ink-600 bg-ink-950 text-[10.5px] text-fg-dim">
      <span className="px-1.5 border border-amber-line text-amber font-semibold tracking-[0.14em]">DEMO DATA</span>
      <span>Synthetic imagery and records · not operational</span>
      <span className="mono">trinetra 2.3.1 · bundle 2026.09-b</span>
      <span className="mono">audit #{audit.length} · {audit[audit.length - 1].hash.slice(0, 8)}</span>
      <span className="flex-1" />
      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-ok" /> 0 outbound connections</span>
      <span className="mono text-fg-muted">{t.replace('T', ' ')}</span>
    </footer>
  )
}

export function Toast() {
  const { toastMsg } = useStore()
  if (!toastMsg) return null
  return (
    <div key={toastMsg} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 panel brackets px-4 py-2 text-sm text-fg toast-in flex items-center gap-2">
      <Icon name="check" size={14} className="text-teal" />
      {toastMsg}
    </div>
  )
}

export function Shell({ children }) {
  return (
    <OnboardingProvider>
      <ShellInner>{children}</ShellInner>
    </OnboardingProvider>
  )
}

function ShellInner({ children }) {
  const nav = useNavigate()
  const ob = useOnboarding()
  const keys = {
    '?': () => ob.toggleHelp(),
    '/': () => nav('/workspace', { state: { focus: Date.now() } }),
  }
  NAV.forEach((n) => (keys[n.key] = () => nav(n.to)))
  useHotkeys(keys)
  return (
    <div className="h-full flex flex-col">
      <TopBar onHelp={ob.openHelp} onDemo={ob.startDemo} demo={ob.demo} />
      <div className="flex-1 flex min-h-0">
        <LeftRail />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</main>
      </div>
      <Footer />
      <Toast />
    </div>
  )
}
