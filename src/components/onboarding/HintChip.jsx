import { useState } from 'react'
import { getPref, setPref } from '../../lib/prefs'
import { Icon } from '../ui/Icon'

// Contextual hint: shown once per viewer, dismissed on click.
export function HintChip({ id, children, className = '' }) {
  const [seen, setSeen] = useState(() => getPref(`hint.${id}`, false))
  if (seen) return null
  return (
    <button
      onClick={() => { setPref(`hint.${id}`, true); setSeen(true) }}
      className={`glass border border-fg-muted/60 text-fg text-xs h-8 px-3 flex items-center gap-2 fade-in ${className}`}
    >
      <span className="w-1.5 h-1.5 bg-amber pulse" />
      {children}
      <Icon name="x" size={11} className="text-fg-dim" />
    </button>
  )
}
