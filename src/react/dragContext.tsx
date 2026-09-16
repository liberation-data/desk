import { createContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/*
 * The state behind dragging, kept apart from the hooks that use it: a desk
 * provides this, and the hooks reach for the desk — so this file must not.
 */

export interface Drag<T = unknown> {
  readonly type: string
  readonly payload: T
  /** The window it was picked up in, when it was picked up in one. */
  readonly from: string | null
}

export type Accepts = string | readonly string[] | ((type: string) => boolean)

export const accepted = (accepts: Accepts, type: string) =>
  typeof accepts === 'function' ? accepts(type) : typeof accepts === 'string' ? accepts === type : accepts.includes(type)

export interface Target {
  readonly accepts: Accepts
  readonly onDrop: (drag: Drag) => void
}

export interface DragState {
  readonly drag: Drag
  readonly x: number
  readonly y: number
  readonly over: string | null
  readonly preview: ReactNode
}

export interface DragContextValue {
  readonly state: DragState | null
  readonly targets: Map<string, Target>
  readonly setState: (state: DragState | null) => void
}

export const DragContext = createContext<DragContextValue | null>(null)

export const TARGET_ATTRIBUTE = 'data-desk-drop'

/** Holds what is being carried. A desk provides one; this is for sharing or nesting. */
export function DragProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<DragState | null>(null)
  const [targets] = useState(() => new Map<string, Target>())
  const value = useMemo(() => ({ state, targets, setState }), [state, targets])
  return (
    <DragContext.Provider value={value}>
      {children}
      {state && (
        <div className="desk-drag-preview" style={{ left: state.x, top: state.y }} aria-hidden="true">
          {state.preview}
        </div>
      )}
    </DragContext.Provider>
  )
}
