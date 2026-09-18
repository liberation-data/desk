import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { topicMatches } from '../core/events.js'
import type { DeskEvent } from '../core/events.js'
import { useDragging, useDropTarget } from './dnd.js'
import type { Accepts } from './dnd.js'
import { useDesk, useWindowId } from './context.js'
import { useBus } from './events.js'

/*
 * A generated app — a self-contained page — running inside a window, and taking
 * part in the desk as a native window does: hearing events, saying things, and
 * taking what is dropped on it.
 *
 * It runs in a sandboxed frame with no access to the host's origin, and talks
 * only through messages. The host decides, per app, which topics it may hear,
 * which it may say, and what may be dropped on it. Nothing else crosses.
 */

/** The protocol version. Every message carries it, so a mismatch is ignored rather than misread. */
const PROTOCOL = 1

/*
 * THE HOST'S LOOK, OFFERED TO THE APP.
 *
 * An app runs in a frame of its own, so by default it wears whatever its author hard-coded: a white
 * page inside a dark desk, a dark one inside a light desk. Switching the desk's theme should carry
 * the app too — the person switched the whole thing, not the chrome around it.
 *
 * So the host offers its palette, and the app takes it or ignores it. `mode` says which way round
 * the page is, for an app that decides its own colours but wants to know; `tokens` are custom
 * properties the bridge sets on the app's own root, so an app that reads them gets the desk's
 * colours with nothing to write.
 */
export interface AppTheme {
  readonly mode: 'light' | 'dark'
  /** Custom properties, named as they will be set: `{ '--sb-bg-dark': '#0b0f1a' }`. */
  readonly tokens: Readonly<Record<string, string>>
}

type HostMessage =
  | { readonly desk: 1; readonly kind: 'hello'; readonly window: string | null; readonly listens: readonly string[]; readonly says: readonly string[]; readonly theme: AppTheme | null }
  | { readonly desk: 1; readonly kind: 'theme'; readonly theme: AppTheme }
  | { readonly desk: 1; readonly kind: 'event'; readonly topic: string; readonly payload: unknown; readonly from: string | null }
  | { readonly desk: 1; readonly kind: 'drop'; readonly type: string; readonly payload: unknown; readonly from: string | null }

type AppMessage =
  | { readonly desk: 1; readonly kind: 'ready' }
  | { readonly desk: 1; readonly kind: 'publish'; readonly topic: string; readonly payload: unknown }
  | { readonly desk: 1; readonly kind: 'open'; readonly window: string }

const isAppMessage = (data: unknown): data is AppMessage =>
  typeof data === 'object' && data !== null && (data as { desk?: unknown }).desk === PROTOCOL && typeof (data as { kind?: unknown }).kind === 'string'

export interface AppFrameProps {
  /** The accessible name of the frame: what the app is. */
  readonly title: string
  /** The app's page, as a URL or as the HTML itself. Give one. */
  readonly src?: string
  readonly srcDoc?: string
  /** Topics the app may hear, e.g. `['ride.selected']` or `['ride.*']`. Default: none. */
  readonly listens?: readonly string[]
  /** Topics the app may say. Anything else it publishes is dropped. Default: none. */
  readonly says?: readonly string[]
  /** The desk's own look, offered to the app: it is applied to the app's root and re-sent on change. */
  readonly theme?: AppTheme
  /** What may be dropped on it. Default: nothing. */
  readonly accepts?: Accepts
  /** Windows the app may ask to open. Default: none. */
  readonly opens?: readonly string[]
  /**
   * The frame's sandbox. The default lets the app run its own scripts and forms, and
   * nothing more: no same-origin access, no top-level navigation, no pop-ups.
   */
  readonly sandbox?: string
  readonly className?: string
}

export function AppFrame({
  title,
  src,
  srcDoc,
  listens = [],
  says = [],
  theme,
  accepts,
  opens = [],
  sandbox = 'allow-scripts allow-forms',
  className,
}: AppFrameProps) {
  const desk = useDesk()
  const bus = useBus()
  const windowId = useWindowId()
  const frame = useRef<HTMLIFrameElement>(null)
  const dragging = useDragging()

  const post = (message: HostMessage) => {
    // A sandboxed frame without same-origin has an opaque origin, so '*' is the only
    // target that reaches it. It is safe here: the message goes to this frame's
    // window and no other.
    frame.current?.contentWindow?.postMessage(message, '*')
  }

  const latest = useRef({ listens, says, opens, windowId, theme })
  latest.current = { listens, says, opens, windowId, theme }

  // What the app says: only from this frame, only on topics it was granted.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow || !isAppMessage(event.data)) return
      const message = event.data
      const granted = latest.current
      if (message.kind === 'ready') {
        post({ desk: PROTOCOL, kind: 'hello', window: granted.windowId, listens: granted.listens, says: granted.says, theme: granted.theme ?? null })
      } else if (message.kind === 'publish') {
        if (typeof message.topic === 'string' && granted.says.some(pattern => topicMatches(pattern, message.topic))) {
          bus.publish(message.topic, message.payload, { from: granted.windowId })
        }
      } else if (message.kind === 'open') {
        if (typeof message.window === 'string' && granted.opens.includes(message.window)) desk.open(message.window)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [bus, desk])

  // The desk's look, again, whenever it changes: a person switching theme switches the app too.
  const themeKey = theme ? `${theme.mode}|${Object.entries(theme.tokens).map(([k, v]) => `${k}:${v}`).join(';')}` : ''
  useEffect(() => {
    if (!latest.current.theme) return
    post({ desk: PROTOCOL, kind: 'theme', theme: latest.current.theme })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey])

  // What the app hears: only the topics it was granted, and never its own words back.
  const listenKey = listens.join('|')
  useEffect(() => {
    if (!listens.length) return
    const stops = listens.map(pattern =>
      bus.subscribe(pattern, (event: DeskEvent) => {
        if (event.from !== null && event.from === latest.current.windowId) return
        post({ desk: PROTOCOL, kind: 'event', topic: event.topic, payload: event.payload, from: event.from })
      }),
    )
    return () => stops.forEach(stop => stop())
    // listenKey stands for the list's contents; the array itself changes identity every render.
  }, [bus, listenKey])

  const { dropProps } = useDropTarget({
    accepts: accepts ?? (() => false),
    disabled: accepts === undefined,
    onDrop: drag => post({ desk: PROTOCOL, kind: 'drop', type: drag.type, payload: drag.payload, from: drag.from }),
  })

  // While something is being carried, the frame must not swallow the pointer, or the
  // desk can never see that it is over this app.
  const frameStyle: CSSProperties = { pointerEvents: dragging ? 'none' : 'auto' }

  return (
    <div className={['desk-app-frame', className].filter(Boolean).join(' ')} {...dropProps}>
      <iframe
        ref={frame}
        title={title}
        className="desk-app-frame-page"
        sandbox={sandbox}
        {...(srcDoc !== undefined ? { srcDoc } : src !== undefined ? { src } : {})}
        style={frameStyle}
      />
    </div>
  )
}

/**
 * The app's half of the bridge, as a script to put in its page. It gives the page a
 * small `desk` object:
 *
 *   desk.on('ride.selected', event => …)     hear a granted topic
 *   desk.onDrop(drop => …)                   take what is dropped on the window
 *   desk.publish('ride.selected', ride)      say something, if it was granted
 *   desk.open('map')                         ask for a window, if it was granted
 *   desk.window                              which window this is, once connected
 */
export const APP_BRIDGE_SCRIPT = `(() => {
  const handlers = new Map();
  const drops = [];
  const send = message => parent.postMessage(Object.assign({ desk: ${PROTOCOL} }, message), '*');
  const applyTheme = theme => {
    if (!theme) return;
    desk.theme = theme;
    const root = document.documentElement;
    root.dataset.deskTheme = theme.mode;
    root.style.colorScheme = theme.mode;
    for (const [name, value] of Object.entries(theme.tokens || {})) root.style.setProperty(name, value);
    themed.forEach(h => h(theme));
  };
  const themed = [];
  const desk = {
    window: null,
    listens: [],
    says: [],
    theme: null,
    onTheme(handler) { themed.push(handler); if (desk.theme) handler(desk.theme); },
    on(topic, handler) { (handlers.get(topic) || handlers.set(topic, []).get(topic)).push(handler); },
    onDrop(handler) { drops.push(handler); },
    publish(topic, payload) { send({ kind: 'publish', topic, payload }); },
    open(window) { send({ kind: 'open', window }); },
  };
  const matches = (pattern, topic) =>
    pattern === '*' || pattern === topic || (pattern.endsWith('.*') && (topic === pattern.slice(0, -2) || topic.startsWith(pattern.slice(0, -1))));
  addEventListener('message', event => {
    if (event.source !== parent || !event.data || event.data.desk !== ${PROTOCOL}) return;
    const message = event.data;
    if (message.kind === 'hello') { desk.window = message.window; desk.listens = message.listens; desk.says = message.says; applyTheme(message.theme); }
    if (message.kind === 'theme') applyTheme(message.theme);
    if (message.kind === 'event') for (const [pattern, list] of handlers) if (matches(pattern, message.topic)) list.forEach(h => h(message));
    if (message.kind === 'drop') drops.forEach(h => h(message));
  });
  window.desk = desk;
  send({ kind: 'ready' });
})();`

/** Puts the bridge into a page of HTML, so a generated app needs nothing added by hand. */
export function withAppBridge(html: string): string {
  const script = `<script>${APP_BRIDGE_SCRIPT}</script>`
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, match => `${match}${script}`) : `${script}${html}`
}
