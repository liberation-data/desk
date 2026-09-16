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
  readonly selected?: string | null
  readonly onSelect?: (id: string, row: Row) => void
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
  onSelect,
  onActivate,
  sort,
  onSortChange,
  empty,
}: TableProps<Row>) {
  const body = useRef<HTMLTableSectionElement>(null)

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(index, rows.length - 1))
    const row = rows[clamped]
    if (!row) return
    onSelect?.(rowId(row), row)
    body.current?.querySelectorAll<HTMLElement>('tr')[clamped]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const index = [...(body.current?.querySelectorAll('tr') ?? [])].indexOf(document.activeElement as HTMLTableRowElement)
    if (index < 0) return
    const row = rows[index]
    switch (event.key) {
      case 'ArrowDown': focusRow(index + 1); break
      case 'ArrowUp': focusRow(index - 1); break
      case 'Home': focusRow(0); break
      case 'End': focusRow(rows.length - 1); break
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
      <table className="desk-table" aria-label={label}>
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
            const isSelected = id === selected
            return (
              <tr
                key={id}
                // One tab stop for the whole table; arrow keys move within it.
                tabIndex={isSelected || (!selected && index === 0) ? 0 : -1}
                aria-selected={onSelect ? isSelected : undefined}
                data-selected={isSelected || undefined}
                onClick={() => onSelect?.(id, row)}
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
