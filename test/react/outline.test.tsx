// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Outline, OUTLINE_MAX_DEPTH } from '../../src/react/index.js'
import type { OutlineRow } from '../../src/react/index.js'

afterEach(cleanup)

const ROWS: OutlineRow[] = [
  { id: 'guide', label: 'Field Guide', depth: 1 },
  { id: 'water', label: 'Finding water', depth: 2 },
  { id: 'camp', label: 'Making camp', depth: 2 },
  { id: 'fire', label: 'Fire', depth: 3 },
  { id: 'kit', label: 'Kit list', depth: 3, disabled: true },
  { id: 'weather', label: 'Reading the weather', depth: 1 },
  { id: 'clouds', label: 'Clouds', depth: 2 },
]

function Held({ rows = ROWS, start = 'guide', onChange = () => {} }: { rows?: OutlineRow[]; start?: string | null; onChange?: (id: string) => void }) {
  const [value, setValue] = useState<string | null>(start)
  return <Outline label="Sections" rows={rows} value={value} onChange={id => { setValue(id); onChange(id) }} />
}

const row = (name: string) => screen.getByRole('treeitem', { name })
const chosen = () => screen.getAllByRole('treeitem').find(item => item.getAttribute('aria-selected') === 'true')?.textContent

describe('Outline', () => {
  it('is a tree whose rows say how deep they sit', () => {
    render(<Held />)
    expect(screen.getByRole('tree', { name: 'Sections' })).toBeTruthy()
    expect(screen.getAllByRole('treeitem').map(item => item.getAttribute('aria-level'))).toEqual(['1', '2', '2', '3', '3', '1', '2'])
    expect(row('Field Guide').getAttribute('aria-selected')).toBe('true')
  })

  it('marks the rows on show along with the chosen one, and keeps the keyboard on the chosen one', () => {
    render(<Outline label="Sections" rows={ROWS} value="guide" showing={['water', 'camp']} onChange={() => {}} />)
    const marked = screen.getAllByRole('treeitem').filter(item => item.getAttribute('aria-selected') === 'true')
    expect(marked.map(item => item.textContent)).toEqual(['Field Guide', 'Finding water', 'Making camp'])
    expect(row('Finding water').hasAttribute('data-showing')).toBe(true)
    expect(row('Field Guide').hasAttribute('data-showing')).toBe(false) // it is the chosen row, and says so
    expect(screen.getByRole('tree').getAttribute('aria-multiselectable')).toBe('true')
    expect(screen.getAllByRole('treeitem').filter(item => item.tabIndex === 0).map(item => item.textContent)).toEqual(['Field Guide'])
  })

  it('says nothing about several rows when only one is on show', () => {
    render(<Held />)
    expect(screen.getByRole('tree').hasAttribute('aria-multiselectable')).toBe(false)
  })

  it('chooses a row on a press', () => {
    const onChange = vi.fn()
    render(<Held onChange={onChange} />)
    fireEvent.click(row('Fire'))
    expect(onChange).toHaveBeenCalledWith('fire')
    expect(chosen()).toBe('Fire')
  })

  it('is one tab stop, on the chosen row', () => {
    render(<Held start="camp" />)
    expect(screen.getAllByRole('treeitem').filter(item => item.tabIndex === 0).map(item => item.textContent)).toEqual(['Making camp'])
  })

  it('still has a tab stop when nothing is chosen', () => {
    render(<Held start={null} />)
    expect(screen.getAllByRole('treeitem').filter(item => item.tabIndex === 0).map(item => item.textContent)).toEqual(['Field Guide'])
  })

  it('moves down and up through the rows that can be chosen, and stops at the ends', () => {
    render(<Held start="fire" />)
    row('Fire').focus()
    fireEvent.keyDown(row('Fire'), { key: 'ArrowDown' })
    expect(chosen()).toBe('Reading the weather') // Kit list has nothing to open
    fireEvent.keyDown(row('Reading the weather'), { key: 'End' })
    expect(chosen()).toBe('Clouds')
    fireEvent.keyDown(row('Clouds'), { key: 'ArrowDown' })
    expect(chosen()).toBe('Clouds')
    fireEvent.keyDown(row('Clouds'), { key: 'Home' })
    expect(chosen()).toBe('Field Guide')
    fireEvent.keyDown(row('Field Guide'), { key: 'ArrowUp' })
    expect(chosen()).toBe('Field Guide')
  })

  it('goes out to what a row sits inside, and in to what sits inside it', () => {
    render(<Held start="fire" />)
    row('Fire').focus()
    fireEvent.keyDown(row('Fire'), { key: 'ArrowLeft' })
    expect(chosen()).toBe('Making camp')
    fireEvent.keyDown(row('Making camp'), { key: 'ArrowLeft' })
    expect(chosen()).toBe('Field Guide')
    fireEvent.keyDown(row('Field Guide'), { key: 'ArrowRight' })
    expect(chosen()).toBe('Finding water')
    // Finding water has nothing inside it: right does not wander into the next heading.
    fireEvent.keyDown(row('Finding water'), { key: 'ArrowRight' })
    expect(chosen()).toBe('Finding water')
  })

  it('lists a row with nothing to open, and does not choose it', () => {
    const onChange = vi.fn()
    render(<Held onChange={onChange} />)
    expect((row('Kit list') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(row('Kit list'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stops drawing depth at the fourth level, while still saying the real one', () => {
    const deep = [1, 2, 3, 4, 5, 9].map(depth => ({ id: `d${depth}`, label: `Level ${depth}`, depth }))
    render(<Held rows={deep} start="d1" />)
    expect(OUTLINE_MAX_DEPTH).toBe(4)
    expect(screen.getAllByRole('treeitem').map(item => item.getAttribute('data-depth'))).toEqual(['1', '2', '3', '4', '4', '4'])
    expect(row('Level 9').getAttribute('aria-level')).toBe('9')
  })

  it('carries the whole title, for a row too long for its line', () => {
    const long = 'A heading that runs on well past the width of any outline it could be shown in'
    render(<Held rows={[{ id: 'long', label: long, depth: 1 }]} start="long" />)
    expect(row(long).getAttribute('title')).toBe(long)
  })
})
