// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attended, attentionOn, becomesNews, createDesk, watchAttention } from '../../src/core/index.js'

/** The tab is in front, or it is not: jsdom says the tab is visible and unfocused by default. */
function looking(at: boolean) {
  document.hasFocus = () => at
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !at })
}

afterEach(() => looking(true))

describe('attention', () => {
  it('means the window is in front, the tab visible and the browser focused', () => {
    const at = { counted: true, front: true, visible: true, focused: true }
    expect(attended(at)).toBe(true)
    // A window in full view behind somebody's editor is not being looked at.
    expect(attended({ ...at, focused: false })).toBe(false)
    expect(attended({ ...at, visible: false })).toBe(false)
    expect(attended({ ...at, front: false })).toBe(false)

    expect(becomesNews(at)).toBe(false)
    expect(becomesNews({ ...at, front: false })).toBe(true)
    // Nothing is drawing the count, so counting would only store a surprise.
    expect(becomesNews({ ...at, counted: false, front: false })).toBe(false)
  })

  it('reads the key window from the desk and the rest from the page', () => {
    looking(true)
    const desk = createDesk()
    desk.open('chat')
    desk.open('rides')
    expect(attentionOn(desk, 'rides')).toEqual({ counted: true, front: true, visible: true, focused: true })
    expect(attentionOn(desk, 'chat').front).toBe(false)
    expect(attentionOn(desk, 'rides', false).counted).toBe(false)

    looking(false)
    expect(attentionOn(desk, 'rides')).toMatchObject({ front: true, visible: false, focused: false })
  })

  it('fires at once when the window is being looked at, and on each of the three ways back', () => {
    looking(true)
    const desk = createDesk()
    desk.open('chat')
    const seen = vi.fn()
    const stop = watchAttention(desk, 'chat', seen)
    expect(seen).toHaveBeenCalledTimes(1)

    // Another window takes the front, and chat is brought back: a desk change.
    desk.open('rides')
    expect(seen).toHaveBeenCalledTimes(1)
    desk.focus('chat')
    expect(seen).toHaveBeenCalledTimes(2)

    // Away in another tab, and back: a visibility change.
    looking(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(seen).toHaveBeenCalledTimes(2)
    looking(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(seen).toHaveBeenCalledTimes(3)

    // Away in another application, and back: a window focus, with no desk change at all.
    window.dispatchEvent(new Event('focus'))
    expect(seen).toHaveBeenCalledTimes(4)

    stop()
    window.dispatchEvent(new Event('focus'))
    desk.focus('rides')
    desk.focus('chat')
    expect(seen).toHaveBeenCalledTimes(4)
  })
})
