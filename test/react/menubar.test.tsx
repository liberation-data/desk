// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk, DeskCommands } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import {
  Desktop,
  DeskProvider,
  MenuBar,
  menuAction,
  menuCommand,
  menuHeader,
  menuSeparator,
  useCommand,
  useDeskState,
  windowMenuItems,
} from '../../src/react/index.js'
import type { Menu } from '../../src/react/index.js'

afterEach(cleanup)

function Rides() {
  const [exported, setExported] = useState(0)
  useCommand('rides.export', () => setExported(n => n + 1))
  return <p>{`exported ${exported}`}</p>
}

function Notes() {
  const field = useRef<HTMLTextAreaElement>(null)
  const [log, setLog] = useState('nothing')
  useCommand('edit.clear', () => setLog('cleared field'), { at: field })
  useCommand('edit.clear', () => setLog('cleared window'))
  return (
    <>
      <textarea ref={field} aria-label="Note" />
      <p>{log}</p>
    </>
  )
}

function Bar({ onAbout, desk }: { readonly onAbout: () => void; readonly desk: Desk }) {
  useDeskState()
  const menus: Menu[] = [
    { id: 'app', label: 'Garage', items: [menuAction('About Garage', onAbout), menuSeparator(), menuAction('Disabled thing', () => {}, { disabled: true })] },
    {
      id: 'ride',
      label: 'Ride',
      items: [menuHeader('Rides'), menuCommand('Export rides', 'rides.export', { shortcut: 'mod+e' }), menuCommand('Clear', 'edit.clear')],
    },
    {
      id: 'window',
      label: 'Window',
      items: () => [
        menuCommand('Arrange', DeskCommands.arrange),
        menuCommand('Next window', DeskCommands.nextWindow, { shortcut: 'alt+]' }),
        menuSeparator(),
        ...windowMenuItems(desk.getState(), desk.focus, id => id.toUpperCase()),
      ],
    },
  ]
  const status: Menu[] = [{ id: 'service', label: 'Service, 2 due', title: <span>Service 2</span>, items: [menuAction('Chain', () => desk.open('service'))] }]
  return <MenuBar menus={menus} status={status} leading={<b>Garage</b>} trailing={<span>Sun 14 Sep</span>} />
}

function mount() {
  const desk = createDesk()
  const onAbout = vi.fn()
  render(
    <DeskProvider desk={desk}>
      <Bar desk={desk} onAbout={onAbout} />
      <Desktop title={id => id} renderWindow={id => (id === 'notes' ? <Notes /> : <Rides />)} />
    </DeskProvider>,
  )
  return { desk, onAbout }
}

const title = (name: string) => within(screen.getByRole('menubar')).getByRole('menuitem', { name })
const menu = () => screen.getByRole('menu')
const item = (name: string | RegExp) => {
  const found = [
    ...within(menu()).queryAllByRole('menuitem', { name }),
    ...within(menu()).queryAllByRole('menuitemcheckbox', { name }),
  ]
  if (found.length !== 1) throw new Error(`Expected one menu item named ${String(name)}, found ${found.length}`)
  return found[0] as HTMLElement
}
const key = (k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k, ...init })

describe('MenuBar', () => {
  it('opens a menu on click and runs an action', () => {
    const { onAbout } = mount()
    fireEvent.click(title('Garage'))
    expect(title('Garage').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(item('About Garage'))
    expect(onAbout).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('shows unavailable commands disabled, and does nothing when they are chosen', () => {
    const { desk } = mount()
    fireEvent.click(title('Ride'))
    expect(item(/Export rides/).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(item(/Export rides/))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.click(title('Ride'))
    act(() => desk.open('rides'))
    fireEvent.click(title('Ride'))
    expect(item(/Export rides/).getAttribute('aria-disabled')).toBeNull()
  })

  it('sends a command to the key window', () => {
    const { desk } = mount()
    act(() => desk.open('rides'))
    fireEvent.click(title('Ride'))
    fireEvent.click(item(/Export rides/))
    expect(screen.getByText('exported 1')).toBeTruthy()
  })

  it('reaches the element that had focus, because opening a menu does not take it', () => {
    const { desk } = mount()
    act(() => desk.open('notes'))
    act(() => screen.getByRole('textbox', { name: 'Note' }).focus())
    fireEvent.click(title('Ride'))
    fireEvent.click(item('Clear'))
    expect(screen.getByText('cleared field')).toBeTruthy()
  })

  it('shows and binds shortcuts', () => {
    const { desk } = mount()
    act(() => desk.open('rides'))
    fireEvent.click(title('Ride'))
    expect(item(/Export rides/).textContent).toMatch(/E/)
    fireEvent.click(title('Ride'))
    fireEvent.keyDown(document.body, { key: 'e', metaKey: true, ctrlKey: false })
    fireEvent.keyDown(document.body, { key: 'e', ctrlKey: true, metaKey: false })
    expect(screen.getByText('exported 1')).toBeTruthy()
  })

  it('binds shortcuts in a menu that builds its items when opened, before it is ever opened', () => {
    const { desk } = mount()
    act(() => {
      desk.open('rides')
      desk.open('notes')
    })
    act(() => void fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight', altKey: true }))
    expect(desk.getState().stack.at(-1)).toBe('rides')
  })

  it('lists open windows with the key window checked', () => {
    const { desk } = mount()
    act(() => {
      desk.open('rides')
      desk.open('notes')
    })
    fireEvent.click(title('Window'))
    expect(item('NOTES').getAttribute('aria-checked')).toBe('true')
    expect(item('RIDES').getAttribute('aria-checked')).toBe('false')
    fireEvent.click(item('RIDES'))
    fireEvent.click(title('Window'))
    expect(item('RIDES').getAttribute('aria-checked')).toBe('true')
  })

  it('switches menus when the pointer moves to another title while one is open', () => {
    mount()
    fireEvent.click(title('Garage'))
    fireEvent.pointerEnter(title('Window'))
    expect(within(menu()).getByRole('menuitem', { name: 'Arrange' })).toBeTruthy()
  })

  it('closes when the pointer goes down outside', () => {
    mount()
    fireEvent.click(title('Garage'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('works from the keyboard: open, move past separators and disabled items, choose', () => {
    const { onAbout } = mount()
    act(() => title('Garage').focus())
    key('ArrowDown')
    const active = () => document.getElementById(menu().getAttribute('aria-activedescendant') ?? '')?.textContent
    expect(active()).toContain('About Garage')
    key('ArrowDown') // skips the separator and the disabled item, wraps to itself
    expect(active()).toContain('About Garage')
    key('Enter')
    expect(onAbout).toHaveBeenCalledOnce()
  })

  it('moves between menus with arrow keys, and Escape returns focus to the title', () => {
    mount()
    act(() => title('Garage').focus())
    key('ArrowDown')
    key('ArrowRight')
    expect(title('Ride').getAttribute('aria-expanded')).toBe('true')
    key('Escape')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(title('Ride'))
  })

  it('jumps to an item by its first letter', () => {
    const { desk } = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
    })
    act(() => title('Window').focus())
    key('ArrowDown')
    key('n')
    expect(document.getElementById(menu().getAttribute('aria-activedescendant') ?? '')?.textContent).toContain('Next window')
  })

  it('is one tab stop with arrow keys between titles, status menus included', () => {
    mount()
    const titles = within(screen.getByRole('menubar')).getAllByRole('menuitem')
    expect(titles.filter(t => t.tabIndex === 0)).toHaveLength(1)
    act(() => title('Window').focus())
    key('ArrowRight')
    expect(document.activeElement).toBe(title('Service, 2 due'))
    key('ArrowRight')
    expect(document.activeElement).toBe(title('Garage'))
  })

  it('renders leading and trailing content', () => {
    mount()
    expect(within(screen.getByRole('menubar')).getByText('Sun 14 Sep')).toBeTruthy()
  })
})
