// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk, DeskCommands } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import {
  Desktop,
  DeskProvider,
  hasModKey,
  hostMenuModel,
  MenuBar,
  menuAction,
  menuCommand,
  menuHeader,
  menuSeparator,
  useCommand,
  windowMenuItems,
} from '../../src/react/index.js'
import type { HostMenu, Menu, MenuHost } from '../../src/react/index.js'

afterEach(cleanup)

/** A host that keeps what was published and lets a test pick an item, as a native menu bar would. */
function fakeHost(extra: Partial<MenuHost> = {}) {
  const published: (readonly HostMenu[])[] = []
  let listener: ((id: string) => void) | null = null
  const host: MenuHost = {
    publish: menus => published.push(menus),
    onSelect: l => {
      listener = l
      return () => {
        listener = null
      }
    },
    ...extra,
  }
  const latest = () => published[published.length - 1] ?? []
  const idOf = (label: string) => {
    const found = latest().flatMap(m => m.items).find(i => i.label === label)
    if (!found?.id) throw new Error(`No published item named ${label}`)
    return found.id
  }
  const pick = (label: string) => act(() => listener?.(idOf(label)))
  return { host, published, latest, pick, listening: () => listener !== null }
}

function Rides() {
  const [exported, setExported] = useState(0)
  useCommand('rides.export', () => setExported(n => n + 1))
  useCommand('rides.next', () => setExported(n => n + 10))
  return <p>{`exported ${exported}`}</p>
}

function menusFor(desk: Desk, onAbout: () => void): { menus: Menu[]; status: Menu[] } {
  return {
    menus: [
      { id: 'app', label: 'Garage', emphasis: true, items: [menuAction('About Garage', onAbout), menuSeparator(), menuAction('Disabled thing', () => {}, { disabled: true })] },
      {
        id: 'ride',
        label: 'Ride',
        items: [menuHeader('Rides'), menuCommand('Export rides', 'rides.export', { shortcut: 'mod+e' }), menuCommand('Next ride', 'rides.next', { shortcut: 'alt+]' })],
      },
      { id: 'window', label: 'Window', items: () => windowMenuItems(desk.getState(), desk.focus, id => id.toUpperCase()) },
    ],
    status: [{ id: 'service', label: 'Service, 2 due', title: <span>Service 2</span>, items: [menuAction('Chain', () => desk.open('chain'))] }],
  }
}

function mount(host: MenuHost) {
  const desk = createDesk()
  const onAbout = vi.fn()
  const { menus, status } = menusFor(desk, onAbout)
  const view = render(
    <DeskProvider desk={desk}>
      <MenuBar menus={menus} status={status} host={host} leading={<b>Garage</b>} trailing={<span>Sun 14 Sep</span>} />
      <Desktop title={id => id} renderWindow={() => <Rides />} />
    </DeskProvider>,
  )
  return { desk, onAbout, view }
}

describe('MenuBar with a host', () => {
  it('draws nothing, and hands the host its menus and status menus as data', () => {
    const fake = fakeHost()
    mount(fake.host)
    expect(screen.queryByRole('menubar')).toBeNull()
    expect(screen.queryByText('Sun 14 Sep')).toBeNull()
    expect(fake.latest().map(m => [m.id, m.label, m.primary ?? false, m.status ?? false])).toEqual([
      ['app', 'Garage', true, false],
      ['ride', 'Ride', false, false],
      ['window', 'Window', false, false],
      ['service', 'Service, 2 due', false, true],
    ])
    expect(fake.latest()[1]?.items).toEqual([
      { type: 'header', label: 'Rides' },
      { type: 'item', id: 'ride:1', label: 'Export rides', shortcut: 'mod+e', enabled: false },
      { type: 'item', id: 'ride:2', label: 'Next ride', shortcut: 'alt+]', enabled: false },
    ])
    // The publish is JSON all the way down: nothing a host could not receive.
    expect(JSON.parse(JSON.stringify(fake.latest()))).toEqual(fake.latest())
  })

  it('runs the action the host says was chosen, and ignores a disabled one', () => {
    const fake = fakeHost()
    const { onAbout } = mount(fake.host)
    fake.pick('About Garage')
    expect(onAbout).toHaveBeenCalledOnce()
    fake.pick('Disabled thing')
    expect(onAbout).toHaveBeenCalledOnce()
  })

  it('publishes again when a command becomes available, and sends a chosen one to the key window', () => {
    const fake = fakeHost()
    const { desk } = mount(fake.host)
    act(() => desk.open('rides'))
    const exportRides = fake.latest()[1]?.items.find(i => i.label === 'Export rides')
    expect(exportRides?.enabled).toBe(true)
    fake.pick('Export rides')
    expect(screen.getByText('exported 1')).toBeTruthy()
  })

  it('lists open windows as they open, and runs a status menu item', () => {
    const fake = fakeHost()
    const { desk } = mount(fake.host)
    act(() => desk.open('rides'))
    expect(fake.latest()[2]?.items.map(i => i.label)).toEqual(['RIDES'])
    fake.pick('Chain')
    expect(desk.getState().windows.map(w => w.id)).toContain('chain')
  })

  it('skips a publish that would change nothing', () => {
    const fake = fakeHost()
    const { view, desk } = mount(fake.host)
    const count = fake.published.length
    const { menus, status } = menusFor(desk, () => {})
    view.rerender(
      <DeskProvider desk={desk}>
        <MenuBar menus={menus} status={status} host={fake.host} />
        <Desktop title={id => id} renderWindow={() => <Rides />} />
      </DeskProvider>,
    )
    expect(fake.published.length).toBe(count)
  })

  it('binds only the shortcuts the host does not own', () => {
    const fake = fakeHost()
    const { desk } = mount(fake.host)
    act(() => desk.open('rides'))
    fireEvent.keyDown(document.body, { key: 'e', ctrlKey: true, metaKey: true })
    expect(screen.getByText('exported 0')).toBeTruthy()
    fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight', altKey: true })
    expect(screen.getByText('exported 10')).toBeTruthy()
  })

  it('lets the host say which shortcuts it owns', () => {
    const fake = fakeHost({ ownsShortcut: () => true })
    const { desk } = mount(fake.host)
    act(() => desk.open('rides'))
    fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight', altKey: true })
    expect(screen.getByText('exported 0')).toBeTruthy()
  })

  it('takes its menus away and stops listening on the way out', () => {
    const fake = fakeHost()
    const { view } = mount(fake.host)
    view.unmount()
    expect(fake.latest()).toEqual([])
    expect(fake.listening()).toBe(false)
  })
})

describe('hostMenuModel', () => {
  it('reads checked and disabled when asked, and keeps details', () => {
    const { model, run } = hostMenuModel(
      [{ id: 'view', label: 'View', items: [menuAction('Grid', () => {}, { checked: () => true, detail: '⌘1' }), menuCommand('Zoom', DeskCommands.zoomWindow)] }],
      [],
      () => true,
    )
    expect(model[0]?.items).toEqual([
      { type: 'item', id: 'view:0', label: 'Grid', detail: '⌘1', enabled: true, checked: true },
      { type: 'item', id: 'view:1', label: 'Zoom', enabled: true },
    ])
    expect([...run.keys()]).toEqual(['view:0', 'view:1'])
  })

  it('knows a mod shortcut', () => {
    expect(hasModKey('mod+k')).toBe(true)
    expect(hasModKey('Mod+Alt+A')).toBe(true)
    expect(hasModKey('alt+]')).toBe(false)
  })
})
