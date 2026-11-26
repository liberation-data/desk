import type { CommandId } from '../core/commands.js'
import { parseShortcut } from '../core/shortcuts.js'
import type { Menu, MenuItem } from './MenuBar.js'

/*
 * A MENU BAR SOMEBODY ELSE DRAWS.
 *
 * Hosted in a native shell (Electron, Tauri, a webview), an app's menus belong in the system's
 * menu bar rather than in a strip along the top of the page. The host cannot run the page's
 * functions, so the menus cross as plain data: what each row says and whether it can be chosen,
 * under an id. When someone picks a row the host sends the id back, and the page runs the item.
 */

/** One row of a menu a host draws. Plain data, so it can cross a process boundary. */
export interface HostMenuItem {
  readonly type: 'item' | 'separator' | 'header'
  /**
   * Present on 'item'; unique within one publish. Opaque to a host, which only sends it back: it
   * names the item's menu, place and label, so a choice from a menu that has since changed runs
   * nothing rather than whatever took that place.
   */
  readonly id?: string
  /** Present on 'item' and 'header'. */
  readonly label?: string
  readonly detail?: string
  /** In desk's format: 'mod+k', 'mod+alt+a', 'alt+]'. */
  readonly shortcut?: string
  /**
   * The page handles this item's shortcut itself, so a host draws it beside the item and gives it
   * no key (Electron: `registerAccelerator: false`). Set on an action's shortcut, which the drawn
   * bar only shows too: binding it as well would fire the action twice.
   */
  readonly showOnly?: boolean
  /** Defaults to true. */
  readonly enabled?: boolean
  /** Absent means the item is not checkable. */
  readonly checked?: boolean
}

/** A whole menu as a host sees it. */
export interface HostMenu {
  readonly id: string
  /** The menu's `label`: a host draws text, so a status menu's richer `title` stays behind. */
  readonly label: string
  /** The app's own menu, which a `Menu` calls `emphasis`. */
  readonly primary?: boolean
  /** One of the bar's status menus, which a host puts after the others. */
  readonly status?: boolean
  readonly items: readonly HostMenuItem[]
}

/** What a native shell provides so a `MenuBar` can live in its menu bar. */
export interface MenuHost {
  /** Replaces every menu the page published before. An empty list takes them all away. */
  publish(menus: readonly HostMenu[]): void
  /** Calls the listener with an item's id when someone picks it; returns an unsubscribe. */
  onSelect(listener: (id: string) => void): () => void
  /**
   * Whether the host gives this shortcut a key of its own, so the page must not bind it too, or it
   * would fire twice. Without it, the host owns every shortcut with `mod` in it, the ones a native
   * menu bar's key equivalents carry; the page keeps binding the rest, like `alt+]`.
   */
  ownsShortcut?(shortcut: string): boolean
}

/** The menus as plain data, and the item each id runs when it is chosen. */
export interface HostMenuModel {
  readonly model: readonly HostMenu[]
  readonly run: ReadonlyMap<string, MenuItem>
}

/** True when a native menu bar would give this shortcut a key: it has `mod` in it. */
export const hasModKey = (shortcut: string): boolean => parseShortcut(shortcut).mod

const read = (flag: boolean | (() => boolean) | undefined) => (typeof flag === 'function' ? flag() : flag)

function itemModel(item: MenuItem, id: string, canPerform: (command: CommandId) => boolean): HostMenuItem {
  switch (item.type) {
    case 'separator':
      return { type: 'separator' }
    case 'header':
      return { type: 'header', label: item.label }
    case 'command':
    case 'action': {
      const checked = read(item.checked)
      return {
        type: 'item',
        id,
        label: item.label,
        ...(item.detail === undefined ? {} : { detail: item.detail }),
        ...(item.shortcut === undefined ? {} : { shortcut: item.shortcut }),
        ...(item.shortcut !== undefined && item.type === 'action' ? { showOnly: true } : {}),
        enabled: item.type === 'command' ? canPerform(item.command) : !read(item.disabled),
        ...(checked === undefined ? {} : { checked }),
      }
    }
  }
}

/**
 * Turns menus into what a host can draw, as they stand now: items given as a function are read,
 * and each command asks `canPerform` whether anything would handle it. An item's id is its menu's
 * id, its place in the menu and its label, so the same menus always give the same ids, and an id
 * from before a menu changed (a window list that moved, a label that toggled) matches nothing.
 * @param menus the bar's menus, in order.
 * @param status the bar's status menus, marked `status` in the model.
 */
const itemId = (menu: Menu, index: number, item: MenuItem): string =>
  `${menu.id}:${index}:${item.type === 'command' || item.type === 'action' ? item.label : ''}`

export function hostMenuModel(
  menus: readonly Menu[],
  status: readonly Menu[],
  canPerform: (command: CommandId) => boolean,
): HostMenuModel {
  const resolved = [...menus.map(menu => ({ menu, status: false })), ...status.map(menu => ({ menu, status: true }))].map(
    ({ menu, status: isStatus }) => ({ menu, isStatus, items: typeof menu.items === 'function' ? menu.items() : menu.items }),
  )
  const model = resolved.map(({ menu, isStatus, items }) => ({
    id: menu.id,
    label: menu.label,
    ...(menu.emphasis === true ? { primary: true } : {}),
    ...(isStatus ? { status: true } : {}),
    items: items.map((item, index) => itemModel(item, itemId(menu, index, item), canPerform)),
  }))
  const run = new Map(
    resolved.flatMap(({ menu, items }) =>
      items.flatMap((item, index): [string, MenuItem][] =>
        item.type === 'command' || item.type === 'action' ? [[itemId(menu, index, item), item]] : [],
      ),
    ),
  )
  return { model, run }
}

/** True when two models would draw the same menus, so a publish can be skipped. */
export const sameHostModel = (a: readonly HostMenu[], b: readonly HostMenu[]): boolean => JSON.stringify(a) === JSON.stringify(b)
