// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { Desktop, DeskProvider, menuAction, menuCommand, menuSeparator, useCommand, useContextMenu } from '../../src/react/index.js'

afterEach(cleanup)

function RideLog({ onOpen, onPin, pinned = false }: { readonly onOpen: () => void; readonly onPin: () => void; readonly pinned?: boolean }) {
  const { target, menu } = useContextMenu({
    label: 'Actions for Ride Log',
    items: () => [menuAction('Open', onOpen), menuSeparator(), menuAction(pinned ? 'Remove from Dock' : 'Keep in Dock', onPin), menuAction('Delete', () => {}, { disabled: true })],
  })
  return (
    <>
      <button type="button" {...target}>Ride Log</button>
      {menu}
    </>
  )
}

const menu = () => screen.getByRole('menu', { name: 'Actions for Ride Log' })

describe('useContextMenu', () => {
  it('opens where the pointer right-clicked, and runs what is chosen', () => {
    const onOpen = vi.fn()
    render(<RideLog onOpen={onOpen} onPin={() => {}} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ride Log' }), { clientX: 120, clientY: 80 })
    expect(menu()).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens from the keyboard with the first item ready, and moves past what cannot be chosen', () => {
    const onPin = vi.fn()
    render(<RideLog onOpen={() => {}} onPin={onPin} />)
    const button = screen.getByRole('button', { name: 'Ride Log' })
    button.focus()
    fireEvent.keyDown(button, { key: 'F10', shiftKey: true })
    expect(menu().getAttribute('aria-activedescendant')).toBeTruthy()
    fireEvent.keyDown(menu(), { key: 'ArrowDown' })
    fireEvent.keyDown(menu(), { key: 'ArrowDown' })
    // Delete is disabled, so the second step wraps back past it to Open, then on to Keep in Dock.
    fireEvent.keyDown(menu(), { key: 'ArrowDown' })
    fireEvent.keyDown(menu(), { key: 'Enter' })
    expect(onPin).toHaveBeenCalledOnce()
  })

  it('does not run a disabled item', () => {
    const onOpen = vi.fn()
    render(<RideLog onOpen={onOpen} onPin={() => {}} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ride Log' }))
    const item = screen.getByRole('menuitem', { name: 'Delete' })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(item)
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('closes on Escape and gives focus back to what was right-clicked', () => {
    render(<RideLog onOpen={() => {}} onPin={() => {}} />)
    const button = screen.getByRole('button', { name: 'Ride Log' })
    fireEvent.contextMenu(button)
    fireEvent.keyDown(menu(), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('closes when the pointer goes down outside it', () => {
    render(<RideLog onOpen={() => {}} onPin={() => {}} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ride Log' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('jumps to an item by its first letter', () => {
    const onPin = vi.fn()
    render(<RideLog onOpen={() => {}} onPin={onPin} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ride Log' }))
    fireEvent.keyDown(menu(), { key: 'k' })
    fireEvent.keyDown(menu(), { key: 'Enter' })
    expect(onPin).toHaveBeenCalledOnce()
  })

  it('runs a command from the window that was right-clicked in, and asks whether it is enabled', () => {
    function Rides() {
      const [exported, setExported] = useState(0)
      useCommand('rides.export', () => setExported(n => n + 1))
      const { target, menu: element } = useContextMenu({ label: 'Actions for rides', items: () => [menuCommand('Export', 'rides.export'), menuCommand('Print', 'rides.print')] })
      return (
        <>
          <button type="button" {...target}>{`rides exported ${exported}`}</button>
          {element}
        </>
      )
    }
    const desk = createDesk()
    render(
      <DeskProvider desk={desk}>
        <Desktop title={id => id} renderWindow={() => <Rides />} />
      </DeskProvider>,
    )
    act(() => desk.open('rides'))
    fireEvent.contextMenu(screen.getByRole('button', { name: /rides exported/ }))
    expect(screen.getByRole('menuitem', { name: 'Print' }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }))
    expect(screen.getByText('rides exported 1')).toBeTruthy()
  })
})
