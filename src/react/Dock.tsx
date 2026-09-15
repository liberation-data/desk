import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { focusedId, isOpen } from '../core/desk.js'
import type { DeskState, WindowId } from '../core/types.js'
import { useDesk, useDeskState } from './context.js'

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
}

const windowOf = (item: DockItem) => item.window ?? item.id

const statusOf = (state: DeskState, items: readonly DockItem[]) => ({
  running: items.some(i => isOpen(state, windowOf(i))),
  focused: items.some(i => focusedId(state) === windowOf(i)),
})

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

export function Dock({ entries, label = 'Dock', placement = 'overlay', className }: DockProps) {
  const [openStack, setOpenStack] = useState<string | null>(null)
  const firstFocusable = entries.find(e => e.type !== 'separator')?.id

  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={['desk-dock', className].filter(Boolean).join(' ')}
      data-placement={placement}
      onKeyDown={event => {
        if ((event.target as HTMLElement).closest('.desk-stack')) return
        roveFocus(event, { next: ['ArrowRight'], previous: ['ArrowLeft'] })
      }}
    >
      {entries.map(entry => {
        if (entry.type === 'separator') return <span key={entry.id} className="desk-dock-separator" role="separator" />
        if (entry.type === 'item')
          return <DockButton key={entry.id} item={entry} tabIndex={entry.id === firstFocusable ? 0 : -1} />
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

function DockButton({ item, tabIndex }: { readonly item: DockItem; readonly tabIndex: number }) {
  const desk = useDesk()
  const { running, focused } = statusOf(useDeskState(), [item])
  return (
    <button
      type="button"
      data-rove
      tabIndex={tabIndex}
      className="desk-dock-item"
      aria-label={item.label}
      data-running={running || undefined}
      data-focused={focused || undefined}
      disabled={item.disabled}
      onClick={() => (item.onSelect ? item.onSelect() : desk.open(windowOf(item)))}
    >
      <span className="desk-dock-icon" aria-hidden="true">
        {item.icon}
      </span>
      {item.badge != null && <Badge>{item.badge}</Badge>}
      <span className="desk-dock-tip" aria-hidden="true">
        {item.label}
      </span>
    </button>
  )
}

interface StackButtonProps {
  readonly stack: DockStack
  readonly tabIndex: number
  readonly open: boolean
  /** The dock's own state setter: stable across renders, so effects below do not re-run. */
  readonly setOpenStack: (id: string | null) => void
}

function StackButton({ stack, tabIndex, open, setOpenStack }: StackButtonProps) {
  const desk = useDesk()
  const state = useDeskState()
  const { running, focused } = statusOf(state, stack.items)
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

  const badges = stack.items.filter(i => i.badge != null).length

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
        {badges > 0 && <Badge>{badges}</Badge>}
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
