import { useContext, useEffect } from 'react'
import { WindowContext } from './context.js'

/*
 * HOW FAR ALONG, IN THE TITLE BAR.
 *
 * HIG.md §7 keeps bars for things with something real to measure, and most waits have nothing: one
 * request whose progress the browser cannot see. But some windows hold a count that IS real — steps
 * done out of steps declared, files imported out of files chosen — and that count describes the
 * whole window, so it belongs where the window is described: in its title bar, beside the note.
 *
 * It is reported from INSIDE the window rather than passed to `Desktop` like `note`, because the
 * count lives in the content: the component that fetched the steps is the one that knows how many
 * are done, and hoisting that state to wherever the desk is mounted would be plumbing for its own
 * sake.
 */

export interface WindowProgress {
  /** How much is done. Clamped to 0…max when drawn. */
  readonly value: number
  /** How much there is. A window with nothing to count reports null rather than 0 of 0. */
  readonly max: number
  /**
   * What is being counted, read aloud with the numbers: "Steps done" is announced as
   * "Steps done, 3 of 8". Sentence case.
   */
  readonly label: string
}

/**
 * Puts a bar and "3 of 8" in the title bar of the window this is rendered in, until the component
 * unmounts or reports null.
 *
 * Returns whether a title bar took it. Outside a window there is none, and the caller draws the
 * count itself — the same content can live in a window and on a page.
 */
export function useWindowProgress(progress: WindowProgress | null): boolean {
  const context = useContext(WindowContext)
  const setProgress = context?.setProgress
  const value = progress?.value
  const max = progress?.max
  const label = progress?.label

  useEffect(() => {
    if (!setProgress) return
    setProgress(value == null || max == null || label == null ? null : { value, max, label })
  }, [setProgress, value, max, label])

  // Cleared once, on the way out, not between every change: clearing first would flash an empty bar.
  useEffect(() => (setProgress ? () => setProgress(null) : undefined), [setProgress])

  return setProgress != null
}

/** The title bar's half. Drawn by `Desktop`; not exported. */
export function TitleProgress({ progress }: { readonly progress: WindowProgress }) {
  const max = Math.max(0, progress.max)
  const value = Math.min(max, Math.max(0, progress.value))
  const fraction = max === 0 ? 0 : value / max
  return (
    <div
      className="desk-window-progress"
      role="progressbar"
      aria-label={progress.label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max}`}
    >
      <span className="desk-window-progress-track" aria-hidden="true">
        <span className="desk-window-progress-fill" style={{ width: `${fraction * 100}%` }} />
      </span>
      <span className="desk-window-progress-count" aria-hidden="true">{value} of {max}</span>
    </div>
  )
}
