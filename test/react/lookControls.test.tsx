// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { Desk, Look } from '../../src/core/index.js'
import { Desktop, DeskProvider } from '../../src/react/index.js'

afterEach(cleanup)

function mount(look: Look, layout: 'desktop' | 'fullscreen' = 'desktop'): Desk {
  const desk = createDesk({ stage: () => ({ width: 1000, height: 700 }) })
  render(
    <DeskProvider desk={desk} look={look}>
      <Desktop
        layout={layout}
        title={() => 'Rides'}
        note={() => 'Last 30 days'}
        actions={() => <button type="button">Share</button>}
        renderWindow={id => <p>{id}</p>}
      />
    </DeskProvider>,
  )
  act(() => desk.open('rides'))
  return desk
}

const titlebar = () => document.querySelector<HTMLElement>('.desk-titlebar')!
/** Every button and the title, in document order: what a keyboard walks and a screen reader reads. */
const sequence = () =>
  [...titlebar().querySelectorAll<HTMLElement>('button, h2')].map(e => e.getAttribute('aria-label') ?? e.textContent)

describe('title bar controls by look', () => {
  it('lead the bar on a Mac: close, minimize, zoom, then the title', () => {
    mount('mac')
    expect(sequence()).toEqual(['Close', 'Minimize', 'Zoom', 'Rides', 'Share'])
  })

  it.each(['gnome', 'windows'] as const)('end the bar on %s: minimize, maximize, close — after the actions', look => {
    // In the document in the order they are seen, not reordered by CSS, so Tab walks them as they read.
    mount(look)
    expect(sequence()).toEqual(['Rides', 'Share', 'Minimize', 'Restore', 'Close'])
  })

  it.each(['gnome', 'windows'] as const)('say Restore on a window filling the desk and Maximize on a free one (%s)', look => {
    const desk = mount(look)
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(desk.getState().windows[0]?.mode).toBe('floating')
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))
    expect(desk.getState().windows[0]?.mode).toBe('filled')
  })

  it.each(['mac', 'gnome', 'windows'] as const)('draw a different glyph on each control (%s)', look => {
    mount(look)
    const controls = within(titlebar()).getAllByRole('button').filter(b => b.classList.contains('desk-control'))
    const glyphs = controls.map(b => b.querySelector('.desk-control-glyph')?.innerHTML)
    expect(glyphs.every(Boolean)).toBe(true)
    expect(new Set(glyphs).size).toBe(controls.length)
  })

  it('draws Restore differently from Maximize, as the platform does', () => {
    const desk = mount('windows')
    const restore = screen.getByRole('button', { name: 'Restore' }).innerHTML
    act(() => desk.toggleMode(desk.getState().windows[0]!.id))
    expect(screen.getByRole('button', { name: 'Maximize' }).innerHTML).not.toBe(restore)
  })

  it('offers only Close when one window has the screen, at the end on gnome', () => {
    mount('gnome', 'fullscreen')
    expect(sequence()).toEqual(['Rides', 'Share', 'Close'])
  })
})
