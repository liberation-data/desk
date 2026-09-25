import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { addCommandHandler, addDeskCommands, DeskCommands, STAGE_ATTRIBUTE, WINDOW_ATTRIBUTE, windowElement } from '../core/commands.js'
import { focusedId, isMinimized, onDesk } from '../core/desk.js'
import type { Desk } from '../core/desk.js'
import type { Look } from '../core/look.js'
import type { DeskWindow, Frame, WindowId, WindowLimits } from '../core/types.js'
import { arrangement } from './arrange.js'
import { InfoTip } from './infoTip.js'
import { useDesk, useDeskState, useLook, WindowContext } from './context.js'
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
   * How big this window may be. Most windows want the whole desk when filled and whatever they are
   * dragged to when free, which is what `null` says. A window whose content has a natural size —
   * an About box, a small form — says so, and is never stretched past it, however it is filled,
   * arranged or dragged.
   */
  readonly limits?: (id: WindowId) => WindowLimits | null
  /**
   * What this window is, behind an (i) at the end of its title bar — the same place in every window,
   * so a person who wonders what they are looking at always knows where to ask. Explanation only: a
   * warning, or anything that changes what someone is about to do, belongs in the window itself.
   */
  readonly info?: (id: WindowId) => ReactNode
  /** Window-wide controls on the trailing side of the title bar. One or two; more belongs in a toolbar. */
  readonly actions?: (id: WindowId) => ReactNode
  /** Shown when no window is on the desk — none open, or every one of them minimized. */
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

export function Desktop({ renderWindow, title, note, info, actions, limits, empty, loading, failed, layout = 'auto', className }: DesktopProps) {
  const desk = useDesk()
  const state = useDeskState()
  const stage = useRef<HTMLDivElement>(null)
  const touch = useMediaQuery(TOUCH)
  const mode: DeskLayout = layout === 'auto' ? (touch ? 'fullscreen' : 'desktop') : layout

  useLayoutEffect(() => {
    desk.setStage(() => ({ width: stage.current?.clientWidth ?? 1024, height: stage.current?.clientHeight ?? 768 }))
  }, [desk])

  /*
   * The desk changing size is not a layout decision, but it can undo one: unplug an external
   * display and the windows you spread across it are past the edge of the laptop screen, where
   * nothing can drag them back. They are brought in; plug the display back in and they go out
   * again exactly as they were.
   *
   * Filled windows need none of this — they are whatever size the desk is — so a desk of only
   * filled windows never commits anything here.
   */
  useEffect(() => {
    const element = stage.current
    if (!element || mode !== 'desktop') return undefined
    let frame = 0
    // Once per paint: dragging the browser window's edge fires this continuously.
    const refit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const fit = desk.fitToStage()
        /*
         * One window that no longer fits is brought in and made smaller, and that is enough. Two or
         * more means the layout itself is gone: each was clamped on its own, so windows that sat
         * side by side now sit on top of each other, and the desk is left looking like one window.
         * At that point it is laid out the way Arrange would — which is a layout for THIS screen,
         * while the frames from the big one are remembered and come back with it.
         */
        if (fit.squeezed.length > 1) arrangeNow(desk, element)
      })
    }
    // The stage can change size without the window doing so — a sidebar opening beside it — so the
    // element is watched where that can be watched, and the window is the fallback where it cannot.
    if (typeof ResizeObserver === 'undefined') {
      addEventListener('resize', refit)
      return () => {
        cancelAnimationFrame(frame)
        removeEventListener('resize', refit)
      }
    }
    const observer = new ResizeObserver(refit)
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [desk, mode])

  useEffect(() => (stage.current ? addDeskCommands(stage.current, desk) : undefined), [desk])

  // Arrange lays every window out once, as free windows that can be moved again straight away.
  useEffect(() => {
    const element = stage.current
    if (!element || mode !== 'desktop') return undefined
    return addCommandHandler(
      element,
      DeskCommands.arrange,
      () => arrangeNow(desk, element),
      {
        enabled: () => {
          const windows = onDesk(desk.getState())
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
      {onDesk(state).length === 0 && empty}
      {state.windows.map(window => (
        <WindowView
          key={window.id}
          window={window}
          layout={mode}
          depth={state.stack.indexOf(window.id)}
          focused={window.id === focused}
          // Offstage, not gone: it keeps its DOM, so nothing in it is lost. One window at a time on
          // touch, and minimizing, are the same thing to everything below this line.
          hidden={(mode === 'fullscreen' && window.id !== focused) || isMinimized(state, window.id)}
          minimized={isMinimized(state, window.id)}
          title={title(window.id)}
          note={note?.(window.id)}
          info={info?.(window.id)}
          limits={limits?.(window.id) ?? null}
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

type ControlGlyph = 'close' | 'minimize' | 'maximize' | 'restore'

/*
 * What each control does, drawn rather than lettered: a font puts its own cross where it likes, and
 * these are 12px wide. On a Mac the marks come up together when the pointer arrives over the cluster,
 * so a control is never chosen on colour alone, and zoom has one mark whichever way it goes. GNOME
 * and Windows show their marks all the time, and draw maximize and restore differently, as they do.
 */
const MAC = {
  close: <path d="M4.1 4.1 7.9 7.9M7.9 4.1 4.1 7.9" />,
  minimize: <path d="M3.6 6h4.8" />,
  maximize: <path d="M3.8 3.8h2.6L3.8 6.4zM8.2 8.2H5.6L8.2 5.6z" fill="currentColor" stroke="none" />,
}

const GLYPHS: Record<Look, Record<ControlGlyph, ReactNode>> = {
  mac: { ...MAC, restore: MAC.maximize },
  gnome: {
    close: <path d="M3.5 3.5 8.5 8.5M8.5 3.5 3.5 8.5" />,
    minimize: <path d="M3.5 8.5h5" />,
    maximize: <path d="M3.5 3.5h5v5h-5z" />,
    restore: <path d="M5 3h4v4M3 5h4v4H3z" />,
  },
  windows: {
    close: <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />,
    minimize: <path d="M2 6h8" />,
    maximize: <path d="M2.5 2.5h7v7h-7z" />,
    restore: <path d="M4 2.5h5.5V8M2.5 4H8v5.5H2.5z" />,
  },
}

const Glyph = ({ look, control }: { readonly look: Look; readonly control: ControlGlyph }) => (
  <svg className="desk-control-glyph" viewBox="0 0 12 12" aria-hidden="true">
    {GLYPHS[look][control]}
  </svg>
)

interface WindowControlsProps {
  readonly look: Look
  readonly layout: DeskLayout
  readonly filled: boolean
  readonly onClose: () => void
  readonly onMinimize: () => void
  readonly onZoom: () => void
}

/**
 * Close, minimize and zoom, in the platform's order and in the document in that order — never
 * reordered by CSS — so Tab walks them the way they read. One window at a time offers only Close.
 */
function WindowControls({ look, layout, filled, onClose, onMinimize, onZoom }: WindowControlsProps) {
  const close = (
    <button key="close" type="button" className="desk-control" data-control="close" aria-label="Close" onClick={onClose}>
      <Glyph look={look} control="close" />
    </button>
  )
  if (layout !== 'desktop') return <div className="desk-controls">{close}</div>
  // Off the desk, still open: nothing is unmounted, so nothing inside it is lost.
  const minimize = (
    <button key="minimize" type="button" className="desk-control" data-control="minimize" aria-label="Minimize" onClick={onMinimize}>
      <Glyph look={look} control="minimize" />
    </button>
  )
  // The same act everywhere — fill the desk and back — named and drawn the way each platform does.
  const label = look === 'mac' ? 'Zoom' : filled ? 'Restore' : 'Maximize'
  const zoom = (
    <button key="mode" type="button" className="desk-control" data-control="mode" aria-label={label} onClick={onZoom}>
      <Glyph look={look} control={filled ? 'restore' : 'maximize'} />
    </button>
  )
  return <div className="desk-controls">{look === 'mac' ? [close, minimize, zoom] : [minimize, zoom, close]}</div>
}

interface WindowViewProps {
  readonly window: DeskWindow
  readonly layout: DeskLayout
  readonly hidden?: boolean
  /** Hidden because it was minimized, rather than because another window has the screen. */
  readonly minimized?: boolean
  readonly depth: number
  readonly focused: boolean
  readonly title: ReactNode
  readonly note?: ReactNode
  readonly info?: ReactNode
  readonly limits?: WindowLimits | null
  readonly actions?: ReactNode
  readonly children: ReactNode
}

/** Moving by the title bar, or resizing from the corner or from the left, right or bottom edge. */
/** Lays every open window out at once: what Window → Arrange does, and what a shrunken desk needs. */
function arrangeNow(desk: Desk, element: HTMLElement) {
  const state = desk.getState()
  // Minimized windows are off the desk: laying one out would put it back without being asked.
  const windows = onDesk(state)
  const stack = state.stack.filter(id => !isMinimized(state, id))
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
}

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

function WindowView({ window, layout, hidden, minimized, depth, focused, title, note, info, actions, limits, children }: WindowViewProps) {
  const desk = useDesk()
  const look = useLook()
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

  // Double-clicking a title bar, or the zoom control, fills the desk with the window and back.
  const zoom = () => {
    if (layout === 'desktop') desk.toggleMode(window.id)
  }

  const frame = layout === 'desktop' ? (live ?? (window.mode === 'floating' ? window.frame : null)) : null
  /*
   * A window that says how big it may be is capped in the browser rather than in the state: filling
   * the desk, being arranged into a cell and being dragged wider all end at the same place, and the
   * window sits in the middle of whatever room it was given rather than pinned to a corner of it.
   */
  const capped: CSSProperties = {
    ...(limits?.maxWidth ? { maxWidth: limits.maxWidth } : {}),
    ...(limits?.maxHeight ? { maxHeight: limits.maxHeight } : {}),
    ...(limits?.minWidth ? { minWidth: limits.minWidth } : {}),
    ...(limits?.minHeight ? { minHeight: limits.minHeight } : {}),
    // Filled and capped: it sits in the middle of the room, not in the corner of it.
    ...(limits && (limits.maxWidth || limits.maxHeight) && !frame ? { margin: 'auto' } : {}),
  }
  const style: CSSProperties | undefined =
    layout !== 'desktop'
      ? capped
      : frame
        ? { left: frame.x, top: frame.y, width: frame.width, height: frame.height, zIndex: 10 + depth, ...capped }
        : { zIndex: 10 + depth, ...capped }

  const controls = (
    <WindowControls
      look={look}
      layout={layout}
      filled={window.mode === 'filled' && !live}
      onClose={() => desk.close(window.id)}
      onMinimize={() => desk.minimize(window.id)}
      onZoom={zoom}
    />
  )
  const heading = (
    <h2 id={titleId} className="desk-title">
      {title}
    </h2>
  )
  const windowNote = note != null && note !== false && <p className="desk-window-note">{note}</p>

  return (
    <WindowContext.Provider value={context}>
      <section
        ref={element}
        tabIndex={-1}
        {...{ [WINDOW_ATTRIBUTE]: window.id }}
        className="desk-window"
        data-mode={layout === 'fullscreen' ? 'fullscreen' : live ? 'floating' : window.mode}
        data-hidden={hidden || undefined}
        data-minimized={minimized || undefined}
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
          {look === 'mac' && controls}
          {look === 'gnome' ? (
            // Title and note stacked in the middle of the bar, as a GNOME header bar carries them.
            <div className="desk-titlebar-heading">
              {heading}
              {windowNote}
            </div>
          ) : (
            <>
              {heading}
              {windowNote}
            </>
          )}
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
          {look !== 'mac' && controls}
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
