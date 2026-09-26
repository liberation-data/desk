// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { DeskProvider, Desktop, useWindowProgress } from '../../src/react/index.js'
import type { WindowProgress } from '../../src/react/index.js'

afterEach(cleanup)

let report: (p: WindowProgress | null) => void = () => {}
let took: boolean | null = null

function Steps({ initial }: { readonly initial: WindowProgress | null }) {
  const [progress, setProgress] = useState(initial)
  report = setProgress
  took = useWindowProgress(progress)
  return <p>steps</p>
}

const mount = (initial: WindowProgress | null) => {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <Desktop title={id => id} renderWindow={id => (id === 'next' ? <Steps initial={initial} /> : <p>{id}</p>)} />
    </DeskProvider>,
  )
  act(() => {
    desk.open('next')
    desk.open('logs')
  })
  return desk
}

describe('a window’s progress', () => {
  it('is drawn in the title bar of the window that reported it, and only that one', () => {
    mount({ value: 3, max: 8, label: 'Steps done' })
    const bar = screen.getByRole('progressbar', { name: 'Steps done' })
    expect(bar.getAttribute('aria-valuenow')).toBe('3')
    expect(bar.getAttribute('aria-valuemax')).toBe('8')
    expect(bar.getAttribute('aria-valuetext')).toBe('3 of 8')
    expect(bar.closest('.desk-titlebar')?.textContent).toContain('next')
    expect(document.querySelectorAll('.desk-window-progress')).toHaveLength(1)
    expect(took).toBe(true)
  })

  it('follows the count, and leaves when the window reports null', () => {
    mount({ value: 3, max: 8, label: 'Steps done' })
    act(() => report({ value: 4, max: 8, label: 'Steps done' }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4')
    act(() => report(null))
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('leaves with the window', () => {
    const desk = mount({ value: 1, max: 2, label: 'Steps done' })
    act(() => desk.close('next'))
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('draws a count past its end as the end', () => {
    mount({ value: 9, max: 8, label: 'Steps done' })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('8')
  })

  it('tells content outside any window that nothing took it, so it can draw the count itself', () => {
    render(<Steps initial={{ value: 1, max: 2, label: 'Steps done' }} />)
    expect(took).toBe(false)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
