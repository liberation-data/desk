import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/*
 * A table of rows people read, sort and choose from. It renders what it is
 * given: no paging, no fetching, no opinion about where the rows came from.
 */

export interface Column<Row> {
  readonly key: string
  readonly header: ReactNode
  /** Defaults to `row[key]` when the key names a field. */
  readonly render?: (row: Row) => ReactNode
  readonly align?: 'start' | 'end'
  /** Figures line up and sort as numbers when this is set. */
  readonly numeric?: boolean
  readonly sortable?: boolean
  readonly width?: string
}

export interface Sort {
  readonly key: string
  readonly direction: 'ascending' | 'descending'
}

export interface TableProps<Row> {
  readonly rows: readonly Row[]
  readonly columns: readonly Column<Row>[]
  readonly rowId: (row: Row) => string
  /** The accessible name, e.g. "Rides". */
  readonly label: string
  /** One id, or several when `selection` is `multiple`. */
  readonly selected?: string | readonly string[] | null
  /** Default `single`. `multiple` adds ⌘/Ctrl to add one and Shift for a run. */
  readonly selection?: 'single' | 'multiple'
  readonly onSelect?: (id: string, row: Row) => void
  /** Called instead of `onSelect` when `selection` is `multiple`. */
  readonly onSelectionChange?: (ids: string[]) => void
  /** Enter, or a double click. */
  readonly onActivate?: (id: string, row: Row) => void
  readonly sort?: Sort | null
  readonly onSortChange?: (sort: Sort) => void
  readonly empty?: ReactNode
}

const cell = <Row,>(row: Row, column: Column<Row>): ReactNode =>
  column.render ? column.render(row) : ((row as Record<string, unknown>)[column.key] as ReactNode)

export function Table<Row>({
  rows,
  columns,
  rowId,
  label,
  selected,
  selection = 'single',
  onSelect,
  onSelectionChange,
  onActivate,
  sort,
  onSortChange,
  empty,
}: TableProps<Row>) {
  const body = useRef<HTMLTableSectionElement>(null)
  const anchor = useRef<number>(0)
  const chosen = selected == null ? [] : Array.isArray(selected) ? selected : [selected as string]
  const isChosen = (id: string) => chosen.includes(id)

  const choose = (index: number, modifiers: { readonly add?: boolean; readonly range?: boolean } = {}) => {
    const row = rows[index]
    if (!row) return
    const id = rowId(row)
    if (selection === 'multiple' && onSelectionChange) {
      if (modifiers.range) {
        const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)]
        onSelectionChange(rows.slice(from, to + 1).map(rowId))
      } else if (modifiers.add) {
        anchor.current = index
        onSelectionChange(isChosen(id) ? chosen.filter(x => x !== id) : [...chosen, id])
      } else {
        anchor.current = index
        onSelectionChange([id])
      }
      return
    }
    anchor.current = index
    onSelect?.(id, row)
  }

  const focusRow = (index: number, modifiers: { readonly range?: boolean } = {}) => {
    const clamped = Math.max(0, Math.min(index, rows.length - 1))
    if (!rows[clamped]) return
    choose(clamped, modifiers)
    body.current?.querySelectorAll<HTMLElement>('tr')[clamped]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const index = [...(body.current?.querySelectorAll('tr') ?? [])].indexOf(document.activeElement as HTMLTableRowElement)
    if (index < 0) return
    const row = rows[index]
    switch (event.key) {
      case 'ArrowDown': focusRow(index + 1, { range: event.shiftKey }); break
      case 'ArrowUp': focusRow(index - 1, { range: event.shiftKey }); break
      case 'Home': focusRow(0, { range: event.shiftKey }); break
      case 'End': focusRow(rows.length - 1, { range: event.shiftKey }); break
      case ' ': if (selection === 'multiple') choose(index, { add: true }); break
      case 'Enter': if (row) onActivate?.(rowId(row), row); break
      default: return
    }
    event.preventDefault()
  }

  const toggleSort = (column: Column<Row>) => {
    if (!column.sortable || !onSortChange) return
    const direction = sort?.key === column.key && sort.direction === 'ascending' ? 'descending' : 'ascending'
    onSortChange({ key: column.key, direction })
  }

  if (!rows.length && empty) return <div className="desk-table-empty">{empty}</div>

  return (
    <div className="desk-table-wrap">
      <table className="desk-table" aria-label={label} aria-multiselectable={selection === 'multiple' || undefined}>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                data-align={column.align ?? (column.numeric ? 'end' : 'start')}
                aria-sort={sort?.key === column.key ? sort.direction : column.sortable ? 'none' : undefined}
              >
                {column.sortable && onSortChange ? (
                  <button type="button" className="desk-table-sort" onClick={() => toggleSort(column)}>
                    {column.header}
                    <span aria-hidden="true">{sort?.key === column.key ? (sort.direction === 'ascending' ? '↑' : '↓') : ''}</span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={body} onKeyDown={onKeyDown}>
          {rows.map((row, index) => {
            const id = rowId(row)
            const isSelected = isChosen(id)
            const selectable = Boolean(onSelect || onSelectionChange)
            return (
              <tr
                key={id}
                // One tab stop for the whole table; arrow keys move within it.
                tabIndex={isSelected || (!chosen.length && index === 0) ? 0 : -1}
                aria-selected={selectable ? isSelected : undefined}
                data-selected={isSelected || undefined}
                onClick={event => choose(index, { add: event.metaKey || event.ctrlKey, range: event.shiftKey })}
                onDoubleClick={() => onActivate?.(id, row)}
              >
                {columns.map(column => (
                  <td key={column.key} data-align={column.align ?? (column.numeric ? 'end' : 'start')} data-numeric={column.numeric || undefined}>
                    {cell(row, column)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
