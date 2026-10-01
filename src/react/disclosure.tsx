import { useId } from 'react'
import type { ReactNode } from 'react'

/*
 * SETTINGS MOST PEOPLE LEAVE ALONE, FOLDED BEHIND ONE LINE THAT SAYS WHAT THEY ARE SET TO.
 *
 * A row of five filters above a result is five things to read before the result, and four of them
 * are at their defaults. Folded, the row is one button and a summary — a chip for each thing that is
 * actually set — so the line costs nothing when nothing is narrowed and says exactly what is when
 * something is. Unfolded, the controls sit under it with their labels. See HIG.md §6.
 *
 * THE BODY STAYS MOUNTED WHILE FOLDED. A field folded away keeps its value, so what it holds is
 * still sent; unmounting it would make folding the section a way to lose input.
 */

export interface DisclosureProps {
  /** What is folded away, as a noun: "Filter", "Advanced". It is the button's whole label. */
  readonly label: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /**
   * Beside the label, folded or open: what the section is currently set to. Chips, usually — one
   * per setting that is off its default — so the folded line is never a mystery.
   */
  readonly summary?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

export function Disclosure({ label, open, onOpenChange, summary, children, className }: DisclosureProps) {
  const id = useId()
  return (
    <div className={['desk-disclosure', className].filter(Boolean).join(' ')}>
      <div className="desk-disclosure-head">
        <button
          type="button"
          className="desk-disclosure-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => onOpenChange(!open)}
        >
          <span className="desk-disclosure-caret" aria-hidden="true" />
          {label}
        </button>
        {summary}
      </div>
      <div id={id} className="desk-disclosure-body" hidden={!open}>
        {children}
      </div>
    </div>
  )
}

export interface ChipProps {
  readonly children: ReactNode
  /** With it the chip ends in a × that calls this: the chip is then how the thing is taken away. */
  readonly onRemove?: () => void
  /** The ×'s name, saying what goes: "Clear the tag", "Remove report.pdf". */
  readonly removeLabel?: string
  readonly className?: string
}

/** One thing that is set or chosen, said in a word or two: a filter in force, a tag, a staged file. */
export function Chip({ children, onRemove, removeLabel = 'Remove', className }: ChipProps) {
  return (
    <span className={['desk-chip', className].filter(Boolean).join(' ')}>
      {children}
      {onRemove && (
        <button type="button" className="desk-chip-remove" aria-label={removeLabel} onClick={onRemove}>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  )
}
