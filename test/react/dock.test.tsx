// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk, focusedId } from '../../src/core/index.js'
import { Dock, DeskProvider, dockItem, dockSeparator, dockStack } from '../../src/react/index.js'
import type { DockEntry } from '../../src/react/index.js'

afterEach(cleanup)

const icon = <svg />

function mount(entries: readonly DockEntry[]) {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <Dock entries={entries} />
    </DeskProvider>,
  )
  return desk
}

const ENTRIES: readonly DockEntry[] = [
  dockItem({ id: 'rides', label: 'Rides', icon }),
  dockItem({ id: 'service', label: 'Service', icon, badge: 2 }),
  dockSeparator('sep'),
  dockStack({
    id: 'garage',
    label: 'Garage',
    items: [
      { id: 'bikes', label: 'Bikes', icon, description: 'Every bike you own' },
      { id: 'parts', label: 'Parts', icon },
    ],
  }),
]

const dock = () => screen.getByRole('toolbar', { name: 'Dock' })

describe('Dock', () => {
  it('opens an item’s window and marks it running and focused', () => {
    const desk = mount(ENTRIES)
    const rides = within(dock()).getByRole('button', { name: 'Rides' })
    fireEvent.click(rides)
    expect(focusedId(desk.getState())).toBe('rides')
    expect(rides.dataset.running).toBe('true')
    expect(rides.dataset.focused).toBe('true')
  })

  it('drops the focus mark but keeps the running mark when another window takes focus', () => {
    const desk = mount(ENTRIES)
    act(() => {
      desk.open('rides')
      desk.open('service')
    })
    const rides = within(dock()).getByRole('button', { name: 'Rides' })
    expect(rides.dataset.running).toBe('true')
    expect(rides.dataset.focused).toBeUndefined()
  })

  it('opens a different window when the item names one', () => {
    const desk = mount([dockItem({ id: 'map', label: 'Map', icon, window: 'routes' })])
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(focusedId(desk.getState())).toBe('routes')
  })

  it('calls onSelect instead of opening a window', () => {
    const onSelect = vi.fn()
    const desk = mount([dockItem({ id: 'search', label: 'Search', icon, onSelect })])
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(desk.getState().windows).toHaveLength(0)
  })

  it('shows a badge', () => {
    mount(ENTRIES)
    expect(within(dock()).getByRole('button', { name: 'Service' }).textContent).toContain('2')
  })

  it('fans a stack out, opens the chosen window, and folds away', () => {
    const desk = mount(ENTRIES)
    const garage = screen.getByRole('button', { name: 'Garage' })
    expect(garage.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(garage)
    const panel = screen.getByRole('dialog', { name: 'Garage' })
    expect(garage.getAttribute('aria-expanded')).toBe('true')
    expect(within(panel).getByText('Every bike you own')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: /Parts/ }))
    expect(focusedId(desk.getState())).toBe('parts')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(garage.dataset.running).toBe('true')
  })

  it('focuses the first item when a stack opens, and Escape returns focus to the stack', () => {
    mount(ENTRIES)
    const garage = screen.getByRole('button', { name: 'Garage' })
    fireEvent.click(garage)
    const panel = screen.getByRole('dialog', { name: 'Garage' })
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: /Bikes/ }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(garage)
  })

  it('closes a stack when the pointer goes down outside it', () => {
    mount(ENTRIES)
    fireEvent.click(screen.getByRole('button', { name: 'Garage' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is one tab stop, with arrow keys moving between items and skipping separators', () => {
    mount(ENTRIES)
    const buttons = within(dock()).getAllByRole('button')
    expect(buttons.filter(b => b.tabIndex === 0)).toHaveLength(1)
    const [rides, service, garage] = buttons as [HTMLElement, HTMLElement, HTMLElement]
    rides.focus()
    fireEvent.keyDown(rides, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(service)
    fireEvent.keyDown(service, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(garage)
    fireEvent.keyDown(garage, { key: 'Home' })
    expect(document.activeElement).toBe(rides)
    fireEvent.keyDown(rides, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(garage)
  })

  it('counts the badged items inside a stack', () => {
    mount([dockStack({ id: 's', label: 'Stack', items: [{ id: 'a', label: 'A', icon, badge: '!' }, { id: 'b', label: 'B', icon, badge: 3 }] })])
    expect(screen.getByRole('button', { name: 'Stack' }).textContent).toContain('2')
  })
})
