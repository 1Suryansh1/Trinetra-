export const pct = (v) => `${Math.round(v)}%`
export const fmtAge = (h) => (h < 1 ? 'new' : h < 48 ? `${h}h` : `${Math.round(h / 24)}d`)
export const fmtTs = (iso) => iso.replace('T', ' ').replace(/:\d\dZ$/, 'Z')
export const shortHash = (h, n = 10) => `${h.slice(0, n)}…${h.slice(-4)}`

export function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
