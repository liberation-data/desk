import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './controls.js'

/*
 * A setup assistant: one pane, one question at a time, Back and Continue where
 * the eye already is. It owns which step is showing and whether Continue is
 * allowed; the steps themselves are the app's.
 *
 * A step cannot be skipped past by clicking a dot: the dots show where you are
 * and let you go back over what you have already answered, nothing more.
 */

export interface WizardStep {
  readonly id: string
  /** Named in the progress row, and announced as the step changes. */
  readonly name: string
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly body?: ReactNode
  /** Above the title. */
  readonly glyph?: ReactNode
  /** Continue is offered only when this is true. Default: always. */
  readonly complete?: boolean
  /** Replaces Continue's label on this step. */
  readonly continueLabel?: string
  /** A quiet way past this step: "Set up later". */
  readonly skip?: { readonly label: string; readonly onSkip: () => void }
  /** Nothing to do but wait: no Back, and Continue waits for `complete`. */
  readonly working?: boolean
  readonly onEnter?: () => void
  /**
   * Work Continue does before moving on: create the account, check the key, install the realm.
   * While it runs, Continue says so and nothing can be pressed twice. Throw to stay on the step
   * and show why, in the step; return `false` to stay without a message.
   */
  readonly onContinue?: () => unknown
  /** Continue's label while `onContinue` runs. Default: "Working…". */
  readonly busyLabel?: string
}

export interface WizardProps {
  readonly steps: readonly WizardStep[]
  readonly index: number
  readonly onIndexChange: (index: number) => void
  readonly onFinish: () => void
  readonly label?: string
  readonly className?: string
}

export function Wizard({ steps, index, onIndexChange, onFinish, label = 'Setup', className }: WizardProps) {
  const step = steps[index]
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const previous = useRef(index)
  const heading = useRef<HTMLHeadingElement>(null)
  const entered = useRef<(() => void) | undefined>(undefined)
  entered.current = step?.onEnter
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The step a running `onContinue` belongs to: if the person has gone back meanwhile, its result is stale.
  const running = useRef<number | null>(null)

  // Only when the step changes: a step whose body has a field re-renders on every
  // keystroke, and moving focus to the heading then would eat what was being typed.
  useEffect(() => {
    setDirection(index >= previous.current ? 'forward' : 'back')
    setBusy(false)
    setError(null)
    running.current = null
    previous.current = index
    entered.current?.()
    // Focus the new step's heading, so a screen reader announces it and the
    // keyboard starts at the top of the pane rather than back at the buttons.
    heading.current?.focus()
  }, [index])

  if (!step) return null

  const last = index === steps.length - 1
  const canContinue = step.complete ?? true
  const go = (to: number) => (to >= steps.length ? onFinish() : onIndexChange(Math.max(0, to)))

  const next = async () => {
    if (!step.onContinue) return go(index + 1)
    if (running.current !== null) return
    running.current = index
    setBusy(true)
    setError(null)
    try {
      const result = await step.onContinue()
      if (running.current !== index) return
      running.current = null
      setBusy(false)
      if (result !== false) go(index + 1)
    } catch (failure) {
      if (running.current !== index) return
      running.current = null
      setBusy(false)
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }

  return (
    <section className={['desk-wizard', className].filter(Boolean).join(' ')} aria-label={label}>
      <div className="desk-wizard-content" data-direction={direction} key={step.id}>
        {step.glyph && <div className="desk-wizard-glyph" aria-hidden="true">{step.glyph}</div>}
        <h1 ref={heading} tabIndex={-1} className="desk-wizard-title">{step.title}</h1>
        {step.description && <p className="desk-wizard-description">{step.description}</p>}
        {step.body}
        {error && (
          <p className="desk-wizard-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="desk-wizard-foot">
        <ol className="desk-wizard-steps" aria-label="Progress">
          {steps.map((other, i) => (
            <li
              key={other.id}
              className="desk-wizard-dot"
              data-state={i === index ? 'now' : i < index ? 'done' : 'ahead'}
              aria-current={i === index ? 'step' : undefined}
            >
              <span className="desk-wizard-dot-name">{other.name}</span>
            </li>
          ))}
        </ol>
        <span className="desk-wizard-step-name" aria-live="polite">
          {step.name}
        </span>
        <div className="desk-wizard-actions">
          {step.skip && (
            <Button intent="quiet" disabled={busy} onClick={step.skip.onSkip}>
              {step.skip.label}
            </Button>
          )}
          {index > 0 && !step.working && (
            <Button disabled={busy} onClick={() => go(index - 1)}>
              Back
            </Button>
          )}
          <Button intent="default" disabled={!canContinue || busy} aria-busy={busy || undefined} onClick={() => void next()}>
            {busy ? (step.busyLabel ?? 'Working…') : (step.continueLabel ?? (last ? 'Done' : 'Continue'))}
          </Button>
        </div>
      </footer>
    </section>
  )
}
