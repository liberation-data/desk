// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { Desktop, DeskProvider } from '../../src/react/index.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Draft({ id }: { readonly id: string }) {
  const [text, setText] = useState('')
  return <textarea aria-label={`${id} draft`} value={text} onChange={e => setText(e.target.value)} />
}

function mount(layout: 'auto' | 'desktop' | 'fullscreen' = 'fullscreen'): Desk {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <Desktop layout={layout} title={id => id} renderWindow={id => <Draft id={id} />} />
    </DeskProvider>,
  )
  return desk
}

// `inert` takes a window out of the accessibility tree, so find it by its window attribute.
const window_ = (id: string) => {
  const found = document.querySelector<HTMLElement>(`[data-desk-window="${id}"]`)
  if (!found) throw new Error(`No window ${id}`)
  return found
}

describe('one window at a time', () => {
  it('shows only the key window, and switches with focus', () => {
    const desk = mount()
    act(() => {
      desk.open('rides')
      desk.open('map')
    })
    expect(window_('map').dataset.hidden).toBeUndefined()
    expect(window_('rides').dataset.hidden).toBe('true')
    act(() => desk.focus('rides'))
    expect(window_('rides').dataset.hidden).toBeUndefined()
    expect(window_('map').dataset.hidden).toBe('true')
  })

  it('keeps the hidden window mounted, so its state survives the switch', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    fireEvent.change(screen.getByRole('textbox', { name: 'rides draft' }), { target: { value: 'Sunday: Dandenongs' } })
    act(() => desk.open('map'))
    act(() => desk.focus('rides'))
    expect(screen.getByRole('textbox', { name: 'rides draft' })).toHaveProperty('value', 'Sunday: Dandenongs')
  })

  it('takes the offstage window out of the tab order and the accessibility tree', () => {
    const desk = mount()
    act(() => {
      desk.open('rides')
      desk.open('map')
    })
    expect(window_('rides').hasAttribute('inert')).toBe(true)
    expect(window_('map').hasAttribute('inert')).toBe(false)
  })

  it('offers close but not float', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Float' })).toBeNull()
  })

  it('fills the stage even for a window the desk calls floating', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.open('c') // floats on a desktop
    })
    expect(window_('c').dataset.mode).toBe('fullscreen')
    expect(window_('c').getAttribute('style')).toBeNull()
  })

  it('still tiles and floats on a desktop', () => {
    const desk = mount('desktop')
    act(() => {
      desk.open('a')
      desk.open('b')
      desk.open('c')
    })
    expect(window_('c').dataset.mode).toBe('floating')
    expect(window_('a').dataset.hidden).toBeUndefined()
    expect(screen.getAllByRole('button', { name: 'Float' }).length).toBeGreaterThan(0)
  })
})

describe('auto', () => {
  const stubMatchMedia = (touch: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: touch && query.includes('coarse'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))

  it('gives a touch screen one window at a time', () => {
    stubMatchMedia(true)
    const desk = mount('auto')
    act(() => {
      desk.open('a')
      desk.open('b')
    })
    expect(window_('a').dataset.hidden).toBe('true')
  })

  it('gives a pointer device the tiling desktop', () => {
    stubMatchMedia(false)
    const desk = mount('auto')
    act(() => {
      desk.open('a')
      desk.open('b')
    })
    expect(window_('a').dataset.hidden).toBeUndefined()
    expect(window_('a').dataset.mode).toBe('tiled')
  })
})
