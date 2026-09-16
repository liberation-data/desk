import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Desk } from '../core/desk.js'
import type { WindowId } from '../core/types.js'
import { useCommand, useShortcuts } from './commands.js'
import { useDesk } from './context.js'
import { useFocusTrap, useLayer } from './layers.js'

/*
 * One place to search everything the app knows. The app says what the results
 * are; the palette handles typing, keyboard, grouping and choosing.
 */

export interface SearchResult {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  /** Groups the results under a heading, in the order the groups first appear. */
  readonly group?: string
  readonly icon?: ReactNode
  /** A short word for what this is: `window`, `ride`, `command`. */
  readonly kind?: string
  readonly onSelect: () => void
}

/** The open windows as results, for an app to mix into its own. */
export function windowResults(desk: Desk, title: (id: WindowId) => string, group = 'Windows'): SearchResult[] {
  return desk.getState().windows.map(w => ({
    id: `window:${w.id}`,
    title: title(w.id),
    group,
    kind: 'window',
    onSelect: () => desk.focus(w.id),
  }))
}

export const SearchCommand = 'desk.search'

export interface SearchPaletteProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Called as the person types. May be async; a slower answer never overtakes a newer one. */
  readonly search: (query: string) => readonly SearchResult[] | Promise<readonly SearchResult[]>
  readonly placeholder?: string
  readonly label?: string
  /** Shown before anything is typed. */
  readonly hint?: ReactNode
  /** Shown when a query matches nothing. */
  readonly empty?: (query: string) => ReactNode
  /** Also opens the palette. Default `mod+k`; pass `null` to bind nothing. */
  readonly shortcut?: string | null
}

export function SearchPalette({
  open,
  onOpenChange,
  search,
  placeholder = 'Search',
  label = 'Search',
  hint,
  empty,
  shortcut = 'mod+k',
}: SearchPaletteProps) {
  const desk = useDesk()
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly SearchResult[]>([])
  const [active, setActive] = useState(0)

  useLayer(id, open, () => onOpenChange(false))
  useFocusTrap(panel, open)
  useCommand(SearchCommand, () => onOpenChange(true), { at: 'app' })
  // Memoised: bindShortcuts re-registers whenever the keymap object changes identity.
  useShortcuts(useMemo(() => (shortcut ? { [shortcut]: SearchCommand } : {}), [shortcut]))

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    let current = true
    Promise.resolve(search(query)).then(found => {
      // A slow search for an old query must not replace the answer to a newer one.
      if (!current) return
      setResults(found)
      setActive(0)
    })
    return () => {
      current = false
    }
  }, [open, query, search])

  if (!open) return null

  const choose = (result: SearchResult | undefined) => {
    if (!result) return
    onOpenChange(false)
    result.onSelect()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const move = (to: number) => {
      event.preventDefault()
      setActive(Math.max(0, Math.min(to, results.length - 1)))
    }
    switch (event.key) {
      case 'ArrowDown': return move(active + 1)
      case 'ArrowUp': return move(active - 1)
      case 'Home': return move(0)
      case 'End': return move(results.length - 1)
      case 'Enter': {
        event.preventDefault()
        return choose(results[active])
      }
      default:
    }
  }

  const listId = `${id}-results`
  let group: string | undefined
  return createPortal(
    <div className="desk-search-scrim" onPointerDown={event => event.target === event.currentTarget && onOpenChange(false)}>
      <div ref={panel} role="dialog" aria-label={label} className="desk-search" onKeyDown={onKeyDown}>
        <div className="desk-search-bar">
          <input
            className="desk-search-field"
            role="combobox"
            aria-label={label}
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${id}-${active}` : undefined}
            aria-autocomplete="list"
            placeholder={placeholder}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        {results.length > 0 && (
          <ul id={listId} role="listbox" aria-label={label} className="desk-search-results">
            {results.map((result, index) => {
              const heading = result.group && result.group !== group ? result.group : null
              group = result.group
              return (
                <li key={result.id} className="desk-search-row-wrap">
                  {heading && <p className="desk-search-group">{heading}</p>}
                  <div
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className="desk-search-row"
                    data-active={index === active || undefined}
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(result)}
                  >
                    {result.icon && <span className="desk-search-icon" aria-hidden="true">{result.icon}</span>}
                    <span className="desk-search-text">
                      <span className="desk-search-title">{result.title}</span>
                      {result.subtitle && <span className="desk-search-subtitle">{result.subtitle}</span>}
                    </span>
                    {result.kind && <span className="desk-search-kind">{result.kind}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {results.length === 0 && (
          <p className="desk-search-empty">{query.trim() ? (empty?.(query) ?? `Nothing matches “${query}”.`) : hint}</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
