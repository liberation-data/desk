// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { Desk, DeskWindow } from '../../src/core/index.js'
import { Desktop, DeskProvider } from '../../src/react/index.js'

afterEach(cleanup)

const STAGE = { left: 0, right: 1000, width: 1000, height: 700 }

beforeEach(() => {
  // jsdom has no layout: describe the stage, and let a drag be captured.
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.getBoundingClientRect = function () {
    return this.hasAttribute('data-desk-stage')
      ? ({ ...STAGE, top: 0, bottom: STAGE.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
      : ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
  }
})

function mount(): Desk {
  const desk = createDesk({ stage: () => ({ width: STAGE.width, height: STAGE.height }) })
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

const drag = (id: string, to: number) => {
  const bar = titleBar(id)
  fireEvent.pointerDown(bar, { button: 0, clientX: 500, clientY: 300, pointerId: 1 })
  act(() => {
    bar.dispatchEvent(new PointerEvent('pointermove', { clientX: to, clientY: 300, bubbles: true }))
  })
}

const drop = (id: string) => {
  act(() => {
    titleBar(id).dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
}

describe('dragging a floating window to an edge', () => {
  it('previews where it would land, and tiles it there', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.open('c') // floats
    })
    drag('c', 20)
    expect(stage().dataset.snap).toBe('start')
    drop('c')
    expect(stage().dataset.snap).toBeUndefined()
    expect(windowOf(desk, 'c').mode).toBe('tiled')
    expect(desk.getState().windows.map(w => w.id)).toEqual(['c', 'a', 'b'])
  })

  it('tiles at the end when dropped against the far edge', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.open('c')
    })
    drag('c', 985)
    expect(stage().dataset.snap).toBe('end')
    drop('c')
    expect(desk.getState().windows.map(w => w.id)).toEqual(['a', 'b', 'c'])
  })

  it('just moves the window when it is dropped away from the edges', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.open('c')
    })
    drag('c', 500)
    expect(stage().dataset.snap).toBeUndefined()
    drop('c')
    expect(windowOf(desk, 'c').mode).toBe('floating')
  })
})

describe('a window that floats again', () => {
  it('goes back where it last was', () => {
    // No React here: a mounted Desktop reports the stage it measures, and jsdom measures nothing.
    const desk = createDesk({ stage: () => ({ width: STAGE.width, height: STAGE.height }) })
    desk.open('a')
    desk.float('a', { x: 120, y: 90, width: 400, height: 300 })
    desk.tile('a')
    desk.float('a')
    expect(windowOf(desk, 'a')).toMatchObject({ mode: 'floating', frame: { x: 120, y: 90 } })
  })

  it('takes a fresh place when the remembered one is off this screen', () => {
    const desk = createDesk({ stage: () => ({ width: 1400, height: 900 }) })
    desk.open('a')
    desk.float('a', { x: 1200, y: 800, width: 300, height: 200 })
    desk.tile('a')
    desk.setStage(() => ({ width: 600, height: 400 }))
    desk.float('a')
    const window = desk.getState().windows[0]
    expect(window?.mode === 'floating' && window.frame.x).toBeLessThan(600)
  })
})
