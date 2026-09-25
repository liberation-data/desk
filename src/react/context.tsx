import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createBus } from '../core/events.js'
import type { Bus } from '../core/events.js'
import { createDesk } from '../core/desk.js'
import { deviceLook, resolveLook } from '../core/look.js'
import type { Look, LookChoice } from '../core/look.js'
import { DragProvider } from './dragContext.js'
import { missingProvider } from './missingProvider.js'
import type { Desk } from '../core/desk.js'
import type { DeskOptions, DeskState, WindowId } from '../core/types.js'

const DeskContext = createContext<Desk | null>(null)

const LookContext = createContext<Look | null>(null)

/** Every desk comes with a bus; <BusProvider> only matters when one has to be shared or supplied. */
export const BusContext = createContext<Bus | null>(null)

export interface DeskProviderProps {
  /** An existing desk, e.g. one a tour runner or router also drives. */
  readonly desk?: Desk
  /** Used to create a desk when none is given. Read once. */
  readonly options?: DeskOptions
  /**
   * The platform chrome: `auto` (the default) matches the device, or the app passes the one its user
   * chose. The app keeps that choice where it keeps its other preferences; the desk does not store it.
   */
  readonly look?: LookChoice
  readonly children: ReactNode
}

export function DeskProvider({ desk, options, look = 'auto', children }: DeskProviderProps) {
  const [value] = useState(() => desk ?? createDesk(options))
  const [bus] = useState(createBus)
  const resolved = resolveLook(look)
  // On the root, not the desk: menus and popovers are portalled out of it, and are chrome too.
  useLayoutEffect(() => {
    document.documentElement.dataset.look = resolved
    return () => {
      delete document.documentElement.dataset.look
    }
  }, [resolved])
  return (
    <DeskContext.Provider value={value}>
      <BusContext.Provider value={bus}>
        <LookContext.Provider value={resolved}>
          <DragProvider>{children}</DragProvider>
        </LookContext.Provider>
      </BusContext.Provider>
    </DeskContext.Provider>
  )
}

/** The look the desk is wearing, for an app that draws chrome of its own. Outside a desk, the device's. */
export const useLook = (): Look => useContext(LookContext) ?? deviceLook()

/** The desk above, or null outside one: for parts that work on a desk and off one, like a context menu. */
export const useOptionalDesk = (): Desk | null => useContext(DeskContext)

export function useDesk(): Desk {
  const desk = useContext(DeskContext)
  if (!desk) throw missingProvider('useDesk', 'a <DeskProvider>')
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
