// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createService } from '../../src/core/index.js'
import { DeskProvider, DeskShell, useService, useServiceValue } from '../../src/react/index.js'

afterEach(cleanup)

describe('services on a desk', () => {
  it('are held by the desk from mount to unmount', () => {
    const rides = createService({ id: 'rides', initial: 0 })
    const parts = createService({ id: 'parts', initial: 0 })
    const { unmount } = render(<DeskProvider services={[rides, parts]}>desk</DeskProvider>)
    expect([rides.running(), parts.running()]).toEqual([true, true])
    unmount()
    expect([rides.running(), parts.running()]).toEqual([false, false])
  })

  it('are held by the shell the same way', () => {
    const rides = createService({ id: 'rides', initial: 0 })
    const { unmount } = render(<DeskShell services={[rides]}>desk</DeskShell>)
    expect(rides.running()).toBe(true)
    unmount()
    expect(rides.running()).toBe(false)
  })

  it('are not released and held again when the desk re-renders with a new array', () => {
    let starts = 0
    const rides = createService({ id: 'rides', initial: 0, run: () => void (starts += 1) })
    const { rerender } = render(<DeskProvider services={[rides]}>one</DeskProvider>)
    rerender(<DeskProvider services={[rides]}>two</DeskProvider>)
    expect(starts).toBe(1)
  })

  it('give a window their value as soon as it is drawn, with the desk already running them', () => {
    const rides = createService({ id: 'rides', initial: 'loading', run: ({ set }) => set('3 rides') })
    const Rides = () => <p>{useService(rides)}</p>
    render(
      <DeskProvider services={[rides]}>
        <Rides />
      </DeskProvider>,
    )
    expect(screen.getByText('3 rides')).toBeTruthy()
  })
})

describe('reading a service', () => {
  it('holds it while mounted with useService, and re-renders on a new value', () => {
    const rides = createService({ id: 'rides', initial: 'a' })
    const Rides = () => <p>{useService(rides)}</p>
    const { unmount } = render(<Rides />)
    expect(rides.running()).toBe(true)
    act(() => rides.set('b'))
    expect(screen.getByText('b')).toBeTruthy()
    unmount()
    expect(rides.running()).toBe(false)
  })

  it('does not hold it with useServiceValue', () => {
    const rides = createService({ id: 'rides', initial: 'a' })
    const Badge = () => <p>{useServiceValue(rides)}</p>
    render(<Badge />)
    expect(rides.running()).toBe(false)
    act(() => rides.set('b'))
    expect(screen.getByText('b')).toBeTruthy()
  })
})
