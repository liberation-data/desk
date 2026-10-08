import { describe, expect, it, vi } from 'vitest'
import { createService, holdAll } from '../../src/core/index.js'

describe('service', () => {
  it('runs from its first hold to its last release, and not twice for two holders', () => {
    const log: string[] = []
    const service = createService({
      id: 'counted',
      initial: 0,
      run: () => {
        log.push('start')
        return () => log.push('stop')
      },
    })
    expect(service.running()).toBe(false)
    expect(log).toEqual([])

    const desk = service.hold()
    const reader = service.hold()
    expect(log).toEqual(['start'])

    // The other holder still needs it, and a release given twice counts once.
    desk()
    desk()
    expect(log).toEqual(['start'])
    expect(service.running()).toBe(true)

    reader()
    expect(log).toEqual(['start', 'stop'])
    expect(service.running()).toBe(false)

    service.hold()()
    expect(log).toEqual(['start', 'stop', 'start', 'stop'])
  })

  it('tells readers a new value, not the same value set again', () => {
    const service = createService({ id: 'heard', initial: 0 })
    const heard = vi.fn()
    const stop = service.subscribe(heard)
    service.set(1)
    service.set(1)
    expect(service.now()).toBe(1)
    expect(heard).toHaveBeenCalledOnce()
    stop()
    service.set(2)
    expect(heard).toHaveBeenCalledOnce()
  })

  it('tells a run that it was stopped, so an answer that lands late can be dropped', () => {
    let answer: (value: string) => void = () => {}
    const service = createService({
      id: 'late',
      initial: 'unread',
      run: ({ set, live }) => {
        answer = value => {
          if (live()) set(value)
        }
      },
    })
    const release = service.hold()
    const first = answer
    release()
    first('from a run that has ended')
    expect(service.now()).toBe('unread')

    service.hold()
    answer('from the run that is live')
    expect(service.now()).toBe('from the run that is live')
  })

  it('is a value with no process when it is given none', () => {
    const service = createService({ id: 'count', initial: 0 })
    const release = service.hold()
    expect(service.running()).toBe(true)
    service.set(3)
    release()
    // Stopping forgets nothing by itself: a process that wants that sets it on the way out.
    expect(service.now()).toBe(3)
  })

  it('holds several at once behind one release', () => {
    const a = createService({ id: 'a', initial: 0 })
    const b = createService({ id: 'b', initial: '' })
    const release = holdAll([a, b])
    expect([a.running(), b.running()]).toEqual([true, true])
    release()
    expect([a.running(), b.running()]).toEqual([false, false])
  })
})
