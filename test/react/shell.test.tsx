// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { Button, Desktop, DeskShell, RadioGroup, Table, useDeskEvent, usePublish, useToast } from '../../src/react/index.js'
import type { Column } from '../../src/react/index.js'

afterEach(cleanup)

describe('DeskShell', () => {
  function Publisher() {
    const publish = usePublish()
    const toast = useToast()
    return (
      <>
        <Button onClick={() => publish('ride.selected', { name: 'Dandenongs loop' })}>Choose</Button>
        <Button onClick={() => toast.show({ message: 'Saved' })}>Save</Button>
      </>
    )
  }

  function Listener() {
    const [heard, setHeard] = useState('nothing')
    useDeskEvent<{ name: string }>('ride.selected', event => setHeard(event.payload.name))
    return <p>{heard}</p>
  }

  it('is the whole surround in one component: desk, bus and toasts', async () => {
    const user = userEvent.setup()
    const desk = createDesk()
    render(
      <DeskShell desk={desk}>
        <Desktop title={id => id} renderWindow={id => (id === 'rides' ? <Publisher /> : <Listener />)} />
      </DeskShell>,
    )
    act(() => {
      desk.open('rides')
      desk.open('map')
    })
    await user.click(screen.getByRole('button', { name: 'Choose' }))
    expect(screen.getByText('Dandenongs loop')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status').textContent).toContain('Saved')
  })

  it('makes its own desk when it is not given one', () => {
    render(
      <DeskShell options={{ cascade: { margin: 24 } }}>
        <Desktop title={id => id} renderWindow={() => null} empty={<p>Nothing open</p>} />
      </DeskShell>,
    )
    expect(screen.getByText('Nothing open')).toBeTruthy()
  })
})

describe('window actions', () => {
  it('puts window-wide controls in the title bar', () => {
    const desk = createDesk()
    const onClick = vi.fn()
    render(
      <DeskShell desk={desk}>
        <Desktop
          title={id => id}
          renderWindow={() => <p>body</p>}
          actions={id => <Button size="small" onClick={onClick}>{`Refresh ${id}`}</Button>}
        />
      </DeskShell>,
    )
    act(() => desk.open('rides'))
    const bar = document.querySelector('.desk-titlebar') as HTMLElement
    fireEvent.click(within(bar).getByRole('button', { name: 'Refresh rides' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('window content', () => {
  it('does not re-render when the desk changes around it', () => {
    const desk = createDesk()
    const renders = vi.fn()
    function Counted() {
      renders()
      return <p>counted</p>
    }
    const render_ = (id: string) => (id === 'counted' ? <Counted /> : <p>other</p>)
    render(
      <DeskShell desk={desk}>
        <Desktop title={id => id} renderWindow={render_} />
      </DeskShell>,
    )
    act(() => desk.open('counted'))
    const before = renders.mock.calls.length
    act(() => desk.open('other'))
    act(() => desk.focus('counted'))
    act(() => desk.float('counted'))
    expect(renders.mock.calls.length).toBe(before)
  })
})

describe('RadioGroup', () => {
  const OPTIONS = [
    { value: 'metric', label: 'Kilometres', description: 'And metres of climbing' },
    { value: 'imperial', label: 'Miles', description: 'And feet of climbing' },
    { value: 'nautical', label: 'Nautical miles', disabled: true },
  ] as const

  function Harness() {
    const [value, setValue] = useState<(typeof OPTIONS)[number]['value']>('metric')
    return <RadioGroup label="Distance" options={OPTIONS} value={value} onChange={setValue} />
  }

  it('is a group of radios, each able to explain itself', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const metric = screen.getByRole('radio', { name: 'Kilometres' })
    expect(metric).toHaveProperty('checked', true)
    expect(metric.getAttribute('aria-describedby')).toBe(screen.getByText('And metres of climbing').id)
    await user.click(screen.getByRole('radio', { name: 'Miles' }))
    expect(screen.getByRole('radio', { name: 'Miles' })).toHaveProperty('checked', true)
    expect(screen.getByRole('radio', { name: 'Nautical miles' })).toHaveProperty('disabled', true)
  })
})

describe('Table with more than one selection', () => {
  interface Ride {
    readonly id: string
    readonly name: string
  }
  const RIDES: Ride[] = [
    { id: '1', name: 'Dandenongs loop' },
    { id: '2', name: 'Beach Road bunch' },
    { id: '3', name: 'Yarra Trail commute' },
    { id: '4', name: 'Lysterfield singletrack' },
  ]
  const COLUMNS: Column<Ride>[] = [{ key: 'name', header: 'Ride' }]

  function Harness() {
    const [selected, setSelected] = useState<string[]>([])
    return (
      <>
        <Table
          label="Rides"
          rows={RIDES}
          columns={COLUMNS}
          rowId={r => r.id}
          selection="multiple"
          selected={selected}
          onSelectionChange={setSelected}
        />
        <p>{`chosen: ${selected.join(',') || 'none'}`}</p>
      </>
    )
  }

  const rows = () => screen.getAllByRole('row').slice(1)

  it('says it takes more than one', () => {
    render(<Harness />)
    expect(screen.getByRole('table').getAttribute('aria-multiselectable')).toBe('true')
  })

  it('replaces the selection on a plain click, adds with ⌘, and takes a run with Shift', () => {
    render(<Harness />)
    fireEvent.click(rows()[0] as HTMLElement)
    expect(screen.getByText('chosen: 1')).toBeTruthy()
    fireEvent.click(rows()[2] as HTMLElement, { metaKey: true })
    expect(screen.getByText('chosen: 1,3')).toBeTruthy()
    fireEvent.click(rows()[2] as HTMLElement, { metaKey: true })
    expect(screen.getByText('chosen: 1')).toBeTruthy()
    fireEvent.click(rows()[0] as HTMLElement)
    fireEvent.click(rows()[3] as HTMLElement, { shiftKey: true })
    expect(screen.getByText('chosen: 1,2,3,4')).toBeTruthy()
  })

  it('adds to the selection with Space, and extends it with Shift and an arrow', () => {
    render(<Harness />)
    const first = rows()[0] as HTMLElement
    fireEvent.click(first)
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown', shiftKey: true })
    expect(screen.getByText('chosen: 1,2')).toBeTruthy()
    const third = rows()[2] as HTMLElement
    third.focus()
    fireEvent.keyDown(third, { key: ' ' })
    expect(screen.getByText('chosen: 1,2,3')).toBeTruthy()
  })
})
