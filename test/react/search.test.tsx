// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { DeskProvider, SearchPalette, windowResults } from '../../src/react/index.js'
import type { SearchResult } from '../../src/react/index.js'

afterEach(cleanup)

const RIDES = ['Dandenongs loop', 'Beach Road bunch', 'Yarra Trail commute']

function mount({ slow = false }: { slow?: boolean } = {}) {
  const desk = createDesk()
  desk.open('rides')
  desk.open('map')
  const chosen = vi.fn()

  const search = (query: string): SearchResult[] | Promise<SearchResult[]> => {
    const text = query.trim().toLowerCase()
    const results = [
      ...windowResults(desk, id => id.toUpperCase()),
      ...RIDES.map(name => ({ id: name, title: name, group: 'Rides', kind: 'ride', subtitle: '92 km', onSelect: () => chosen(name) })),
    ].filter(r => !text || r.title.toLowerCase().includes(text))
    return slow ? new Promise(resolve => setTimeout(() => resolve(results), text.length === 1 ? 50 : 0)) : results
  }

  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <DeskProvider desk={desk}>
        <button type="button" onClick={() => setOpen(true)}>Open search</button>
        <SearchPalette open={open} onOpenChange={setOpen} search={search} hint={<span>Search rides and windows</span>} />
      </DeskProvider>
    )
  }
  render(<Harness />)
  return { desk, chosen }
}

const field = () => screen.getByRole('combobox', { name: 'Search' })
const options = () => screen.queryAllByRole('option')
const openPalette = () => fireEvent.click(screen.getByRole('button', { name: 'Open search' }))

describe('SearchPalette', () => {
  it('opens on its shortcut, showing the hint until something is typed', () => {
    mount()
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy()
    expect(screen.getByText('Search rides and windows')).toBeTruthy()
  })

  it('takes focus, and gives it back when it closes', () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'Open search' })
    act(() => trigger.focus())
    openPalette()
    expect(document.activeElement).toBe(field())
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('searches everything the app offers, grouped', async () => {
    const user = userEvent.setup()
    mount()
    openPalette()
    await user.type(field(), 'road')
    expect(options()).toHaveLength(1)
    expect(options()[0]?.textContent).toContain('Beach Road bunch')
    expect(screen.getByText('Rides')).toBeTruthy()
  })

  it('moves with the arrow keys and chooses with Enter', async () => {
    const user = userEvent.setup()
    const { chosen } = mount()
    openPalette()
    await user.type(field(), 'loop')
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{Enter}')
    expect(chosen).toHaveBeenCalledWith('Dandenongs loop')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('focuses a window chosen from the results', async () => {
    const user = userEvent.setup()
    const { desk } = mount()
    openPalette()
    await user.type(field(), 'rides')
    await user.click(options()[0] as HTMLElement)
    expect(desk.getState().stack.at(-1)).toBe('rides')
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    mount()
    openPalette()
    await user.type(field(), 'zzzz')
    expect(screen.getByText(/Nothing matches/)).toBeTruthy()
    expect(options()).toHaveLength(0)
  })

  it('closes when the surround is pressed', () => {
    mount()
    openPalette()
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('never lets a slower answer overtake a newer query', async () => {
    vi.useFakeTimers()
    try {
      mount({ slow: true })
      openPalette()
      fireEvent.change(field(), { target: { value: 'r' } }) // slow: resolves in 50ms
      fireEvent.change(field(), { target: { value: 'road' } }) // fast
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      expect(options().map(o => o.textContent?.slice(0, 10))).toEqual(['Beach Road'])
    } finally {
      vi.useRealTimers()
    }
  })
})
