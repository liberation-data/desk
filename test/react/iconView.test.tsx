// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { DeskProvider, IconView, menuAction } from '../../src/react/index.js'
import type { IconViewProps } from '../../src/react/index.js'

afterEach(cleanup)

const ITEMS = [
  { id: 'ride', label: 'Ride Log', icon: '🚲' },
  { id: 'route', label: 'Route Planner', icon: '🗺' },
  { id: 'weather', label: 'Weather', icon: '⛅' },
  { id: 'locked', label: 'Locked', icon: '🔒', disabled: true },
]

type Item = (typeof ITEMS)[number]

const view = (props: Partial<IconViewProps<Item>> = {}) =>
  render(
    <DeskProvider desk={createDesk()}>
      <IconView items={ITEMS} label="Apps" onOpen={() => {}} {...props} />
    </DeskProvider>,
  )

const icon = (name: string) => screen.getByRole('option', { name: new RegExp(name) })

describe('IconView', () => {
  it('selects on click and opens on double-click', () => {
    const onOpen = vi.fn()
    view({ onOpen })
    fireEvent.click(icon('Ride Log'))
    expect(icon('Ride Log').getAttribute('aria-selected')).toBe('true')
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.doubleClick(icon('Ride Log'))
    expect(onOpen).toHaveBeenCalledWith(ITEMS[0])
  })

  it('opens on one click when asked to', () => {
    const onOpen = vi.fn()
    view({ onOpen, openOn: 'single' })
    fireEvent.click(icon('Weather'))
    expect(onOpen).toHaveBeenCalledWith(ITEMS[2])
  })

  it('never opens a disabled item', () => {
    const onOpen = vi.fn()
    view({ onOpen })
    fireEvent.doubleClick(icon('Locked'))
    icon('Locked').focus()
    fireEvent.keyDown(icon('Locked'), { key: 'Enter' })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('moves with the arrows, finds by typing, and opens with Return', () => {
    const onOpen = vi.fn()
    view({ onOpen })
    expect(icon('Ride Log').tabIndex).toBe(0)
    icon('Ride Log').focus()
    fireEvent.keyDown(icon('Ride Log'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(icon('Route Planner'))
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(icon('Locked'))
    fireEvent.keyDown(document.activeElement!, { key: 'w' })
    expect(document.activeElement).toBe(icon('Weather'))
    expect(icon('Weather').tabIndex).toBe(0)
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith(ITEMS[2])
  })

  it('opens the item context menu, and choosing from it does not count as a click on the icon', () => {
    const onOpen = vi.fn()
    const remove = vi.fn()
    view({ onOpen, openOn: 'single', contextMenu: item => [menuAction(`Remove ${item.label}`, () => remove(item.id))] })
    fireEvent.contextMenu(icon('Route Planner'))
    expect(icon('Route Planner').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove Route Planner' }))
    expect(remove).toHaveBeenCalledWith('route')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('shows the empty state when there is nothing', () => {
    view({ items: [], empty: 'No apps yet' })
    expect(screen.getByText('No apps yet')).toBeTruthy()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('follows a controlled selection', () => {
    const onSelectionChange = vi.fn()
    view({ selected: 'weather', onSelectionChange })
    expect(icon('Weather').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(icon('Ride Log'))
    expect(onSelectionChange).toHaveBeenCalledWith('ride')
    expect(icon('Weather').getAttribute('aria-selected')).toBe('true')
  })
})
