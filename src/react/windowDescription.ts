import { useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import { WindowContext } from './context.js'

/*
 * WHAT THIS VIEW IS LOOKING AT, IN THE TITLE BAR.
 *
 * `Desktop` gives each window one note and one (i), chosen by its id. That is right until the window
 * has views of its own: a window whose tabs read three endpoints is looking at whichever one is shown,
 * and a note naming the first is wrong on the other two. The view that is showing knows what it
 * reads, so it says so from inside the window — the same seam `useWindowProgress` uses — and the
 * window's own note comes back when it stops.
 *
 * `undefined` and `null` report nothing, so the window's own note stands. `false` reports that this
 * view is looking at nothing in particular, and the bar carries no note at all.
 */

/** A note or an (i) as the content reports it: `null` and `undefined` defer to the window's own. */
export type WindowDescription = ReactNode

/**
 * Puts `note` in the title bar of the window this is rendered in, in place of the one `Desktop` gave
 * it, until the component unmounts or reports nothing.
 *
 * Returns whether a title bar took it. Outside a window there is none, and the caller shows it
 * itself.
 */
export function useWindowNote(note: WindowDescription): boolean {
  const setNote = useContext(WindowContext)?.setNote
  return useReport(setNote, note)
}

/**
 * Puts `info` behind the title bar's (i), in place of what `Desktop` gave the window, until the
 * component unmounts or reports nothing. What the view is, not what the window is: explanation only,
 * as every (i) is.
 */
export function useWindowInfo(info: WindowDescription): boolean {
  const setInfo = useContext(WindowContext)?.setInfo
  return useReport(setInfo, info)
}

function useReport(set: ((value: WindowDescription) => void) | undefined, value: WindowDescription): boolean {
  useEffect(() => {
    set?.(value)
  }, [set, value])

  // Cleared once, on the way out, not between every change: clearing first would flash the window's own.
  useEffect(() => (set ? () => set(undefined) : undefined), [set])

  return set != null
}
