// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk, DeskCommands, focusedId } from '../../src/core/index.js'
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
  /** Sends an id back as the host would, whether or not the page still publishes it. */
  const send = (id: string) => act(() => listener?.(id))
  return { host, published, latest, pick, send, listening: () => listener !== null }
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
      { type: 'item', id: 'ride:1:Export rides', label: 'Export rides', shortcut: 'mod+e', enabled: false },
      { type: 'item', id: 'ride:2:Next ride', label: 'Next ride', shortcut: 'alt+]', enabled: false },
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

  it('asks an action again when it is chosen, not trusting what was last published', () => {
    let locked = false
    const onSelect = vi.fn()
    const fake = fakeHost()
    render(
      <DeskProvider desk={createDesk()}>
        <MenuBar menus={[{ id: 'file', label: 'File', items: [menuAction('Unlock', onSelect, { disabled: () => locked })] }]} host={fake.host} />
      </DeskProvider>,
    )
    expect(fake.latest()[0]?.items[0]?.enabled).toBe(true)
    locked = true // through app state the bar never sees, so nothing is published again
    fake.pick('Unlock')
    expect(onSelect).not.toHaveBeenCalled()
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

  it('ignores a command nothing can perform, and sends a chosen one its args', () => {
    const got = vi.fn()
    function Opener() {
      useCommand<string>('file.open', name => got(name))
      return null
    }
    function App({ ready }: { ready: boolean }) {
      return (
        <DeskProvider desk={desk}>
          <MenuBar menus={[{ id: 'file', label: 'File', items: [menuCommand('Open recent', 'file.open', { args: 'garage.txt' })] }]} host={fake.host} />
          {ready ? <Opener /> : null}
        </DeskProvider>
      )
    }
    const fake = fakeHost()
    const desk = createDesk()
    const view = render(<App ready={false} />)
    fake.pick('Open recent')
    expect(got).not.toHaveBeenCalled()
    view.rerender(<App ready />)
    fake.pick('Open recent')
    expect(got).toHaveBeenCalledWith('garage.txt')
  })

  it('runs nothing for a choice from a menu that has changed since, not what took its place', () => {
    const fake = fakeHost()
    const { desk } = mount(fake.host)
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.open('c')
    })
    const windows = () => fake.latest()[2]?.items ?? []
    const first = windows()[0]
    expect(first?.label).toBe('A')
    act(() => desk.close('a'))
    expect(windows()[0]?.label).toBe('B')
    const focused = focusedId(desk.getState())
    fake.send(first?.id ?? '')
    expect(focusedId(desk.getState())).toBe(focused)
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

  it('publishes again when focus moves to what answers a command', () => {
    function Field() {
      const field = useRef<HTMLInputElement>(null)
      useCommand('field.clear', () => {}, { at: field })
      return <input aria-label="Field" ref={field} />
    }
    const fake = fakeHost()
    const desk = createDesk()
    render(
      <DeskProvider desk={desk}>
        <MenuBar menus={[{ id: 'edit', label: 'Edit', items: [menuCommand('Clear', 'field.clear')] }]} host={fake.host} />
        <Desktop title={id => id} renderWindow={() => <Field />} />
      </DeskProvider>,
    )
    act(() => desk.open('form'))
    expect(fake.latest()[0]?.items[0]?.enabled).toBe(false)
    act(() => screen.getByLabelText('Field').focus())
    expect(fake.latest()[0]?.items[0]?.enabled).toBe(true)
  })

  it('calls a command enabled that a component after the bar answers', async () => {
    function Saver() {
      useCommand('app.save', () => {})
      return null
    }
    const fake = fakeHost()
    render(
      <DeskProvider desk={createDesk()}>
        <MenuBar menus={[{ id: 'file', label: 'File', items: [menuCommand('Save', 'app.save')] }]} host={fake.host} />
        <Saver />
      </DeskProvider>,
    )
    await act(async () => {})
    expect(fake.latest()[0]?.items[0]?.enabled).toBe(true)
  })

  it('runs the function from the latest render, though the menus publish the same', () => {
    const fake = fakeHost()
    const { view, desk } = mount(fake.host)
    const later = vi.fn()
    const { menus, status } = menusFor(desk, later)
    view.rerender(
      <DeskProvider desk={desk}>
        <MenuBar menus={menus} status={status} host={fake.host} />
        <Desktop title={id => id} renderWindow={() => <Rides />} />
      </DeskProvider>,
    )
    fake.pick('About Garage')
    expect(later).toHaveBeenCalledOnce()
  })

  it('does nothing for an id it never published', () => {
    let listener: ((id: string) => void) | null = null
    const host: MenuHost = { publish: () => {}, onSelect: l => ((listener = l), () => {}) }
    const { onAbout } = mount(host)
    expect(() => act(() => listener?.('app:9'))).not.toThrow()
    expect(() => act(() => listener?.('app:1'))).not.toThrow()
    expect(onAbout).not.toHaveBeenCalled()
  })

  it('binds no shortcuts when told not to', () => {
    const fake = fakeHost()
    const desk = createDesk()
    const { menus, status } = menusFor(desk, () => {})
    render(
      <DeskProvider desk={desk}>
        <MenuBar menus={menus} status={status} host={fake.host} shortcuts={false} />
        <Desktop title={id => id} renderWindow={() => <Rides />} />
      </DeskProvider>,
    )
    act(() => desk.open('rides'))
    fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight', altKey: true })
    expect(screen.getByText('exported 0')).toBeTruthy()
  })

  it('moves its menus to a new host, taking them from the old one', () => {
    const first = fakeHost()
    const second = fakeHost()
    const { view, desk } = mount(first.host)
    const { menus, status } = menusFor(desk, () => {})
    view.rerender(
      <DeskProvider desk={desk}>
        <MenuBar menus={menus} status={status} host={second.host} />
        <Desktop title={id => id} renderWindow={() => <Rides />} />
      </DeskProvider>,
    )
    expect(first.latest()).toEqual([])
    expect(first.listening()).toBe(false)
    expect(second.latest().map(m => m.id)).toEqual(['app', 'ride', 'window', 'service'])
    expect(second.listening()).toBe(true)
  })

  it('takes its menus away and stops listening on the way out', async () => {
    const fake = fakeHost()
    const { view } = mount(fake.host)
    view.unmount()
    await act(async () => {}) // the microtask the last render queued publishes nothing after the empty list
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
      { type: 'item', id: 'view:0:Grid', label: 'Grid', detail: '⌘1', enabled: true, checked: true },
      { type: 'item', id: 'view:1:Zoom', label: 'Zoom', enabled: true },
    ])
    expect([...run.keys()]).toEqual(['view:0:Grid', 'view:1:Zoom'])
  })

  it('knows a mod shortcut', () => {
    expect(hasModKey('mod+k')).toBe(true)
    expect(hasModKey('Mod+Alt+A')).toBe(true)
    expect(hasModKey('alt+]')).toBe(false)
  })
})
