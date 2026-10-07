// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { DeskProvider, Dock, dockItem, dockStack, menuAction, useDraggable } from '../../src/react/index.js'
import type { DockEntry, DockPins } from '../../src/react/index.js'

afterEach(cleanup)

beforeEach(() => {
  Element.prototype.setPointerCapture = () => {}
  document.elementFromPoint = () => null
})

const icon = <svg />

function App() {
  const { dragProps } = useDraggable({ type: 'app', payload: 'weather', preview: 'Weather' })
  return <p {...dragProps} data-testid="weather">Weather</p>
}

function mount(entries: readonly DockEntry[], pins?: DockPins) {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <App />
      <Dock entries={entries} {...(pins ? { pins } : {})} />
    </DeskProvider>,
  )
  return desk
}

const carry = (from: HTMLElement, onto: HTMLElement) => {
  document.elementFromPoint = () => onto
  fireEvent.pointerDown(from, { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
  act(() => {
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200, bubbles: true }))
  })
  act(() => {
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 200, bubbles: true }))
  })
}

const ENTRIES = [
  dockItem({ id: 'rides', label: 'Rides', icon }),
  dockItem({ id: 'ride-log', label: 'Ride Log', icon, movable: true }),
  dockItem({ id: 'routes', label: 'Routes', icon, movable: true }),
]

describe('Dock pins', () => {
  it('keeps what is dropped on the dock, at the end', () => {
    const onPin = vi.fn()
    mount(ENTRIES, { accepts: 'app', onPin })
    carry(screen.getByTestId('weather'), screen.getByRole('toolbar'))
    expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ type: 'app', payload: 'weather' }), null)
  })

  it('puts what is dropped on a kept item in front of it', () => {
    const onPin = vi.fn()
    mount(ENTRIES, { accepts: 'app', onPin })
    carry(screen.getByTestId('weather'), screen.getByRole('button', { name: 'Routes' }))
    expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ payload: 'weather' }), 'routes')
  })

  it('never inserts among the fixed items, and ignores what it does not accept', () => {
    const onPin = vi.fn()
    mount(ENTRIES, { accepts: 'document', onPin })
    carry(screen.getByTestId('weather'), screen.getByRole('toolbar'))
    expect(onPin).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Rides' }).hasAttribute('data-desk-drop')).toBe(false)
  })

  it('moves a kept item along the dock, and the drag is not a click', () => {
    const onMove = vi.fn()
    const desk = mount(ENTRIES, { accepts: 'app', onPin: () => {}, onMove })
    const routes = screen.getByRole('button', { name: 'Routes' })
    carry(routes, screen.getByRole('button', { name: 'Ride Log' }))
    fireEvent.click(routes)
    expect(onMove).toHaveBeenCalledWith('routes', 'ride-log')
    expect(desk.getState().windows).toHaveLength(0)
  })

  it('offers an item menu, even on an item that cannot open', () => {
    const remove = vi.fn()
    const desk = mount([dockItem({ id: 'gone', label: 'Gone', icon, disabled: true, contextMenu: () => [menuAction('Remove from Dock', remove)] })])
    const gone = screen.getByRole('button', { name: 'Gone' })
    expect(gone.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(gone)
    expect(desk.getState().windows).toHaveLength(0)
    fireEvent.contextMenu(gone)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Dock' }))
    expect(remove).toHaveBeenCalledOnce()
  })

  const KEPT_STACK = [
    ...ENTRIES,
    dockStack({ id: 'plan', label: 'Plan', items: [{ id: 'calendar', label: 'Calendar', icon }], movable: true }),
  ]

  it('puts what is dropped on a kept stack in front of it, and leaves a fixed stack alone', () => {
    const onPin = vi.fn()
    mount([...KEPT_STACK, dockStack({ id: 'system', label: 'System', items: [{ id: 'logs', label: 'Logs', icon }] })], { accepts: 'app', onPin })
    expect(screen.getByRole('button', { name: 'System' }).hasAttribute('data-desk-drop')).toBe(false)
    carry(screen.getByTestId('weather'), screen.getByRole('button', { name: 'Plan' }))
    expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ payload: 'weather' }), 'plan')
  })

  it('moves a kept stack along the dock, and the drag does not open it', () => {
    const onMove = vi.fn()
    mount(KEPT_STACK, { accepts: 'app', onPin: () => {}, onMove })
    const plan = screen.getByRole('button', { name: 'Plan' })
    carry(plan, screen.getByRole('button', { name: 'Ride Log' }))
    fireEvent.click(plan)
    expect(onMove).toHaveBeenCalledWith('plan', 'ride-log')
    expect(screen.queryByRole('dialog', { name: 'Plan' })).toBeNull()
  })

  it('offers a stack menu, and still opens the stack on a click', () => {
    const remove = vi.fn()
    mount([dockStack({ id: 'plan', label: 'Plan', items: [{ id: 'calendar', label: 'Calendar', icon }], contextMenu: () => [menuAction('Remove from Dock', remove)] })])
    const plan = screen.getByRole('button', { name: 'Plan' })
    fireEvent.contextMenu(plan)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Dock' }))
    expect(remove).toHaveBeenCalledOnce()
    fireEvent.click(plan)
    expect(screen.getByRole('dialog', { name: 'Plan' })).toBeTruthy()
  })
})
