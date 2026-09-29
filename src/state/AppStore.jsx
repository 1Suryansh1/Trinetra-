// Client-side store. Each action maps 1:1 to a future backend call
// (POST /changes/:id/decision, POST /ingest/run, POST /watches, ...).
import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react'
import { AUDIT_SEED, CHANGES, INGEST, NOTIFICATIONS, USERS, WATCHES, NOW, sectorById } from '../data/mock'
import { regionFromSector } from '../lib/region'
import { sha256 } from '../lib/sha256'

const GENESIS = '0'.repeat(64)
const REJECT_THRESHOLD = 3

export function entryHash(e) {
  return sha256([e.prev, e.seq, e.ts, e.user, e.action, e.object, e.detail].join('|'))
}

function chain(entries) {
  let prev = GENESIS
  return entries.map((e, i) => {
    const full = { ...e, seq: i + 1, prev }
    full.hash = entryHash(full)
    prev = full.hash
    return full
  })
}

function append(audit, e) {
  const prev = audit.length ? audit[audit.length - 1].hash : GENESIS
  const full = { ...e, seq: audit.length + 1, prev }
  full.hash = entryHash(full)
  return [...audit, full]
}

const initial = {
  role: 'Analyst',
  coord: 'WGS84',
  aoi: 'ALL',
  changes: CHANGES,
  audit: chain(AUDIT_SEED),
  rejectsByType: {},
  ingestRuns: 0,
  ingestNote: null,
  newScenes: 3,
  notifications: NOTIFICATIONS.map((n) => ({ ...n, read: false })),
  watches: WATCHES,
  confirmedSites: {},
  region: null,
  session: null, // { serviceNo, role, method, at } — demo gate, no real credentials are stored
  toastMsg: null,
}

function reducer(state, a) {
  switch (a.type) {
    case 'set':
      return { ...state, [a.key]: a.value }
    case 'audit':
      return { ...state, audit: append(state.audit, a.entry) }
    case 'decide': {
      const c = state.changes.find((x) => x.id === a.id)
      if (!c) return state
      const changes = state.changes.map((x) =>
        x.id === a.id ? { ...x, status: a.decision, remark: a.remark, decidedBy: a.user, decidedAt: a.ts } : x,
      )
      const rejectsByType = { ...state.rejectsByType }
      if (a.decision === 'rejected') rejectsByType[c.type] = (rejectsByType[c.type] ?? 0) + 1
      const action = { confirmed: 'CONFIRM', rejected: 'REJECT', 'needs-data': 'NEEDS_DATA', pending: 'REOPEN' }[a.decision]
      return {
        ...state,
        changes,
        rejectsByType,
        audit: append(state.audit, { ts: a.ts, user: a.user, action, object: a.id, detail: a.remark || `${c.type} · ${c.conf}%` }),
      }
    }
    case 'ingest': {
      if (state.ingestRuns > 0) return state
      const suppressedTypes = Object.entries(state.rejectsByType).filter(([, n]) => n >= REJECT_THRESHOLD).map(([t]) => t)
      const incoming = INGEST.filter((c) => !suppressedTypes.includes(c.type))
      const held = INGEST.filter((c) => suppressedTypes.includes(c.type))
      // Keep the single strongest held alert, demoted, so nothing silently disappears.
      const demoted = held.sort((x, y) => y.conf - x.conf).slice(0, 1).map((c) => ({ ...c, conf: c.conf - 12, demoted: true }))
      const added = [...incoming, ...demoted].map((c) => ({ ...c, isNew: true }))
      const note = suppressedTypes.length
        ? {
            types: suppressedTypes,
            held: held.length - demoted.length,
            text: `Sensitivity for ${suppressedTypes.join(', ')} lowered by analyst feedback`,
          }
        : null
      let audit = append(state.audit, { ts: a.ts, user: 'system', action: 'INGEST', object: 'transfer vol. TV-0928', detail: `${INGEST.length} candidates scored, ${added.length} queued` })
      if (note) audit = append(audit, { ts: a.ts, user: 'system', action: 'SENSITIVITY', object: suppressedTypes.join(', '), detail: `Threshold raised after ${REJECT_THRESHOLD}+ analyst rejections; ${note.held} held below threshold` })
      return { ...state, changes: [...state.changes, ...added], ingestRuns: 1, ingestNote: note, newScenes: 0, audit }
    }
    case 'addWatch':
      return {
        ...state,
        watches: [a.watch, ...state.watches],
        audit: append(state.audit, { ts: a.ts, user: a.user, action: 'WATCH_ADD', object: a.watch.id, detail: a.watch.name }),
      }
    case 'confirmSite':
      return {
        ...state,
        confirmedSites: { ...state.confirmedSites, [a.id]: true },
        audit: append(state.audit, { ts: a.ts, user: a.user, action: 'SITE_CONFIRM', object: a.id, detail: 'Similar-site search run across AOI' }),
      }
    case 'readNotifications':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }
    default:
      return state
  }
}

const Ctx = createContext(null)

export function AppStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial, (s) => ({ ...s, region: regionFromSector(sectorById('SEC-W')) }))
  const startRef = useRef(Date.now())
  const toastTimer = useRef(null)

  // Demo clock: starts at the mock "now" and advances in real time.
  const now = useCallback(() => new Date(new Date(NOW).getTime() + (Date.now() - startRef.current)).toISOString().replace(/\.\d+Z$/, 'Z'), [])
  const user = USERS[state.role]

  const api = useMemo(() => {
    const toast = (msg) => {
      dispatch({ type: 'set', key: 'toastMsg', value: msg })
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => dispatch({ type: 'set', key: 'toastMsg', value: null }), 2600)
    }
    return {
      setRole: (v) => {
        dispatch({ type: 'set', key: 'role', value: v })
        dispatch({ type: 'audit', entry: { ts: now(), user: USERS[v].id, action: 'ROLE_SWITCH', object: 'session', detail: `Role ${v}` } })
      },
      signIn: ({ role, method, serviceNo }) => {
        const at = now()
        dispatch({ type: 'set', key: 'role', value: role })
        dispatch({ type: 'set', key: 'session', value: { role, method, serviceNo, at } })
        dispatch({ type: 'audit', entry: { ts: at, user: USERS[role].id, action: 'LOGIN', object: 'ws-07', detail: `${method}, role ${role}${serviceNo ? ` · ${serviceNo}` : ''}` } })
      },
      signOut: () => {
        dispatch({ type: 'audit', entry: { ts: now(), user: user.id, action: 'LOGOUT', object: 'ws-07', detail: 'Session closed' } })
        dispatch({ type: 'set', key: 'session', value: null })
      },
      setCoord: (v) => dispatch({ type: 'set', key: 'coord', value: v }),
      setAoi: (v) => dispatch({ type: 'set', key: 'aoi', value: v }),
      setRegion: (r) => {
        dispatch({ type: 'set', key: 'region', value: r })
        if (r.aoi) dispatch({ type: 'set', key: 'aoi', value: r.aoi })
        dispatch({ type: 'audit', entry: { ts: now(), user: user.id, action: 'REGION_OPEN', object: r.aoi ?? r.id, detail: `${r.name}${r.drawnArea ? ` · ${Math.round(r.drawnArea)} km²` : ''}` } })
      },
      decide: (id, decision, remark = '') => {
        dispatch({ type: 'decide', id, decision, remark, user: user.id, ts: now() })
        toast(`${id} ${decision === 'needs-data' ? 'marked needs more data' : decision} · audit entry written`)
      },
      runIngest: () => { dispatch({ type: 'ingest', ts: now() }); toast('Ingest complete · queue re-scored') },
      addWatch: (watch) => { dispatch({ type: 'addWatch', watch, user: user.id, ts: now() }); toast(`Watch ${watch.id} saved`) },
      confirmSite: (id) => dispatch({ type: 'confirmSite', id, user: user.id, ts: now() }),
      log: (action, object, detail) => dispatch({ type: 'audit', entry: { ts: now(), user: user.id, action, object, detail } }),
      readNotifications: () => dispatch({ type: 'readNotifications' }),
      toast,
      now,
    }
  }, [now, user.id])

  const value = useMemo(() => ({ ...state, user, ...api }), [state, user, api])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  return useContext(Ctx)
}
