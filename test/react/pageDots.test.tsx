// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PageDots, pageWindow } from '../../src/react/index.js'

afterEach(cleanup)

const drawn = (count: number, value: number, max?: number) =>
  pageWindow(count, value, max).map(dot => `${dot.index}${dot.size === 'full' ? '' : dot.size[0]}`).join(' ')

describe('pageWindow', () => {
  it('draws every page while they fit', () => {
    expect(drawn(5, 2)).toBe('0 1 2 3 4')
    expect(drawn(7, 6)).toBe('0 1 2 3 4 5 6')
  })

  it('keeps its width past the limit, around the current page, and shrinks toward more', () => {
    // s = small, m = medium: the two dots at an edge that has pages beyond it.
    expect(drawn(100, 0)).toBe('0 1 2 3 4 5m 6s')
    expect(drawn(100, 50)).toBe('47s 48m 49 50 51 52m 53s')
    expect(drawn(100, 99)).toBe('93s 94m 95 96 97 98 99')
    expect(drawn(9, 4, 5)).toBe('2s 3m 4 5m 6s')
  })

  it('holds a position outside the run to its nearest end', () => {
    expect(drawn(3, 9)).toBe('0 1 2')
    expect(drawn(100, -4)).toBe('0 1 2 3 4 5m 6s')
  })
})

describe('PageDots', () => {
  it('is a picture that reads the exact position aloud, which seven dots cannot show, and takes no focus', () => {
    render(<PageDots count={100} value={11} label="Tip" />)
    const row = screen.getByRole('img', { name: 'Tip 12 of 100' })
    expect(row.querySelectorAll('.desk-page-dot')).toHaveLength(7)
    expect(row.querySelectorAll('[data-current]')).toHaveLength(1)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws nothing for a single page', () => {
    const { container } = render(<PageDots count={1} value={0} label="Tip" />)
    expect(container.firstChild).toBeNull()
  })
})
