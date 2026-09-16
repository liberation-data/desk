// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Checkbox, PopUpButton, Sidebar, Slider, Table } from '../../src/react/index.js'
import type { Column, Sort } from '../../src/react/index.js'

afterEach(cleanup)

describe('Checkbox', () => {
  it('checks, unchecks and carries a description', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Include commutes" description="Rides under 30 km" />)
    const box = screen.getByRole('checkbox', { name: 'Include commutes' })
    expect(box.getAttribute('aria-describedby')).toBe(screen.getByText('Rides under 30 km').id)
    await user.click(box)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('can stand for a mixed set', () => {
    render(<Checkbox checked={false} indeterminate onChange={() => {}} aria-label="All bikes" />)
    expect(screen.getByRole('checkbox')).toHaveProperty('indeterminate', true)
  })
})

describe('Slider', () => {
  it('reads its value in words, and reports what it is moved to', () => {
    function Harness() {
      const [psi, setPsi] = useState(80)
      return <Slider label="Tyre pressure" value={psi} onChange={setPsi} min={60} max={120} format={v => `${v} psi`} />
    }
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Tyre pressure' })
    expect(slider.getAttribute('aria-valuetext')).toBe('80 psi')
    // jsdom has no keyboard behaviour for a range input, so drive its value directly.
    fireEvent.change(slider, { target: { value: '81' } })
    expect(screen.getByText('81 psi')).toBeTruthy()
    expect(slider.getAttribute('aria-valuetext')).toBe('81 psi')
  })
})

describe('PopUpButton', () => {
  const OPTIONS = [
    { value: 'road', label: 'Road' },
    { value: 'gravel', label: 'Gravel', description: 'Steel, flat-mount discs' },
    { value: 'retired', label: 'Retired bike', disabled: true },
    { value: 'mtb', label: 'MTB' },
  ] as const

  function Harness() {
    const [value, setValue] = useState<(typeof OPTIONS)[number]['value'] | null>(null)
    return <PopUpButton label="Bike" options={OPTIONS} value={value} onChange={setValue} placeholder="Choose a bike" />
  }

  const trigger = () => screen.getByRole('button', { name: /Bike/ })

  it('shows a placeholder until something is chosen', () => {
    render(<Harness />)
    expect(trigger().textContent).toContain('Choose a bike')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens a listbox, chooses, and shows what was chosen', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())
    const list = screen.getByRole('listbox', { name: 'Bike' })
    expect(within(list).getByText('Steel, flat-mount discs')).toBeTruthy()
    await user.click(within(list).getByRole('option', { name: /Gravel/ }))
    expect(trigger().textContent).toContain('Gravel')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('works from the keyboard, skipping what cannot be chosen', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    const list = screen.getByRole('listbox')
    expect(document.activeElement).toBe(list)
    await user.keyboard('{ArrowDown}{ArrowDown}') // Road → Gravel → skips Retired → MTB
    await user.keyboard('{Enter}')
    expect(trigger().textContent).toContain('MTB')
    expect(document.activeElement).toBe(trigger())
  })

  it('jumps to an option by typing', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())
    await user.keyboard('g{Enter}')
    expect(trigger().textContent).toContain('Gravel')
  })

  it('closes on Escape without choosing', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger().textContent).toContain('Choose a bike')
  })
})

describe('Table', () => {
  interface Ride {
    readonly id: string
    readonly name: string
    readonly km: number
  }
  const RIDES: Ride[] = [
    { id: '1', name: 'Dandenongs loop', km: 92.4 },
    { id: '2', name: 'Beach Road bunch', km: 61.8 },
    { id: '3', name: 'Yarra Trail commute', km: 24.1 },
  ]
  const COLUMNS: Column<Ride>[] = [
    { key: 'name', header: 'Ride', sortable: true },
    { key: 'km', header: 'km', numeric: true, sortable: true, render: r => r.km.toFixed(1) },
  ]

  function Harness({ onActivate }: { readonly onActivate?: (id: string) => void }) {
    const [selected, setSelected] = useState<string | null>(null)
    const [sort, setSort] = useState<Sort | null>(null)
    const rows = sort
      ? [...RIDES].sort((a, b) => (sort.direction === 'ascending' ? 1 : -1) * (sort.key === 'km' ? a.km - b.km : a.name.localeCompare(b.name)))
      : RIDES
    return (
      <Table
        label="Rides"
        rows={rows}
        columns={COLUMNS}
        rowId={r => r.id}
        selected={selected}
        onSelect={id => setSelected(id)}
        {...(onActivate ? { onActivate: (id: string) => onActivate(id) } : {})}
        sort={sort}
        onSortChange={setSort}
      />
    )
  }

  it('renders rows, with figures lined up', () => {
    render(<Harness />)
    const table = screen.getByRole('table', { name: 'Rides' })
    expect(within(table).getAllByRole('row')).toHaveLength(4) // header and three rides
    expect(within(table).getByText('92.4')).toBeTruthy()
  })

  it('sorts when a heading is chosen, and says which way', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const heading = screen.getByRole('columnheader', { name: /km/ })
    expect(heading.getAttribute('aria-sort')).toBe('none')
    await user.click(within(heading).getByRole('button'))
    expect(heading.getAttribute('aria-sort')).toBe('ascending')
    expect(screen.getAllByRole('row')[1]?.textContent).toContain('Yarra Trail commute')
    await user.click(within(heading).getByRole('button'))
    expect(heading.getAttribute('aria-sort')).toBe('descending')
  })

  it('selects with a click and with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const rows = screen.getAllByRole('row').slice(1)
    await user.click(rows[1] as HTMLElement)
    expect(rows[1]?.dataset.selected).toBe('true')
    ;(rows[1] as HTMLElement).focus()
    fireEvent.keyDown(rows[1] as HTMLElement, { key: 'ArrowDown' })
    expect(screen.getAllByRole('row')[3]?.dataset.selected).toBe('true')
  })

  it('activates on Enter and on a double click', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    render(<Harness onActivate={onActivate} />)
    const row = screen.getAllByRole('row')[1] as HTMLElement
    await user.dblClick(row)
    expect(onActivate).toHaveBeenCalledWith('1')
    row.focus()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledTimes(2)
  })

  it('shows an empty state instead of a bare table', () => {
    render(<Table label="Rides" rows={[]} columns={COLUMNS} rowId={(r: Ride) => r.id} empty={<p>No rides yet</p>} />)
    expect(screen.getByText('No rides yet')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Sidebar', () => {
  const SECTIONS = [
    { id: 'garage', label: 'Garage', items: [{ id: 'bikes', label: 'Bikes' }, { id: 'parts', label: 'Parts', badge: 2 }] },
    { id: 'plan', label: 'Plan', items: [{ id: 'routes', label: 'Routes' }, { id: 'old', label: 'Archive', disabled: true }] },
  ]

  function Harness() {
    const [value, setValue] = useState('bikes')
    return <Sidebar label="Places" sections={SECTIONS} value={value} onChange={setValue} />
  }

  it('marks where you are', () => {
    render(<Harness />)
    const nav = screen.getByRole('navigation', { name: 'Places' })
    expect(within(nav).getByRole('button', { name: 'Bikes' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByText('Garage')).toBeTruthy()
  })

  it('moves with the arrow keys, skipping what cannot be chosen, and wraps', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('button', { name: 'Bikes' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: /Parts/ }).getAttribute('aria-current')).toBe('page')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Bikes' }).getAttribute('aria-current')).toBe('page')
  })

  it('is one tab stop', () => {
    render(<Harness />)
    const buttons = within(screen.getByRole('navigation')).getAllByRole('button')
    expect(buttons.filter(b => b.tabIndex === 0)).toHaveLength(1)
  })
})
