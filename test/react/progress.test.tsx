// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Loading, Spinner } from '../../src/react/index.js'

afterEach(cleanup)

describe('Spinner', () => {
  it('says what is being waited for, without showing the words', () => {
    render(<Spinner label="Loading the conversation" />)
    // The mark carries no words of its own, so the wait is only reachable at all through this.
    expect(screen.getByRole('status').textContent).toBe('Loading the conversation')
    expect(screen.getByText('Loading the conversation').hasAttribute('data-hidden')).toBe(true)
  })

  it('shows the words when asked, and then does not hide them', () => {
    render(<Spinner label="Saving" showLabel />)
    expect(screen.getByText('Saving').hasAttribute('data-hidden')).toBe(false)
  })

  it('draws the mark at the size asked for, and keeps it out of the reading', () => {
    const { container } = render(<Spinner label="Working" size="small" />)
    const ring = container.querySelector('.desk-spinner-ring')
    expect(ring?.getAttribute('data-size')).toBe('small')
    expect(ring?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('Loading', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows what is on its way, and nothing else yet', () => {
    render(<Loading label="Reading what your realms brought" slow="Still reading." />)
    expect(screen.getByRole('status').textContent).toBe('Reading what your realms brought')
    expect(screen.queryByText('Still reading.')).toBeNull()
  })

  it('explains itself once the wait passes three seconds', () => {
    render(<Loading label="Loading the realms" slow="The directory is being fetched." />)
    act(() => { vi.advanceTimersByTime(2999) })
    expect(screen.queryByText('The directory is being fetched.')).toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    // Inside the same live region, so its arrival is the announcement.
    expect(screen.getByRole('status').textContent).toContain('The directory is being fetched.')
  })

  it('never explains a wait that was given nothing to say', () => {
    render(<Loading label="Loading" />)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(screen.getByRole('status').textContent).toBe('Loading')
  })

  it('waits again when the panel changes what it is waiting for', () => {
    const { rerender } = render(<Loading label="First" slow="First is slow." />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('First is slow.')).toBeTruthy()
    rerender(<Loading label="Second" slow="Second is slow." />)
    // The new wait has just started; inheriting the old expired timer would explain it at once.
    expect(screen.queryByText('Second is slow.')).toBeNull()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('Second is slow.')).toBeTruthy()
  })
})
