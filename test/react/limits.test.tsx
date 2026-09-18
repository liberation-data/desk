// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { DeskProvider, Desktop } from '../../src/react/index.js'

afterEach(cleanup)

/*
 * An About box has a natural size. Filling the desk with it, or arranging it into a half, should not
 * stretch it across a 27-inch screen.
 */
const mount = (limits?: (id: string) => { maxWidth?: number; maxHeight?: number } | null) => {
  const desk = createDesk({ stage: () => ({ width: 1600, height: 1000 }) })
  render(
    <DeskProvider desk={desk}>
      <Desktop title={id => id} {...(limits ? { limits } : {})} renderWindow={id => <p>{id}</p>} />
    </DeskProvider>,
  )
  return desk
}

const windowFor = (id: string) => screen.getByRole('region', { name: id })

describe('how big a window may be', () => {
  it('caps a filled window, and centres it in the room it was given', () => {
    const desk = mount(id => (id === 'about' ? { maxWidth: 720, maxHeight: 560 } : null))
    act(() => desk.open('about'))
    const style = windowFor('about').style
    expect(style.maxWidth).toBe('720px')
    expect(style.maxHeight).toBe('560px')
    expect(style.margin).toBe('auto')
  })

  it('caps a free window too, without moving it', () => {
    const desk = mount(() => ({ maxWidth: 400 }))
    act(() => desk.open('about', { frame: { x: 60, y: 40, width: 900, height: 500 } }))
    const style = windowFor('about').style
    expect([style.left, style.top, style.width]).toEqual(['60px', '40px', '900px'])
    expect(style.maxWidth).toBe('400px')
    expect(style.margin).toBe('')
  })

  it('says nothing about a window with no limits, which is most of them', () => {
    const desk = mount(id => (id === 'about' ? { maxWidth: 720 } : null))
    act(() => desk.open('rides'))
    const style = windowFor('rides').style
    expect(style.maxWidth).toBe('')
    expect(style.margin).toBe('')
  })

  it('needs no limits function at all', () => {
    const desk = mount()
    act(() => desk.open('rides'))
    expect(windowFor('rides').style.maxWidth).toBe('')
  })
})
