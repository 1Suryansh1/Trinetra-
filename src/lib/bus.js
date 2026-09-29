// Tiny event bus used by the guided demo to drive screens without tight coupling.
const listeners = new Map()
export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set())
    listeners.get(evt).add(fn)
    return () => listeners.get(evt)?.delete(fn)
  },
  emit(evt, payload) {
    listeners.get(evt)?.forEach((fn) => fn(payload))
  },
}
