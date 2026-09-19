// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canPerform, createDesk, DeskCommands, focusedId, isMinimized, perform } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { Desktop, DeskProvider, Dock, dockItem, windowMenuItems } from '../../src/react/index.js'

afterEach(cleanup)

const TITLES: Record<string, string> = { rides: 'Rides', service: 'Service' }

function mount(): Desk {
  const desk = createDesk({ stage: () => ({ width: 1000, height: 700 }) })
  render(
    <DeskProvider desk={desk}>
      <Desktop
        title={id => TITLES[id] ?? id}
        // A window with something in it that only the DOM remembers.
        renderWindow={id => <input aria-label={`${TITLES[id]} note`} defaultValue="" />}
        empty={<p>Nothing open</p>}
      />
      <Dock entries={[dockItem({ id: 'rides', label: 'Rides', icon: <svg /> })]} />
    </DeskProvider>,
  )
  return desk
}

const window = (name: string) => screen.getByRole('region', { name })
const dockItemFor = (name: string) => within(screen.getByRole('toolbar', { name: 'Dock' })).getByRole('button', { name })

describe('the minimize control', () => {
  it('sits between close and zoom', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    const controls = [...window('Rides').querySelectorAll('.desk-control')].map(c => c.getAttribute('aria-label'))
    expect(controls).toEqual(['Close', 'Minimize', 'Zoom'])
  })

  it('takes the window off the desk without closing it', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(desk.getState().windows).toHaveLength(1)
    expect(isMinimized(desk.getState(), 'rides')).toBe(true)
    expect(window('Rides').dataset.minimized).toBe('true')
    expect(window('Rides').hasAttribute('inert')).toBe(true)
  })

  it('leaves the window loaded, with everything in it', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    const note = screen.getByRole('textbox', { name: 'Rides note' }) as HTMLInputElement
    fireEvent.change(note, { target: { value: 'chain at 2,860 km' } })
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    act(() => desk.focus('rides'))
    expect((screen.getByRole('textbox', { name: 'Rides note' }) as HTMLInputElement).value).toBe('chain at 2,860 km')
  })

  it('is not offered where there is one window at a time', () => {
    const desk = createDesk()
    render(
      <DeskProvider desk={desk}>
        <Desktop layout="fullscreen" title={id => TITLES[id] ?? id} renderWindow={() => null} />
      </DeskProvider>,
    )
    act(() => desk.open('rides'))
    expect(screen.queryByRole('button', { name: 'Minimize' })).toBeNull()
  })
})

describe('a desk with everything minimized', () => {
  it('says nothing is open, because nothing is on it', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    expect(screen.queryByText('Nothing open')).toBeNull()
    act(() => desk.minimize('rides'))
    expect(screen.getByText('Nothing open')).toBeTruthy()
  })
})

describe('the dock', () => {
  it('still says the window is open, and says it is off the desk', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    expect(dockItemFor('Rides').dataset.minimized).toBeUndefined()
    act(() => desk.minimize('rides'))
    expect(dockItemFor('Rides').dataset.running).toBe('true')
    expect(dockItemFor('Rides').dataset.minimized).toBe('true')
  })

  it('brings it back rather than opening a second one', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    act(() => desk.minimize('rides'))
    fireEvent.click(dockItemFor('Rides'))
    expect(desk.getState().windows).toHaveLength(1)
    expect(isMinimized(desk.getState(), 'rides')).toBe(false)
    expect(focusedId(desk.getState())).toBe('rides')
  })
})

describe('the Window menu', () => {
  it('lists a minimized window, and says so', () => {
    const desk = createDesk()
    desk.open('rides')
    desk.open('service')
    desk.minimize('service')
    const items = windowMenuItems(desk.getState(), desk.focus, id => TITLES[id] ?? id)
    expect(items.map(i => (i.type === 'action' ? [i.label, i.detail, i.checked] : null))).toEqual([
      ['Rides', undefined, true],
      ['Service', 'Minimized', false],
    ])
  })
})

describe('the minimize command', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute('data-desk-stage') ? 1000 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute('data-desk-stage') ? 700 : 0 } })
  })

  it('minimizes the key window, and is not offered when there is none', () => {
    const desk = mount()
    expect(canPerform(desk, DeskCommands.minimizeWindow)).toBe(false)
    act(() => desk.open('rides'))
    expect(canPerform(desk, DeskCommands.minimizeWindow)).toBe(true)
    act(() => void perform(desk, DeskCommands.minimizeWindow))
    expect(isMinimized(desk.getState(), 'rides')).toBe(true)
    expect(canPerform(desk, DeskCommands.minimizeWindow)).toBe(false)
  })

  it('is skipped by cycling, so a minimized window is not dragged back out', () => {
    const desk = mount()
    act(() => {
      desk.open('rides')
      desk.open('service')
    })
    act(() => desk.minimize('service'))
    expect(canPerform(desk, DeskCommands.nextWindow)).toBe(false)
    act(() => void perform(desk, DeskCommands.nextWindow))
    expect(isMinimized(desk.getState(), 'service')).toBe(true)
  })

  it('is left out of Arrange, which lays out the desk it can see', () => {
    const desk = mount()
    act(() => {
      desk.open('rides')
      desk.open('service')
    })
    act(() => desk.minimize('service'))
    act(() => void perform(desk, DeskCommands.arrange))
    // One window on the desk: Arrange fills it, and the minimized one is left exactly as it was.
    expect(desk.getState().windows).toEqual([
      { id: 'rides', mode: 'filled' },
      { id: 'service', mode: 'filled' },
    ])
    expect(isMinimized(desk.getState(), 'service')).toBe(true)
  })
})
