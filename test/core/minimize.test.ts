import { describe, expect, it } from 'vitest'
import { createDesk, focusedId, isMinimized, normalise, onDesk, parse, serialize } from '../../src/core/index.js'
import type { DeskState } from '../../src/core/index.js'

const stage = { width: 1200, height: 800 }
const desk = () => createDesk({ stage: () => stage })

describe('minimize', () => {
  it('takes a window off the desk without closing it', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    const state = d.getState()
    expect(state.windows.map(w => w.id)).toEqual(['rides'])
    expect(isMinimized(state, 'rides')).toBe(true)
    expect(onDesk(state)).toHaveLength(0)
  })

  it('hands the desk to the window behind it', () => {
    const d = desk()
    d.open('rides')
    d.open('service')
    d.minimize('service')
    expect(focusedId(d.getState())).toBe('rides')
  })

  it('leaves nobody with the desk when every window is minimized', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    expect(focusedId(d.getState())).toBeNull()
  })

  it('keeps the mode and the frame it had, and comes back to them', () => {
    const d = desk()
    d.open('rides', { frame: { x: 40, y: 60, width: 500, height: 400 } })
    d.minimize('rides')
    expect(d.getState().windows[0]).toEqual({ id: 'rides', mode: 'floating', frame: { x: 40, y: 60, width: 500, height: 400 } })
    d.focus('rides')
    expect(d.getState().windows[0]).toEqual({ id: 'rides', mode: 'floating', frame: { x: 40, y: 60, width: 500, height: 400 } })
    expect(isMinimized(d.getState(), 'rides')).toBe(false)
  })

  it('comes back when it is opened again, rather than opening a second one', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    d.open('rides')
    expect(d.getState().windows).toHaveLength(1)
    expect(focusedId(d.getState())).toBe('rides')
  })

  it('comes back when it is filled or freed from wherever it is chosen', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    d.fill('rides')
    expect(isMinimized(d.getState(), 'rides')).toBe(false)
  })

  it('does not move it in the stack, so it comes back where it was', () => {
    const d = desk()
    ;['a', 'b', 'c'].forEach(id => d.open(id))
    d.focus('a')
    d.minimize('b')
    expect(d.getState().stack).toEqual(['b', 'c', 'a'])
  })

  it('says nothing about minimized windows while none are', () => {
    const d = desk()
    d.open('rides')
    expect(d.getState().minimized).toBeUndefined()
    d.minimize('rides')
    d.focus('rides')
    expect(d.getState().minimized).toBeUndefined()
  })

  it('ignores a window that is not open, and one already minimized', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    const before = d.getState()
    d.minimize('rides')
    d.minimize('nothing')
    expect(d.getState()).toBe(before)
  })

  it('stays minimized while another window is opened', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    d.open('service')
    expect(isMinimized(d.getState(), 'rides')).toBe(true)
    expect(onDesk(d.getState()).map(w => w.id)).toEqual(['service'])
  })

  it('stays minimized while a window is opened by instance', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    d.openInstance('service')
    expect(isMinimized(d.getState(), 'rides')).toBe(true)
  })

  it('stays minimized while another window is closed', () => {
    const d = desk()
    d.open('rides')
    d.open('service')
    d.minimize('rides')
    d.close('service')
    expect(isMinimized(d.getState(), 'rides')).toBe(true)
    expect(onDesk(d.getState())).toHaveLength(0)
  })

  it('keeps every minimized window when one of several is closed', () => {
    const d = desk()
    ;['a', 'b', 'c'].forEach(id => d.open(id))
    d.minimize('a')
    d.minimize('b')
    d.close('c')
    expect(d.getState().minimized).toEqual(['a', 'b'])
  })

  it('forgets a minimized window that is closed', () => {
    const d = desk()
    d.open('rides')
    d.minimize('rides')
    d.close('rides')
    expect(d.getState()).toEqual({ windows: [], stack: [] })
  })
})

describe('a desk restored from outside the program', () => {
  it('drops a minimized id that names no window', () => {
    const state = normalise({ windows: [{ id: 'rides', mode: 'filled' }], stack: ['rides'], minimized: ['rides', 'gone', 'rides'] })
    expect(state.minimized).toEqual(['rides'])
  })

  it('leaves the field out when nothing survives', () => {
    const state = normalise({ windows: [{ id: 'rides', mode: 'filled' }], stack: ['rides'], minimized: ['gone'] })
    expect(state.minimized).toBeUndefined()
  })
})

describe('the URL', () => {
  const hash = (state: DeskState) => serialize(state).toString().replace(/%2C/g, ',').replace(/%7E/g, '~')

  it('carries which windows are minimized, because that is not a position', () => {
    const d = desk()
    d.open('rides')
    d.open('map', { frame: { x: 10, y: 10, width: 400, height: 300 } })
    d.minimize('map')
    expect(hash(d.getState())).toBe('w=rides,map~_&f=rides')
  })

  it('opens them minimized again', () => {
    const state = parse(new URLSearchParams('w=rides,map~_&f=rides'), stage, { isKnown: () => true })
    expect(isMinimized(state, 'map')).toBe(true)
    expect(isMinimized(state, 'rides')).toBe(false)
    expect(state.windows.find(w => w.id === 'map')?.mode).toBe('floating')
    expect(focusedId(state)).toBe('rides')
  })

  it('says nothing when nothing is minimized', () => {
    const d = desk()
    d.open('rides')
    expect(hash(d.getState())).toBe('w=rides&f=rides')
  })
})
