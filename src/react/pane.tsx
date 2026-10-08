import { useId } from 'react'
import type { Ref, UIEvent, ReactNode } from 'react'

/*
 * The inside of a window: a row of controls that stays put, and content that scrolls under it.
 *
 * A window is a fixed height, so something inside it has to give. When the content simply grows,
 * the window grows with it and the whole thing scrolls — the toolbar leaves with it, and a log or a
 * table has to be scrolled past to reach anything below. A pane fills the window instead and scrolls
 * only its middle, so the controls stay where the pointer left them.
 */

export interface ToolbarProps {
  /** Controls, in reading order. Anything given `className="desk-grow"` takes the spare room. */
  readonly children: ReactNode
  /** Pushed to the trailing end: what acts on everything here, or the state of it. */
  readonly trailing?: ReactNode
  /** Names the row for assistive technology when it holds more than one thing: "Log controls". */
  readonly label?: string
  readonly className?: string
}

/** One aligned row of controls. Every item sits on the same centre line, whatever its height. */
export function Toolbar({ children, trailing, label, className }: ToolbarProps) {
  return (
    <div
      {...(label ? { role: 'group', 'aria-label': label } : {})}
      className={['desk-toolbar', className].filter(Boolean).join(' ')}
    >
      {children}
      {trailing != null && <div className="desk-toolbar-trailing">{trailing}</div>}
    </div>
  )
}

export interface PaneHeaderProps {
  /** What the pane is: "Keys and connections". */
  readonly title: ReactNode
  /** What acts on everything in the pane — Refresh — on the title's line, at the trailing end. */
  readonly actions?: ReactNode
  readonly className?: string
}

/**
 * A pane's title, and the controls for all of it, on one line.
 *
 * Sized from the type scale and padded to the window's clear edge, so every pane in an app titles
 * itself the same way without each one choosing a size.
 */
export function PaneHeader({ title, actions, className }: PaneHeaderProps) {
  return (
    <div className={['desk-pane-title', className].filter(Boolean).join(' ')}>
      <h2 className="desk-pane-title-text">{title}</h2>
      {actions != null && <div className="desk-pane-title-actions">{actions}</div>}
    </div>
  )
}

export interface SectionProps {
  /** Names the group, and the region for assistive technology. */
  readonly title: ReactNode
  /** What acts on this group only, on the title's line. */
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

/** A titled group inside a pane. Sections in a padded pane are spaced by the pane, not by themselves. */
export function Section({ title, actions, children, className }: SectionProps) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={['desk-section', className].filter(Boolean).join(' ')}>
      <div className="desk-section-head">
        <h3 id={id} className="desk-section-title">{title}</h3>
        {actions != null && <div className="desk-section-actions">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export interface PaneProps {
  /** Stays put at the top: a Toolbar, usually. */
  readonly header?: ReactNode
  /** Stays put at the bottom: a count, a status line, the buttons of a form. */
  readonly footer?: ReactNode
  /** Fills what is left and scrolls, on its own. */
  readonly children: ReactNode
  /** The scrolling part is the thing being read, so it can be named and reached by the keyboard. */
  readonly label?: string
  /** The scrolling element itself: for reading where it sits, or sending it to the bottom. */
  readonly bodyRef?: Ref<HTMLDivElement>
  readonly onScroll?: (event: UIEvent<HTMLDivElement>) => void
  /**
   * Keeps the HIG's 16px clear at the edges and lays the children out with a gap between them.
   * Leave it off for content that runs to the edge: a table, a log, a list with its own rules.
   */
  readonly padded?: boolean
  readonly className?: string
}

export function Pane({ header, footer, children, label, bodyRef, onScroll, padded, className }: PaneProps) {
  return (
    <div className={['desk-pane', className].filter(Boolean).join(' ')}>
      {header != null && <div className="desk-pane-header">{header}</div>}
      <div
        ref={bodyRef}
        className="desk-pane-body"
        onScroll={onScroll}
        {...(padded ? { 'data-padded': '' } : {})}
        {...(label ? { role: 'region', 'aria-label': label, tabIndex: 0 } : {})}
      >
        {children}
      </div>
      {footer != null && <div className="desk-pane-footer">{footer}</div>}
    </div>
  )
}

export interface PageProps {
  /** The text: paragraphs, headings, lists, a rendered document. */
  readonly children: ReactNode
  /** Names the sheet for assistive technology: the document's title, or "Answer". */
  readonly label?: string
  /** At least as tall as the room it is given, so a short section is still a whole sheet. */
  readonly fill?: boolean
  readonly className?: string
}

/**
 * A sheet for text that is read at length: a document's section, an answer, a report.
 *
 * A window's surface takes the theme's colour, which is right for chrome and tiring behind
 * paragraphs. A page lies on a neutral ground of its own (`--desk-page`), a shade off the window in
 * a light theme and a terminal's grey in a dark one, so the sheet reads as a sheet in both.
 */
export function Page({ children, label, fill, className }: PageProps) {
  return (
    <article
      className={['desk-page', className].filter(Boolean).join(' ')}
      {...(fill ? { 'data-fill': '' } : {})}
      {...(label ? { 'aria-label': label } : {})}
    >
      {children}
    </article>
  )
}
