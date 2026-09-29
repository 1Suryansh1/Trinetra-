// Login landing. A demo gate only: nothing is verified against a real directory and
// no PIN is stored or transmitted. Real deployments plug a smart-card / PKI provider
// into `authenticate()`.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { USERS } from '../data/mock'
import { useStore } from '../state/AppStore'
import { getDem, getTheatre } from '../lib/dem'
import { buildLayers } from '../lib/terrainLayers'
import { buildGeometry, buildSkirt, sceneDims } from '../components/workspace/TerrainScene'
import { Icon } from '../components/ui/Icon'
import { CountUp } from '../components/ui/primitives'

const HERO_DEM = 'AOI-05' // Kargil–Drass

// ---------------- backdrop ----------------
function Orbit({ d, leaving }) {
  const { camera } = useThree()
  const t0 = useRef(performance.now())
  const leave = useRef(null)
  useEffect(() => { if (leaving) leave.current = performance.now() }, [leaving])
  useFrame(() => {
    const t = (performance.now() - t0.current) / 1000
    const intro = Math.min(1, t / 5)
    const e = 1 - Math.pow(1 - intro, 3)
    const a = -0.6 + t * 0.035
    let r = d.Du * (1.25 - 0.4 * e)
    let h = d.Du * (0.95 - 0.5 * e)
    if (leave.current) {
      const k = Math.min(1, (performance.now() - leave.current) / 900)
      const ke = k * k * (3 - 2 * k)
      r *= 1 - 0.55 * ke
      h *= 1 - 0.35 * ke
    }
    camera.position.set(Math.sin(a) * r, h, Math.cos(a) * r)
    camera.lookAt(0, d.Du * 0.02, 0)
  })
  return null
}

function HeroTerrain({ dem, leaving }) {
  const d = useMemo(() => sceneDims(dem), [dem])
  const geom = useMemo(() => buildGeometry(dem, d, 255), [dem, d])
  const skirt = useMemo(() => buildSkirt(dem, d, 128, 3), [dem, d])
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(buildLayers(dem, dem.terrain).optical)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [dem])
  useEffect(() => () => { geom.dispose(); skirt.dispose(); tex.dispose() }, [geom, skirt, tex])
  return (
    <Canvas camera={{ fov: 34, near: 0.5, far: 1500, position: [0, 120, 120] }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <color attach="background" args={['#07090C']} />
      <fog attach="fog" args={['#07090C', 90, 260]} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[-70, 80, -40]} intensity={1.5} />
      <group scale={[1, 1.35, 1]}>
        <mesh geometry={geom}><meshLambertMaterial map={tex} /></mesh>
        <mesh geometry={skirt}><meshLambertMaterial color="#10161D" side={THREE.DoubleSide} /></mesh>
      </group>
      <gridHelper args={[500, 50, '#18212B', '#10161D']} position={[0, -4, 0]} />
      <Orbit d={d} leaving={leaving} />
    </Canvas>
  )
}

function Backdrop({ ready, leaving }) {
  const dem = ready ? getDem(HERO_DEM) : null
  const relief = getTheatre()?.url
  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-950">
      {relief && (
        <img src={relief} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 drift" style={{ objectPosition: '30% 12%' }} />
      )}
      {dem && <div className="absolute inset-0 appear" style={{ animationDuration: '1.6s' }}><HeroTerrain dem={dem} leaving={leaving} /></div>}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 220px 60px #07090C' }} />
      <div className="absolute inset-0 pointer-events-none gridlines opacity-[0.18]" style={{ backgroundColor: 'transparent' }} />
    </div>
  )
}

// ---------------- inputs ----------------
function PinInput({ value, onChange, autoFocus, onEnter }) {
  const ref = useRef(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        inputMode="numeric"
        autoComplete="off"
        aria-label="6-digit PIN"
        className="absolute inset-0 opacity-0 cursor-text"
        maxLength={6}
      />
      <div className="grid grid-cols-6 gap-2 pointer-events-none">
        {Array.from({ length: 6 }, (_, i) => {
          const filled = i < value.length
          const active = i === Math.min(value.length, 5) && document.activeElement === ref.current
          return (
            <span key={i} className={`h-11 border flex items-center justify-center transition-colors ${active ? 'border-fg-hi' : filled ? 'border-fg-muted' : 'border-ink-500'} bg-ink-950/70`}>
              {filled && <span className="w-2 h-2 bg-fg-hi pop" />}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function CardReader({ state }) {
  return (
    <div className="relative h-[88px] border border-ink-600 bg-ink-950/60 flex items-center justify-center overflow-hidden">
      <svg width="170" height="64" viewBox="0 0 170 64" fill="none">
        <rect x="18" y="38" width="134" height="20" stroke="#3A4958" />
        <rect x="30" y="44" width="110" height="3" fill="#1F2A35" />
        <g className={state === 'idle' ? 'card-hover' : 'card-in'} style={{ transformBox: 'fill-box' }}>
          <rect x="45" y="4" width="80" height="48" fill="#141B23" stroke={state === 'read' ? '#3EB2A8' : '#8C99A7'} />
          <rect x="54" y="14" width="14" height="11" stroke="#D6A24A" />
          <path d="M54 34h40M54 40h26" stroke="#3A4958" />
        </g>
        <circle cx="140" cy="48" r="2.5" fill={state === 'read' ? '#3EB2A8' : state === 'reading' ? '#D6A24A' : '#3A4958'} className={state === 'reading' ? 'pulse' : ''} />
      </svg>
      {state === 'reading' && <span className="absolute bottom-0 left-0 h-0.5 bg-amber reader-bar" />}
    </div>
  )
}

const AUTH_STEPS = ['Verifying certificate', 'Checking revocation list (offline)', 'Opening audited session']

// ---------------- login card ----------------
function LoginCard({ bootReady, onDone }) {
  const [role, setRole] = useState('Analyst')
  const [method, setMethod] = useState('card')
  const [card, setCard] = useState('idle') // idle | reading | read
  const [serviceNo, setServiceNo] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [auth, setAuth] = useState(-1) // -1 idle, 0..n steps, n = granted
  const user = USERS[role]

  useEffect(() => { setCard('idle'); setPin(''); setError(null) }, [role, method])

  const readCard = () => {
    setCard('reading')
    setTimeout(() => setCard('read'), 1100)
  }

  const authenticate = (opts = {}) => {
    const m = opts.method ?? method
    const sn = (opts.serviceNo ?? (m === 'card' ? user.serviceNo : serviceNo)).toUpperCase()
    const p = opts.pin ?? pin
    if (m === 'card' && card !== 'read' && !opts.demo) return setError('Insert and read your card first')
    if (m === 'service' && !/^[A-Z]{1,3}-?\d{4,6}[A-Z]?$/.test(sn)) return setError('Check service number, e.g. IC-51234K')
    if (!/^\d{6}$/.test(p)) return setError('PIN must be 6 digits')
    setError(null)
    let i = 0
    setAuth(0)
    const tick = () => {
      i++
      setAuth(i)
      if (i < AUTH_STEPS.length) setTimeout(tick, 420)
      else onDone({ role: opts.role ?? role, method: m === 'card' ? 'Smart-card auth' : 'Service no. + PIN', serviceNo: sn })
    }
    setTimeout(tick, 420)
  }

  const demo = (r) => {
    setRole(r)
    setMethod('card')
    setCard('read')
    setPin('123456')
    setTimeout(() => authenticate({ role: r, method: 'card', serviceNo: USERS[r].serviceNo, pin: '123456', demo: true }), 60)
  }

  const busy = auth >= 0
  const granted = auth >= AUTH_STEPS.length

  return (
    <div className="w-[400px] glass border border-ink-500 brackets rise" style={{ '--i': 3 }}>
      <div className="px-6 pt-6 pb-4 border-b border-ink-600">
        <div className="flex items-center gap-2">
          <Icon name="lock" size={14} className="text-fg-muted" />
          <span className="label text-fg-muted">Secure sign-in</span>
          <span className="flex-1" />
          <span className="mono text-[10px] text-fg-dim">ws-07 · LAN</span>
        </div>
        <div className="text-[22px] font-light text-fg-hi mt-3 leading-tight">Sign in</div>
        <div className="text-xs text-fg-dim mt-1">Authorised personnel only</div>
      </div>

      <div className={`px-6 py-5 space-y-4 transition-opacity ${busy ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 border border-ink-600">
          {['Analyst', 'Supervisor'].map((r) => (
            <button key={r} onClick={() => setRole(r)} className={`h-8 text-xs uppercase tracking-wider transition-colors ${role === r ? 'bg-ink-600 text-fg-hi' : 'text-fg-dim hover:text-fg'}`}>{r}</button>
          ))}
        </div>

        <div className="flex gap-4 border-b border-ink-600">
          {[['card', 'Smart card', 'key'], ['service', 'Service No.', 'file']].map(([k, l, ic]) => (
            <button key={k} onClick={() => setMethod(k)} className={`relative pb-2 text-sm flex items-center gap-1.5 transition-colors ${method === k ? 'text-fg-hi' : 'text-fg-dim hover:text-fg'}`}>
              <Icon name={ic} size={13} />{l}
              <span className={`absolute left-0 right-0 -bottom-px h-[2px] bg-amber transition-transform origin-left ${method === k ? 'scale-x-100' : 'scale-x-0'}`} />
            </button>
          ))}
        </div>

        {method === 'card' ? (
          <div key="card" className="space-y-3 appear">
            <CardReader state={card} />
            {card === 'read' ? (
              <div className="flex items-center gap-2 text-xs rise">
                <Icon name="check" size={13} className="text-teal" />
                <span className="mono text-fg">{user.serviceNo}</span>
                <span className="text-fg-muted">{user.name}</span>
                <span className="flex-1" />
                <span className="text-[10px] text-fg-dim uppercase tracking-wider">{user.title}</span>
              </div>
            ) : (
              <button onClick={readCard} disabled={card === 'reading'} className="w-full h-9 border border-ink-500 text-sm text-fg hover:border-fg-muted flex items-center justify-center gap-2">
                <Icon name="key" size={14} />{card === 'reading' ? 'Reading card…' : 'Read card'}
              </button>
            )}
          </div>
        ) : (
          <label key="service" className="block appear">
            <span className="label">Service number</span>
            <input
              value={serviceNo}
              onChange={(e) => setServiceNo(e.target.value.toUpperCase())}
              placeholder="IC-00000X"
              autoFocus
              className="input w-full mt-1.5 h-10 mono tracking-wider"
            />
          </label>
        )}

        {(method === 'service' || card === 'read') && (
          <div className="rise">
            <div className="flex items-center"><span className="label">PIN</span><span className="flex-1" /><span className="text-[10px] text-fg-dim">6 digits</span></div>
            <div className="mt-1.5"><PinInput value={pin} onChange={setPin} autoFocus={card === 'read'} onEnter={() => authenticate()} /></div>
          </div>
        )}

        {error && <div className="text-xs text-rej flex items-center gap-1.5 rise"><Icon name="x" size={12} />{error}</div>}
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={() => authenticate()}
          disabled={busy}
          className={`w-full h-11 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${granted ? 'bg-teal text-ink-950' : 'bg-fg text-ink-900 hover:bg-fg-hi'} disabled:cursor-default`}
        >
          {granted ? <><Icon name="check" size={15} strokeWidth={2} /> {bootReady ? 'Access granted' : 'Preparing terrain…'}</> : busy ? <><span className="w-3 h-3 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" /> {AUTH_STEPS[Math.min(auth, AUTH_STEPS.length - 1)]}</> : <>Sign in <Icon name="chevron" size={14} /></>}
        </button>
        {busy && (
          <div className="flex gap-1 mt-2">
            {AUTH_STEPS.map((s, i) => <span key={s} className={`flex-1 h-0.5 transition-colors duration-300 ${i < auth ? 'bg-teal' : 'bg-ink-600'}`} />)}
          </div>
        )}
        <div className="flex items-center gap-2 mt-4 text-[11px] text-fg-dim">
          <span>Demo access</span>
          <span className="flex-1 h-px bg-ink-600" />
          <button onClick={() => demo('Analyst')} disabled={busy} className="px-2 h-6 border border-ink-600 hover:border-fg-muted text-fg-muted hover:text-fg">Analyst</button>
          <button onClick={() => demo('Supervisor')} disabled={busy} className="px-2 h-6 border border-ink-600 hover:border-fg-muted text-fg-muted hover:text-fg">Supervisor</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- page ----------------
export default function Login({ boot }) {
  const { signIn } = useStore()
  const [pending, setPending] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(i) }, [])

  // Sign-in completes once credentials pass and the offline tiles are ready.
  useEffect(() => {
    if (pending && boot.ready) setLeaving(true)
  }, [pending, boot.ready])
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => signIn(pending), 950)
    return () => clearTimeout(t)
  }, [leaving]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = 9
  const progress = Math.min(1, boot.steps.length / total)

  return (
    <div className={`fixed inset-0 overflow-hidden text-fg ${leaving ? 'login-leave' : ''}`}>
      <Backdrop ready={boot.ready} leaving={leaving} />

      {/* tricolour hairline + banner */}
      <div className="absolute top-0 inset-x-0 flex h-[3px]">
        <span className="flex-1 bg-[#FF9933]" /><span className="flex-1 bg-[#F4F4F2]" /><span className="flex-1 bg-[#138808]" />
      </div>
      <div className="absolute top-[3px] inset-x-0 h-6 flex items-center justify-center text-[10px] tracking-[0.3em] text-fg-dim bg-ink-950/60">
        DEMO · UNCLASSIFIED · PROTOTYPE
      </div>

      <div className="relative h-full flex flex-col px-[clamp(24px,5vw,88px)] pt-14 pb-5 fluid-content">
        <header className="flex items-center gap-3 rise" style={{ '--i': 0 }}>
          <svg width="30" height="30" viewBox="0 0 22 22" fill="none" stroke="#EEF2F5" strokeWidth="1.2">
            <path d="M11 2.5 20 18.5H2Z" />
            <path d="M6.2 13.2c1.3-1.6 2.9-2.4 4.8-2.4s3.5.8 4.8 2.4c-1.3 1.6-2.9 2.4-4.8 2.4s-3.5-.8-4.8-2.4Z" />
            <circle cx="11" cy="13.2" r="1.3" fill="#EEF2F5" stroke="none" />
          </svg>
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-[0.4em] text-fg-hi">TRINETRA</div>
            <div className="text-[9.5px] tracking-[0.24em] text-fg-dim mt-1">IMAGERY INTELLIGENCE</div>
          </div>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5 h-7 px-2.5 border border-ok-line bg-ok-dim text-ok text-[10px] font-semibold tracking-[0.14em]">
            <span className="w-1.5 h-1.5 bg-ok" /> OFFLINE · NO EXTERNAL CALLS
          </span>
          <span className="mono text-xs text-fg-muted w-[150px] text-right">{clock.toISOString().slice(0, 19).replace('T', ' ')}Z</span>
        </header>

        <main className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[clamp(24px,5vw,96px)]">
          <section className="max-w-[640px]">
            <div className="inline-flex items-center gap-3 h-7 px-3 glass border border-ink-600 label text-fg rise" style={{ '--i': 1 }}>
              <span className="w-6 h-px bg-amber" /> Indian Army · Imagery Intelligence
            </div>
            <h1 className="mt-5 font-extralight text-fg-hi leading-[1.1] tracking-tight rise" style={{ '--i': 2, fontSize: 'clamp(30px, 3.2vw, 52px)', textShadow: '0 2px 24px #07090C, 0 0 2px #07090C' }}>
              We watch everywhere, in any weather, and only raise our hand when the evidence holds up.
            </h1>
            <div className="mt-9 grid grid-cols-4 gap-px bg-ink-600 border border-ink-600 rise" style={{ '--i': 3 }}>
              {[
                [7, 'AOIs on real terrain', ''],
                [30, 'DEM resolution', ' m'],
                [3, 'detectors per alert', ''],
                [0, 'external calls', ''],
              ].map(([v, l, u]) => (
                <div key={l} className="bg-ink-950/80 px-4 py-3">
                  <div className="text-2xl font-light num text-fg-hi"><CountUp value={v} />{u}</div>
                  <div className="text-[10.5px] text-fg-dim mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 w-[min(100%,440px)] glass border border-ink-600 px-3 py-2.5 rise" style={{ '--i': 4 }}>
              <div className="flex items-center gap-2 text-[11px]">
                <span className={`w-1.5 h-1.5 ${boot.ready ? 'bg-teal' : 'bg-amber pulse'}`} />
                <span className="text-fg-muted">{boot.ready ? 'Offline tiles ready' : 'Loading offline tiles'}</span>
                <span className="flex-1" />
                <span className="mono text-fg-dim">{boot.steps[boot.steps.length - 1]?.k ?? '…'}</span>
              </div>
              <div className="h-px bg-ink-600 mt-2 overflow-hidden"><div className="h-full bg-teal transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} /></div>
              {boot.error && <div className="mono text-xs text-rej mt-2">{boot.error}</div>}
            </div>
          </section>

          <LoginCard bootReady={boot.ready} onDone={setPending} />
        </main>

        <footer className="flex items-center gap-4 text-[10.5px] text-fg-muted glass border border-ink-600 px-3 h-8 rise" style={{ '--i': 5 }}>
          <span className="px-1.5 border border-amber-line text-amber font-semibold tracking-[0.14em]">DEMO DATA</span>
          <span>Prototype prepared for the Indian Army · not an official Indian Army system</span>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5"><Icon name="audit" size={12} /> Every session is hash-chain audited</span>
          <span className="mono">{boot.ready ? 'Kargil–Drass · GLO-30 · live render' : 'Terrarium relief'}</span>
        </footer>
      </div>
      {leaving && <div className="absolute inset-0 bg-ink-950 pointer-events-none login-curtain" />}
    </div>
  )
}
