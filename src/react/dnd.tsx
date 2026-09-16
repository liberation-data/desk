import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { WINDOW_ATTRIBUTE } from '../core/commands.js'
import { useDesk, useWindowId } from './context.js'

/*
 * Dragging something from one window to another — a ride onto the map, a
 * document into a conversation. Built on Pointer Events rather than HTML5
 * drag-and-drop: the same code then works for touch and pen, the preview is
 * ours to draw, and a drag can be cancelled with Escape.
 *
 * What is dragged is a `type` and a `payload`. A target says which types it
 * takes; nothing else about the two windows is shared.
 */

export interface Drag<T = unknown> {
  readonly type: string
  readonly payload: T
  /** The window it was picked up in, when it was picked up in one. */
  readonly from: string | null
}

export type Accepts = string | readonly string[] | ((type: string) => boolean)

const accepted = (accepts: Accepts, type: string) =>
  typeof accepts === 'function' ? accepts(type) : typeof accepts === 'string' ? accepts === type : accepts.includes(type)

interface Target {
  readonly accepts: Accepts
  readonly onDrop: (drag: Drag) => void
}

interface DragState {
  readonly drag: Drag
  readonly x: number
  readonly y: number
  readonly over: string | null
  readonly preview: ReactNode
}

interface DragContextValue {
  readonly state: DragState | null
  readonly targets: Map<string, Target>
  readonly setState: (state: DragState | null) => void
}

const DragContext = createContext<DragContextValue | null>(null)

const TARGET_ATTRIBUTE = 'data-desk-drop'

export function DragProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<DragState | null>(null)
  const [targets] = useState(() => new Map<string, Target>())
  const value = useMemo(() => ({ state, targets, setState }), [state, targets])
  return (
    <DragContext.Provider value={value}>
      {children}
      {state && (
        <DragPreview x={state.x} y={state.y}>
          {state.preview}
        </DragPreview>
      )}
    </DragContext.Provider>
  )
}

function DragPreview({ x, y, children }: { readonly x: number; readonly y: number; readonly children: ReactNode }) {
  return createPortal(
    <div className="desk-drag-preview" style={{ left: x, top: y }} aria-hidden="true">
      {children}
    </div>,
    document.body,
  )
}

const useDrag = () => {
  const context = useContext(DragContext)
  if (!context) throw new Error('Dragging needs a <DeskProvider> (or <DragProvider>) above it')
  return context
}

/** What is being dragged right now, for a window that wants to show it is ready. */
export const useDragging = (): Drag | null => useDrag().state?.drag ?? null

export interface DraggableOptions<T> {
  readonly type: string
  readonly payload: T
  /** What follows the pointer. Defaults to the type. */
  readonly preview?: ReactNode
  readonly disabled?: boolean
}

export interface DraggableResult {
  readonly dragProps: { readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void; readonly 'data-desk-draggable': true }
  readonly dragging: boolean
}

export interface DragSourceOptions {
  readonly type: string
  readonly disabled?: boolean
}

export interface DragSource<T> {
  /** Props for one item in a list: `rowProps={row => source.dragProps(row, row.name)}`. */
  readonly dragProps: (payload: T, preview?: ReactNode) => DraggableResult['dragProps']
  readonly dragging: boolean
}

/**
 * One source for a list of things: a hook cannot be called per row, so the row
 * says what it is as it is picked up.
 */
export function useDragSource<T>({ type, disabled }: DragSourceOptions): DragSource<T> {
  const { targets, setState } = useDrag()
  const from = useWindowId()
  const desk = useDesk()
  const [dragging, setDragging] = useState(false)

  const start = useCallback(
    (payload: T, preview: ReactNode) => (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) return
      const startX = event.clientX
      const startY = event.clientY
      const handle = event.currentTarget
      let started = false

      const findTarget = (x: number, y: number) => {
        const element = document.elementFromPoint(x, y)?.closest(`[${TARGET_ATTRIBUTE}]`)
        const key = element?.getAttribute(TARGET_ATTRIBUTE) ?? null
        const target = key ? targets.get(key) : undefined
        return target && accepted(target.accepts, type) ? key : null
      }

      const onMove = (move: PointerEvent) => {
        if (!started && Math.hypot(move.clientX - startX, move.clientY - startY) < 5) return
        if (!started) {
          started = true
          setDragging(true)
          handle.setPointerCapture?.(move.pointerId)
        }
        move.preventDefault()
        setState({
          drag: { type, payload, from },
          x: move.clientX,
          y: move.clientY,
          over: findTarget(move.clientX, move.clientY),
          preview: preview ?? type,
        })
      }

      const finish = (drop: boolean, released?: PointerEvent) => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('keydown', onKey)
        if (!started) return
        setDragging(false)
        const key = drop && released ? findTarget(released.clientX, released.clientY) : null
        const target = key ? targets.get(key) : undefined
        setState(null)
        if (!target) return
        target.onDrop({ type, payload, from })
        // The window that took it comes forward: that is where the work moved to.
        const window = document.querySelector(`[${TARGET_ATTRIBUTE}="${key}"]`)?.closest(`[${WINDOW_ATTRIBUTE}]`)
        const windowId = window?.getAttribute(WINDOW_ATTRIBUTE)
        if (windowId) desk.focus(windowId)
      }

      const onUp = (up: PointerEvent) => finish(true, up)
      const onKey = (key: KeyboardEvent) => {
        if (key.key === 'Escape') finish(false)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('keydown', onKey)
    },
    [disabled, type, from, setState, targets, desk],
  )

  return {
    dragProps: useCallback((payload: T, preview?: ReactNode) => ({ onPointerDown: start(payload, preview), 'data-desk-draggable': true as const }), [start]),
    dragging,
  }
}

/** Makes one thing picked up and carried. Spread `dragProps` on the element. */
export function useDraggable<T>({ type, payload, preview, disabled }: DraggableOptions<T>): DraggableResult {
  const source = useDragSource<T>({ type, ...(disabled === undefined ? {} : { disabled }) })
  return { dragProps: source.dragProps(payload, preview), dragging: source.dragging }
}

export interface DropTargetOptions<T> {
  readonly accepts: Accepts
  readonly onDrop: (drag: Drag<T>) => void
  readonly disabled?: boolean
}

export interface DropTargetResult {
  readonly dropProps: Record<string, string | undefined>
  /** Something acceptable is being carried over this target right now. */
  readonly over: boolean
  /** Something acceptable is being carried somewhere: show where it could go. */
  readonly ready: boolean
}

/** Makes something a place to drop. Spread `dropProps` on the element. */
export function useDropTarget<T>({ accepts, onDrop, disabled }: DropTargetOptions<T>): DropTargetResult {
  const { state, targets } = useDrag()
  const id = useId()
  const latest = useRef({ accepts, onDrop })
  latest.current = { accepts, onDrop }

  useEffect(() => {
    if (disabled) return
    targets.set(id, {
      accepts: type => accepted(latest.current.accepts, type),
      onDrop: drag => latest.current.onDrop(drag as Drag<T>),
    })
    return () => {
      targets.delete(id)
    }
  }, [id, targets, disabled])

  const ready = Boolean(state && !disabled && accepted(accepts, state.drag.type))
  const over = ready && state?.over === id
  return {
    // The marks the stylesheet looks for, so a target lights up without the app wiring it.
    dropProps: {
      [TARGET_ATTRIBUTE]: disabled ? undefined : id,
      ...(ready ? { 'data-ready': 'true' } : {}),
      ...(over ? { 'data-over': 'true' } : {}),
    },
    over,
    ready,
  }
}
