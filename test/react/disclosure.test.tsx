// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Chip, Disclosure } from '../../src/react/index.js'

afterEach(cleanup)

function Filters() {
  const [open, setOpen] = useState(false)
  return (
    <Disclosure label="Filter" open={open} onOpenChange={setOpen} summary={<Chip>tagged contracts</Chip>}>
      <input aria-label="From" defaultValue="2026-01-01" />
    </Disclosure>
  )
}

describe('Disclosure', () => {
  it('folds its body behind one button, and says so', () => {
    render(<Filters />)
    const toggle = screen.getByRole('button', { name: 'Filter' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(body?.hidden).toBe(true)

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(body?.hidden).toBe(false)
  })

  it('keeps the summary on the line whether folded or open', () => {
    const { container } = render(<Filters />)
    const head = container.querySelector('.desk-disclosure-head')
    expect(head?.textContent).toContain('tagged contracts')
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(head?.textContent).toContain('tagged contracts')
  })

  it('keeps a folded field mounted, so what it holds is not lost', () => {
    render(<Filters />)
    const field = screen.getByLabelText('From') as HTMLInputElement
    fireEvent.change(field, { target: { value: '2026-03-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-03-01')
  })
})

describe('Chip', () => {
  it('is plain words when there is nothing to take away', () => {
    const { container } = render(<Chip>contracts</Chip>)
    expect(container.querySelector('.desk-chip')?.textContent).toBe('contracts')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ends in a × named for what it removes', () => {
    const onRemove = vi.fn()
    render(<Chip onRemove={onRemove} removeLabel="Clear the tag">tagged contracts</Chip>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear the tag' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('keeps the class an app gives it', () => {
    const { container } = render(<Chip className="mine">x</Chip>)
    expect(container.querySelector('.desk-chip')?.classList.contains('mine')).toBe(true)
  })
})
