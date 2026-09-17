// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { DeskProvider, Desktop } from '../../src/react/index.js'

afterEach(cleanup)

const mount = (note?: (id: string) => string | null) => {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <Desktop title={id => id} {...(note ? { note } : {})} renderWindow={id => <p>{id} body</p>} />
    </DeskProvider>,
  )
  act(() => {
    desk.open('logs')
    desk.open('rides')
  })
  return desk
}

describe('a window note', () => {
  it('says what each window is looking at, in its own title bar', () => {
    mount(id => (id === 'logs' ? 'GET /api/v1/admin/logs' : '128 rides'))
    const bars = document.querySelectorAll('.desk-window-note')
    expect([...bars].map(b => b.textContent)).toEqual(['GET /api/v1/admin/logs', '128 rides'])
  })

  it('is absent from a window with nothing to say, and from a desk with no note at all', () => {
    mount(id => (id === 'logs' ? 'GET /api/v1/admin/logs' : null))
    expect(document.querySelectorAll('.desk-window-note')).toHaveLength(1)
    cleanup()
    mount()
    expect(document.querySelectorAll('.desk-window-note')).toHaveLength(0)
  })

  it('does not take the window’s name from what reads it', () => {
    mount(() => 'GET /api/v1/admin/logs')
    expect(screen.getByRole('region', { name: 'logs' })).toBeTruthy()
  })
})
