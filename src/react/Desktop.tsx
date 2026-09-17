import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { addCommandHandler, addDeskCommands, DeskCommands, STAGE_ATTRIBUTE, WINDOW_ATTRIBUTE, windowElement } from '../core/commands.js'
import { focusedId } from '../core/desk.js'
import type { DeskWindow, Frame, WindowId } from '../core/types.js'
import { arrangement } from './arrange.js'
import { InfoTip } from './infoTip.js'
import { useDesk, useDeskState, WindowContext } from './context.js'
import { WindowBoundary } from './windowBoundary.js'
import type { WindowFailed, WindowLoading } from './windowBoundary.js'

export type DeskLayout = 'desktop' | 'fullscreen'

export interface DesktopProps {
  readonly renderWindow: (id: WindowId) => ReactNode
  readonly title: (id: WindowId) => ReactNode
  /**
   * A quiet line on the trailing side of the title bar, saying what this window is looking at: the
   * request behind it, the file it is editing, how many rows it found. Text, not a control — it
   * gives way to the actions and disappears before the title does when the window is narrow.
   */
  readonly note?: (id: WindowId) => ReactNode
  /**
   * What this window is, behind an (i) at the end of its title bar — the same place in every window,
   * so a person who wonders what they are looking at always knows where to ask. Explanation only: a
   * warning, or anything that changes what someone is about to do, belongs in the window itself.
   */
  readonly info?: (id: WindowId) => ReactNode
  /** Window-wide controls on the trailing side of the title bar. One or two; more belongs in a toolbar. */
  readonly actions?: (id: WindowId) => ReactNode
  /** Shown when no window is open. */
  readonly empty?: ReactNode
  /** Shown inside a window while its code loads. Default: a quiet "Loading…". */
  readonly loading?: WindowLoading
  /** Shown inside a window that could not open, with a way to try again. */
  readonly failed?: WindowFailed
  /**
   * `auto` (the default) reads the device: a touch screen gets `fullscreen`, one
   * window at a time; anything with a pointer gets the layered `desktop`.
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
/** How close to the edge a dragged window has to get before it takes that half. */
const SNAP_MARGIN = 56

/** The part of the stage windows are arranged in: inside its padding, with its gap. */
function arrangementArea(stage: HTMLElement) {
  const style = getComputedStyle(stage)
  const left = parseFloat(style.paddingLeft) || 0
  const right = parseFloat(style.paddingRight) || 0
  const top = parseFloat(style.paddingTop) || 0
  const bottom = parseFloat(style.paddingBottom) || 0
  const gap = parseFloat(style.columnGap) || 0
  return { x: left, y: top, width: stage.clientWidth - left - right, height: stage.clientHeight - top - bottom, gap }
}

const halfFrame = (stage: HTMLElement, side: 'start' | 'end'): Frame => {
  const area = arrangementArea(stage)
  const width = (area.width - area.gap) / 2
  return { x: side === 'start' ? area.x : area.x + width + area.gap, y: area.y, width, height: area.height }
}

export function Desktop({ renderWindow, title, note, info, actions, empty, loading, failed, layout = 'auto', className }: DesktopProps) {
  const desk = useDesk()
  const state = useDeskState()
  const stage = useRef<HTMLDivElement>(null)
  const touch = useMediaQuery(TOUCH)
  const mode: DeskLayout = layout === 'auto' ? (touch ? 'fullscreen' : 'desktop') : layout

  useLayoutEffect(() => {
    desk.setStage(() => ({ width: stage.current?.clientWidth ?? 1024, height: stage.current?.clientHeight ?? 768 }))
  }, [desk])

  useEffect(() => (stage.current ? addDeskCommands(stage.current, desk) : undefined), [desk])

  // Arrange lays every window out once, as free windows that can be moved again straight away.
  useEffect(() => {
    const element = stage.current
    if (!element || mode !== 'desktop') return undefined
    return addCommandHandler(
      element,
      DeskCommands.arrange,
      () => {
        const { windows, stack } = desk.getState()
        const [focused, previous] = [stack.at(-1), stack.at(-2)]
        if (windows.length === 1) {
          if (focused) desk.fill(focused)
          return
        }
        const frames = arrangement(
          windows.map(w => w.id),
          focused ?? null,
          previous ?? null,
          arrangementArea(element),
          { minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT },
        )
        desk.placeAll(frames)
        // Windows that cascade come in front of the half they cascade over; the focused window stays in front of all.
        if (previous) desk.focus(previous)
        windows.forEach(w => w.id !== focused && w.id !== previous && desk.focus(w.id))
        if (focused) desk.focus(focused)
      },
      {
        enabled: () => {
          const { windows } = desk.getState()
          return windows.length > 1 || windows.some(w => w.mode === 'floating')
        },
      },
    )
  }, [desk, mode])

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

  return (
    <div
      ref={stage}
      className={['desk-stage', className].filter(Boolean).join(' ')}
      data-layout={mode}
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
          note={note?.(window.id)}
          info={info?.(window.id)}
          actions={actions?.(window.id)}
        >
          {/* Memoised on the id and the render function: moving or focusing a window
              re-renders its chrome, never the app's content inside it. */}
          <WindowContent id={window.id} render={renderWindow} loading={loading} failed={failed} />
        </WindowView>
      ))}
    </div>
  )
}

interface WindowContentProps {
  readonly id: WindowId
  readonly render: (id: WindowId) => ReactNode
  readonly loading: WindowLoading | undefined
  readonly failed: WindowFailed | undefined
}

// Each window loads and fails on its own: one fetching its code, or throwing, never blanks another.
const WindowContent = memo(function WindowContent({ id, render, loading, failed }: WindowContentProps) {
  return (
    <WindowBoundary id={id} loading={loading} failed={failed}>
      {render(id)}
    </WindowBoundary>
  )
})

interface WindowViewProps {
  readonly window: DeskWindow
  readonly layout: DeskLayout
  readonly hidden?: boolean
  readonly depth: number
  readonly focused: boolean
  readonly title: ReactNode
  readonly note?: ReactNode
  readonly info?: ReactNode
  readonly actions?: ReactNode
  readonly children: ReactNode
}

/** Moving by the title bar, or resizing from the corner or from the left, right or bottom edge. */
type Gesture = 'move' | 'resize' | 'left' | 'right' | 'bottom'

/** The frame a gesture makes of `origin` after the pointer has travelled dx, dy. */
function reshape(gesture: Gesture, origin: Frame, dx: number, dy: number): Frame {
  switch (gesture) {
    case 'move':
      return { ...origin, x: origin.x + dx, y: Math.max(0, origin.y + dy) }
    case 'resize':
      return { ...origin, width: Math.max(MIN_WIDTH, origin.width + dx), height: Math.max(MIN_HEIGHT, origin.height + dy) }
    case 'right':
      return { ...origin, width: Math.max(MIN_WIDTH, origin.width + dx) }
    case 'bottom':
      return { ...origin, height: Math.max(MIN_HEIGHT, origin.height + dy) }
    case 'left': {
      // The right edge stays put, however far the left one is pulled.
      const shift = Math.min(dx, origin.width - MIN_WIDTH)
      return { ...origin, x: origin.x + shift, width: origin.width - shift }
    }
  }
}

function WindowView({ window, layout, hidden, depth, focused, title, note, info, actions, children }: WindowViewProps) {
  const desk = useDesk()
  // While dragging, the frame lives here and commits once on release, so a drag
  // re-renders one window rather than notifying every subscriber per pixel.
  const [live, setLive] = useState<Frame | null>(null)
  const element = useRef<HTMLElement>(null)
  const context = useMemo(() => ({ id: window.id, element }), [window.id])
  const titleId = `desk-title-${window.id}`

  const startGesture = (gesture: Gesture) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || layout === 'fullscreen') return
    if (gesture === 'move' && (event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const stageBox = event.currentTarget.closest<HTMLElement>(`[${STAGE_ATTRIBUTE}]`)?.getBoundingClientRect()
    const windowBox = event.currentTarget.closest<HTMLElement>(`[${WINDOW_ATTRIBUTE}]`)?.getBoundingClientRect()
    // A filled window is freed exactly where it already sits, so it does not jump under the pointer.
    const origin: Frame =
      window.mode === 'floating'
        ? window.frame
        : {
            x: (windowBox?.left ?? 0) - (stageBox?.left ?? 0),
            y: (windowBox?.top ?? 0) - (stageBox?.top ?? 0),
            width: windowBox?.width ?? 480,
            height: windowBox?.height ?? 360,
          }
    let pulledOut = window.mode === 'floating'
    const startX = event.clientX
    const startY = event.clientY
    const handle = event.currentTarget
    handle.setPointerCapture?.(event.pointerId)
    const stage = handle.closest<HTMLElement>(`[${STAGE_ATTRIBUTE}]`)
    let latest = origin
    let snap: 'start' | 'end' | null = null

    // Dragging a window against an edge offers it that half of the desk.
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
      if (!pulledOut && Math.hypot(dx, dy) > 5) {
        pulledOut = true
        if (window.mode === 'filled') desk.float(window.id, origin)
      }
      latest = reshape(gesture, origin, dx, dy)
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
      // Dropped against an edge, it takes that half of the desk — and nothing else moves.
      if (snap && stage) desk.float(window.id, halfFrame(stage, snap))
      else if (pulledOut && latest !== origin) desk.float(window.id, latest)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  // Double-clicking a title bar, or the green control, fills the desk with the window and back — as on a Mac.
  const zoom = () => {
    if (layout === 'desktop') desk.toggleMode(window.id)
  }

  const frame = layout === 'desktop' ? (live ?? (window.mode === 'floating' ? window.frame : null)) : null
  const style: CSSProperties | undefined =
    layout !== 'desktop'
      ? undefined
      : frame
        ? { left: frame.x, top: frame.y, width: frame.width, height: frame.height, zIndex: 10 + depth }
        : { zIndex: 10 + depth }

  return (
    <WindowContext.Provider value={context}>
      <section
        ref={element}
        tabIndex={-1}
        {...{ [WINDOW_ATTRIBUTE]: window.id }}
        className="desk-window"
        data-mode={layout === 'fullscreen' ? 'fullscreen' : live ? 'floating' : window.mode}
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
          <header
          className="desk-titlebar"
          onPointerDown={startGesture('move')}
          onDoubleClick={event => {
            if (!(event.target as HTMLElement).closest('button')) zoom()
          }}
          data-draggable={layout === 'desktop' || undefined}
        >
          <div className="desk-controls">
            <button type="button" className="desk-control" data-control="close" aria-label="Close" onClick={() => desk.close(window.id)} />
            {layout === 'desktop' && (
              <button type="button" className="desk-control" data-control="mode" aria-label="Zoom" onClick={zoom} />
            )}
          </div>
          <h2 id={titleId} className="desk-title">
            {title}
          </h2>
          {note != null && note !== false && <p className="desk-window-note">{note}</p>}
          {info != null && info !== false && (
            <InfoTip
              className="desk-window-info"
              label={typeof title === 'string' ? `About ${title}` : 'About this window'}
              align="end"
            >
              {info}
            </InfoTip>
          )}
          {actions && <div className="desk-window-actions">{actions}</div>}
        </header>
        <div className="desk-body">{children}</div>
        {layout === 'desktop' && (
          <>
            {/* No top edge: the title bar is there, and it moves the window. */}
            <div className="desk-edge" data-edge="left" aria-hidden="true" onPointerDown={startGesture('left')} />
            <div className="desk-edge" data-edge="right" aria-hidden="true" onPointerDown={startGesture('right')} />
            <div className="desk-edge" data-edge="bottom" aria-hidden="true" onPointerDown={startGesture('bottom')} />
            <div className="desk-grip" aria-hidden="true" onPointerDown={startGesture('resize')} />
          </>
        )}
      </section>
    </WindowContext.Provider>
  )
}
