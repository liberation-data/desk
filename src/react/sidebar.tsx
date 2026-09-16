import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/*
 * A source list: the places inside a window. It is navigation, not a menu, so
 * the chosen item is marked `aria-current` and stays chosen.
 */

export interface SidebarItem {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  readonly badge?: ReactNode
  readonly disabled?: boolean
}

export interface SidebarSection {
  readonly id: string
  readonly label?: string
  readonly items: readonly SidebarItem[]
}

export interface SidebarProps {
  readonly sections: readonly SidebarSection[]
  readonly value: string
  readonly onChange: (id: string) => void
  readonly label: string
  readonly footer?: ReactNode
  readonly className?: string
}

export function Sidebar({ sections, value, onChange, label, footer, className }: SidebarProps) {
  const nav = useRef<HTMLElement>(null)
  const items = sections.flatMap(section => section.items).filter(item => !item.disabled)

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const keys = { ArrowDown: 1, ArrowUp: -1 } as const
    const delta = keys[event.key as keyof typeof keys]
    if (!delta && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const at = items.findIndex(item => item.id === value)
    const next =
      event.key === 'Home' ? items[0]
      : event.key === 'End' ? items.at(-1)
      : items[(at + (delta ?? 1) + items.length) % items.length]
    if (!next) return
    onChange(next.id)
    nav.current?.querySelector<HTMLButtonElement>(`[data-item="${CSS.escape(next.id)}"]`)?.focus()
  }

  return (
    <nav ref={nav} className={['desk-sidebar', className].filter(Boolean).join(' ')} aria-label={label} onKeyDown={onKeyDown}>
      {sections.map(section => (
        <div key={section.id} className="desk-sidebar-section">
          {section.label && <p className="desk-sidebar-heading">{section.label}</p>}
          <ul>
            {section.items.map(item => {
              const current = item.id === value
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-item={item.id}
                    className="desk-sidebar-item"
                    aria-current={current ? 'page' : undefined}
                    data-current={current || undefined}
                    disabled={item.disabled}
                    tabIndex={current ? 0 : -1}
                    onClick={() => onChange(item.id)}
                  >
                    {item.icon && <span className="desk-sidebar-icon" aria-hidden="true">{item.icon}</span>}
                    <span className="desk-sidebar-label">{item.label}</span>
                    {item.badge != null && <span className="desk-sidebar-badge">{item.badge}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {footer && <div className="desk-sidebar-footer">{footer}</div>}
    </nav>
  )
}
