import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

/*
 * Two panels in one window, with the edge between them to drag: a list beside its detail, a picker
 * beside the canvas it fills.
 *
 * They are one app, so they are one window: they open, close, minimize and move together, and
 * nothing can pull them apart. Only the edge between them moves, and it is remembered, so the side
 * panel opens at the width it was left at. Dragging things from one panel to the other is the
 * ordinary drag and drop (`useDragSource`, `useDropTarget`), which does not care where its ends are.
 */

export interface SplitProps {
  /** The panel at the edge: a list, a picker, an outline. */
  readonly side: ReactNode
  /** The rest of the window: what the side panel chooses for. */
  readonly children: ReactNode
  /** Which edge the side panel stands at. Default `start`. */
  readonly at?: 'start' | 'end'
  /** The side panel's width, in px, until it is dragged. Default 280. */
  readonly size?: number
  /** The narrowest it can be dragged to. Default 200. */
  readonly min?: number
  /**
   * The most of the window it may take, as CSS: `50%` (the default), `420px`. A width remembered from
   * a big screen never leaves a small one without room for the rest.
   */
  readonly max?: string
  /** Remembers the width in this browser under this key, so the panel opens at the width it was left at. */
  readonly remember?: string
  /** What the edge is called to assistive technology. Default "Resize". */
  readonly label?: string
  readonly className?: string
}

/** How far an arrow key moves the edge. */
const STEP = 16

const key = (name: string) => `desk.split.${name}`

function recall(name: string | undefined, fallback: number, min: number): number {
  if (!name) return fallback
  try {
    const stored = Number(globalThis.localStorage?.getItem(key(name)))
    // Storage is outside the program: anything that is not a usable width is none.
    return Number.isFinite(stored) && stored >= min ? stored : fallback
  } catch {
    return fallback
  }
}

function keep(name: string | undefined, width: number) {
  if (!name) return
  try {
    globalThis.localStorage?.setItem(key(name), String(width))
  } catch {
    // Private windows and full storage: the panel still resizes, it just opens at its default.
  }
}

export function Split({ side, children, at = 'start', size = 280, min = 200, max = '50%', remember, label = 'Resize', className }: SplitProps) {
  const initial = Math.max(min, size)
  const [width, setWidth] = useState(() => recall(remember, initial, min))
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const length = (px: number) => `min(${px}px, ${max})`

  const commit = (next: number) => {
    const clamped = Math.max(min, Math.round(next))
    setWidth(clamped)
    keep(remember, clamped)
  }

  /*
   * While dragging, only the variable on this element changes, so the panels follow the pointer
   * without re-rendering what is in them; the width is committed once, on release. It starts from
   * the width as drawn, which `max` may have capped, so the edge never lags behind the pointer.
   */
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const element = root.current
    const origin = panel.current?.getBoundingClientRect().width ?? width
    const startX = event.clientX
    let next = origin
    handle.setPointerCapture?.(event.pointerId)
    if (element) element.dataset.dragging = ''
    const onMove = (move: PointerEvent) => {
      // Towards the middle is wider, whichever edge the panel is at.
      const pulled = at === 'start' ? move.clientX - startX : startX - move.clientX
      next = Math.max(min, origin + pulled)
      element?.style.setProperty('--desk-split-size', length(next))
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      if (element) delete element.dataset.dragging
      // Back to what React drew, so the commit is what draws the new width, and a click draws nothing.
      element?.style.setProperty('--desk-split-size', length(width))
      if (Math.round(next) !== Math.round(origin)) commit(next)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  // The edge is a separator that can be focused, so the width can be set without a pointer.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const wider = at === 'start' ? 'ArrowRight' : 'ArrowLeft'
    const narrower = at === 'start' ? 'ArrowLeft' : 'ArrowRight'
    const drawn = panel.current?.getBoundingClientRect().width || width
    if (event.key === wider) commit(drawn + STEP)
    else if (event.key === narrower) commit(drawn - STEP)
    else if (event.key === 'Home') commit(min)
    else if (event.key === 'Enter') commit(initial)
    else return
    event.preventDefault()
  }

  const sidePanel = (
    <div key="side" ref={panel} className="desk-split-panel" data-side="">
      {side}
    </div>
  )
  const edge = (
    <div
      key="edge"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      tabIndex={0}
      className="desk-split-edge"
      onPointerDown={startDrag}
      onKeyDown={onKeyDown}
      // Back to the width it started at, as a double-click on a divider does on a Mac.
      onDoubleClick={() => commit(initial)}
    />
  )
  const main = (
    <div key="main" className="desk-split-panel">
      {children}
    </div>
  )

  return (
    <div
      ref={root}
      className={['desk-split', className].filter(Boolean).join(' ')}
      data-at={at}
      style={{ '--desk-split-size': length(width) } as CSSProperties}
    >
      {/* In reading order, so Tab walks the panels the way they are drawn. */}
      {at === 'start' ? [sidePanel, edge, main] : [main, edge, sidePanel]}
    </div>
  )
}
