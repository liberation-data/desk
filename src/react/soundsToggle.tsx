import { useSyncExternalStore, type ReactNode } from 'react'
import type { Fx } from '../fx/fx.js'
import { Toggle } from './controls.js'

export interface SoundsToggleProps {
  readonly fx: Fx<string>
  readonly label?: ReactNode
  /** Say which events this app sounds for: the person deciding needs to know what they are silencing. */
  readonly description?: ReactNode
}

/**
 * The one switch for an app's sounds. A Toggle, because muting takes effect at once; it follows a
 * change made in another tab, since the mute is this browser's rather than this page's.
 */
export function SoundsToggle({ fx, label = 'Sounds', description }: SoundsToggleProps) {
  const on = useSyncExternalStore(fx.subscribe, () => !fx.muted(), () => true)
  return <Toggle checked={on} onChange={(next) => fx.setMuted(!next)} label={label} description={description} />
}
