import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { addDeskCommands, STAGE_ATTRIBUTE, WINDOW_ATTRIBUTE, windowElement } from '../core/commands.js'
import { focusedId } from '../core/desk.js'
import type { DeskWindow, Frame, WindowId } from '../core/types.js'
import { useDesk, useDeskState, WindowContext } from './context.js'

export type DeskLayout = 'desktop' | 'fullscreen'

export interface DesktopProps {
  readonly renderWindow: (id: WindowId) => ReactNode
  readonly title: (id: WindowId) => ReactNode
  /** Shown when no window is open. */
  readonly empty?: ReactNode
  /**
   * `auto` (the default) reads the device: a touch screen gets `fullscreen`, one
   * window at a time; anything with a pointer gets the tiling `desktop`.
   */
  readonly layout?: DeskLayout | 'auto'
  readonly className?: string
}

/** Touch-first: a coarse pointer that cannot hover. A tablet with a trackpad reports otherwise. */
const TOUCH = '(pointer: coarse) and (hover: none)'

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = globalThis.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia?.(query).matches ?? false,
    () => false,
  )
}

const MIN_WIDTH = 240
const MIN_HEIGHT = 160
/** How close to the edge a dragged window has to get before it will tile there. */
const SNAP_MARGIN = 56

/** One column, then two side by side, then the smallest square grid that fits. */
const columnsFor = (tiled: number) => (tiled <= 2 ? Math.max(1, tiled) : Math.ceil(Math.sqrt(tiled)))

export function Desktop({ renderWindow, title, empty, layout = 'auto', className }: DesktopProps) {
  const desk = useDesk()
  const state = useDeskState()
  const stage = useRef<HTMLDivElement>(null)
  const touch = useMediaQuery(TOUCH)
  const mode: DeskLayout = layout === 'auto' ? (touch ? 'fullscreen' : 'desktop') : layout

  useLayoutEffect(() => {
    desk.setStage(() => ({ width: stage.current?.clientWidth ?? 1024, height: stage.current?.clientHeight ?? 768 }))
  }, [desk])

  useEffect(() => (stage.current ? addDeskCommands(stage.current, desk) : undefined), [desk])

  const tiled = state.windows.filter(w => w.mode === 'tiled').length
  const focused = focusedId(state)

  // Keyboard focus follows the key window, so commands and typing reach the window the person just chose.
  // Not on first render: loading a page should not pull focus away from wherever the browser put it.
  const previousFocus = useRef<WindowId | null | undefined>(undefined)
  useEffect(() => {
    const before = previousFocus.current
    previousFocus.current = focused
    if (before === undefined || before === focused || !focused || !stage.current) return
    const element = windowElement(stage.current, focused)
    if (element instanceof HTMLElement && !element.contains(document.activeElement)) element.focus({ preventScroll: true })
  }, [focused])

  const style = { '--desk-columns': mode === 'fullscreen' ? 1 : columnsFor(tiled) } as CSSProperties

  return (
    <div
      ref={stage}
      className={['desk-stage', className].filter(Boolean).join(' ')}
      data-layout={mode}
      style={style}
      {...{ [STAGE_ATTRIBUTE]: '' }}
    >
      {state.windows.length === 0 && empty}
      {state.windows.map(window => (
        <WindowView
          key={window.id}
          window={window}
          layout={mode}
          depth={state.stack.indexOf(window.id)}
          focused={window.id === focused}
          // One window at a time: the rest stay mounted, keeping their state, and simply wait offstage.
          hidden={mode === 'fullscreen' && window.id !== focused}
          title={title(window.id)}
        >
          {renderWindow(window.id)}
        </WindowView>
      ))}
    </div>
  )
}

interface WindowViewProps {
  readonly window: DeskWindow
  readonly layout: DeskLayout
  readonly hidden?: boolean
  readonly depth: number
  readonly focused: boolean
  readonly title: ReactNode
  readonly children: ReactNode
}

type Gesture = 'move' | 'resize'

function WindowView({ window, layout, hidden, depth, focused, title, children }: WindowViewProps) {
  const desk = useDesk()
  // While dragging, the frame lives here and commits once on release, so a drag
  // re-renders one window rather than notifying every subscriber per pixel.
  const [live, setLive] = useState<Frame | null>(null)
  const element = useRef<HTMLElement>(null)
  const context = useMemo(() => ({ id: window.id, element }), [window.id])
  const titleId = `desk-title-${window.id}`

  const startGesture = (gesture: Gesture) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!floating || event.button !== 0) return
    if (gesture === 'move' && (event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const origin = window.frame
    const startX = event.clientX
    const startY = event.clientY
    const handle = event.currentTarget
    handle.setPointerCapture?.(event.pointerId)
    const stage = handle.closest<HTMLElement>(`[${STAGE_ATTRIBUTE}]`)
    let latest = origin
    let snap: 'start' | 'end' | null = null

    // Dragging a window against an edge tiles it there — the way the tiles were
    // going to lay themselves out anyway, chosen by hand.
    const snapAt = (clientX: number) => {
      if (gesture !== 'move' || !stage) return null
      const box = stage.getBoundingClientRect()
      if (clientX - box.left < SNAP_MARGIN) return 'start' as const
      if (box.right - clientX < SNAP_MARGIN) return 'end' as const
      return null
    }

    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - startX
      const dy = move.clientY - startY
      latest =
        gesture === 'move'
          ? { ...origin, x: origin.x + dx, y: Math.max(0, origin.y + dy) }
          : { ...origin, width: Math.max(MIN_WIDTH, origin.width + dx), height: Math.max(MIN_HEIGHT, origin.height + dy) }
      setLive(latest)
      snap = snapAt(move.clientX)
      if (stage) {
        if (snap) stage.dataset.snap = snap
        else delete stage.dataset.snap
      }
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      setLive(null)
      if (stage) delete stage.dataset.snap
      if (snap) desk.tile(window.id, { at: snap })
      else if (latest !== origin) desk.float(window.id, latest)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const floating = window.mode === 'floating' && layout === 'desktop'
  const frame = floating ? (live ?? window.frame) : null
  const style: CSSProperties | undefined = frame
    ? { left: frame.x, top: frame.y, width: frame.width, height: frame.height, zIndex: 10 + depth }
    : undefined

  return (
    <WindowContext.Provider value={context}>
      <section
        ref={element}
        tabIndex={-1}
        {...{ [WINDOW_ATTRIBUTE]: window.id }}
        className="desk-window"
        data-mode={layout === 'fullscreen' ? 'fullscreen' : window.mode}
        data-hidden={hidden || undefined}
        inert={hidden || undefined}
        data-focused={focused || undefined}
        data-dragging={live ? true : undefined}
        aria-labelledby={titleId}
        style={style}
        onPointerDownCapture={() => {
          if (!focused) desk.focus(window.id)
        }}
      >
        <header className="desk-titlebar" onPointerDown={startGesture('move')}>
          <div className="desk-controls">
            <button type="button" className="desk-control" data-control="close" aria-label="Close" onClick={() => desk.close(window.id)} />
            {layout === 'desktop' && (
              <button
                type="button"
                className="desk-control"
                data-control="mode"
                aria-label={window.mode === 'tiled' ? 'Float' : 'Tile'}
                onClick={() => desk.toggleMode(window.id)}
              />
            )}
          </div>
          <h2 id={titleId} className="desk-title">
            {title}
          </h2>
        </header>
        <div className="desk-body">{children}</div>
        {floating && <div className="desk-grip" aria-hidden="true" onPointerDown={startGesture('resize')} />}
      </section>
    </WindowContext.Provider>
  )
}
