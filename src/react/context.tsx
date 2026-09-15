import { createContext, useContext, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createDesk } from '../core/desk.js'
import type { Desk } from '../core/desk.js'
import type { DeskOptions, DeskState } from '../core/types.js'

const DeskContext = createContext<Desk | null>(null)

export interface DeskProviderProps {
  /** An existing desk, e.g. one a tour runner or router also drives. */
  readonly desk?: Desk
  /** Used to create a desk when none is given. Read once. */
  readonly options?: DeskOptions
  readonly children: ReactNode
}

export function DeskProvider({ desk, options, children }: DeskProviderProps) {
  const [value] = useState(() => desk ?? createDesk(options))
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>
}

export function useDesk(): Desk {
  const desk = useContext(DeskContext)
  if (!desk) throw new Error('useDesk must be used inside a <DeskProvider>')
  return desk
}

export function useDeskState(): DeskState {
  const desk = useDesk()
  return useSyncExternalStore(desk.subscribe, desk.getState, desk.getState)
}
