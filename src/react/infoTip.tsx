import { useState } from 'react'
import type { ReactNode } from 'react'
import { Popover } from './overlays.js'

/*
 * What a view would explain if asked. A window that opens with a paragraph makes everyone read it
 * every time to reach the thing they came for; the same words behind an (i) are there for whoever
 * has the question, once.
 *
 * Only for explanation. A warning, or anything that changes what someone is about to do, belongs
 * in front of them — hiding that behind a disclosure is how it goes unread.
 */

export interface InfoTipProps {
  /** What it explains, e.g. "About these logs" — the button's name and the popover's. */
  readonly label: string
  readonly children: ReactNode
  readonly placement?: 'below' | 'above'
  readonly align?: 'start' | 'end'
  readonly className?: string
}

export function InfoTip({ label, children, placement = 'below', align = 'start', className }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={label}
      placement={placement}
      align={align}
      trigger={props => (
        <button
          {...props}
          ref={props.ref}
          type="button"
          className={['desk-infotip', className].filter(Boolean).join(' ')}
          aria-label={label}
          data-open={open || undefined}
        >
          <span aria-hidden="true">i</span>
        </button>
      )}
    >
      <div className="desk-infotip-body">{children}</div>
    </Popover>
  )
}
