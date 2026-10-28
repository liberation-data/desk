import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createBus } from '../core/events.js'
import type { Bus } from '../core/events.js'
import { createDesk, routeOf } from '../core/desk.js'
import { deviceLook, resolveLook } from '../core/look.js'
import { holdAll } from '../core/services.js'
import type { Holdable } from '../core/services.js'
import type { Look, LookChoice } from '../core/look.js'
import { DragProvider } from './dragContext.js'
import { missingProvider } from './missingProvider.js'
import type { Desk } from '../core/desk.js'
import type { DeskOptions, DeskState, WindowId } from '../core/types.js'
import type { WindowProgress } from './windowProgress.js'

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
  /**
   * What the desk keeps going while it is on screen: each is held from mount to unmount. Read once,
   * so the array need not be stable.
   */
  readonly services?: readonly Holdable[]
  readonly children: ReactNode
}

export function DeskProvider({ desk, options, look = 'auto', services, children }: DeskProviderProps) {
  const [value] = useState(() => desk ?? createDesk(options))
  const [bus] = useState(createBus)
  const [held] = useState(() => services ?? [])
  useEffect(() => holdAll(held), [held])
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
  /** Where `useWindowProgress` reports to: the title bar draws whatever was last set, or nothing. */
  readonly setProgress: (progress: WindowProgress | null) => void
  /** Where `useWindowNote` reports to: `null` or `undefined` leaves the note `Desktop` gave the window. */
  readonly setNote: (note: ReactNode) => void
  /** Where `useWindowInfo` reports to, the same way. */
  readonly setInfo: (info: ReactNode) => void
}

/** Present inside a window's content: which window this is, and its element. */
export const WindowContext = createContext<WindowContextValue | null>(null)

/** The id of the window this component is rendered in, or null outside any window. */
export const useWindowId = (): WindowId | null => useContext(WindowContext)?.id ?? null

/**
 * Where this window is inside itself, and a way to say it has moved: Settings on a section, a list on
 * one item. A link that opens the window somewhere (`desk.open(id, { route })`) changes the route
 * whether the window is new or already open, so a window that reads it here follows every link to it.
 * The route is `''` when nobody has said; what it means is the window's.
 *
 * Outside a window — the same view drawn on its own, in a test or on a page of its own — the route
 * is the component's own state, starting at `''`, as the other window hooks do something sensible
 * there rather than throw.
 */
export function useWindowRoute(): readonly [string, (route: string) => void] {
  const id = useWindowId()
  const desk = useOptionalDesk()
  const [own, setOwn] = useState('')
  const inWindow = id !== null && desk !== null
  const subscribe = useCallback((listener: () => void) => (inWindow ? desk.subscribe(listener) : () => {}), [desk, inWindow])
  const read = useCallback(() => (inWindow ? routeOf(desk.getState(), id) : own), [desk, id, inWindow, own])
  const route = useSyncExternalStore(subscribe, read, read)
  const setRoute = useCallback((next: string) => (inWindow ? desk.setRoute(id, next) : setOwn(next)), [desk, id, inWindow])
  return [route, setRoute] as const
}
