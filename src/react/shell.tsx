import { useState } from 'react'
import type { ReactNode } from 'react'
import { createDesk } from '../core/desk.js'
import type { Desk } from '../core/desk.js'
import type { Bus } from '../core/events.js'
import type { LookChoice } from '../core/look.js'
import type { DeskOptions } from '../core/types.js'
import { DeskProvider } from './context.js'
import { BusProvider } from './events.js'
import { ToastProvider } from './overlays.js'

export interface DeskShellProps {
  /** An existing desk. One is made from `options` when this is left out. */
  readonly desk?: Desk
  readonly options?: DeskOptions
  /** Share a bus across desks, or supply your own. A desk already carries one. */
  readonly bus?: Bus
  /** Leave toasts out when the app does not use them. Default true. */
  readonly toasts?: boolean
  /** The platform chrome: `auto` (the default) matches the device. See `DeskProviderProps.look`. */
  readonly look?: LookChoice
  readonly children: ReactNode
}

/** Everything an app needs around it, in one component: the desk, its bus, and toasts. */
export function DeskShell({ desk, options, bus, toasts = true, look = 'auto', children }: DeskShellProps) {
  const [made] = useState(() => desk ?? createDesk(options))
  const inner = toasts ? <ToastProvider>{children}</ToastProvider> : children
  return <DeskProvider desk={made} look={look}>{bus ? <BusProvider bus={bus}>{inner}</BusProvider> : inner}</DeskProvider>
}
