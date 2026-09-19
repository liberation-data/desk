import { useEffect, useState } from 'react'
import { focusedId } from '../core/desk.js'
import type { WindowId } from '../core/types.js'
import { useDeskState } from './context.js'

/*
 * The browser's title bar, and every tab strip and window switcher that reads it, says what
 * is in front — as an application's title bar does. The frontmost window's name comes first,
 * because that is the part a narrow tab still shows.
 *
 * The app's own name is not asked for twice: left out, it is whatever the document was
 * already called, which is the <title> in the page's HTML. That stays the one place the app
 * is named, and the title is put back as it was when the desk goes away — a desk mounted in
 * a larger page must not leave the last window's name behind it.
 *
 * A window's name is wanted as a string here, not as the ReactNode <Desktop> renders: an
 * icon beside a label is a title bar's business, and `document.title` is text. It is the same
 * signature `windowMenuItems` asks for, so an app with a Window menu already has one.
 */

export interface DocumentTitleOptions {
  /** The app's name, kept after the window's: `Rides — Garage`. Defaults to the document's own title. */
  readonly app?: string
  /** What goes between the two names. */
  readonly separator?: string
}

const DEFAULT_SEPARATOR = ' — '

/** Keeps `document.title` on the frontmost window: `Rides — Garage`, and `Garage` with nothing open. */
export function useDocumentTitle(title: (id: WindowId) => string, options: DocumentTitleOptions = {}): void {
  const { app, separator = DEFAULT_SEPARATOR } = options
  const state = useDeskState()
  const id = focusedId(state)

  // What the page was called before the desk took it over: the app's name by default, and what
  // is put back on the way out. Read once, so a title this hook set is never mistaken for it.
  const [original] = useState(() => (typeof document === 'undefined' ? '' : document.title))
  const base = app ?? original

  const front = id === null ? '' : title(id)
  const next = front && base ? `${front}${separator}${base}` : front || base

  useEffect(() => {
    if (next) document.title = next
  }, [next])

  // Only on the way out: a restore that ran between renders would flicker the real title away.
  useEffect(() => () => {
    document.title = original
  }, [original])
}
