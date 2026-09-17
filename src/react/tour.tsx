import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DeskEvent } from '../core/events.js'
import type { WindowId } from '../core/types.js'
import { Button } from './controls.js'
import { useDesk } from './context.js'
import { useBus } from './events.js'

/*
 * A tour drives the desk: it opens the window each step is about and points at
 * the control it is talking about, so the person watches the real app work
 * rather than reading about it. A step can hand over — "your turn" — and wait.
 *
 * The bar holds no content of its own: the steps are the app's.
 */

export interface TourStep {
  /** Opened and made key before the step is shown. */
  readonly window?: WindowId
  /** What to point at: a `data-tour` name, or any CSS selector. */
  readonly point?: string
  readonly caption: ReactNode
  /** Hands over: the bar offers Done and Skip instead of Next. */
  readonly yourTurn?: boolean
  /**
   * The event that means the person has done it — `ride.selected`, or a topic and a test.
   * The tour moves on by itself when it arrives, so nobody has to say Done.
   */
  readonly until?: string | { readonly topic: string; readonly when: (event: DeskEvent) => boolean }
}

export interface Tour {
  readonly id: string
  readonly name: string
  /** What the tour shows, in a sentence: said when it is offered. */
  readonly description?: ReactNode
  readonly steps: readonly TourStep[]
}

export interface TourBarProps {
  readonly tour: Tour
  /** Called when the last step is finished. */
  readonly onFinish?: () => void
  /** Called when the person stops early. */
  readonly onStop?: () => void
  /**
   * Ask first: the bar invites the person to take the tour, and starts only if they say so.
   * For the first time someone reaches the desktop, where nobody should be dropped without a word.
   */
  readonly offer?: boolean
  readonly className?: string
}

const POINTED = 'data-desk-tour-pointed'

function point(step: TourStep | undefined): () => void {
  if (!step?.point) return () => {}
  const selector = step.point.startsWith('[') || step.point.includes('.') || step.point.includes('#') ? step.point : `[data-tour="${step.point}"]`
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) return () => {}
  element.setAttribute(POINTED, '')
  element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  return () => element.removeAttribute(POINTED)
}

export function TourBar({ tour, onFinish, onStop, offer, className }: TourBarProps) {
  const desk = useDesk()
  const bus = useBus()
  const [offered, setOffered] = useState(offer ?? false)
  const [index, setIndex] = useState(0)
  const step = offered ? undefined : tour.steps[index]
  const total = tour.steps.length
  const stop = useRef<() => void>(() => {})

  // Enter the step: open the window it is about, then point at its control.
  useEffect(() => {
    if (!step) return
    if (step.window) desk.open(step.window)
    stop.current()
    // A frame later: the window it just opened has to exist before it can be pointed at.
    const frame = requestAnimationFrame(() => {
      stop.current = point(step)
    })
    return () => {
      cancelAnimationFrame(frame)
      stop.current()
      stop.current = () => {}
    }
  }, [desk, step, index])

  const go = useCallback(
    (to: number) => {
      if (to >= total) {
        onFinish?.()
        return
      }
      setIndex(Math.max(0, to))
    },
    [total, onFinish],
  )

  // A step that waits for the person moves on when what it asked for happens.
  const until = step?.until
  useEffect(() => {
    if (!until) return undefined
    const topic = typeof until === 'string' ? until : until.topic
    return bus.subscribe(topic, event => {
      if (typeof until === 'string' || until.when(event)) go(index + 1)
    })
  }, [bus, until, go, index])

  if (offered) {
    return (
      <div className={['desk-tour', className].filter(Boolean).join(' ')} role="region" aria-label={`Tour: ${tour.name}`}>
        <div className="desk-tour-head">
          <b>{tour.name}</b>
          <span className="desk-tour-count">{total} steps</span>
        </div>
        {tour.description && <p className="desk-tour-caption">{tour.description}</p>}
        <div className="desk-tour-actions">
          <span className="desk-tour-spacer" />
          <Button size="small" onClick={() => onStop?.()}>
            Not now
          </Button>
          <Button size="small" intent="default" onClick={() => setOffered(false)}>
            Show me
          </Button>
        </div>
      </div>
    )
  }

  if (!step) return null

  return (
    <div className={['desk-tour', className].filter(Boolean).join(' ')} role="region" aria-label={`Tour: ${tour.name}`}>
      <div className="desk-tour-head">
        <b>{tour.name}</b>
        <span className="desk-tour-count">
          Step {index + 1} of {total}
        </span>
        <Button size="small" intent="quiet" aria-label="Stop the tour" onClick={() => onStop?.()}>
          ✕
        </Button>
      </div>
      <div className="desk-tour-progress" role="presentation">
        <i style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <p className="desk-tour-caption" data-your-turn={step.yourTurn || undefined}>
        {step.yourTurn && <span className="desk-tour-turn">Your turn</span>}
        {step.caption}
      </p>
      <div className="desk-tour-actions">
        <Button size="small" intent="quiet" onClick={() => setIndex(0)}>
          Restart
        </Button>
        <Button size="small" intent="quiet" onClick={() => setIndex(index)}>
          Show me again
        </Button>
        <span className="desk-tour-spacer" />
        {step.yourTurn ? (
          <>
            <Button size="small" onClick={() => go(index + 1)}>Skip</Button>
            {!step.until && (
              <Button size="small" intent="default" onClick={() => go(index + 1)}>
                Done
              </Button>
            )}
          </>
        ) : (
          <>
            <Button size="small" disabled={index === 0} onClick={() => go(index - 1)}>
              ‹ Back
            </Button>
            <Button size="small" intent="default" onClick={() => go(index + 1)}>
              {index === total - 1 ? 'Finish' : 'Next ›'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
