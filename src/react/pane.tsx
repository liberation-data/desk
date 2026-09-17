import type { ReactNode } from 'react'

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

export interface PaneProps {
  /** Stays put at the top: a Toolbar, usually. */
  readonly header?: ReactNode
  /** Stays put at the bottom: a count, a status line, the buttons of a form. */
  readonly footer?: ReactNode
  /** Fills what is left and scrolls, on its own. */
  readonly children: ReactNode
  /** The scrolling part is the thing being read, so it can be named and reached by the keyboard. */
  readonly label?: string
  readonly className?: string
}

export function Pane({ header, footer, children, label, className }: PaneProps) {
  return (
    <div className={['desk-pane', className].filter(Boolean).join(' ')}>
      {header != null && <div className="desk-pane-header">{header}</div>}
      <div
        className="desk-pane-body"
        {...(label ? { role: 'region', 'aria-label': label, tabIndex: 0 } : {})}
      >
        {children}
      </div>
      {footer != null && <div className="desk-pane-footer">{footer}</div>}
    </div>
  )
}
