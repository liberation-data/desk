import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { focusedId, instancesOf, isMinimized, windowType } from '../core/desk.js'
import type { DeskState, WindowId } from '../core/types.js'
import { useDesk, useDeskState } from './context.js'
import { useContextMenu } from './contextMenu.js'
import { useDragSource, useDropTarget } from './dnd.js'
import type { Accepts, Drag } from './dnd.js'
import { accepted } from './dragContext.js'
import type { MenuItem } from './MenuBar.js'

export interface DockItem {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
  /** The window this item opens and reports as running. Defaults to the item's id. */
  readonly window?: WindowId
  /** One line under the label inside a stack. */
  readonly description?: string
  readonly badge?: ReactNode
  /** Replaces the default of opening the item's window. */
  readonly onSelect?: () => void
  readonly disabled?: boolean
  /** What a right-click (or the Menu key) offers for this item: Open, Remove from Dock. */
  readonly contextMenu?: () => readonly MenuItem[]
  /** Can be dragged along the dock to a new place, when the dock has `pins.onMove`. */
  readonly movable?: boolean
}

/** The drag type of an item carried along the dock; its payload is the item's id. */
export const DOCK_ITEM = 'desk.dock-item'

/*
 * Keeping things in the dock. The dock does not store what is kept: the app does, where it keeps its
 * other preferences, and passes the kept items back as entries. The dock reports what the person did:
 * dropped something on it, or carried a kept item to a new place. `before` is the id of the item it
 * landed on, which it goes in front of, or null for the end.
 */
export interface DockPins {
  /** The drag types that can be kept by dropping them on the dock. */
  readonly accepts: Accepts
  readonly onPin: (drag: Drag, before: string | null) => void
  readonly onMove?: (id: string, before: string | null) => void
}

export interface DockStack {
  readonly id: string
  readonly label: string
  readonly items: readonly DockItem[]
  /** Defaults to the first four item icons, the way a folder previews its contents. */
  readonly icon?: ReactNode
}

export type DockEntry =
  | ({ readonly type: 'item' } & DockItem)
  | ({ readonly type: 'stack' } & DockStack)
  | { readonly type: 'separator'; readonly id: string }

export const dockItem = (item: DockItem): DockEntry => ({ type: 'item', ...item })
export const dockStack = (stack: DockStack): DockEntry => ({ type: 'stack', ...stack })
export const dockSeparator = (id: string): DockEntry => ({ type: 'separator', id })

export interface DockProps {
  readonly entries: readonly DockEntry[]
  readonly label?: string
  /** `overlay` floats the dock over the bottom of its positioned parent; `inline` leaves layout to you. */
  readonly placement?: 'overlay' | 'inline'
  readonly className?: string
  readonly pins?: DockPins
}

const windowOf = (item: DockItem) => item.window ?? item.id

const statusOf = (state: DeskState, items: readonly DockItem[]) => {
  const key = focusedId(state)
  const windows = items.flatMap(i => instancesOf(state, windowOf(i)))
  return {
    // Any window of this kind counts: a second query window is still Query, running.
    running: windows.length > 0,
    focused: items.some(i => key !== null && windowType(key) === windowOf(i)),
    // Open, and none of it on the desk. One window of a kind still showing means the item is not.
    minimized: windows.length > 0 && windows.every(w => isMinimized(state, w.id)),
  }
}

/** Moves focus among the buttons in a container with arrow keys, Home and End. */
function roveFocus(event: KeyboardEvent<HTMLElement>, keys: { next: string[]; previous: string[] }) {
  // Only this container's own buttons: the dock must not rove into an open stack, nor a stack back out.
  const container = event.currentTarget
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-rove]:not(:disabled)')].filter(
    b => b.parentElement?.closest('[role="toolbar"], .desk-stack') === container,
  )
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (index < 0) return
  const target =
    keys.next.includes(event.key) ? buttons[(index + 1) % buttons.length]
    : keys.previous.includes(event.key) ? buttons[(index - 1 + buttons.length) % buttons.length]
    : event.key === 'Home' ? buttons[0]
    : event.key === 'End' ? buttons.at(-1)
    : undefined
  if (!target) return
  event.preventDefault()
  buttons.forEach(b => (b.tabIndex = b === target ? 0 : -1))
  target.focus()
}

export function Dock({ entries, label = 'Dock', placement = 'overlay', className, pins }: DockProps) {
  const [openStack, setOpenStack] = useState<string | null>(null)
  const firstFocusable = entries.find(e => e.type !== 'separator')?.id
  const { dropProps } = useDropTarget({
    accepts: pinAccepts(pins),
    onDrop: drag => deliver(pins, drag, null),
    disabled: !pins,
  })

  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={['desk-dock', className].filter(Boolean).join(' ')}
      data-placement={placement}
      {...dropProps}
      onKeyDown={event => {
        if ((event.target as HTMLElement).closest('.desk-stack')) return
        roveFocus(event, { next: ['ArrowRight'], previous: ['ArrowLeft'] })
      }}
    >
      {entries.map(entry => {
        if (entry.type === 'separator') return <span key={entry.id} className="desk-dock-separator" role="separator" />
        if (entry.type === 'item')
          return <DockButton key={entry.id} item={entry} tabIndex={entry.id === firstFocusable ? 0 : -1} pins={pins} />
        return (
          <StackButton
            key={entry.id}
            stack={entry}
            tabIndex={entry.id === firstFocusable ? 0 : -1}
            open={openStack === entry.id}
            setOpenStack={setOpenStack}
          />
        )
      })}
    </div>
  )
}

function Badge({ children }: { readonly children: ReactNode }) {
  return <span className="desk-dock-badge">{children}</span>
}

// A kept item can be carried along the dock as well as whatever the app lets it keep.
const pinAccepts = (pins: DockPins | undefined): Accepts => type =>
  Boolean(pins) && ((type === DOCK_ITEM && Boolean(pins?.onMove)) || (type !== DOCK_ITEM && accepted(pins!.accepts, type)))

function deliver(pins: DockPins | undefined, drag: Drag, before: string | null) {
  if (!pins) return
  if (drag.type === DOCK_ITEM) {
    const id = drag.payload as string
    if (id !== before) pins.onMove?.(id, before)
  } else pins.onPin(drag, before)
}

interface DockButtonProps {
  readonly item: DockItem
  readonly tabIndex: number
  readonly pins: DockPins | undefined
}

function DockButton({ item, tabIndex, pins }: DockButtonProps) {
  const desk = useDesk()
  const { running, focused, minimized } = statusOf(useDeskState(), [item])
  const context = useContextMenu({ label: item.label, items: item.contextMenu ?? (() => []), disabled: !item.contextMenu })
  // Only kept items take drops, so something carried lands among them and never splits the fixed ones.
  const droppable = Boolean(pins && item.movable)
  const { dropProps } = useDropTarget({ accepts: pinAccepts(pins), onDrop: drag => deliver(pins, drag, item.id), disabled: !droppable })
  const source = useDragSource<string>({ type: DOCK_ITEM, disabled: !(droppable && pins?.onMove) })
  const drag = droppable && pins?.onMove ? source.dragProps(item.id, <span className="desk-dock-icon">{item.icon}</span>) : {}
  return (
    <>
    <button
      type="button"
      data-rove
      tabIndex={tabIndex}
      className="desk-dock-item"
      aria-label={item.label}
      data-running={running || undefined}
      data-focused={focused || undefined}
      data-minimized={minimized || undefined}
      // An item with a menu stays reachable while it cannot open, so it can still be removed.
      disabled={item.disabled && !item.contextMenu}
      aria-disabled={(item.disabled && item.contextMenu && true) || undefined}
      {...dropProps}
      {...drag}
      onClick={() => {
        if (item.disabled) return
        if (item.onSelect) item.onSelect()
        else desk.open(windowOf(item))
      }}
      onContextMenu={context.target.onContextMenu}
      onKeyDown={context.target.onKeyDown}
    >
      <span className="desk-dock-icon" aria-hidden="true">
        {item.icon}
      </span>
      {item.badge != null && <Badge>{item.badge}</Badge>}
      <span className="desk-dock-tip" aria-hidden="true">
        {item.label}
      </span>
    </button>
    {context.menu}
    </>
  )
}

interface StackButtonProps {
  readonly stack: DockStack
  readonly tabIndex: number
  readonly open: boolean
  /** The dock's own state setter: stable across renders, so effects below do not re-run. */
  readonly setOpenStack: (id: string | null) => void
}

/**
 * What a stack is waiting on, gathered onto its closed icon.
 *
 * A stack hides its items, so whatever they are counting is invisible until somebody opens it —
 * which is the one thing a badge exists to prevent. Numbers ADD UP: three unread here and five
 * there is eight waiting behind this icon, and reporting "2" instead answers a question nobody
 * asked ("how many of your items have something?").
 *
 * A badge is a ReactNode, so it is not always a number — an app may use a dot, a glyph, or "99+"
 * for a count it has already capped. Those cannot be summed, and inventing a total across them
 * would be worse than saying less, so a stack holding any non-numeric badge falls back to the
 * count of badged items. Mixed stays mixed on purpose: a partial sum would read as a total.
 *
 * Null when nothing is waiting, so the caller renders no badge at all rather than a zero.
 */
function stackBadge(items: readonly DockItem[]): ReactNode | null {
  const badged = items.filter(i => i.badge != null)
  if (badged.length === 0) return null
  const numbers = badged.map(i => (typeof i.badge === 'number' ? i.badge : null))
  if (numbers.some(n => n === null)) return badged.length
  return (numbers as number[]).reduce((total, n) => total + n, 0)
}

function StackButton({ stack, tabIndex, open, setOpenStack }: StackButtonProps) {
  const desk = useDesk()
  const state = useDeskState()
  const { running, focused, minimized } = statusOf(state, stack.items)
  const onOpenChange = (next: boolean) => setOpenStack(next ? stack.id : null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('[data-rove]:not(:disabled)')?.focus()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpenStack(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, setOpenStack])

  const close = () => {
    onOpenChange(false)
    button.current?.focus()
  }

  const select = (item: DockItem) => {
    if (item.onSelect) item.onSelect()
    else desk.open(windowOf(item))
    onOpenChange(false)
  }

  const badges = stackBadge(stack.items)

  return (
    <span className="desk-dock-slot">
      <button
        ref={button}
        type="button"
        data-rove
        tabIndex={tabIndex}
        className="desk-dock-item"
        data-stack
        aria-label={stack.label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-running={running || undefined}
        data-focused={focused || undefined}
        data-minimized={minimized || undefined}
        onClick={() => onOpenChange(!open)}
      >
        <span className="desk-dock-icon" aria-hidden="true">
          {stack.icon ?? (
            <span className="desk-dock-preview">
              {stack.items.slice(0, 4).map(i => (
                <span key={i.id}>{i.icon}</span>
              ))}
            </span>
          )}
        </span>
        {badges != null && <Badge>{badges}</Badge>}
        <span className="desk-dock-tip" aria-hidden="true">
          {stack.label}
        </span>
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label={stack.label}
          className="desk-stack"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              close()
              return
            }
            roveFocus(event, { next: ['ArrowRight', 'ArrowDown'], previous: ['ArrowLeft', 'ArrowUp'] })
          }}
        >
          <p className="desk-stack-title">{stack.label}</p>
          <div className="desk-stack-grid">
            {stack.items.map(item => {
              const status = statusOf(state, [item])
              return (
                <button
                  key={item.id}
                  type="button"
                  data-rove
                  className="desk-stack-item"
                  data-running={status.running || undefined}
                  data-minimized={status.minimized || undefined}
                  disabled={item.disabled}
                  onClick={() => select(item)}
                >
                  <span className="desk-dock-icon" aria-hidden="true">
                    {item.icon}
                    {item.badge != null && <Badge>{item.badge}</Badge>}
                  </span>
                  <span className="desk-stack-label">{item.label}</span>
                  {item.description && <span className="desk-stack-description">{item.description}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
