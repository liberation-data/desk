import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'

/*
 * An outline: a list that shows how deep each row sits. A document's headings, a schema, a folder.
 *
 * It is not a sidebar. A sidebar is a few places to go, in sections, all at one level; an outline
 * can be hundreds of rows in a hierarchy, and is moved through the way a tree is. The rows arrive
 * flat and in order, each saying its depth, because that is how a hierarchy is usually held and it
 * leaves nothing to fold or unfold by accident.
 *
 * Depth is drawn with weight, colour and a small indent, and all three stop changing at
 * [OUTLINE_MAX_DEPTH]: a hierarchy twelve levels deep cannot indent the list out of its own width.
 * A row is one line; a title too long for it is cut, and is whole on hover.
 */

/** The deepest level drawn differently. Deeper rows look like this one. */
export const OUTLINE_MAX_DEPTH = 4

export interface OutlineRow {
  readonly id: string
  readonly label: string
  /** 1 for the top level, 2 for a row inside one, and so on. */
  readonly depth: number
  /** Listed, but with nothing to open: a heading with no words under it. */
  readonly disabled?: boolean
}

export interface OutlineProps {
  /** In the order they are read, each saying how deep it sits. */
  readonly rows: readonly OutlineRow[]
  /** The chosen row, or null when none is. */
  readonly value: string | null
  readonly onChange: (id: string) => void
  /** Names the outline for assistive technology: "Sections". */
  readonly label: string
  readonly className?: string
}

const drawnDepth = (depth: number) => Math.min(Math.max(1, Math.floor(depth)), OUTLINE_MAX_DEPTH)

export function Outline({ rows, value, onChange, label, className }: OutlineProps) {
  const tree = useRef<HTMLDivElement>(null)
  const enabled = rows.filter(row => !row.disabled)
  // One tab stop: the chosen row, or the first that can be chosen when none is.
  const tabStop = enabled.some(row => row.id === value) ? value : enabled[0]?.id ?? null

  // Chosen from outside — Next, a link — it may be out of sight; bring it in without jumping.
  useEffect(() => {
    if (value === null) return
    tree.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(value)}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [value])

  const choose = (row: OutlineRow | undefined) => {
    if (!row) return
    onChange(row.id)
    tree.current?.querySelector<HTMLButtonElement>(`[data-row="${CSS.escape(row.id)}"]`)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const at = rows.findIndex(row => row.id === (document.activeElement as HTMLElement | null)?.dataset.row)
    if (at < 0) return
    const here = rows[at]!
    const usable = (row: OutlineRow) => !row.disabled
    const target: OutlineRow | undefined = (() => {
      switch (event.key) {
        case 'ArrowDown': return rows.slice(at + 1).find(usable)
        case 'ArrowUp': return rows.slice(0, at).reverse().find(usable)
        case 'Home': return enabled[0]
        case 'End': return enabled.at(-1)
        // Out to what this row sits inside, as a tree does.
        case 'ArrowLeft': return rows.slice(0, at).reverse().find(row => row.depth < here.depth && usable(row))
        // In to the first row inside this one, if it has any.
        case 'ArrowRight': {
          const inside = rows.slice(at + 1)
          const end = inside.findIndex(row => row.depth <= here.depth)
          return (end < 0 ? inside : inside.slice(0, end)).find(usable)
        }
        default: return undefined
      }
    })()
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    choose(target)
  }

  return (
    <div ref={tree} role="tree" aria-label={label} className={['desk-outline', className].filter(Boolean).join(' ')} onKeyDown={onKeyDown}>
      {rows.map(row => {
        const current = row.id === value
        return (
          <button
            key={row.id}
            type="button"
            role="treeitem"
            aria-level={Math.max(1, Math.floor(row.depth))}
            aria-selected={current}
            data-row={row.id}
            data-depth={drawnDepth(row.depth)}
            data-current={current || undefined}
            className="desk-outline-row"
            disabled={row.disabled}
            tabIndex={row.id === tabStop ? 0 : -1}
            title={row.label}
            onClick={() => onChange(row.id)}
          >
            <span className="desk-outline-label">{row.label}</span>
          </button>
        )
      })}
    </div>
  )
}
