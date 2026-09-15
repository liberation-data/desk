import { perform } from './commands.js'
import type { CommandId } from './commands.js'
import type { Desk } from './desk.js'

/*
 * Shortcuts are written once, platform-neutrally — `mod+shift+z` — and mean ⌘ on
 * Apple devices and Ctrl elsewhere. A shortcut performs a command through the
 * responder chain; if nothing handles it, the browser's default is left alone,
 * so ⌘C still copies when no window has claimed Copy.
 */

export type Keymap = Readonly<Record<string, CommandId>>

export interface Shortcut {
  readonly key: string
  readonly mod: boolean
  readonly shift: boolean
  readonly alt: boolean
  readonly ctrl: boolean
}

const NAMES: Readonly<Record<string, string>> = { esc: 'escape', return: 'enter', comma: ',', space: ' ', backquote: '`' }

export function parseShortcut(text: string): Shortcut {
  const parts = text.toLowerCase().split('+')
  const key = parts.pop() ?? ''
  return {
    key: NAMES[key] ?? key,
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    ctrl: parts.includes('ctrl'),
  }
}

export const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)

interface KeyLike {
  readonly key: string
  readonly code?: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
}

const CODES: Readonly<Record<string, string>> = {
  BracketLeft: '[', BracketRight: ']', Backquote: '`', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Minus: '-', Equal: '=', Backslash: '\\', Space: ' ',
}

/** The unmodified key a physical key stands for: ⌥ on a Mac turns `]` into `‘`, but the code is still BracketRight. */
const keyFromCode = (code: string | undefined) =>
  !code ? undefined
  : code.startsWith('Key') ? code.slice(3).toLowerCase()
  : code.startsWith('Digit') ? code.slice(5)
  : CODES[code]

export function matchesShortcut(event: KeyLike, shortcut: Shortcut, apple = isApplePlatform()): boolean {
  const wantMeta = apple && shortcut.mod
  const wantCtrl = shortcut.ctrl || (!apple && shortcut.mod)
  return (
    (event.key.toLowerCase() === shortcut.key || keyFromCode(event.code) === shortcut.key) &&
    event.metaKey === wantMeta &&
    event.ctrlKey === wantCtrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt
  )
}

const GLYPHS: Readonly<Record<string, string>> = {
  escape: 'Esc', enter: '↩', ',': ',', ' ': 'Space', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', backspace: '⌫', '`': '`',
}

/** How a menu shows a shortcut: `⇧⌘Z` on Apple devices, `Ctrl+Shift+Z` elsewhere. */
export function formatShortcut(text: string, apple = isApplePlatform()): string {
  const s = parseShortcut(text)
  const key = GLYPHS[s.key] ?? s.key.toUpperCase()
  if (apple) return `${s.ctrl ? '⌃' : ''}${s.alt ? '⌥' : ''}${s.shift ? '⇧' : ''}${s.mod ? '⌘' : ''}${key}`
  return [s.ctrl || s.mod ? 'Ctrl' : '', s.alt ? 'Alt' : '', s.shift ? 'Shift' : '', key].filter(Boolean).join('+')
}

const isEditable = (target: EventTarget | null) =>
  target instanceof Element && (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null)

export interface ShortcutOptions {
  readonly target?: EventTarget
  readonly apple?: boolean
}

/** Performs commands from keyboard shortcuts. Returns a function that stops listening. */
export function bindShortcuts(desk: Desk | null, keymap: Keymap, options: ShortcutOptions = {}): () => void {
  const target = options.target ?? globalThis
  const bindings = Object.entries(keymap).map(([text, command]) => ({ shortcut: parseShortcut(text), command }))

  const onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent
    if (key.defaultPrevented || key.isComposing) return
    const binding = bindings.find(b => matchesShortcut(key, b.shortcut, options.apple))
    if (!binding) return
    // A bare key belongs to whatever is being typed into; a modified one can still be a command.
    const plain = !binding.shortcut.mod && !binding.shortcut.ctrl && !binding.shortcut.alt
    if (plain && isEditable(key.target)) return
    if (perform(desk, binding.command)) key.preventDefault()
  }

  target.addEventListener('keydown', onKeyDown)
  return () => target.removeEventListener('keydown', onKeyDown)
}
