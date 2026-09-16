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

  // Only when the step changes: a step whose body has a field re-renders on every
  // keystroke, and moving focus to the heading then would eat what was being typed.
  useEffect(() => {
    setDirection(index >= previous.current ? 'forward' : 'back')
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

  return (
    <section className={['desk-wizard', className].filter(Boolean).join(' ')} aria-label={label}>
      <div className="desk-wizard-content" data-direction={direction} key={step.id}>
        {step.glyph && <div className="desk-wizard-glyph" aria-hidden="true">{step.glyph}</div>}
        <h1 ref={heading} tabIndex={-1} className="desk-wizard-title">{step.title}</h1>
        {step.description && <p className="desk-wizard-description">{step.description}</p>}
        {step.body}
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
            <Button intent="quiet" onClick={step.skip.onSkip}>
              {step.skip.label}
            </Button>
          )}
          {index > 0 && !step.working && <Button onClick={() => go(index - 1)}>Back</Button>}
          <Button intent="default" disabled={!canContinue} onClick={() => go(index + 1)}>
            {step.continueLabel ?? (last ? 'Done' : 'Continue')}
          </Button>
        </div>
      </footer>
    </section>
  )
}
