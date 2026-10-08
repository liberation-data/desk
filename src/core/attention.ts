/*
 * WHETHER SOMEBODY IS LOOKING AT A WINDOW RIGHT NOW.
 *
 * A service that counts what arrived unseen has to know what "seen" is, and the answer is the same
 * for every window: it is the key window, the browser tab is the one showing, and the browser has
 * the operating system's focus. All three, because each can be false on its own: a window in full
 * view behind somebody's editor is not being looked at.
 */
import { focusedId } from './desk.js'
import type { Desk } from './desk.js'
import type { WindowId } from './types.js'

/** Everything `attended` weighs, as plain values, so the rule can be read and tested without a desk. */
export interface Attention {
  /** Something is drawing the count. Nothing counts otherwise: a number nobody can see only surprises them later. */
  readonly counted: boolean
  /** It is the key window: in front, and therefore not minimized or closed. */
  readonly front: boolean
  /** The browser tab is the one being shown. */
  readonly visible: boolean
  /** The browser window has the operating system's focus. */
  readonly focused: boolean
}

/** Being looked at right now, which is the one state in which what arrives is not news. */
export const attended = (a: Attention): boolean => a.front && a.visible && a.focused

/** What arrives is news when something is drawing the count and nobody is looking at the window. */
export const becomesNews = (a: Attention): boolean => a.counted && !attended(a)

/** Where there is no document there is no tab to hide and no browser to leave: only the desk can say. */
const page = (): Document | null => (typeof document === 'undefined' ? null : document)

/**
 * The attention on one window, now. `counted` is the caller's to say: usually whether the service
 * doing the counting is running, which is whether a dock is there to draw it.
 */
export function attentionOn(desk: Desk, id: WindowId, counted = true): Attention {
  const doc = page()
  return {
    counted,
    front: focusedId(desk.getState()) === id,
    visible: !(doc?.hidden ?? false),
    focused: doc?.hasFocus() ?? true,
  }
}

/**
 * Call `onAttended` at once if the window is being looked at, and again each time it comes to be.
 *
 * THREE SIGNALS, BECAUSE THERE ARE THREE WAYS BACK. Opening or focusing the window is a desk
 * change; returning to the browser tab is a visibility change; coming back to the browser from
 * another application is a window focus. Any one of them can happen without the other two.
 */
export function watchAttention(desk: Desk, id: WindowId, onAttended: () => void): () => void {
  const check = () => {
    if (attended(attentionOn(desk, id))) onAttended()
  }
  const doc = page()
  const stopDesk = desk.subscribe(check)
  doc?.defaultView?.addEventListener('focus', check)
  doc?.addEventListener('visibilitychange', check)
  check()
  return () => {
    stopDesk()
    doc?.defaultView?.removeEventListener('focus', check)
    doc?.removeEventListener('visibilitychange', check)
  }
}
