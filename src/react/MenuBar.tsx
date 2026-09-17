import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { canPerform, perform } from '../core/commands.js'
import type { CommandId } from '../core/commands.js'
import { focusedId } from '../core/desk.js'
import { bindShortcuts, formatShortcut, isApplePlatform } from '../core/shortcuts.js'
import type { Desk } from '../core/desk.js'
import type { DeskState, WindowId } from '../core/types.js'
import { useDesk } from './context.js'

/*
 * A menu bar in the AppKit manner. Menus never take keyboard focus from the
 * window you were working in — they are driven by a document key listener while
 * open — so a command chosen from a menu reaches the same responder a shortcut
 * would. Items ask the responder chain whether they are enabled as the menu opens.
 */

type Flag = boolean | (() => boolean)

interface ItemCommon {
  readonly label: string
  /** Shown after the label, muted. */
  readonly detail?: string
  readonly shortcut?: string
  readonly checked?: Flag
}

export type MenuItem =
  | ({ readonly type: 'command'; readonly command: CommandId; readonly args?: unknown } & ItemCommon)
  | ({ readonly type: 'action'; readonly onSelect: () => void; readonly disabled?: Flag } & ItemCommon)
  | { readonly type: 'separator' }
  | { readonly type: 'header'; readonly label: string }

export interface Menu {
  readonly id: string
  /** The accessible name, and the title when `title` is not given. */
  readonly label: string
  /** A richer title: an icon, a badge. */
  readonly title?: ReactNode
  /** The app's own menu: its name, set in bold. Conventionally the first one. */
  readonly emphasis?: boolean
  /** Items, or a function called each time the menu opens — for lists that change, like open windows. */
  readonly items: readonly MenuItem[] | (() => readonly MenuItem[])
}

type Options<T> = Omit<T, 'type' | 'label'>
export const menuCommand = (label: string, command: CommandId, options: Omit<Options<Extract<MenuItem, { type: 'command' }>>, 'command'> = {}): MenuItem => ({
  type: 'command',
  label,
  command,
  ...options,
})
export const menuAction = (label: string, onSelect: () => void, options: Omit<Options<Extract<MenuItem, { type: 'action' }>>, 'onSelect'> = {}): MenuItem => ({
  type: 'action',
  label,
  onSelect,
  ...options,
})
export const menuSeparator = (): MenuItem => ({ type: 'separator' })
export const menuHeader = (label: string): MenuItem => ({ type: 'header', label })

/** One item per open window, the key window checked — what a Window menu lists at its foot. */
export function windowMenuItems(state: DeskState, focus: (id: WindowId) => void, title: (id: WindowId) => string): MenuItem[] {
  const key = focusedId(state)
  return state.windows.map(w => menuAction(title(w.id), () => focus(w.id), { checked: w.id === key }))
}

export interface MenuBarProps {
  /** Menus on the leading side, in order. The first is conventionally the app's own. */
  readonly menus: readonly Menu[]
  /** Status menus on the trailing side. */
  readonly status?: readonly Menu[]
  /** Leading content before the menus, e.g. the app's mark. */
  readonly leading?: ReactNode
  /** Trailing content after the status menus, e.g. a clock. */
  readonly trailing?: ReactNode
  readonly label?: string
  /** Bind the shortcuts of command items, in every menu. Default true. */
  readonly shortcuts?: boolean
  readonly className?: string
}

/** A menu item as it stands when the menu opens: whether it can be chosen, and whether it is checked. */
export interface ResolvedMenuItem {
  readonly item: MenuItem
  readonly enabled: boolean
  readonly checked: boolean | undefined
}
type Resolved = ResolvedMenuItem

interface OpenMenu {
  readonly id: string
  readonly items: readonly Resolved[]
  readonly active: number
  readonly via: 'pointer' | 'keyboard'
}

const read = (flag: Flag | undefined) => (typeof flag === 'function' ? flag() : flag)

/** Can this item be moved to and chosen: an enabled command or action, not a separator or header. */
export const selectable = (r: Resolved) => r.enabled && (r.item.type === 'command' || r.item.type === 'action')

/** Items as they stand now: commands ask the responder chain whether anything would handle them. */
export const resolveMenuItems = (desk: Desk | null, items: readonly MenuItem[]): Resolved[] =>
  items.map(item => ({
    item,
    enabled:
      item.type === 'command' ? canPerform(desk, item.command)
      : item.type === 'action' ? !read(item.disabled)
      : false,
    checked: item.type === 'command' || item.type === 'action' ? read(item.checked) : undefined,
  }))

/** The next selectable item from `from`, wrapping; -1 when there is none. */
export const stepMenu = (items: readonly Resolved[], from: number, delta: 1 | -1) => {
  for (let i = 1; i <= items.length; i++) {
    const index = (from + delta * i + items.length * 2) % items.length
    if (items[index] && selectable(items[index])) return index
  }
  return -1
}

/** The next selectable item whose label starts with `letter`, after `from`; -1 when there is none. */
export const typeAhead = (items: readonly Resolved[], from: number, letter: string) => {
  for (let i = 1; i <= items.length; i++) {
    const index = (from + i) % items.length
    const r = items[index]
    if (r && selectable(r) && 'label' in r.item && r.item.label.toLowerCase().startsWith(letter.toLowerCase())) return index
  }
  return -1
}

export function MenuBar({ menus, status = [], leading, trailing, label = 'Menu bar', shortcuts = true, className }: MenuBarProps) {
  const desk = useDesk()
  const all = useMemo(() => [...menus, ...status], [menus, status])
  const [open, setOpen] = useState<OpenMenu | null>(null)
  const [roving, setRoving] = useState(0)
  const bar = useRef<HTMLDivElement>(null)
  const titles = useRef(new Map<string, HTMLButtonElement>())
  // Where focus was before the keyboard reached the menu bar, so a chosen command starts from there.
  const returnTo = useRef<HTMLElement | null>(null)
  const baseId = useId()
  const apple = useMemo(isApplePlatform, [])

  const resolve = (menu: Menu): Resolved[] => resolveMenuItems(desk, typeof menu.items === 'function' ? menu.items() : menu.items)
  const step = stepMenu

  const openMenu = (index: number, via: OpenMenu['via'], active: 'first' | 'last' | 'none' = 'first') => {
    const menu = all[(index + all.length) % all.length]
    if (!menu) return
    const items = resolve(menu)
    setRoving(all.indexOf(menu))
    setOpen({
      id: menu.id,
      items,
      via,
      active: active === 'none' ? -1 : active === 'first' ? step(items, -1, 1) : step(items, items.length, -1),
    })
    if (via === 'keyboard') titles.current.get(menu.id)?.focus()
  }

  const close = (returnFocus: boolean) => {
    const was = open
    setOpen(null)
    if (returnFocus && was) titles.current.get(was.id)?.focus()
  }

  const activate = (resolved: Resolved | undefined) => {
    if (!resolved || !selectable(resolved)) return
    const wasKeyboard = open?.via === 'keyboard'
    setOpen(null)
    // Keyboard use put focus on the menu bar; send it back so the command starts where the person was working.
    if (wasKeyboard && bar.current?.contains(document.activeElement)) {
      if (returnTo.current?.isConnected) returnTo.current.focus()
      else (document.activeElement as HTMLElement).blur()
    }
    const { item } = resolved
    if (item.type === 'command') perform(desk, item.command, item.args)
    else if (item.type === 'action') item.onSelect()
  }

  // While a menu is open, the keyboard drives it without it ever holding focus.
  useEffect(() => {
    if (!open) return
    const menuIndex = all.findIndex(m => m.id === open.id)
    const onKey = (event: KeyboardEvent) => {
      const handled = (() => {
        switch (event.key) {
          case 'ArrowDown': setOpen({ ...open, active: step(open.items, open.active, 1) }); return true
          case 'ArrowUp': setOpen({ ...open, active: step(open.items, open.active < 0 ? open.items.length : open.active, -1) }); return true
          case 'Home': setOpen({ ...open, active: step(open.items, -1, 1) }); return true
          case 'End': setOpen({ ...open, active: step(open.items, open.items.length, -1) }); return true
          case 'ArrowRight': openMenu(menuIndex + 1, open.via); return true
          case 'ArrowLeft': openMenu(menuIndex - 1, open.via); return true
          case 'Enter':
          case ' ': activate(open.items[open.active]); return true
          case 'Escape': close(open.via === 'keyboard'); return true
          case 'Tab': close(false); return false
          default: {
            if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return false
            const index = typeAhead(open.items, open.active, event.key)
            if (index < 0) return false
            setOpen({ ...open, active: index })
            return true
          }
        }
      })()
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpen(null)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  })

  // Menus own their key equivalents, as in AppKit. Menus that build their items when opened are
  // read when a key is pressed, so their shortcuts work before the menu has ever been opened.
  const menusNow = useRef(all)
  menusNow.current = all
  useEffect(
    () =>
      shortcuts
        ? bindShortcuts(
            desk,
            () =>
              Object.fromEntries(
                menusNow.current
                  .flatMap(m => (typeof m.items === 'function' ? m.items() : m.items))
                  .flatMap(i => (i.type === 'command' && i.shortcut ? [[i.shortcut, i.command] as const] : [])),
              ),
            { apple },
          )
        : undefined,
    [desk, shortcuts, apple],
  )

  const onBarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (open) return
    const index = all.findIndex(m => titles.current.get(m.id) === document.activeElement)
    if (index < 0) return
    const move = (to: number) => {
      const next = all[(to + all.length) % all.length]
      if (next) {
        setRoving(all.indexOf(next))
        titles.current.get(next.id)?.focus()
      }
    }
    switch (event.key) {
      case 'ArrowRight': move(index + 1); break
      case 'ArrowLeft': move(index - 1); break
      case 'Home': move(0); break
      case 'End': move(all.length - 1); break
      case 'ArrowDown':
      case 'Enter':
      case ' ': openMenu(index, 'keyboard', 'first'); break
      case 'ArrowUp': openMenu(index, 'keyboard', 'last'); break
      default: return
    }
    event.preventDefault()
  }

  const renderMenu = (menu: Menu, index: number) => {
    const isOpen = open?.id === menu.id
    const titleId = `${baseId}-title-${menu.id}`
    const menuId = `${baseId}-menu-${menu.id}`
    return (
      <div className="desk-menubar-slot" key={menu.id} data-align={index >= menus.length ? 'end' : undefined}>
        <button
          ref={el => {
            if (el) titles.current.set(menu.id, el)
            else titles.current.delete(menu.id)
          }}
          id={titleId}
          type="button"
          role="menuitem"
          className="desk-menubar-title"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
          aria-label={menu.title ? menu.label : undefined}
          data-emphasis={menu.emphasis || undefined}
          tabIndex={index === roving ? 0 : -1}
          // Opening a menu with the pointer must not move focus out of the window being worked in.
          onMouseDown={event => event.preventDefault()}
          onClick={() => (isOpen ? close(false) : openMenu(index, 'pointer', 'none'))}
          onPointerEnter={() => {
            if (open && !isOpen) openMenu(index, open.via, open.via === 'keyboard' ? 'first' : 'none')
          }}
        >
          {menu.title ?? menu.label}
        </button>
        {isOpen && open && (
          <div
            id={menuId}
            role="menu"
            aria-labelledby={titleId}
            className="desk-menu"
            aria-activedescendant={open.active >= 0 ? `${menuId}-${open.active}` : undefined}
          >
            {open.items.map((resolved, i) => {
              const { item } = resolved
              if (item.type === 'separator') return <div key={i} role="separator" className="desk-menu-separator" />
              if (item.type === 'header') return <div key={i} role="presentation" className="desk-menu-header">{item.label}</div>
              const checkable = resolved.checked !== undefined
              return (
                <div
                  key={i}
                  id={`${menuId}-${i}`}
                  role={checkable ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={checkable ? resolved.checked : undefined}
                  aria-disabled={!resolved.enabled || undefined}
                  className="desk-menu-item"
                  data-active={i === open.active || undefined}
                  onMouseDown={event => event.preventDefault()}
                  onPointerMove={() => {
                    if (open.active !== i && selectable(resolved)) setOpen({ ...open, active: i })
                  }}
                  onPointerLeave={() => {
                    if (open.via === 'pointer' && open.active === i) setOpen({ ...open, active: -1 })
                  }}
                  onClick={() => activate(resolved)}
                >
                  <span className="desk-menu-check" aria-hidden="true">{resolved.checked ? '✓' : ''}</span>
                  <span className="desk-menu-label">{item.label}</span>
                  {item.detail && <span className="desk-menu-detail">{item.detail}</span>}
                  {item.shortcut && <kbd className="desk-menu-shortcut">{formatShortcut(item.shortcut, apple)}</kbd>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={bar}
      role="menubar"
      aria-label={label}
      className={['desk-menubar', className].filter(Boolean).join(' ')}
      onKeyDown={onBarKeyDown}
      onFocus={event => {
        const from = event.relatedTarget
        if (from instanceof HTMLElement && !bar.current?.contains(from)) returnTo.current = from
      }}
    >
      {leading && <div className="desk-menubar-leading">{leading}</div>}
      {menus.map((menu, i) => renderMenu(menu, i))}
      <span className="desk-menubar-spacer" />
      {status.map((menu, i) => renderMenu(menu, menus.length + i))}
      {trailing && <div className="desk-menubar-trailing">{trailing}</div>}
    </div>
  )
}
