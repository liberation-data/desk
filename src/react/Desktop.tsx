import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { addDeskCommands, STAGE_ATTRIBUTE, WINDOW_ATTRIBUTE, windowElement } from '../core/commands.js'
import { focusedId } from '../core/desk.js'
import type { DeskWindow, Frame, WindowId } from '../core/types.js'
import { useDesk, useDeskState, WindowContext } from './context.js'
import { WindowBoundary } from './windowBoundary.js'
import type { WindowFailed, WindowLoading } from './windowBoundary.js'

export type DeskLayout = 'desktop' | 'fullscreen'

export interface DesktopProps {
  readonly renderWindow: (id: WindowId) => ReactNode
  readonly title: (id: WindowId) => ReactNode
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

const MIN_SPLIT = 0.2

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

const fullFrame = (stage: HTMLElement): Frame => {
  const { x, y, width, height } = arrangementArea(stage)
  return { x, y, width, height }
}

export function Desktop({ renderWindow, title, actions, empty, loading, failed, layout = 'auto', className }: DesktopProps) {
  // Where the split between two tiles sits. A third tile makes it a grid again.
  const [split, setSplit] = useState(0.5)
  const desk = useDesk()
  const state = useDeskState()
  const stage = useRef<HTMLDivElement>(null)
  const touch = useMediaQuery(TOUCH)
  const mode: DeskLayout = layout === 'auto' ? (touch ? 'fullscreen' : 'desktop') : layout

  useLayoutEffect(() => {
    desk.setStage(() => ({ width: stage.current?.clientWidth ?? 1024, height: stage.current?.clientHeight ?? 768 }))
  }, [desk])

  useEffect(() => (stage.current ? addDeskCommands(stage.current, desk) : undefined), [desk])

  // Arranged windows are placed once, not held in place. The first time a person moves or
  // resizes one, every tile becomes an independent window exactly where it sits, so the
  // others stay put instead of reflowing into the space.
  const letGo = useCallback(() => {
    const element = stage.current
    if (!element) return
    const box = element.getBoundingClientRect()
    const frames = Object.fromEntries(
      desk
        .getState()
        .windows.filter(w => w.mode === 'tiled')
        .flatMap(w => {
          const rect = windowElement(element, w.id)?.getBoundingClientRect()
          return rect ? [[w.id, { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height }] as const] : []
        }),
    )
    desk.placeAll(frames)
  }, [desk])

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

  const splittable = mode === 'desktop' && tiled === 2
  const style = {
    '--desk-columns': mode === 'fullscreen' ? 1 : columnsFor(tiled),
    ...(splittable ? { gridTemplateColumns: `minmax(0, ${split}fr) auto minmax(0, ${1 - split}fr)` } : {}),
  } as CSSProperties

  const dragSplit = (event: ReactPointerEvent<HTMLElement>) => {
    const box = stage.current?.getBoundingClientRect()
    if (!box) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture?.(event.pointerId)
    // From where it was grabbed, not from where the pointer happens to be: taking
    // the raw position makes the split jump to meet the pointer on the first move.
    const startX = event.clientX
    const startSplit = split
    const onMove = (move: PointerEvent) => {
      const fraction = startSplit + (move.clientX - startX) / box.width
      setSplit(Math.min(1 - MIN_SPLIT, Math.max(MIN_SPLIT, fraction)))
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={stage}
      className={['desk-stage', className].filter(Boolean).join(' ')}
      data-layout={mode}
      style={style}
      {...{ [STAGE_ATTRIBUTE]: '' }}
    >
      {state.windows.length === 0 && empty}
      {splittable && (
        <div
          className="desk-split"
          role="separator"
          aria-orientation="vertical"
          aria-label="Split between the windows"
          aria-valuenow={Math.round(split * 100)}
          aria-valuemin={Math.round(MIN_SPLIT * 100)}
          aria-valuemax={Math.round((1 - MIN_SPLIT) * 100)}
          tabIndex={0}
          onPointerDown={dragSplit}
          onDoubleClick={() => setSplit(0.5)}
          onKeyDown={event => {
            const step = event.key === 'ArrowLeft' ? -0.05 : event.key === 'ArrowRight' ? 0.05 : 0
            if (!step) return
            event.preventDefault()
            setSplit(current => Math.min(1 - MIN_SPLIT, Math.max(MIN_SPLIT, current + step)))
          }}
        />
      )}
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
          actions={actions?.(window.id)}
          letGo={letGo}
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
  readonly actions?: ReactNode
  readonly letGo: () => void
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

function WindowView({ window, layout, hidden, depth, focused, title, actions, letGo, children }: WindowViewProps) {
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
    // A tile is let go of exactly where it already sits, so it does not jump under the pointer.
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
        letGo()
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

  const floating = window.mode === 'floating' && layout === 'desktop'
  // Where it was before it was zoomed, so zooming again puts it back.
  const unzoomed = useRef<Frame | null>(null)

  // Double-clicking a title bar, or the green control, zooms a window to fill the desk and
  // back — as on a Mac. It is a placement by hand, so any arrangement is let go of first.
  const zoom = () => {
    const stage = element.current?.closest<HTMLElement>(`[${STAGE_ATTRIBUTE}]`)
    if (layout !== 'desktop' || !stage) return
    if (desk.getState().windows.some(w => w.mode === 'tiled')) letGo()
    const current = desk.getState().windows.find(w => w.id === window.id)
    if (current?.mode !== 'floating') return
    const full = fullFrame(stage)
    const isZoomed = Math.abs(current.frame.width - full.width) < 2 && Math.abs(current.frame.height - full.height) < 2
    if (isZoomed && unzoomed.current) {
      const back = unzoomed.current
      unzoomed.current = null
      desk.float(window.id, back)
    } else {
      unzoomed.current = current.frame
      desk.float(window.id, full)
    }
  }

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
