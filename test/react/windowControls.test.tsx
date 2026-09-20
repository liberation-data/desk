// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { Desktop, DeskProvider } from '../../src/react/index.js'

afterEach(cleanup)

/*
 * The glyph is drawn in the markup and hidden by CSS until the pointer is over the cluster, so
 * what a test can hold is that every control carries its own mark and that the mark stays out of
 * the accessible name. Whether it fades in is the stylesheet's, and the browser check's.
 */

const TITLES: Record<string, string> = { rides: 'Rides' }

function mount(): Desk {
  const desk = createDesk({ stage: () => ({ width: 1000, height: 700 }) })
  render(
    <DeskProvider desk={desk}>
      <Desktop title={id => TITLES[id] ?? id} renderWindow={id => <p>{id}</p>} />
    </DeskProvider>,
  )
  act(() => desk.open('rides'))
  return desk
}

const control = (name: string) => screen.getByRole('button', { name })
const glyphOf = (name: string) => control(name).querySelector('.desk-control-glyph')

describe('the window controls', () => {
  it('each carry a glyph', () => {
    mount()
    for (const name of ['Close', 'Minimize', 'Zoom']) expect(glyphOf(name)).toBeTruthy()
  })

  it('draw a different one on each', () => {
    mount()
    const paths = ['Close', 'Minimize', 'Zoom'].map(name => glyphOf(name)?.querySelector('path')?.getAttribute('d'))
    expect(new Set(paths).size).toBe(3)
    expect(paths.every(Boolean)).toBe(true)
  })

  it('keep the glyph out of the accessible name', () => {
    mount()
    for (const name of ['Close', 'Minimize', 'Zoom']) {
      expect(glyphOf(name)?.getAttribute('aria-hidden')).toBe('true')
      expect(control(name).textContent).toBe('')
    }
  })
})
