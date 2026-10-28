import { cascadeFrame, focusedId, isMinimized, normalise, routeOf } from './desk.js'
import type { Desk } from './desk.js'
import type { DeskState, DeskWindow, Size, WindowId } from './types.js'

/*
 * The URL carries which windows are open, which are free, and which has focus —
 * never frames. A shared link should open the same things, not reproduce
 * someone else's window positions on a different screen.
 *
 *   #w=notes,clock~,inspector_&f=clock
 *
 * `~` marks a free window; the others fill the desk. `_` marks one that is minimized — open and
 * off the desk — which is not a position but which windows are open and how, so it travels.
 * `f` names the focused window.
 *
 *   #w=notes,settings~/agents&f=settings
 *
 * After a `/`, where the window is inside itself: Settings at its agents section. That does travel,
 * because it is what a link is for — the place someone meant, not how their screen was arranged.
 */

const FLOAT = '~'
const MINIMIZED = '_'
const ROUTE = '/'

/*
 * Only what would break the list is escaped — a `,` would end the window, a `%` would be read as an
 * escape — so `views/name/run` reads as a path in the address bar and the rest is left to the hash.
 */
const encodeRoute = (route: string) => route.replace(/%/g, '%25').replace(/,/g, '%2C')

/** A hand-edited link can hold a `%` that decodes to nothing; that window opens without its route. */
const decodeRoute = (route: string) => {
  try {
    return decodeURIComponent(route)
  } catch {
    return ''
  }
}

const warned = new Set<string>()
/** Said once per message: a warning on every parse would be noise, not help. */
const warnOnce = (message: string) => {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(message)
}

export interface LocationOptions {
  /** Hash parameter that holds the windows. Default `w`. */
  readonly key?: string
  /** Hash parameter that holds the focused window. Default `f`. */
  readonly focusKey?: string
  /** Ids the app can render. Anything else in a URL is dropped. */
  readonly isKnown?: (id: WindowId) => boolean
}

export function serialize(state: DeskState, options: LocationOptions = {}): URLSearchParams {
  const params = new URLSearchParams()
  if (!state.windows.length) return params
  params.set(
    options.key ?? 'w',
    state.windows
      .map(w => {
        const route = routeOf(state, w.id)
        return `${encodeURIComponent(w.id)}${w.mode === 'floating' ? FLOAT : ''}${isMinimized(state, w.id) ? MINIMIZED : ''}${route ? ROUTE + encodeRoute(route) : ''}`
      })
      .join(','),
  )
  const focused = focusedId(state)
  if (focused) params.set(options.focusKey ?? 'f', focused)
  return params
}

export function parse(params: URLSearchParams, stage: Size, options: LocationOptions = {}): DeskState {
  const known =
    options.isKnown ??
    (id => {
      // Without `isKnown` a stale or hand-edited link opens ids the app cannot render.
      warnOnce(`desk: no isKnown given, so "${id}" from a URL is taken on trust. Pass isKnown to drop unknown windows.`)
      return true
    })
  const raw = params.get(options.key ?? 'w')
  if (!raw) return { windows: [], stack: [] }

  const entries = raw
    .split(',')
    .filter(Boolean)
    .map(token => {
      // An id is encoded whole, so its own slashes are `%2F`: the first plain one starts the route.
      const at = token.indexOf(ROUTE)
      const head = at < 0 ? token : token.slice(0, at)
      const route = at < 0 ? '' : decodeRoute(token.slice(at + 1))
      const minimized = head.endsWith(MINIMIZED)
      const rest = minimized ? head.slice(0, -1) : head
      const floating = rest.endsWith(FLOAT)
      return { id: decodeURIComponent(floating ? rest.slice(0, -1) : rest), floating, minimized, route }
    })
    .filter(e => e.id && known(e.id))

  const windows = entries.map(
    (e, i): DeskWindow =>
      e.floating
        ? { id: e.id, mode: 'floating', frame: cascadeFrame(entries.slice(0, i).filter(x => x.floating).length, stage) }
        : { id: e.id, mode: 'filled' },
  )
  const focus = params.get(options.focusKey ?? 'f')
  const ids = windows.map(w => w.id)
  const stack = focus && ids.includes(focus) ? [...ids.filter(id => id !== focus), focus] : ids
  const minimized = entries.filter(e => e.minimized).map(e => e.id)
  const routes = Object.fromEntries(entries.filter(e => e.route).map(e => [e.id, e.route]))
  return normalise({ windows, stack, minimized, routes })
}

export interface LocationEnv {
  readonly location: { hash: string }
  readonly history: { pushState(data: unknown, unused: string, url: string): void; replaceState(data: unknown, unused: string, url: string): void }
  addEventListener(type: 'popstate', listener: () => void): void
  removeEventListener(type: 'popstate', listener: () => void): void
}

const openSet = (state: DeskState) => state.windows.map(w => w.id).join('|')

/**
 * Keeps the desk and the URL hash in step. Opening or closing a window pushes a
 * history entry, so Back closes it; focus, mode and route changes replace the entry.
 * Other hash parameters are left alone, so the app can keep using the hash too.
 */
export function syncWithLocation(desk: Desk, stage: () => Size, options: LocationOptions = {}, env?: LocationEnv): () => void {
  const target = env ?? (globalThis as unknown as LocationEnv)
  const keys = [options.key ?? 'w', options.focusKey ?? 'f']
  const read = () => new URLSearchParams(target.location.hash.replace(/^#/, ''))

  const fromUrl = () => desk.restore(parse(read(), stage(), options))

  const toUrl = (state: DeskState, previous: DeskState) => {
    const params = read()
    keys.forEach(k => params.delete(k))
    serialize(state, options).forEach((value, key) => params.set(key, value))
    const url = `#${params.toString().replace(/%2C/g, ',').replace(/%7E/g, FLOAT).replace(/%2F/g, ROUTE)}`
    if (url === target.location.hash || (url === '#' && !target.location.hash)) return
    if (openSet(state) !== openSet(previous)) target.history.pushState(null, '', url)
    else target.history.replaceState(null, '', url)
  }

  // A URL that names windows wins. One that names none adopts whatever the app opened.
  if (read().has(keys[0] as string)) fromUrl()
  else if (desk.getState().windows.length) toUrl(desk.getState(), desk.getState())
  let previous = desk.getState()
  const unsubscribe = desk.subscribe(state => {
    toUrl(state, previous)
    previous = state
  })
  const onPop = () => {
    fromUrl()
    previous = desk.getState()
  }
  target.addEventListener('popstate', onPop)

  return () => {
    unsubscribe()
    target.removeEventListener('popstate', onPop)
  }
}
