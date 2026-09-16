import { describe, expect, it, vi } from 'vitest'
import { createBus, topicMatches } from '../../src/core/index.js'

describe('topicMatches', () => {
  it('takes an exact topic, a branch, or everything', () => {
    expect(topicMatches('ride.selected', 'ride.selected')).toBe(true)
    expect(topicMatches('ride.*', 'ride.selected')).toBe(true)
    expect(topicMatches('ride.*', 'ride')).toBe(true)
    expect(topicMatches('*', 'anything.at.all')).toBe(true)
    expect(topicMatches('ride.*', 'rides.selected')).toBe(false)
    expect(topicMatches('ride.selected', 'ride.deleted')).toBe(false)
  })
})

describe('bus', () => {
  it('delivers to subscribers of the topic and its branch, and nobody else', () => {
    const bus = createBus()
    const exact = vi.fn()
    const branch = vi.fn()
    const other = vi.fn()
    bus.subscribe('ride.selected', exact)
    bus.subscribe('ride.*', branch)
    bus.subscribe('part.*', other)
    bus.publish('ride.selected', { id: '1' }, { from: 'rides' })
    expect(exact).toHaveBeenCalledOnce()
    expect(branch).toHaveBeenCalledOnce()
    expect(other).not.toHaveBeenCalled()
  })

  it('says what happened, where it came from, and when', () => {
    const bus = createBus()
    const heard = vi.fn()
    bus.subscribe('ride.selected', heard)
    const published = bus.publish('ride.selected', { id: '1' }, { from: 'rides' })
    expect(heard).toHaveBeenCalledWith(published)
    expect(published).toMatchObject({ topic: 'ride.selected', payload: { id: '1' }, from: 'rides' })
    expect(published.at).toBeTypeOf('number')
  })

  it('has no sender when nothing published it from a window', () => {
    const bus = createBus()
    expect(bus.publish('app.started', null).from).toBeNull()
  })

  it('replays the last event to a late subscriber that asks', () => {
    const bus = createBus()
    bus.publish('ride.selected', { id: '1' })
    const late = vi.fn()
    bus.subscribe('ride.selected', late, { replay: true })
    expect(late).toHaveBeenCalledOnce()
    const quiet = vi.fn()
    bus.subscribe('ride.selected', quiet)
    expect(quiet).not.toHaveBeenCalled()
  })

  it('replays the most recent event on a branch', () => {
    const bus = createBus()
    bus.publish('ride.selected', { id: '1' })
    bus.publish('ride.deleted', { id: '2' })
    const late = vi.fn()
    bus.subscribe('ride.*', late, { replay: true })
    expect(late.mock.calls[0]?.[0]).toMatchObject({ topic: 'ride.deleted' })
  })

  it('stops delivering once unsubscribed, even mid-delivery', () => {
    const bus = createBus()
    const second = vi.fn()
    const stopSecond = bus.subscribe('ride.selected', second)
    bus.subscribe('ride.selected', () => stopSecond())
    bus.publish('ride.selected', { id: '1' })
    expect(second).toHaveBeenCalledTimes(1)
    bus.publish('ride.selected', { id: '2' })
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('remembers the last event on a topic', () => {
    const bus = createBus()
    expect(bus.last('ride.selected')).toBeUndefined()
    bus.publish('ride.selected', { id: '1' })
    expect(bus.last<{ id: string }>('ride.selected')?.payload).toEqual({ id: '1' })
  })
})
