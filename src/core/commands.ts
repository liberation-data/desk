import { focusedId, onDesk } from './desk.js'
import type { Desk } from './desk.js'

/*
 * The responder chain, built from the DOM rather than beside it.
 *
 * A command that names no target — Copy, Close, text typed into the desk's input
 * bar — is dispatched as an event from the start of the chain and bubbles up
 * through ancestors: focused element → its window → the stage → the document.
 * The first element with a handler for that command decides. Menus ask the same
 * chain whether a command can be performed before they draw an item enabled.
 *
 * Deciding is AppKit's rule: the first responder that implements a command is
 * its target, and its answer stands. A disabled handler stops the command rather
 * than letting it fall through to something further up the chain.
 */

export type CommandId = string

/** Marks a window's element, so the chain can start at the key window. */
export const WINDOW_ATTRIBUTE = 'data-desk-window'
/** Marks the stage, the desk-level responder. */
export const STAGE_ATTRIBUTE = 'data-desk-stage'

const PERFORM = 'desk:perform'
const QUERY = 'desk:can-perform'

interface PerformDetail {
  readonly command: CommandId
  readonly args: unknown
  handled: boolean
}

interface QueryDetail {
  readonly command: CommandId
  enabled: boolean | undefined
}

export type CommandHandler<Args = unknown> = (args: Args) => void

export interface CommandOptions {
  /** Whether the handler can act right now. Asked before performing and when a menu opens. Default: always. */
  readonly enabled?: () => boolean
}

/**
 * Makes `element` a responder for `command`. Returns a function that removes it.
 * Attach to `document` for an app-level responder.
 */
export function addCommandHandler<Args = unknown>(
  element: EventTarget,
  command: CommandId,
  handler: CommandHandler<Args>,
  options: CommandOptions = {},
): () => void {
  const enabled = options.enabled ?? (() => true)

  const onPerform = (event: Event) => {
    const detail = (event as CustomEvent<PerformDetail>).detail
    if (detail.command !== command) return
    event.stopPropagation()
    if (!enabled()) return
    detail.handled = true
    handler(detail.args as Args)
  }

  const onQuery = (event: Event) => {
    const detail = (event as CustomEvent<QueryDetail>).detail
    if (detail.command !== command) return
    event.stopPropagation()
    detail.enabled = enabled()
  }

  element.addEventListener(PERFORM, onPerform)
  element.addEventListener(QUERY, onQuery)
  return () => {
    element.removeEventListener(PERFORM, onPerform)
    element.removeEventListener(QUERY, onQuery)
  }
}

export interface ChainOptions {
  /** Start here instead of at the focused element. */
  readonly from?: Element | null
  readonly document?: Document
}

/** Where a command starts: focus inside the key window, else the key window, else the stage, else the document. */
export function chainStart(desk: Desk | null, options: ChainOptions = {}): EventTarget {
  if (options.from) return options.from
  const doc = options.document ?? globalThis.document
  const key = desk ? focusedId(desk.getState()) : null
  const window = key ? windowElement(doc, key) : null
  const active = doc.activeElement
  if (window && active && window.contains(active)) return active
  return window ?? doc.querySelector(`[${STAGE_ATTRIBUTE}]`) ?? doc
}

export const windowElement = (doc: ParentNode, id: string): Element | null =>
  [...doc.querySelectorAll(`[${WINDOW_ATTRIBUTE}]`)].find(el => el.getAttribute(WINDOW_ATTRIBUTE) === id) ?? null

/** Sends a command along the chain. Returns whether anything handled it. */
export function perform<Args = unknown>(desk: Desk | null, command: CommandId, args?: Args, options: ChainOptions = {}): boolean {
  const detail: PerformDetail = { command, args, handled: false }
  chainStart(desk, options).dispatchEvent(new CustomEvent(PERFORM, { detail, bubbles: true, composed: true }))
  return detail.handled
}

/** Asks the chain whether a command would be handled right now. */
export function canPerform(desk: Desk | null, command: CommandId, options: ChainOptions = {}): boolean {
  const detail: QueryDetail = { command, enabled: undefined }
  chainStart(desk, options).dispatchEvent(new CustomEvent(QUERY, { detail, bubbles: true, composed: true }))
  return detail.enabled ?? false
}

/** The commands the desk itself answers, at the stage. */
export const DeskCommands = {
  closeWindow: 'desk.window.close',
  /** Fills the key window, or frees it: the green control. */
  zoomWindow: 'desk.window.zoom',
  /** Takes the key window off the desk, still open and still loaded: the amber control. */
  minimizeWindow: 'desk.window.minimize',
  /** Answered by a mounted Desktop, which knows the space windows are laid out in. */
  arrange: 'desk.window.arrange',
  nextWindow: 'desk.window.next',
  previousWindow: 'desk.window.previous',
} as const

export function addDeskCommands(stage: EventTarget, desk: Desk): () => void {
  const key = () => focusedId(desk.getState())
  // Only the windows on the desk: cycling through a minimized one would drag it back out by the way.
  const cycle = (step: 1 | -1) => {
    const windows = onDesk(desk.getState())
    if (!windows.length) return
    const current = windows.findIndex(w => w.id === key())
    const next = windows[(current + step + windows.length) % windows.length]
    if (next) desk.focus(next.id)
  }
  const removers = [
    addCommandHandler(stage, DeskCommands.closeWindow, () => { const id = key(); if (id) desk.close(id) }, { enabled: () => key() !== null }),
    addCommandHandler(stage, DeskCommands.zoomWindow, () => { const id = key(); if (id) desk.toggleMode(id) }, { enabled: () => key() !== null }),
    addCommandHandler(stage, DeskCommands.minimizeWindow, () => { const id = key(); if (id) desk.minimize(id) }, { enabled: () => key() !== null }),
    addCommandHandler(stage, DeskCommands.nextWindow, () => cycle(1), { enabled: () => onDesk(desk.getState()).length > 1 }),
    addCommandHandler(stage, DeskCommands.previousWindow, () => cycle(-1), { enabled: () => onDesk(desk.getState()).length > 1 }),
  ]
  return () => removers.forEach(remove => remove())
}
