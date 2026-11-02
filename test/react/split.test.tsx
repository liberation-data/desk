// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Split } from '../../src/react/index.js'

/*
 * Two panels in one window, with the edge between them to drag. jsdom has no layout, so the side
 * panel says how wide it is drawn.
 */

afterEach(() => {
  cleanup()
  localStorage.clear()
})

let drawn = 280
beforeEach(() => {
  drawn = 280
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.getBoundingClientRect = function () {
    const width = this.hasAttribute('data-side') ? drawn : 0
    return { left: 0, top: 0, right: width, bottom: 0, width, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  }
})

const split = () => document.querySelector<HTMLElement>('.desk-split') as HTMLElement
const edge = () => screen.getByRole('separator')
const size = () => split().style.getPropertyValue('--desk-split-size')

const drag = (from: number, to: number) => {
  fireEvent.pointerDown(edge(), { button: 0, clientX: from, pointerId: 1 })
  act(() => {
    edge().dispatchEvent(new PointerEvent('pointermove', { clientX: to, bubbles: true }))
  })
  act(() => {
    edge().dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
}

describe('a split', () => {
  it('draws the side panel, the edge and the rest, in reading order', () => {
    render(<Split side={<p>side</p>}><p>main</p></Split>)
    expect([...split().children].map(c => c.textContent || c.getAttribute('role'))).toEqual(['side', 'separator', 'main'])
    expect(size()).toBe('min(280px, 50%)')
  })

  it('puts the side panel last at the end edge', () => {
    render(<Split side={<p>side</p>} at="end"><p>main</p></Split>)
    expect([...split().children].map(c => c.textContent || c.getAttribute('role'))).toEqual(['main', 'separator', 'side'])
  })

  it('widens when the edge is dragged towards the middle, and keeps no smaller than its minimum', () => {
    render(<Split side={<p>side</p>} min={220}><p>main</p></Split>)
    drag(280, 360)
    expect(size()).toBe('min(360px, 50%)')
    drawn = 360
    drag(360, 0)
    expect(size()).toBe('min(220px, 50%)')
  })

  it('widens leftwards at the end edge', () => {
    render(<Split side={<p>side</p>} at="end"><p>main</p></Split>)
    drag(700, 650)
    expect(size()).toBe('min(330px, 50%)')
  })

  it('follows the pointer without a commit, and draws nothing new for a click', () => {
    render(<Split side={<p>side</p>} remember="w"><p>main</p></Split>)
    fireEvent.pointerDown(edge(), { button: 0, clientX: 280, pointerId: 1 })
    act(() => {
      edge().dispatchEvent(new PointerEvent('pointermove', { clientX: 300, bubbles: true }))
    })
    expect(size()).toBe('min(300px, 50%)')
    expect(split().dataset.dragging).toBe('')
    act(() => {
      edge().dispatchEvent(new PointerEvent('pointermove', { clientX: 280, bubbles: true }))
      edge().dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    expect(size()).toBe('min(280px, 50%)')
    expect(split().dataset.dragging).toBeUndefined()
    expect(localStorage.getItem('desk.split.w')).toBeNull()
  })

  it('remembers the width it was left at', () => {
    const { unmount } = render(<Split side={<p>side</p>} remember="w"><p>main</p></Split>)
    drag(280, 400)
    unmount()
    render(<Split side={<p>side</p>} remember="w"><p>main</p></Split>)
    expect(size()).toBe('min(400px, 50%)')
  })

  it('ignores a remembered width that is not one', () => {
    localStorage.setItem('desk.split.w', 'wide')
    render(<Split side={<p>side</p>} remember="w" size={300}><p>main</p></Split>)
    expect(size()).toBe('min(300px, 50%)')
  })

  it('moves with the arrow keys, goes to its narrowest on Home, and back to its size on Enter or a double-click', () => {
    render(<Split side={<p>side</p>} min={200} max="420px"><p>main</p></Split>)
    act(() => void fireEvent.keyDown(edge(), { key: 'ArrowRight' }))
    expect(size()).toBe('min(296px, 420px)')
    expect(edge().getAttribute('aria-valuenow')).toBe('296')
    act(() => void fireEvent.keyDown(edge(), { key: 'Home' }))
    expect(size()).toBe('min(200px, 420px)')
    act(() => void fireEvent.keyDown(edge(), { key: 'Enter' }))
    expect(size()).toBe('min(280px, 420px)')
    drag(280, 380)
    act(() => void fireEvent.doubleClick(edge()))
    expect(size()).toBe('min(280px, 420px)')
  })

  it('names the edge for assistive technology', () => {
    render(<Split side={<p>side</p>} label="Resize the catalogue"><p>main</p></Split>)
    expect(screen.getByRole('separator', { name: 'Resize the catalogue' }).getAttribute('aria-orientation')).toBe('vertical')
  })
})
