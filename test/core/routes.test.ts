import { describe, expect, it } from 'vitest'
import { createDesk, focusedId, normalise, parse, routeOf, serialize, syncWithLocation } from '../../src/core/index.js'
import type { LocationEnv } from '../../src/core/index.js'

const stage = { width: 1200, height: 800 }
const desk = () => createDesk({ stage: () => stage })

describe('routes', () => {
  it('opens a window somewhere inside it', () => {
    const d = desk()
    d.open('settings', { route: 'agents' })
    expect(routeOf(d.getState(), 'settings')).toBe('agents')
  })

  it('moves a window already open, and brings it forward', () => {
    const d = desk()
    d.open('settings', { route: 'look' })
    d.open('notes')
    d.open('settings', { route: 'agents' })
    expect(routeOf(d.getState(), 'settings')).toBe('agents')
    expect(focusedId(d.getState())).toBe('settings')
  })

  it('leaves a window where it is when opened without one', () => {
    const d = desk()
    d.open('settings', { route: 'agents' })
    d.open('settings')
    expect(routeOf(d.getState(), 'settings')).toBe('agents')
  })

  it('takes a route from the window without bringing it forward', () => {
    const d = desk()
    d.open('settings')
    d.open('notes')
    d.setRoute('settings', 'agents')
    expect(routeOf(d.getState(), 'settings')).toBe('agents')
    expect(focusedId(d.getState())).toBe('notes')
  })

  it('clears with an empty route, and keeps the field out of the state', () => {
    const d = desk()
    d.open('settings', { route: 'agents' })
    d.setRoute('settings', '')
    expect(d.getState()).toEqual({ windows: [{ id: 'settings', mode: 'filled' }], stack: ['settings'] })
  })

  it('ignores a route for a window that is not open', () => {
    const d = desk()
    d.setRoute('settings', 'agents')
    expect(d.getState().routes).toBeUndefined()
  })

  it('forgets the route when the window closes', () => {
    const d = desk()
    d.open('settings', { route: 'agents' })
    d.close('settings')
    d.open('settings')
    expect(routeOf(d.getState(), 'settings')).toBe('')
  })

  it("keeps the other windows' routes when one closes", () => {
    const d = desk()
    d.open('settings', { route: 'agents' })
    d.open('views', { route: 'crime/run' })
    d.close('settings')
    expect(d.getState().routes).toEqual({ views: 'crime/run' })
  })

  it('keeps routes through minimize, mode changes and a second instance', () => {
    const d = desk()
    d.open('settings', { route: 'agents' })
    const second = d.openInstance('settings', { route: 'look' })
    d.minimize('settings')
    d.toggleMode('settings')
    expect(routeOf(d.getState(), 'settings')).toBe('agents')
    expect(routeOf(d.getState(), second)).toBe('look')
  })

  it('tells listeners once, and not at all when nothing moved', () => {
    const d = desk()
    d.open('settings')
    let told = 0
    d.subscribe(() => told++)
    d.setRoute('settings', 'agents')
    d.setRoute('settings', 'agents')
    expect(told).toBe(1)
  })

  it('normalises away routes of windows that are not open', () => {
    const state = normalise({ windows: [{ id: 'a', mode: 'filled' }], stack: ['a'], routes: { a: 'x', gone: 'y', b: '' } })
    expect(state.routes).toEqual({ a: 'x' })
  })
})

describe('routes in the URL', () => {
  it('round-trips a route after the window, slashes and all', () => {
    const d = desk()
    d.open('notes')
    d.open('views', { route: 'crime/run' })
    d.open('settings', { mode: 'floating', route: 'agents' })
    d.minimize('settings')
    const params = serialize(d.getState())
    expect(params.get('w')).toBe('notes,views/crime/run,settings~_/agents')
    const restored = parse(params, stage)
    expect(restored.routes).toEqual({ views: 'crime/run', settings: 'agents' })
    expect(restored.minimized).toEqual(['settings'])
    expect(restored.windows.map(w => `${w.id}:${w.mode}`)).toEqual(['notes:filled', 'views:filled', 'settings:floating'])
  })

  it('keeps an id with a slash apart from its route', () => {
    const d = desk()
    d.open('apps/workspace/report.html', { route: 'q1, by region at 100%' })
    const restored = parse(serialize(d.getState()), stage)
    expect(restored.windows[0]?.id).toBe('apps/workspace/report.html')
    expect(routeOf(restored, 'apps/workspace/report.html')).toBe('q1, by region at 100%')
  })

  it('opens a window without its route when the route does not decode', () => {
    const restored = parse(new URLSearchParams('w=settings/%E0%A4%A'), stage)
    expect(restored.windows.map(w => w.id)).toEqual(['settings'])
    expect(restored.routes).toBeUndefined()
  })

  it('writes a readable address and replaces the entry as the route moves', () => {
    const entries: string[] = ['']
    const env: LocationEnv = {
      location: { hash: '' },
      history: {
        pushState: (_d, _u, url) => {
          entries.push(url)
          env.location.hash = url
        },
        replaceState: (_d, _u, url) => {
          entries[entries.length - 1] = url
          env.location.hash = url
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    const d = desk()
    syncWithLocation(d, () => stage, { isKnown: () => true }, env)
    d.open('settings', { route: 'look' })
    const depth = entries.length
    d.setRoute('settings', 'agents/claude code')
    expect(entries).toHaveLength(depth)
    expect(env.location.hash).toBe('#w=settings/agents/claude+code&f=settings')
    expect(routeOf(parse(new URLSearchParams(env.location.hash.slice(1)), stage, { isKnown: () => true }), 'settings')).toBe('agents/claude code')
  })

  it('takes an id with a slash and a route full of URL characters through the address and back', () => {
    const entries: string[] = ['']
    let onPop = () => {}
    const env: LocationEnv = {
      location: { hash: '' },
      history: {
        pushState: (_d, _u, url) => {
          entries.push(url)
          env.location.hash = url
        },
        replaceState: (_d, _u, url) => {
          entries[entries.length - 1] = url
          env.location.hash = url
        },
      },
      addEventListener: (_t, listener) => {
        onPop = listener
      },
      removeEventListener: () => {},
    }
    const d = desk()
    syncWithLocation(d, () => stage, { isKnown: () => true }, env)
    const id = 'apps/a~b_c,d%e'
    const route = 'q1+q2 & a=b #3, at 100%/x'
    d.open(id, { route })
    d.open('notes')
    env.location.hash = entries[1] as string
    onPop()
    expect(d.getState().windows.map(w => w.id)).toEqual([id])
    expect(routeOf(d.getState(), id)).toBe(route)
  })
})

describe('routes and ids that name what objects have', () => {
  it('has no route for a window called constructor', () => {
    const d = desk()
    d.open('settings', { route: 'agents' })
    d.open('constructor')
    expect(routeOf(d.getState(), 'constructor')).toBe('')
    expect(serialize(d.getState()).get('w')).toBe('settings/agents,constructor')
  })
})

describe('routes restored from something else', () => {
  it('takes no routes from a list or a string, even with a window called 0', () => {
    const windows = [{ id: '0', mode: 'filled' as const }]
    const hostile = (routes: unknown) => normalise({ windows, stack: ['0'], routes } as never)
    expect(hostile(['agents']).routes).toBeUndefined()
    expect(hostile('agents').routes).toBeUndefined()
    expect(hostile(null).routes).toBeUndefined()
    expect(hostile(7).routes).toBeUndefined()
  })

  it('drops a route that is not a string, and keeps the rest', () => {
    const state = normalise({ windows: [{ id: 'a', mode: 'filled' }, { id: 'b', mode: 'filled' }], stack: ['a', 'b'], routes: { a: 3, b: 'x' } } as never)
    expect(state.routes).toEqual({ b: 'x' })
  })

  it('restores routes onto the desk and lets them be moved', () => {
    const d = desk()
    d.restore({ windows: [{ id: 'settings', mode: 'filled' }], stack: ['settings'], routes: { settings: 'agents' } })
    expect(routeOf(d.getState(), 'settings')).toBe('agents')
    d.setRoute('settings', 'look')
    expect(routeOf(d.getState(), 'settings')).toBe('look')
  })
})
