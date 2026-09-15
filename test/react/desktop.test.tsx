// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk, focusedId } from '../../src/core/index.js'
import { Desktop, DeskProvider } from '../../src/react/index.js'

afterEach(cleanup)

const TITLES: Record<string, string> = { notes: 'Notes', clock: 'Clock', inspector: 'Inspector' }

function mount() {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <Desktop
        title={id => TITLES[id]}
        renderWindow={id => <p>{`${TITLES[id]} body`}</p>}
        empty={<p>Nothing open</p>}
      />
    </DeskProvider>,
  )
  return desk
}

describe('Desktop', () => {
  it('shows the empty state until a window opens', () => {
    const desk = mount()
    expect(screen.getByText('Nothing open')).toBeTruthy()
    act(() => desk.open('notes'))
    expect(screen.queryByText('Nothing open')).toBeNull()
    expect(screen.getByRole('region', { name: 'Notes' })).toBeTruthy()
    expect(screen.getByText('Notes body')).toBeTruthy()
  })

  it('closes a window from its close button', () => {
    const desk = mount()
    act(() => desk.open('notes'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(desk.getState().windows).toHaveLength(0)
  })

  it('floats and tiles from the mode button', () => {
    const desk = mount()
    act(() => desk.open('notes'))
    fireEvent.click(screen.getByRole('button', { name: 'Float' }))
    expect(screen.getByRole('region', { name: 'Notes' }).dataset.mode).toBe('floating')
    fireEvent.click(screen.getByRole('button', { name: 'Tile' }))
    expect(screen.getByRole('region', { name: 'Notes' }).dataset.mode).toBe('tiled')
  })

  it('focuses a window when it is pressed', () => {
    const desk = mount()
    act(() => {
      desk.open('notes')
      desk.open('clock')
    })
    fireEvent.pointerDown(screen.getByText('Notes body'))
    expect(focusedId(desk.getState())).toBe('notes')
    expect(screen.getByRole('region', { name: 'Notes' }).dataset.focused).toBe('true')
  })

  it('keeps each window’s DOM when focus changes', () => {
    const desk = mount()
    act(() => {
      desk.open('notes')
      desk.open('clock')
    })
    const body = screen.getByText('Notes body')
    act(() => desk.focus('notes'))
    expect(screen.getByText('Notes body')).toBe(body)
  })
})
