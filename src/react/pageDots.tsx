/*
 * WHERE YOU ARE IN A SHORT RUN OF PAGES.
 *
 * A row of dots, the current one drawn longer: tips, a gallery, the screens of a walkthrough. It
 * says position at a glance and takes less room than "3 of 9", which is why it sits in a footer
 * beside the button that moves on.
 *
 * IT DOES NOT GROW WITH THE COUNT. Nine dots are nine dots; a hundred would be a ruler. Past
 * `max` only a window of them is drawn, around the current one, and the dots at an edge with more
 * beyond it shrink — so the row keeps its width and still shows which way there is further to go.
 *
 * THE DOTS ARE NEVER THE ONLY THING THAT SAYS IT. The row reads aloud as "<label> 12 of 100", the
 * exact position a row of seven dots cannot show.
 *
 * A PICTURE, NOT A CONTROL. A dot is six pixels and a page is pressed for with a button; dots that
 * could be pressed would each need a 44 px target, and then they are no longer a row of dots.
 */

export interface PageDotsProps {
  /** How many pages there are. Nothing is drawn for fewer than two. */
  readonly count: number
  /** The current page, from 0. */
  readonly value: number
  /** What a page is, in a word: "Tip", "Photo". Read aloud with the position. */
  readonly label: string
  /** The most dots drawn at once. Default 7; an odd number keeps the current one in the middle. */
  readonly max?: number
  readonly className?: string
}

export interface PageDot {
  readonly index: number
  /** Smaller toward an edge that has more pages beyond it. */
  readonly size: 'full' | 'medium' | 'small'
}

/** The dots to draw for [count] pages at [value]: all of them, or a window of [max] around it. */
export function pageWindow(count: number, value: number, max = 7): PageDot[] {
  const shown = Math.max(1, Math.min(max, count))
  const at = Math.min(Math.max(value, 0), Math.max(count - 1, 0))
  const start = Math.min(Math.max(at - Math.floor(shown / 2), 0), Math.max(count - shown, 0))
  const before = start > 0
  const after = start + shown < count
  return Array.from({ length: shown }, (_, i): PageDot => {
    const fromEdge = Math.min(before ? i : Infinity, after ? shown - 1 - i : Infinity)
    return { index: start + i, size: fromEdge === 0 ? 'small' : fromEdge === 1 ? 'medium' : 'full' }
  })
}

export function PageDots({ count, value, label, max = 7, className }: PageDotsProps) {
  if (count < 2) return null
  const at = Math.min(Math.max(value, 0), count - 1)
  return (
    <span className={['desk-page-dots', className].filter(Boolean).join(' ')} role="img" aria-label={`${label} ${at + 1} of ${count}`}>
      {pageWindow(count, at, max).map(dot => (
        <span key={dot.index} className="desk-page-dot" data-size={dot.size} data-current={dot.index === at || undefined} />
      ))}
    </span>
  )
}
