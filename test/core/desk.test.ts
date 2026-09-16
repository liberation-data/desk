import { describe, expect, it, vi } from 'vitest'
import { cascadeFrame, createDesk, focusedId, instancesOf, normalise, windowType } from '../../src/core/index.js'
import type { DeskState } from '../../src/core/index.js'

const modes = (state: DeskState) => state.windows.map(w => `${w.id}:${w.mode}`)

describe('open', () => {
  it('fills the desk with every window, each over the last', () => {
    const desk = createDesk()
    ;['a', 'b', 'c'].forEach(id => desk.open(id))
    expect(modes(desk.getState())).toEqual(['a:filled', 'b:filled', 'c:filled'])
    expect(desk.getState().stack).toEqual(['a', 'b', 'c'])
  })

  it('focuses a window that is already open instead of opening it twice', () => {
    const desk = createDesk()
    desk.open('a')
    desk.open('b')
    desk.open('a')
    expect(desk.getState().windows).toHaveLength(2)
    expect(focusedId(desk.getState())).toBe('a')
  })

  it('opens a free window when asked', () => {
    const desk = createDesk()
    desk.open('a', { mode: 'floating' })
    expect(modes(desk.getState())).toEqual(['a:floating'])
  })

  it('opens a free window where it is given a frame', () => {
    const desk = createDesk()
    const frame = { x: 10, y: 20, width: 300, height: 200 }
    desk.open('a', { frame })
    expect(desk.getState().windows[0]).toEqual({ id: 'a', mode: 'floating', frame })
  })
})

describe('several windows of the same kind', () => {
  it('numbers the second and after, keeping the first plain', () => {
    const desk = createDesk()
    expect(desk.openInstance('query')).toBe('query')
    expect(desk.openInstance('query')).toBe('query#2')
    expect(desk.openInstance('query')).toBe('query#3')
    expect(desk.getState().windows.map(w => w.id)).toEqual(['query', 'query#2', 'query#3'])
  })

  it('says what kind each one is', () => {
    expect(windowType('query#2')).toBe('query')
    expect(windowType('query')).toBe('query')
  })

  it('finds every window of a kind', () => {
    const desk = createDesk()
    desk.openInstance('query')
    desk.open('views')
    desk.openInstance('query')
    expect(instancesOf(desk.getState(), 'query').map(w => w.id)).toEqual(['query', 'query#2'])
    expect(instancesOf(desk.getState(), 'views')).toHaveLength(1)
  })

  it('fills a gap left by one that was closed', () => {
    const desk = createDesk()
    desk.openInstance('query')
    desk.openInstance('query')
    desk.close('query')
    expect(desk.openInstance('query')).toBe('query')
  })

  it('treats them as the separate windows they are', () => {
    const desk = createDesk()
    desk.openInstance('query')
    const second = desk.openInstance('query')
    desk.close(second)
    expect(desk.getState().windows.map(w => w.id)).toEqual(['query'])
  })
})

describe('focus', () => {
  it('moves the window to the front without reordering the windows', () => {
    const desk = createDesk()
    desk.open('a')
    desk.open('b')
    desk.focus('a')
    expect(desk.getState().windows.map(w => w.id)).toEqual(['a', 'b'])
    expect(desk.getState().stack).toEqual(['b', 'a'])
  })

  it('does not notify when the window already has focus', () => {
    const desk = createDesk()
    desk.open('a')
    const listener = vi.fn()
    desk.subscribe(listener)
    desk.focus('a')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('close', () => {
  it('passes focus to the window behind', () => {
    const desk = createDesk()
    ;['a', 'b', 'c'].forEach(id => desk.open(id))
    desk.focus('a')
    desk.close('a')
    expect(focusedId(desk.getState())).toBe('c')
  })

  it('leaves an empty desk with nothing focused', () => {
    const desk = createDesk()
    desk.open('a')
    desk.closeAll()
    expect(desk.getState()).toEqual({ windows: [], stack: [] })
    expect(focusedId(desk.getState())).toBeNull()
  })
})

describe('float and fill', () => {
  it('frees a filled window inside the stage and brings it to the front', () => {
    const desk = createDesk({ stage: () => ({ width: 800, height: 600 }) })
    desk.open('a')
    desk.open('b')
    desk.float('a')
    const a = desk.getState().windows[0]
    expect(a?.mode).toBe('floating')
    if (a?.mode === 'floating') {
      expect(a.frame.x + a.frame.width).toBeLessThanOrEqual(800)
      expect(a.frame.y + a.frame.height).toBeLessThanOrEqual(600)
    }
    expect(focusedId(desk.getState())).toBe('a')
  })

  it('moves a free window when given a frame', () => {
    const desk = createDesk()
    desk.open('a', { mode: 'floating' })
    const frame = { x: 5, y: 6, width: 300, height: 200 }
    desk.float('a', frame)
    expect(desk.getState().windows[0]).toEqual({ id: 'a', mode: 'floating', frame })
  })

  it('zooms between filling the desk and where the window was', () => {
    const desk = createDesk()
    const frame = { x: 40, y: 30, width: 300, height: 200 }
    desk.open('a', { frame })
    desk.toggleMode('a')
    expect(modes(desk.getState())).toEqual(['a:filled'])
    desk.toggleMode('a')
    expect(desk.getState().windows[0]).toEqual({ id: 'a', mode: 'floating', frame })
  })

  it('places several windows at once, as free windows', () => {
    const desk = createDesk()
    ;['a', 'b', 'c'].forEach(id => desk.open(id))
    desk.placeAll({ a: { x: 0, y: 0, width: 10, height: 10 }, b: { x: 10, y: 0, width: 10, height: 10 } })
    expect(modes(desk.getState())).toEqual(['a:floating', 'b:floating', 'c:filled'])
  })

  it('works when methods are destructured', () => {
    const { open, toggleMode, getState } = createDesk()
    open('a')
    toggleMode('a')
    expect(modes(getState())).toEqual(['a:floating'])
  })
})

describe('cascadeFrame', () => {
  it('steps each new window down and right, then wraps', () => {
    const stage = { width: 1600, height: 1000 }
    const first = cascadeFrame(0, stage)
    const second = cascadeFrame(1, stage)
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.y).toBeGreaterThan(first.y)
    expect(cascadeFrame(6, stage)).toEqual(first)
  })

  it('shrinks to fit a small stage', () => {
    const frame = cascadeFrame(3, { width: 400, height: 300 })
    expect(frame.x + frame.width).toBeLessThanOrEqual(400)
    expect(frame.y + frame.height).toBeLessThanOrEqual(300)
  })
})

describe('the cascade never hides a window under another', () => {
  const stage = () => ({ width: 1400, height: 900 })
  const frames = (d: ReturnType<typeof createDesk>) =>
    d.getState().windows.flatMap(w => (w.mode === 'floating' ? [`${w.frame.x},${w.frame.y}`] : []))

  it('gives every floating window its own step', () => {
    const desk = createDesk({ stage })
    ;['a', 'b', 'c', 'd', 'e'].forEach(id => desk.open(id, { mode: 'floating' }))
    expect(new Set(frames(desk)).size).toBe(frames(desk).length)
  })

  it('reuses a step only once the window on it has gone', () => {
    const desk = createDesk({ stage })
    ;['a', 'b', 'c', 'd', 'e'].forEach(id => desk.open(id, { mode: 'floating' }))
    const freed = frames(desk)[0]
    desk.close('c')
    desk.open('f', { mode: 'floating' })
    expect(frames(desk)).toContain(freed)
    expect(new Set(frames(desk)).size).toBe(frames(desk).length)
  })

  it('keeps them apart past the wrap', () => {
    const desk = createDesk({ stage })
    ;['a', 'b'].forEach(id => desk.open(id))
    ;Array.from({ length: 6 }, (_, i) => `f${i}`).forEach(id => desk.open(id, { mode: 'floating' }))
    expect(new Set(frames(desk)).size).toBe(frames(desk).length)
  })

  it('does not land on a window that was dragged onto a step', () => {
    const desk = createDesk({ stage })
    desk.open('c', { mode: 'floating' })
    const first = desk.getState().windows[0]
    if (first?.mode !== 'floating') throw new Error('expected a floating window')
    desk.open('d', { mode: 'floating' })
    desk.float('d', { ...first.frame })
    desk.open('e', { mode: 'floating' })
    expect(frames(desk).filter(f => f === `${first.frame.x},${first.frame.y}`)).toHaveLength(2)
  })
})

describe('restore', () => {
  it('drops duplicates and repairs the stack', () => {
    const repaired = normalise({
      windows: [
        { id: 'a', mode: 'filled' },
        { id: 'a', mode: 'filled' },
        { id: 'b', mode: 'filled' },
      ],
      stack: ['ghost', 'a'],
    })
    expect(repaired).toEqual({
      windows: [
        { id: 'a', mode: 'filled' },
        { id: 'b', mode: 'filled' },
      ],
      stack: ['b', 'a'],
    })
  })
})
