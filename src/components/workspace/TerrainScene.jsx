// 3D terrain workspace: DEM heightfield mesh (real GLO-30 where available) with a
// canvas drape, skirt, change pins, query footprints, similar-site markers,
// cross-section line and a hover reticle. Camera fly-in on region open.
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { sampleFrac } from '../../lib/dem'
import { Icon } from '../ui/Icon'

export function sceneDims(dem) {
  const maxM = Math.max(dem.widthM, dem.heightM)
  return { Wu: (100 * dem.widthM) / maxM, Du: (100 * dem.heightM) / maxM, mpu: maxM / 100 }
}
export const fracToWorld = (d, fx, fy) => [(fx - 0.5) * d.Wu, (fy - 0.5) * d.Du]
export const heightAt = (dem, d, fx, fy) => (sampleFrac(dem, fx, fy).elev - dem.min) / d.mpu

export function buildGeometry(dem, d, seg) {
  const g = new THREE.PlaneGeometry(d.Wu, d.Du, seg, seg)
  const pos = g.attributes.position
  for (let r = 0; r <= seg; r++) {
    for (let c = 0; c <= seg; c++) {
      const i = r * (seg + 1) + c
      const x = Math.min(dem.W - 1, Math.round((c / seg) * (dem.W - 1)))
      const y = Math.min(dem.H - 1, Math.round((r / seg) * (dem.H - 1)))
      pos.setZ(i, (dem.elev[y * dem.W + x] - dem.min) / d.mpu)
    }
  }
  g.rotateX(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

// Vertical walls around the block so the terrain reads as a physical model.
export function buildSkirt(dem, d, seg, depth) {
  const verts = []
  const edge = (pts) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0, z0] = pts[k], [x1, y1, z1] = pts[k + 1]
      verts.push(x0, y0, z0, x1, y1, z1, x0, -depth, z0, x1, y1, z1, x1, -depth, z1, x0, -depth, z0)
    }
  }
  const h = (fx, fy) => {
    const x = Math.min(dem.W - 1, Math.round(fx * (dem.W - 1)))
    const y = Math.min(dem.H - 1, Math.round(fy * (dem.H - 1)))
    return (dem.elev[y * dem.W + x] - dem.min) / d.mpu
  }
  const line = (f) => Array.from({ length: seg + 1 }, (_, k) => f(k / seg))
  edge(line((t) => [(t - 0.5) * d.Wu, h(t, 0), -d.Du / 2]))
  edge(line((t) => [d.Wu / 2, h(1, t), (t - 0.5) * d.Du]))
  edge(line((t) => [(0.5 - t) * d.Wu, h(1 - t, 1), d.Du / 2]))
  edge(line((t) => [-d.Wu / 2, h(0, 1 - t), (0.5 - t) * d.Du]))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  g.computeVertexNormals()
  return g
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function CameraRig({ d, fly, onAzimuth }) {
  const { camera, controls } = useThree()
  const anim = useRef(null)
  useEffect(() => {
    if (!fly) return
    const target = new THREE.Vector3(...(fly.target ?? [0, 0, 0]))
    const to = new THREE.Vector3(...(fly.to ?? [0, d.Du * 0.62, d.Du * 0.82]))
    const from = fly.from ? new THREE.Vector3(...fly.from) : camera.position.clone()
    const fromTarget = controls?.target?.clone() ?? new THREE.Vector3()
    anim.current = { t0: performance.now(), dur: fly.dur ?? 1800, from, to, fromTarget, target }
    if (fly.from) camera.position.copy(from)
  }, [fly]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const a = anim.current
    if (a) {
      const t = Math.min(1, (performance.now() - a.t0) / a.dur)
      const k = ease(t)
      camera.position.lerpVectors(a.from, a.to, k)
      if (controls) controls.target.lerpVectors(a.fromTarget, a.target, k)
      if (t >= 1) anim.current = null
    }
    if (controls) {
      const v = camera.position.clone().sub(controls.target)
      onAzimuth?.(Math.atan2(v.x, v.z), v.length())
    }
  })
  return null
}

const STATUS_COLOR = { pending: '#D6A24A', confirmed: '#3EB2A8', rejected: '#C2625C', 'needs-data': '#8C99A7' }
const TYPE_ICON = { structure: 'box', 'structure-noaccess': 'box', clearing: 'clearing', track: 'path', earthwork: 'berm', shelter: 'tent', disturbed: 'dots', water: 'drop', removed: 'x' }

function PinHead({ pin, onClick }) {
  const col = STATUS_COLOR[pin.status] ?? '#D6A24A'
  return (
    <button
      data-tour={pin.tour ? 'pin' : undefined}
      onClick={(e) => { e.stopPropagation(); onClick(pin.id) }}
      className="relative flex flex-col items-center group"
      style={{ opacity: pin.dim ? 0.3 : 1 }}
    >
      {pin.pulse && <span className="absolute top-0 w-7 h-7 border pin-pulse" style={{ borderColor: col }} />}
      <span
        className={`relative w-7 h-7 flex items-center justify-center border bg-ink-950/90 transition-transform ${pin.selected ? 'scale-125' : 'group-hover:scale-110'}`}
        style={{ borderColor: col, color: col, boxShadow: pin.selected ? `0 0 0 2px ${col}55` : undefined }}
      >
        <Icon name={TYPE_ICON[pin.render] ?? 'pin'} size={14} />
      </span>
      {(pin.selected || pin.showLabel) && (
        <span className="absolute top-8 mono text-[10px] px-1 bg-ink-950/90 border border-ink-600 text-fg whitespace-nowrap">
          {pin.id} · {pin.conf}%
        </span>
      )}
    </button>
  )
}

function Pins({ dem, d, exag, pins, onPin }) {
  return pins.map((p) => {
    const [x, z] = fracToWorld(d, p.fx, p.fy)
    const y = heightAt(dem, d, p.fx, p.fy) * exag
    const stem = 2.6
    const col = STATUS_COLOR[p.status] ?? '#D6A24A'
    return (
      <group key={p.id} position={[x, y, z]}>
        <mesh position={[0, stem / 2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, stem, 6]} />
          <meshBasicMaterial color={col} transparent opacity={p.dim ? 0.25 : 0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.35, 0.6, 24]} />
          <meshBasicMaterial color={col} transparent opacity={p.dim ? 0.2 : 0.85} side={THREE.DoubleSide} />
        </mesh>
        <Html position={[0, stem + 0.6, 0]} center zIndexRange={[8, 2]}>
          <PinHead pin={p} onClick={onPin} />
        </Html>
      </group>
    )
  })
}

function Markers({ dem, d, exag, items, kind }) {
  return items.map((m) => {
    const [x, z] = fracToWorld(d, m.fx, m.fy)
    const y = heightAt(dem, d, m.fx, m.fy) * exag
    return (
      <Html key={`${kind}-${m.id}`} position={[x, y + 0.8, z]} center zIndexRange={[8, 1]}>
        {kind === 'footprint' ? (
          <span className="flex items-center justify-center w-5 h-5 bg-fg-hi text-ink-950 mono text-[11px] font-semibold fade-in">{m.n}</span>
        ) : (
          <span className="flex items-center gap-1 fade-in">
            <span className="w-3 h-3 rotate-45 border border-teal bg-teal/30 pin-glow" />
            <span className="mono text-[10px] text-teal bg-ink-950/80 px-1">{m.id}</span>
          </span>
        )}
      </Html>
    )
  })
}

function Reticle({ dem, d, exag, hover }) {
  if (!hover) return null
  const [x, z] = fracToWorld(d, hover.fx, hover.fy)
  const y = heightAt(dem, d, hover.fx, hover.fy) * exag + 0.08
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.62, 32]} />
      <meshBasicMaterial color="#EEF2F5" transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  )
}

function ProfileLine({ dem, d, exag, pts }) {
  const line = useMemo(() => {
    if (pts.length < 2) return null
    const [a, b] = pts
    return Array.from({ length: 160 }, (_, k) => {
      const t = k / 159
      const fx = a.fx + (b.fx - a.fx) * t, fy = a.fy + (b.fy - a.fy) * t
      const [x, z] = fracToWorld(d, fx, fy)
      return [x, heightAt(dem, d, fx, fy) * exag + 0.25, z]
    })
  }, [pts, dem, d, exag])
  return (
    <>
      {pts.map((p, i) => {
        const [x, z] = fracToWorld(d, p.fx, p.fy)
        return (
          <Html key={i} position={[x, heightAt(dem, d, p.fx, p.fy) * exag + 0.6, z]} center zIndexRange={[8, 1]}>
            <span className="w-5 h-5 flex items-center justify-center bg-amber text-ink-950 mono text-[11px] font-semibold">{i ? 'B' : 'A'}</span>
          </Html>
        )
      })}
      {line && <Line points={line} color="#D6A24A" lineWidth={2.5} depthTest={false} />}
    </>
  )
}

function Terrain({ dem, d, texture, exag, onHover, onClick }) {
  const geom = useMemo(() => buildGeometry(dem, d, Math.min(511, dem.W - 1)), [dem, d])
  const proxy = useMemo(() => buildGeometry(dem, d, 128), [dem, d])
  const skirt = useMemo(() => buildSkirt(dem, d, 128, 2.2), [dem, d])
  useEffect(() => () => { geom.dispose(); proxy.dispose(); skirt.dispose() }, [geom, proxy, skirt])
  const toFrac = (p) => ({ fx: p.x / d.Wu + 0.5, fy: p.z / d.Du + 0.5 })
  return (
    <group scale={[1, exag, 1]}>
      <mesh geometry={geom} receiveShadow>
        <meshLambertMaterial map={texture} />
      </mesh>
      <mesh geometry={skirt}>
        <meshLambertMaterial color="#141B23" side={THREE.DoubleSide} />
      </mesh>
      <mesh
        geometry={proxy}
        onPointerMove={(e) => onHover(toFrac(e.point))}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { if (e.delta < 5) onClick(toFrac(e.point)) }}
      >
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export function TerrainScene({ dem, drape, drapeVersion, exag, pins, footprints, similar, profile, hover, fly, onHover, onClick, onPin, onAzimuth }) {
  const d = useMemo(() => sceneDims(dem), [dem])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(drape)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [drape])
  useEffect(() => { texture.needsUpdate = true }, [texture, drapeVersion])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <Canvas
      camera={{ position: [0, 150, 0.01], fov: 38, near: 0.5, far: 2000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => onHover(null)}
    >
      <color attach="background" args={['#07090C']} />
      <fog attach="fog" args={['#07090C', 160, 420]} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[-60, 90, -50]} intensity={1.35} />
      <gridHelper args={[600, 60, '#1A232D', '#11171E']} position={[0, -2.3 * exag, 0]} />
      <Terrain dem={dem} d={d} texture={texture} exag={exag} onHover={onHover} onClick={onClick} />
      <Reticle dem={dem} d={d} exag={exag} hover={hover} />
      <Pins dem={dem} d={d} exag={exag} pins={pins} onPin={onPin} />
      <Markers dem={dem} d={d} exag={exag} items={footprints} kind="footprint" />
      <Markers dem={dem} d={d} exag={exag} items={similar} kind="similar" />
      <ProfileLine dem={dem} d={d} exag={exag} pts={profile} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={1.38} minDistance={12} maxDistance={260} screenSpacePanning={false} />
      <CameraRig d={d} fly={fly} onAzimuth={onAzimuth} />
    </Canvas>
  )
}
