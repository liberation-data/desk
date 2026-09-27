import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/*
 * The views of one window, one at a time.
 *
 * Not a segmented control. A segmented control CHOOSES — a filter, a unit, a mode — and what it
 * governs stays on screen. Tabs SWITCH what the window shows: the strip is the heading of the
 * view beneath it, and the view beneath it is a tabpanel the strip names. Screen readers say
 * "tab 2 of 4" for one and "radio button" for the other, and they are right to.
 *
 * Selection follows focus, as the arrow keys move it: a tab is a place, and a place is cheap to
 * look at. A view that is expensive to open should load when it is shown, not ask to be clicked.
 */

export interface Tab<T extends string> {
  readonly value: T
  readonly label: string
  /** A count or a state beside the label, e.g. the 3 in "Needs review 3". */
  readonly badge?: ReactNode
  readonly disabled?: boolean
}

export interface TabsProps<T extends string> {
  /** Two to seven views. More than fit on one line want a `<Sidebar>`. */
  readonly tabs: readonly Tab<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  /** The accessible name for the strip, usually the window's, e.g. "Model Router". */
  readonly label: string
  /** The selected view. Rendered inside the tabpanel the selected tab controls. */
  readonly children?: ReactNode
  readonly className?: string
}

const KEYS = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' } as const

export function Tabs<T extends string>({ tabs, value, onChange, label, children, className }: TabsProps<T>) {
  const id = useId()
  const strip = useRef<HTMLDivElement>(null)
  const tabId = (v: T) => `${id}-tab-${v}`
  const panelId = `${id}-panel`

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = KEYS[event.key as keyof typeof KEYS]
    const usable = tabs.filter(t => !t.disabled)
    if (key === undefined || !usable.length) return
    event.preventDefault()
    const at = usable.findIndex(t => t.value === value)
    const next = key === 'first' ? usable[0]
      : key === 'last' ? usable[usable.length - 1]
      : usable[(at + key + usable.length) % usable.length]
    if (!next) return
    onChange(next.value)
    strip.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus()
  }

  return (
    <div className={['desk-tabs', className].filter(Boolean).join(' ')}>
      <div ref={strip} role="tablist" aria-label={label} className="desk-tablist" onKeyDown={move}>
        {tabs.map(tab => {
          const selected = tab.value === value
          return (
            <button
              key={tab.value}
              id={tabId(tab.value)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              data-value={tab.value}
              className="desk-tab"
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.value)}
            >
              {tab.label}
              {tab.badge != null && <span className="desk-tab-badge">{tab.badge}</span>}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)} className="desk-tabpanel">
        {children}
      </div>
    </div>
  )
}
