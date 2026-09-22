import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/*
 * WAITING, SAID OUT LOUD.
 *
 * HIG.md §7 asks for a spinner under about three seconds and a determinate bar beyond it. The bar
 * is not offered here, because a bar needs something real to measure and most waits in an app like
 * this are one request whose progress the browser cannot see. Drawing a bar over that invents the
 * one number it exists to report.
 *
 * What is offered instead is the honest form of "says how far it has got": the spinner keeps
 * turning, and after a few seconds it says MORE. A wait that outlives its welcome stops being a
 * mark and starts being a sentence, which is the difference between a screen that is thinking and
 * a screen that has died.
 */

/** The turning mark itself. Decorative — whoever draws it owns the words. */
function Ring({ size }: { readonly size: SpinnerSize }) {
  return <span className="desk-spinner-ring" data-size={size} aria-hidden="true" />
}

export type SpinnerSize = 'small' | 'regular' | 'large'

export interface SpinnerProps {
  /**
   * What is being waited for, e.g. "Loading the conversation". Sentence case, no ellipsis — the
   * turning says it is going. Read aloud, and shown only if `showLabel`.
   */
  readonly label: string
  /** Beside the mark. Off by default: inline, the control it sits in has usually said it already. */
  readonly showLabel?: boolean
  readonly size?: SpinnerSize
  readonly className?: string
}

/**
 * A wait, inline — beside a control, in a toolbar, in a row. For a panel with nothing else on it
 * yet, `Loading` centres the same mark and says what is missing.
 */
export function Spinner({ label, showLabel = false, size = 'regular', className }: SpinnerProps) {
  return (
    <span
      className={['desk-spinner', className].filter(Boolean).join(' ')}
      role="status"
      data-labelled={showLabel || undefined}
    >
      <Ring size={size} />
      <span className="desk-spinner-label" data-hidden={showLabel ? undefined : true}>{label}</span>
    </span>
  )
}

/** How long a wait may go unexplained. HIG.md §7: a spinner alone is for under about three seconds. */
const SLOW_AFTER_MS = 3000

export interface LoadingProps {
  /** What is on its way, e.g. "Reading what your realms brought". Sentence case, no ellipsis. */
  readonly label: string
  /**
   * Said once the wait passes about three seconds, where a spinner alone stops being enough. Say
   * what is taking the time and whether it is expected — never an apology, and never a guess at
   * how much longer.
   */
  readonly slow?: ReactNode
  /** How long before `slow` is said. Only move this for a wait that is known to be longer. */
  readonly slowAfterMs?: number
  readonly size?: SpinnerSize
  readonly className?: string
}

/**
 * A panel that has nothing to show yet, saying so in the space the content will take. It replaces
 * the content rather than sitting above it: a spinner over a stale list is a screen claiming two
 * things at once.
 */
export function Loading({ label, slow, slowAfterMs = SLOW_AFTER_MS, size = 'large', className }: LoadingProps) {
  const [slowed, setSlowed] = useState(false)

  useEffect(() => {
    if (!slow) return
    // Keyed on the note and the delay, so a panel that changes what it is waiting for waits again
    // rather than inheriting the previous wait's expired timer and explaining itself instantly.
    setSlowed(false)
    const timer = setTimeout(() => setSlowed(true), slowAfterMs)
    return () => clearTimeout(timer)
  }, [slow, slowAfterMs])

  return (
    <div className={['desk-loading', className].filter(Boolean).join(' ')} role="status">
      <Ring size={size} />
      <p className="desk-loading-label">{label}</p>
      {/* Announced when it arrives, not when the panel mounts: the wait became long enough to
          explain, and that is the news. */}
      {slowed && slow && <p className="desk-loading-slow">{slow}</p>}
    </div>
  )
}
