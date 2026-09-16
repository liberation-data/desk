import { createContext, useContext, useState, useSyncExternalStore } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createBus } from '../core/events.js'
import type { Bus } from '../core/events.js'
import { createDesk } from '../core/desk.js'
import { DragProvider } from './dragContext.js'
import type { Desk } from '../core/desk.js'
import type { DeskOptions, DeskState, WindowId } from '../core/types.js'

const DeskContext = createContext<Desk | null>(null)

/** Every desk comes with a bus; <BusProvider> only matters when one has to be shared or supplied. */
export const BusContext = createContext<Bus | null>(null)

export interface DeskProviderProps {
  /** An existing desk, e.g. one a tour runner or router also drives. */
  readonly desk?: Desk
  /** Used to create a desk when none is given. Read once. */
  readonly options?: DeskOptions
  readonly children: ReactNode
}

export function DeskProvider({ desk, options, children }: DeskProviderProps) {
  const [value] = useState(() => desk ?? createDesk(options))
  const [bus] = useState(createBus)
  return (
    <DeskContext.Provider value={value}>
      <BusContext.Provider value={bus}>
        <DragProvider>{children}</DragProvider>
      </BusContext.Provider>
    </DeskContext.Provider>
  )
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

export interface WindowContextValue {
  readonly id: WindowId
  readonly element: RefObject<HTMLElement | null>
}

/** Present inside a window's content: which window this is, and its element. */
export const WindowContext = createContext<WindowContextValue | null>(null)

/** The id of the window this component is rendered in, or null outside any window. */
export const useWindowId = (): WindowId | null => useContext(WindowContext)?.id ?? null
