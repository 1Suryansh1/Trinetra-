// Per-viewer conveniences only (tour seen, dismissed hints). Always safe to fail.
export function getPref(key, fallback) {
  try {
    const v = localStorage.getItem(`trinetra.${key}`)
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}
export function setPref(key, value) {
  try { localStorage.setItem(`trinetra.${key}`, JSON.stringify(value)) } catch { /* storage unavailable */ }
}
