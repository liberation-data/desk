import { describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { DeskState, Size } from '../../src/core/index.js'

/*
 * Undocking a laptop: the desk is suddenly half the size, and windows spread across the big screen
 * are past its edge — where a pointer cannot reach them to drag them back.
 */
const frames = (state: DeskState) =>
  state.windows.map(w => (w.mode === 'floating' ? `${w.id}:${w.frame.x},${w.frame.y},${w.frame.width}x${w.frame.height}` : `${w.id}:filled`))

const desk = (size: () => Size) => createDesk({ stage: size })

describe('the desk changing size', () => {
  it('brings a window that is now past the edge back on', () => {
    let size: Size = { width: 2560, height: 1400 }
    const d = desk(() => size)
    d.open('map', { frame: { x: 1800, y: 900, width: 600, height: 400 } })
    size = { width: 1280, height: 800 }
    d.fitToStage()
    expect(frames(d.getState())).toEqual(['map:680,400,600x400'])
  })

  it('puts it back exactly where it was when the room returns', () => {
    let size: Size = { width: 2560, height: 1400 }
    const d = desk(() => size)
    d.open('map', { frame: { x: 1800, y: 900, width: 600, height: 400 } })
    size = { width: 1280, height: 800 }
    d.fitToStage()
    size = { width: 2560, height: 1400 }
    d.fitToStage()
    expect(frames(d.getState())).toEqual(['map:1800,900,600x400'])
  })

  it('leaves a window alone once you have moved it yourself on the smaller desk', () => {
    let size: Size = { width: 2560, height: 1400 }
    const d = desk(() => size)
    d.open('map', { frame: { x: 1800, y: 900, width: 600, height: 400 } })
    size = { width: 1280, height: 800 }
    d.fitToStage()
    // A decision, not a rescue: where it sits now is where it belongs.
    d.float('map', { x: 40, y: 40, width: 500, height: 300 })
    size = { width: 2560, height: 1400 }
    d.fitToStage()
    expect(frames(d.getState())).toEqual(['map:40,40,500x300'])
  })

  it('shrinks a window too big for the desk, and fills when it cannot be a window at all', () => {
    let size: Size = { width: 2560, height: 1400 }
    const d = desk(() => size)
    d.open('map', { frame: { x: 0, y: 0, width: 1400, height: 900 } })
    size = { width: 900, height: 600 }
    d.fitToStage()
    expect(frames(d.getState())).toEqual(['map:0,0,900x600'])
    size = { width: 180, height: 500 }
    d.fitToStage()
    expect(frames(d.getState())).toEqual(['map:filled'])
  })

  it('says nothing about windows that fill the desk, and notifies only when something moved', () => {
    let size: Size = { width: 1280, height: 800 }
    const d = desk(() => size)
    d.open('rides')
    d.open('map', { frame: { x: 10, y: 10, width: 400, height: 300 } })
    const seen: number[] = []
    d.subscribe(state => seen.push(state.windows.length))
    d.fitToStage()
    expect(seen).toEqual([])
    size = { width: 300, height: 700 }
    d.fitToStage()
    expect(seen).toHaveLength(1)
  })

  it('ignores a desk that has no size yet, so nothing is rearranged before it is measured', () => {
    let size: Size = { width: 1280, height: 800 }
    const d = desk(() => size)
    d.open('map', { frame: { x: 900, y: 500, width: 300, height: 250 } })
    size = { width: 0, height: 0 }
    d.fitToStage()
    expect(frames(d.getState())).toEqual(['map:900,500,300x250'])
  })
})

describe('what a resize reports', () => {
  it('separates a window merely brought in from one that had to be made smaller', () => {
    let size: Size = { width: 2000, height: 1200 }
    const d = desk(() => size)
    d.open('map', { frame: { x: 1500, y: 100, width: 400, height: 300 } })   // fits, once moved
    d.open('rides', { frame: { x: 0, y: 0, width: 1800, height: 1000 } })    // cannot fit as it is
    size = { width: 1000, height: 700 }
    const fit = d.fitToStage()
    expect(fit.moved).toEqual(['map'])
    expect(fit.squeezed).toEqual(['rides'])
    expect(fit.restored).toEqual([])
  })

  it('reports nothing when every window already fits', () => {
    const d = desk(() => ({ width: 1280, height: 800 }))
    d.open('map', { frame: { x: 10, y: 10, width: 400, height: 300 } })
    expect(d.fitToStage()).toEqual({ moved: [], squeezed: [], restored: [] })
  })

  it('names what it put back, so growing again is not mistaken for a new layout', () => {
    let size: Size = { width: 2000, height: 1200 }
    const d = desk(() => size)
    d.open('map', { frame: { x: 1500, y: 800, width: 400, height: 300 } })
    size = { width: 1000, height: 700 }
    d.fitToStage()
    size = { width: 2000, height: 1200 }
    const fit = d.fitToStage()
    expect(fit.restored).toEqual(['map'])
    expect(fit.squeezed).toEqual([])
  })
})
