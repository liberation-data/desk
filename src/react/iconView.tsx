import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useContextMenu } from './contextMenu.js'
import { useDragSource } from './dnd.js'
import type { MenuItem } from './MenuBar.js'

/*
 * Things shown as icons, the way a Finder window shows files: a name under each, arranged in rows
 * that follow the width of the window.
 *
 * Click selects and double-click opens, as a Finder does; `openOn="single"` opens on one click for
 * a launcher, where selecting first would be a step nobody wants. The keyboard can do everything the
 * pointer can: arrows move through the grid (up and down by a row, however many fit), Home and End
 * go to the ends, typing a name jumps to it, Return opens, and the Menu key opens the item's menu.
 */

export interface IconViewItem {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
  /** A second line, muted: a kind, a scope, a size. */
  readonly subtitle?: string
  readonly badge?: ReactNode
  readonly disabled?: boolean
}

export interface IconViewProps<T extends IconViewItem> {
  readonly items: readonly T[]
  /** Names the collection: "Apps". */
  readonly label: string
  readonly onOpen: (item: T) => void
  /** `double` (the default): click selects, double-click or Return opens. `single`: a click opens. */
  readonly openOn?: 'double' | 'single'
  /** Controlled selection. Leave both out and the view keeps its own. */
  readonly selected?: string | null
  readonly onSelectionChange?: (id: string | null) => void
  /** The item's context menu: what can be done to this one thing. */
  readonly contextMenu?: (item: T) => readonly MenuItem[]
  /** Lets an icon be picked up and carried, to the dock or into another window. */
  readonly drag?: { readonly type: string; readonly payload: (item: T) => unknown }
  /** Shown when there are no items. */
  readonly empty?: ReactNode
  readonly className?: string
}

export function IconView<T extends IconViewItem>({
  items,
  label,
  onOpen,
  openOn = 'double',
  selected,
  onSelectionChange,
  contextMenu,
  drag,
  empty,
  className,
}: IconViewProps<T>) {
  const [ownSelection, setOwnSelection] = useState<string | null>(null)
  const current = selected !== undefined ? selected : ownSelection
  const select = (id: string | null) => {
    if (selected === undefined) setOwnSelection(id)
    onSelectionChange?.(id)
  }
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const source = useDragSource<unknown>({ type: drag?.type ?? 'desk.icon', disabled: !drag })

  // The one that takes Tab: the selected item, or the first.
  const focusable = items.some(i => i.id === current) ? current : (items[0]?.id ?? null)

  const cells = () => [...(list.current?.querySelectorAll<HTMLElement>('[data-icon-id]') ?? [])]

  const focusAt = (index: number) => {
    const all = cells()
    const target = all[Math.max(0, Math.min(index, all.length - 1))]
    if (!target) return
    target.focus()
    select(target.dataset.iconId ?? null)
  }

  // How many icons fit in a row right now: the ones that share the first one's top edge.
  const columns = () => {
    const all = cells()
    const top = all[0]?.offsetTop
    const count = all.filter(cell => cell.offsetTop === top).length
    return Math.max(1, count)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const all = cells()
    const index = all.findIndex(cell => cell === document.activeElement)
    if (index < 0) return
    const item = items[index]
    switch (event.key) {
      case 'ArrowRight': focusAt(index + 1); break
      case 'ArrowLeft': focusAt(index - 1); break
      case 'ArrowDown': focusAt(index + columns()); break
      case 'ArrowUp': focusAt(index - columns()); break
      case 'Home': focusAt(0); break
      case 'End': focusAt(all.length - 1); break
      case 'Enter':
        if (item && !item.disabled) onOpen(item)
        break
      case ' ':
        if (item) select(item.id)
        break
      default: {
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return
        // Typing a name finds it: letters typed close together build one search, as in a Finder.
        const now = Date.now()
        typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + event.key.toLowerCase(), at: now }
        const search = typed.current.text
        const order = [...items.slice(index + (search.length === 1 ? 1 : 0)), ...items.slice(0, index + (search.length === 1 ? 1 : 0))]
        const found = order.find(i => i.label.toLowerCase().startsWith(search))
        if (!found) return
        focusAt(items.indexOf(found))
      }
    }
    event.preventDefault()
  }

  // A selection that no longer exists is dropped, so Tab never lands nowhere.
  useEffect(() => {
    if (current && !items.some(i => i.id === current)) select(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, current])

  if (!items.length) return <div className={['desk-icon-view-empty', className].filter(Boolean).join(' ')}>{empty}</div>

  return (
    <ul
      ref={list}
      role="listbox"
      aria-label={label}
      className={['desk-icon-view', className].filter(Boolean).join(' ')}
      onKeyDown={onKeyDown}
      onPointerDown={event => {
        if (event.target === event.currentTarget) select(null)
      }}
    >
      {items.map(item => (
        <IconCell
          key={item.id}
          item={item}
          selected={item.id === current}
          tabbable={item.id === focusable}
          openOn={openOn}
          onSelect={() => select(item.id)}
          onOpen={() => onOpen(item)}
          menu={contextMenu ? () => contextMenu(item) : null}
          dragProps={drag ? source.dragProps(drag.payload(item), <span className="desk-icon-drag">{item.icon}</span>) : null}
        />
      ))}
    </ul>
  )
}

interface IconCellProps {
  readonly item: IconViewItem
  readonly selected: boolean
  readonly tabbable: boolean
  readonly openOn: 'double' | 'single'
  readonly onSelect: () => void
  readonly onOpen: () => void
  readonly menu: (() => readonly MenuItem[]) | null
  readonly dragProps: ReturnType<ReturnType<typeof useDragSource>['dragProps']> | null
}

function IconCell({ item, selected, tabbable, openOn, onSelect, onOpen, menu, dragProps }: IconCellProps) {
  const context = useContextMenu({ label: `Actions for ${item.label}`, items: menu ?? (() => []), disabled: !menu })
  // The menu sits beside the cell, not in it: React bubbles a portal's events through its owner,
  // and a click on "Open" must not also count as a click on the icon.
  return (
    <>
    <li
      role="option"
      aria-selected={selected}
      aria-disabled={item.disabled || undefined}
      tabIndex={tabbable ? 0 : -1}
      data-icon-id={item.id}
      className="desk-icon-cell"
      {...(dragProps ?? {})}
      onClick={() => {
        onSelect()
        if (openOn === 'single' && !item.disabled) onOpen()
      }}
      onDoubleClick={() => {
        if (openOn === 'double' && !item.disabled) onOpen()
      }}
      onContextMenu={event => {
        onSelect()
        context.target.onContextMenu(event)
      }}
      onKeyDown={context.target.onKeyDown}
    >
      <span className="desk-icon-glyph" aria-hidden="true">
        {item.icon}
        {item.badge != null && <span className="desk-icon-badge">{item.badge}</span>}
      </span>
      <span className="desk-icon-label">{item.label}</span>
      {item.subtitle && <span className="desk-icon-subtitle">{item.subtitle}</span>}
    </li>
    {context.menu}
    </>
  )
}
