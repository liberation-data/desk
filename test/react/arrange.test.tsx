// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canPerform, createDesk, DeskCommands, focusedId, perform } from '../../src/core/index.js'
import type { Desk, Frame } from '../../src/core/index.js'
import { Desktop, DeskProvider } from '../../src/react/index.js'
import { arrangement } from '../../src/react/arrange.js'

const AREA = { x: 0, y: 0, width: 1000, height: 700, gap: 0 }
const LIMITS = { minWidth: 240, minHeight: 160 }

describe('where Arrange puts windows', () => {
  it('fills the area with one', () => {
    expect(arrangement(['a'], 'a', null, AREA, LIMITS)).toEqual({ a: { x: 0, y: 0, width: 1000, height: 700 } })
  })

  it('puts two side by side, the focused one first', () => {
    expect(arrangement(['a', 'b'], 'b', 'a', AREA, LIMITS)).toEqual({
      b: { x: 0, y: 0, width: 500, height: 700 },
      a: { x: 500, y: 0, width: 500, height: 700 },
    })
  })

  it('gives three one tall place and two stacked, leaving the gap between them', () => {
    const frames = arrangement(['a', 'b', 'c'], 'a', null, { ...AREA, gap: 10 }, LIMITS)
    expect(frames).toEqual({
      a: { x: 0, y: 0, width: 495, height: 700 },
      b: { x: 505, y: 0, width: 495, height: 345 },
      c: { x: 505, y: 355, width: 495, height: 345 },
    })
  })

  it('makes a 2 × 2 grid of four', () => {
    const frames = arrangement(['a', 'b', 'c', 'd'], 'a', null, AREA, LIMITS)
    expect(Object.values(frames).map(f => [f.x, f.y])).toEqual([[0, 0], [500, 0], [0, 350], [500, 350]])
  })

  it('does not depend on where windows are, or on which was used before the focused one', () => {
    const once = arrangement(['a', 'b', 'c', 'd', 'e'], 'a', 'c', AREA, LIMITS)
    const again = arrangement(['a', 'b', 'c', 'd', 'e'], 'a', 'e', AREA, LIMITS)
    expect(again).toEqual(once)
  })

  it('shares the area between the two most recent when a grid would be too small, and cascades the rest over the second half', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const frames = arrangement(ids, 'c', 'h', { ...AREA, width: 700, height: 500 }, LIMITS)
    expect(frames.c).toEqual({ x: 0, y: 0, width: 350, height: 500 })
    expect(frames.h).toEqual({ x: 350, y: 0, width: 350, height: 500 })
    const rest = ids.filter(id => id !== 'c' && id !== 'h').map(id => frames[id] as Frame)
    expect(rest.every(f => f.x >= 350)).toBe(true)
    expect(new Set(rest.slice(0, 6).map(f => `${f.x},${f.y}`)).size).toBe(6)
  })
})

describe('the Arrange command', () => {
  afterEach(cleanup)
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute('data-desk-stage') ? 1000 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute('data-desk-stage') ? 700 : 0 } })
  })

  const mount = (): Desk => {
    const desk = createDesk({ stage: () => ({ width: 1000, height: 700 }) })
    render(
      <DeskProvider desk={desk}>
        <Desktop title={id => id} renderWindow={id => <p>{id}</p>} />
      </DeskProvider>,
    )
    return desk
  }

  it('is offered once windows have been placed by hand, and not for the split the desk made', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
    })
    expect(canPerform(desk, DeskCommands.arrange)).toBe(false)
    act(() => desk.float('b', { x: 40, y: 40, width: 300, height: 300 }))
    expect(canPerform(desk, DeskCommands.arrange)).toBe(true)
  })

  it('returns two windows to a split', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.float('b', { x: 40, y: 40, width: 300, height: 300 })
    })
    act(() => void perform(desk, DeskCommands.arrange))
    expect(desk.getState().windows.map(w => w.mode)).toEqual(['tiled', 'tiled'])
  })

  it('places three as windows that can be moved again, keeping focus where it was', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.open('c')
      desk.focus('b')
    })
    act(() => void perform(desk, DeskCommands.arrange))
    const { windows } = desk.getState()
    expect(windows.every(w => w.mode === 'floating')).toBe(true)
    expect(windows.find(w => w.id === 'b')).toMatchObject({ frame: { x: 0, y: 0, width: 500, height: 700 } })
    expect(focusedId(desk.getState())).toBe('b')
  })
})
