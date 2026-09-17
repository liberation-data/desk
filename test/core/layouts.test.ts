// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createDesk, fitFrame, localLayoutStore, stepFrom } from '../../src/core/index.js'
import type { LayoutStore, SavedLayout } from '../../src/core/index.js'

const memory = (): LayoutStore & { saved: Map<string, SavedLayout> } => {
  const saved = new Map<string, SavedLayout>()
  return { saved, load: type => saved.get(type), save: (type, layout) => void saved.set(type, layout) }
}

const STAGE = { width: 1200, height: 800 }
const CORNER = { x: 700, y: 400, width: 400, height: 300 }

describe('remembered layouts', () => {
  it('opens a window where its kind was last left', () => {
    const layouts = memory()
    const first = createDesk({ layouts, stage: () => STAGE })
    first.open('query')
    first.float('query', CORNER)
    const next = createDesk({ layouts, stage: () => STAGE })
    next.open('query')
    expect(next.getState().windows[0]).toEqual({ id: 'query', mode: 'floating', frame: CORNER })
  })

  it('opens filled again when it was zoomed to fill', () => {
    const layouts = memory()
    const first = createDesk({ layouts, stage: () => STAGE })
    first.open('query', { frame: CORNER })
    first.fill('query')
    const next = createDesk({ layouts, stage: () => STAGE })
    next.open('query')
    expect(next.getState().windows[0]?.mode).toBe('filled')
  })

  it('does not remember a window it was told where to put, or Arrange', () => {
    const layouts = memory()
    const desk = createDesk({ layouts, stage: () => STAGE })
    desk.open('query', { frame: CORNER })
    desk.placeAll({ query: { x: 0, y: 0, width: 600, height: 800 } })
    expect(layouts.saved.size).toBe(0)
  })

  it('an explicit mode or frame wins over what was remembered', () => {
    const layouts = memory()
    layouts.save('query', { mode: 'floating', frame: CORNER })
    const desk = createDesk({ layouts, stage: () => STAGE })
    desk.open('query', { mode: 'filled' })
    expect(desk.getState().windows[0]?.mode).toBe('filled')
  })

  it('fits the frame to a desk that has since become smaller', () => {
    const layouts = memory()
    layouts.save('query', { mode: 'floating', frame: CORNER })
    const desk = createDesk({ layouts, stage: () => ({ width: 800, height: 500 }) })
    desk.open('query')
    expect(desk.getState().windows[0]).toEqual({ id: 'query', mode: 'floating', frame: { x: 400, y: 200, width: 400, height: 300 } })
  })

  it('fills a desk too small for the remembered frame to be usable', () => {
    const layouts = memory()
    layouts.save('query', { mode: 'floating', frame: CORNER })
    const desk = createDesk({ layouts, stage: () => ({ width: 200, height: 500 }) })
    desk.open('query')
    expect(desk.getState().windows[0]?.mode).toBe('filled')
  })

  it('steps another window of the same kind down and right, and never on top of one', () => {
    const layouts = memory()
    layouts.save('query', { mode: 'floating', frame: { x: 100, y: 100, width: 400, height: 300 } })
    const desk = createDesk({ layouts, stage: () => STAGE, cascade: { step: { x: 30, y: 30 } } })
    desk.open('query')
    desk.openInstance('query')
    desk.openInstance('query')
    const frames = desk.getState().windows.map(w => (w.mode === 'floating' ? [w.frame.x, w.frame.y] : null))
    expect(frames).toEqual([[100, 100], [130, 130], [160, 160]])
  })
})

describe('fitFrame', () => {
  it('leaves a frame that fits alone', () => {
    expect(fitFrame(CORNER, STAGE)).toEqual(CORNER)
  })

  it('moves a frame back onto the desk', () => {
    expect(fitFrame({ x: -50, y: 2000, width: 400, height: 300 }, STAGE)).toEqual({ x: 0, y: 500, width: 400, height: 300 })
  })
})

describe('stepFrom', () => {
  it('wraps to the top-left when the next step would run off the desk', () => {
    const open = [{ x: 780, y: 480, width: 400, height: 300 }]
    expect(stepFrom(open[0]!, open, STAGE, { x: 30, y: 30 }, 16)).toEqual({ x: 16, y: 16, width: 400, height: 300 })
  })
})

describe('localLayoutStore', () => {
  beforeEach(() => localStorage.clear())

  it('keeps layouts by kind across stores', () => {
    localLayoutStore('rides').save('query', { mode: 'floating', frame: CORNER })
    localLayoutStore('rides').save('map', { mode: 'filled' })
    expect(localLayoutStore('rides').load('query')).toEqual({ mode: 'floating', frame: CORNER })
    expect(localLayoutStore('rides').load('map')).toEqual({ mode: 'filled' })
  })

  it('treats what is not a layout as none', () => {
    localStorage.setItem('desk.layouts.rides', JSON.stringify({ query: { mode: 'floating', frame: { x: 'left' } } }))
    expect(localLayoutStore('rides').load('query')).toBeUndefined()
    localStorage.setItem('desk.layouts.rides', 'not json')
    expect(localLayoutStore('rides').load('query')).toBeUndefined()
  })
})
