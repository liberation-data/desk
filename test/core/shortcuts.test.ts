// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addCommandHandler, bindShortcuts, createDesk, formatShortcut, matchesShortcut, parseShortcut } from '../../src/core/index.js'

const key = (key: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
})

describe('parseShortcut', () => {
  it('reads modifiers and names', () => {
    expect(parseShortcut('mod+shift+Z')).toEqual({ key: 'z', mod: true, shift: true, alt: false, ctrl: false })
    expect(parseShortcut('mod+comma').key).toBe(',')
    expect(parseShortcut('esc').key).toBe('escape')
  })
})

describe('matchesShortcut', () => {
  it('treats mod as ⌘ on Apple devices', () => {
    const undo = parseShortcut('mod+z')
    expect(matchesShortcut(key('z', { metaKey: true }), undo, true)).toBe(true)
    expect(matchesShortcut(key('z', { ctrlKey: true }), undo, true)).toBe(false)
  })

  it('treats mod as Ctrl elsewhere', () => {
    const undo = parseShortcut('mod+z')
    expect(matchesShortcut(key('z', { ctrlKey: true }), undo, false)).toBe(true)
    expect(matchesShortcut(key('z', { metaKey: true }), undo, false)).toBe(false)
  })

  it('requires the exact modifiers, so redo is not undo', () => {
    expect(matchesShortcut(key('Z', { metaKey: true, shiftKey: true }), parseShortcut('mod+z'), true)).toBe(false)
    expect(matchesShortcut(key('Z', { metaKey: true, shiftKey: true }), parseShortcut('mod+shift+z'), true)).toBe(true)
  })
})

describe('formatShortcut', () => {
  it('uses glyphs in Apple order', () => {
    expect(formatShortcut('mod+shift+z', true)).toBe('⇧⌘Z')
    expect(formatShortcut('mod+comma', true)).toBe('⌘,')
  })

  it('spells it out elsewhere', () => {
    expect(formatShortcut('mod+shift+z', false)).toBe('Ctrl+Shift+Z')
    expect(formatShortcut('esc', false)).toBe('Esc')
  })
})

describe('bindShortcuts', () => {
  const removers: (() => void)[] = []
  afterEach(() => {
    removers.forEach(remove => remove())
    removers.length = 0
    document.body.innerHTML = ''
  })

  const press = (target: EventTarget, init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }

  it('performs the bound command and prevents the browser default when handled', () => {
    const search = vi.fn()
    removers.push(addCommandHandler(document, 'search', search))
    removers.push(bindShortcuts(createDesk(), { 'mod+k': 'search' }, { target: document, apple: true }))
    const event = press(document.body, { key: 'k', metaKey: true })
    expect(search).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves the browser default alone when nothing handles the command', () => {
    removers.push(bindShortcuts(createDesk(), { 'mod+c': 'copy' }, { target: document, apple: true }))
    expect(press(document.body, { key: 'c', metaKey: true }).defaultPrevented).toBe(false)
  })

  it('does not steal a bare key from a text field', () => {
    const next = vi.fn()
    removers.push(addCommandHandler(document, 'next', next))
    removers.push(bindShortcuts(createDesk(), { j: 'next' }, { target: document, apple: true }))
    document.body.innerHTML = '<input id="field">'
    press(document.getElementById('field') as HTMLElement, { key: 'j' })
    expect(next).not.toHaveBeenCalled()
    press(document.body, { key: 'j' })
    expect(next).toHaveBeenCalledOnce()
  })
})
