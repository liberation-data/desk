import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { perform } from '../core/commands.js'
import { formatShortcut, isApplePlatform } from '../core/shortcuts.js'
import { useOptionalDesk } from './context.js'
import { resolveMenuItems, selectable, stepMenu, typeAhead } from './MenuBar.js'
import type { MenuItem, ResolvedMenuItem } from './MenuBar.js'

/*
 * The menu a right-click opens: the things you can do to this one item, where the pointer is.
 *
 * The keyboard reaches it too — the Menu key, or Shift+F10 — and it opens at the item instead.
 * It uses the menu bar's items, so a command in a context menu asks the responder chain whether it
 * is enabled exactly as a menu-bar command does, and runs from the item that was right-clicked.
 */

export interface ContextMenuOptions {
  /** The items, built as the menu opens: what is possible can depend on the item right now. */
  readonly items: () => readonly MenuItem[]
  /** Names the menu for assistive technology: "Actions for Ride Log". */
  readonly label: string
  readonly disabled?: boolean
}

export interface ContextMenuTargetProps {
  readonly onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
}

export interface ContextMenuResult {
  /** Spread on the thing that has the menu. Chain your own `onKeyDown` through `target.onKeyDown`. */
  readonly target: ContextMenuTargetProps
  /** Render it anywhere: it draws into the document body. */
  readonly menu: ReactNode
  readonly open: boolean
}

interface OpenState {
  readonly x: number
  readonly y: number
  readonly items: readonly ResolvedMenuItem[]
  readonly active: number
  readonly opener: HTMLElement
}

export function useContextMenu({ items, label, disabled }: ContextMenuOptions): ContextMenuResult {
  const desk = useOptionalDesk()
  const [state, setState] = useState<OpenState | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const apple = isApplePlatform()

  const show = useCallback(
    (x: number, y: number, opener: HTMLElement, activeFirst: boolean) => {
      const resolved = resolveMenuItems(desk, items())
      if (!resolved.length) return
      setState({ x, y, items: resolved, active: activeFirst ? stepMenu(resolved, -1, 1) : -1, opener })
    },
    [desk, items],
  )

  const close = useCallback((returnFocus: boolean) => {
    setState(current => {
      if (current && returnFocus && current.opener.isConnected) current.opener.focus({ preventScroll: true })
      return null
    })
  }, [])

  const choose = (resolved: ResolvedMenuItem | undefined) => {
    if (!state || !resolved || !selectable(resolved)) return
    const { opener } = state
    setState(null)
    // Back to the item first, so a command starts its search for a responder from there.
    if (opener.isConnected) opener.focus({ preventScroll: true })
    const { item } = resolved
    if (item.type === 'command') perform(desk, item.command, item.args)
    else if (item.type === 'action') item.onSelect()
  }

  const target: ContextMenuTargetProps = {
    onContextMenu: event => {
      if (disabled) return
      event.preventDefault()
      const opener = event.currentTarget
      opener.focus({ preventScroll: true })
      show(event.clientX, event.clientY, opener, false)
    },
    onKeyDown: event => {
      if (disabled) return
      if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
        event.preventDefault()
        const box = event.currentTarget.getBoundingClientRect()
        show(box.left + 8, box.bottom - 4, event.currentTarget, true)
      }
    },
  }

  // Keep it on screen: measured once it exists, then moved in from the edges it would cross.
  useLayoutEffect(() => {
    const element = panel.current
    if (!state || !element) return
    const { width, height } = element.getBoundingClientRect()
    const x = Math.max(8, Math.min(state.x, innerWidth - width - 8))
    const y = Math.max(8, state.y + height > innerHeight - 8 ? state.y - height : state.y)
    element.style.left = `${x}px`
    element.style.top = `${y}px`
    element.focus({ preventScroll: true })
  }, [state])

  useEffect(() => {
    if (!state) return
    const onPointerDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) close(false)
    }
    const onAway = () => close(false)
    document.addEventListener('pointerdown', onPointerDown, true)
    addEventListener('blur', onAway)
    addEventListener('resize', onAway)
    document.addEventListener('scroll', onAway, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      removeEventListener('blur', onAway)
      removeEventListener('resize', onAway)
      document.removeEventListener('scroll', onAway, true)
    }
  }, [state, close])

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!state) return
    const move = (active: number) => setState({ ...state, active })
    switch (event.key) {
      case 'ArrowDown': move(stepMenu(state.items, state.active, 1)); break
      case 'ArrowUp': move(stepMenu(state.items, state.active < 0 ? state.items.length : state.active, -1)); break
      case 'Home': move(stepMenu(state.items, -1, 1)); break
      case 'End': move(stepMenu(state.items, state.items.length, -1)); break
      case 'Enter':
      case ' ': choose(state.items[state.active]); break
      case 'Escape': close(true); break
      case 'Tab': close(true); break
      default: {
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return
        const index = typeAhead(state.items, state.active, event.key)
        if (index < 0) return
        move(index)
      }
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const menu =
    state && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            className="desk-menu desk-context-menu"
            style={{ left: state.x, top: state.y }}
            aria-activedescendant={state.active >= 0 ? `${menuId}-${state.active}` : undefined}
            onKeyDown={onMenuKeyDown}
            onContextMenu={event => event.preventDefault()}
          >
            {state.items.map((resolved, i) => {
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
                  data-active={i === state.active || undefined}
                  onPointerMove={() => {
                    if (state.active !== i && selectable(resolved)) setState({ ...state, active: i })
                  }}
                  onClick={() => choose(resolved)}
                >
                  <span className="desk-menu-check" aria-hidden="true">{resolved.checked ? '✓' : ''}</span>
                  <span className="desk-menu-label">{item.label}</span>
                  {item.detail && <span className="desk-menu-detail">{item.detail}</span>}
                  {item.shortcut && <kbd className="desk-menu-shortcut">{formatShortcut(item.shortcut, apple)}</kbd>}
                </div>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return { target, menu, open: state !== null }
}
