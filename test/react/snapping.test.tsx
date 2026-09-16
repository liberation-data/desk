// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { Desk, DeskWindow, Frame } from '../../src/core/index.js'
import { Desktop, DeskProvider } from '../../src/react/index.js'

/*
 * Arranging windows is something the desk does once, not a mode windows stay in.
 * jsdom has no layout, so the stage and each window say where they are.
 */

afterEach(cleanup)

const STAGE = { width: 1000, height: 700 }

/** Where each window is drawn right now. The tests start from two windows side by side. */
let drawn = {} as { a: Frame; b: Frame } & Record<string, Frame>

const FULL: Frame = { x: 0, y: 0, width: 1000, height: 700 }

const rect = (f: Frame) =>
  ({ left: f.x, top: f.y, right: f.x + f.width, bottom: f.y + f.height, width: f.width, height: f.height, x: f.x, y: f.y, toJSON: () => ({}) }) as DOMRect

beforeEach(() => {
  Element.prototype.setPointerCapture = () => {}
  drawn = { a: { x: 0, y: 0, width: 494, height: 700 }, b: { x: 506, y: 0, width: 494, height: 700 } }
  Element.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-desk-stage')) return rect({ x: 0, y: 0, ...STAGE })
    const id = this.getAttribute('data-desk-window')
    return rect((id && drawn[id]) || { x: 0, y: 0, width: 0, height: 0 })
  }
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute('data-desk-stage') ? STAGE.width : 0 } })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute('data-desk-stage') ? STAGE.height : 0 } })
})

function mount(): Desk {
  const desk = createDesk({ stage: () => STAGE })
  render(
    <DeskProvider desk={desk}>
      <Desktop title={id => id} renderWindow={id => <p>{id}</p>} />
    </DeskProvider>,
  )
  return desk
}

const titleBar = (id: string) => {
  const bar = document.querySelector<HTMLElement>(`[data-desk-window="${id}"] .desk-titlebar`)
  if (!bar) throw new Error(`No title bar for ${id}`)
  return bar
}
const stage = () => document.querySelector<HTMLElement>('[data-desk-stage]') as HTMLElement
const windowOf = (desk: Desk, id: string): DeskWindow => {
  const found = desk.getState().windows.find(w => w.id === id)
  if (!found) throw new Error(`No window ${id}`)
  return found
}
const frameOf = (desk: Desk, id: string) => {
  const w = windowOf(desk, id)
  if (w.mode !== 'floating') throw new Error(`${id} still fills the desk`)
  return w.frame
}

const drag = (id: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
  const bar = titleBar(id)
  fireEvent.pointerDown(bar, { button: 0, clientX: from.x, clientY: from.y, pointerId: 1 })
  act(() => {
    bar.dispatchEvent(new PointerEvent('pointermove', { clientX: to.x, clientY: to.y, bubbles: true }))
  })
}

const drop = (id: string) =>
  act(() => {
    titleBar(id).dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })

describe('moving a window that fills the desk', () => {
  it('frees it where it was, moving it by the drag, and leaves the window behind filling the desk', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
    })
    drawn = { a: FULL, b: FULL }
    drag('b', { x: 700, y: 10 }, { x: 600, y: 80 })
    drop('b')
    expect(frameOf(desk, 'b')).toEqual({ x: -100, y: 70, width: 1000, height: 700 })
    expect(windowOf(desk, 'a').mode).toBe('filled')
  })

  it('opens the next window filling the desk again', () => {
    const desk = mount()
    act(() => desk.open('a'))
    drawn = { a: FULL, b: FULL }
    drag('a', { x: 700, y: 10 }, { x: 600, y: 80 })
    drop('a')
    act(() => desk.open('c'))
    expect(windowOf(desk, 'c').mode).toBe('filled')
  })
})

describe('dragging a window against an edge', () => {
  it('previews the half it would take, and takes it — nothing else moves', () => {
    const desk = mount()
    act(() => {
      desk.open('a', { frame: drawn.a })
      desk.open('b', { frame: drawn.b })
    })
    drag('b', { x: 700, y: 10 }, { x: 20, y: 300 })
    expect(stage().dataset.snap).toBe('start')
    drop('b')
    expect(stage().dataset.snap).toBeUndefined()
    expect(frameOf(desk, 'b')).toMatchObject({ x: 0, width: 500 })
    expect(frameOf(desk, 'a')).toEqual(drawn.a)
  })

  it('takes the far half against the far edge', () => {
    const desk = mount()
    act(() => {
      desk.open('a', { frame: drawn.a })
      desk.open('b', { frame: drawn.b })
    })
    drag('a', { x: 200, y: 10 }, { x: 985, y: 300 })
    expect(stage().dataset.snap).toBe('end')
    drop('a')
    expect(frameOf(desk, 'a')).toMatchObject({ x: 500, width: 500 })
  })

  it('just moves the window when it is dropped away from the edges', () => {
    const desk = mount()
    act(() => {
      desk.open('a', { frame: drawn.a })
      desk.open('b', { frame: drawn.b })
    })
    drag('b', { x: 700, y: 10 }, { x: 500, y: 200 })
    expect(stage().dataset.snap).toBeUndefined()
    drop('b')
    expect(frameOf(desk, 'b')).toMatchObject({ x: 306, y: 190 })
  })
})

describe('resizing a window', () => {
  it('resizes that window alone', () => {
    const desk = mount()
    act(() => {
      desk.open('a', { frame: drawn.a })
      desk.open('b', { frame: drawn.b })
    })
    const grip = document.querySelector<HTMLElement>('[data-desk-window="a"] .desk-grip') as HTMLElement
    fireEvent.pointerDown(grip, { button: 0, clientX: 494, clientY: 700, pointerId: 1 })
    act(() => {
      grip.dispatchEvent(new PointerEvent('pointermove', { clientX: 394, clientY: 600, bubbles: true }))
    })
    act(() => {
      grip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    expect(frameOf(desk, 'a')).toMatchObject({ x: 0, y: 0, width: 394, height: 600 })
    expect(frameOf(desk, 'b')).toEqual(drawn.b)
  })
})

describe('resizing from an edge', () => {
  const pull = (id: string, edge: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const handle = document.querySelector<HTMLElement>(`[data-desk-window="${id}"] [data-edge="${edge}"]`) as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, clientX: from.x, clientY: from.y, pointerId: 1 })
    act(() => {
      handle.dispatchEvent(new PointerEvent('pointermove', { clientX: to.x, clientY: to.y, bubbles: true }))
    })
    act(() => {
      handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
  }
  const pair = () => {
    const desk = mount()
    act(() => {
      desk.open('a', { frame: drawn.a })
      desk.open('b', { frame: drawn.b })
    })
    return desk
  }

  it('widens from the right edge, and only widens', () => {
    const desk = pair()
    pull('a', 'right', { x: 494, y: 300 }, { x: 394, y: 360 })
    expect(frameOf(desk, 'a')).toEqual({ x: 0, y: 0, width: 394, height: 700 })
    expect(frameOf(desk, 'b')).toEqual(drawn.b)
  })

  it('widens from the left edge, keeping the right edge where it was', () => {
    const desk = pair()
    pull('b', 'left', { x: 506, y: 300 }, { x: 606, y: 250 })
    expect(frameOf(desk, 'b')).toEqual({ x: 606, y: 0, width: 394, height: 700 })
  })

  it('stops the left edge at the smallest a window can be', () => {
    const desk = pair()
    pull('b', 'left', { x: 506, y: 300 }, { x: 990, y: 300 })
    expect(frameOf(desk, 'b')).toMatchObject({ x: 1000 - 240, width: 240 })
  })

  it('grows taller from the bottom edge, and only taller', () => {
    const desk = pair()
    pull('a', 'bottom', { x: 200, y: 700 }, { x: 260, y: 500 })
    expect(frameOf(desk, 'a')).toEqual({ x: 0, y: 0, width: 494, height: 500 })
  })

  it('has no top edge, where the title bar is', () => {
    pair()
    expect(document.querySelector('[data-edge="top"]')).toBeNull()
  })
})

describe('zooming', () => {
  it('fills the desk from a double-click on the title bar, and goes back', () => {
    const desk = mount()
    act(() => {
      desk.open('a', { frame: drawn.a })
      desk.open('b', { frame: drawn.b })
    })
    act(() => fireEvent.doubleClick(titleBar('b')))
    expect(windowOf(desk, 'b').mode).toBe('filled')
    expect(frameOf(desk, 'a')).toEqual(drawn.a)
    act(() => fireEvent.doubleClick(titleBar('b')))
    expect(frameOf(desk, 'b')).toEqual(drawn.b)
  })

  it('frees a window that fills the desk from the green control', () => {
    const desk = mount()
    act(() => desk.open('a'))
    const zoomControl = document.querySelector<HTMLElement>('[data-desk-window="a"] [aria-label="Zoom"]') as HTMLElement
    act(() => fireEvent.click(zoomControl))
    expect(windowOf(desk, 'a').mode).toBe('floating')
    act(() => fireEvent.click(zoomControl))
    expect(windowOf(desk, 'a').mode).toBe('filled')
  })
})

describe('a window that floats again', () => {
  it('goes back where it last was', () => {
    // No React here: a mounted Desktop reports the stage it measures, and jsdom measures nothing.
    const desk = createDesk({ stage: () => STAGE })
    desk.open('a')
    desk.float('a', { x: 120, y: 90, width: 400, height: 300 })
    desk.fill('a')
    desk.float('a')
    expect(windowOf(desk, 'a')).toMatchObject({ mode: 'floating', frame: { x: 120, y: 90 } })
  })

  it('takes a fresh place when the remembered one is off this screen', () => {
    const desk = createDesk({ stage: () => ({ width: 1400, height: 900 }) })
    desk.open('a')
    desk.float('a', { x: 1200, y: 800, width: 300, height: 200 })
    desk.fill('a')
    desk.setStage(() => ({ width: 600, height: 400 }))
    desk.float('a')
    const window = desk.getState().windows[0]
    expect(window?.mode === 'floating' && window.frame.x).toBeLessThan(600)
  })
})
