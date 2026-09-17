import type { Frame, Size } from './types.js'

/*
 * Windows that come back the way they were left. Close a window you had made small and put in a
 * corner, open it tomorrow, and it is small and in the corner again; one you zoomed to fill the desk
 * fills it again.
 *
 * What is remembered is per kind of window, not per id: `query#2` opens where `query` was last left.
 * A remembered frame is a promise about a screen that may have changed, so it is fitted to the
 * current one: moved in until it is on the desk, made smaller if the desk is now smaller, and given
 * up for filling if it would be too small to use. A second window of a kind already open steps down
 * and to the right of it, as a cascade does, rather than opening exactly on top and hiding it.
 */

export type SavedLayout = { readonly mode: 'filled' } | { readonly mode: 'floating'; readonly frame: Frame }

/** Where layouts are kept. Synchronous: a window opens now, not after a round trip. */
export interface LayoutStore {
  load(type: string): SavedLayout | undefined
  save(type: string, layout: SavedLayout): void
}

const MIN: Size = { width: 240, height: 160 }

/** Keeps layouts in this browser, under `desk.layouts.<key>`. */
export function localLayoutStore(key: string): LayoutStore {
  const name = `desk.layouts.${key}`
  const read = (): Record<string, SavedLayout> => {
    try {
      const raw = globalThis.localStorage?.getItem(name)
      const parsed: unknown = raw ? JSON.parse(raw) : {}
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, SavedLayout>) : {}
    } catch {
      return {}
    }
  }
  return {
    load: type => valid(read()[type]),
    save(type, layout) {
      try {
        globalThis.localStorage?.setItem(name, JSON.stringify({ ...read(), [type]: layout }))
      } catch {
        // Private windows and full storage: windows still open, just not where they were.
      }
    },
  }
}

const finite = (...values: unknown[]) => values.every(v => typeof v === 'number' && Number.isFinite(v))

/** Storage is outside the program: anything that is not a layout is treated as none. */
function valid(layout: unknown): SavedLayout | undefined {
  const l = layout as SavedLayout | undefined
  if (l?.mode === 'filled') return l
  if (l?.mode === 'floating' && l.frame && finite(l.frame.x, l.frame.y, l.frame.width, l.frame.height)) return l
  return undefined
}

/** A remembered frame on today's desk: on screen, no bigger than the desk, or null if too small to use. */
export function fitFrame(frame: Frame, stage: Size, min: Size = MIN): Frame | null {
  const width = Math.min(frame.width, stage.width)
  const height = Math.min(frame.height, stage.height)
  if (width < min.width || height < min.height) return null
  return {
    x: Math.max(0, Math.min(frame.x, stage.width - width)),
    y: Math.max(0, Math.min(frame.y, stage.height - height)),
    width,
    height,
  }
}

/**
 * Where another window of a kind goes when some are already free on the desk: a step down and right
 * of the one in front, back to the top-left when that would run off the desk, and never exactly on
 * top of one already there.
 */
export function stepFrom(frame: Frame, open: readonly Frame[], stage: Size, step: { x: number; y: number }, margin: number): Frame {
  const front = open.at(-1)
  if (!front) return frame
  const taken = (f: Frame) => open.some(o => o.x === f.x && o.y === f.y)
  let next = { ...frame, x: front.x + step.x, y: front.y + step.y }
  for (let tries = 0; tries <= open.length; tries++) {
    if (next.x + next.width > stage.width || next.y + next.height > stage.height) next = { ...next, x: margin, y: margin }
    if (!taken(next)) return next
    next = { ...next, x: next.x + step.x, y: next.y + step.y }
  }
  return next
}
