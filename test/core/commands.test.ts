// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addCommandHandler,
  addDeskCommands,
  canPerform,
  chainStart,
  createDesk,
  DeskCommands,
  focusedId,
  perform,
  STAGE_ATTRIBUTE,
  WINDOW_ATTRIBUTE,
} from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'

/*
 * <div data-desk-stage>
 *   <section data-desk-window="notes"><input id="field"></section>
 *   <section data-desk-window="map"><button id="zoom"></section>
 * </div>
 */
let desk: Desk
let stage: HTMLElement
let notes: HTMLElement
let map: HTMLElement
let field: HTMLInputElement
let removers: (() => void)[]

const on = (...args: Parameters<typeof addCommandHandler>) => removers.push(addCommandHandler(...args))

beforeEach(() => {
  document.body.innerHTML = `
    <div ${STAGE_ATTRIBUTE}>
      <section ${WINDOW_ATTRIBUTE}="notes" tabindex="-1"><input id="field"></section>
      <section ${WINDOW_ATTRIBUTE}="map" tabindex="-1"><button id="zoom"></button></section>
    </div>
    <button id="outside"></button>`
  stage = document.querySelector(`[${STAGE_ATTRIBUTE}]`) as HTMLElement
  notes = document.querySelector('[data-desk-window="notes"]') as HTMLElement
  map = document.querySelector('[data-desk-window="map"]') as HTMLElement
  field = document.getElementById('field') as HTMLInputElement
  desk = createDesk()
  desk.open('notes')
  desk.open('map')
  removers = []
})

afterEach(() => removers.forEach(remove => remove()))

describe('chainStart', () => {
  it('starts at the key window when focus is elsewhere', () => {
    ;(document.getElementById('outside') as HTMLElement).focus()
    expect(chainStart(desk)).toBe(map)
  })

  it('starts at the focused element when it is inside the key window', () => {
    desk.focus('notes')
    field.focus()
    expect(chainStart(desk)).toBe(field)
  })

  it('does not start inside a window that is not key', () => {
    field.focus()
    expect(chainStart(desk)).toBe(map)
  })

  it('starts at the stage when no window is open', () => {
    desk.closeAll()
    expect(chainStart(desk)).toBe(stage)
  })
})

describe('perform', () => {
  it('reaches the nearest responder and stops there', () => {
    desk.focus('notes')
    field.focus()
    const inField = vi.fn()
    const inWindow = vi.fn()
    on(field, 'copy', inField)
    on(notes, 'copy', inWindow)
    expect(perform(desk, 'copy')).toBe(true)
    expect(inField).toHaveBeenCalledOnce()
    expect(inWindow).not.toHaveBeenCalled()
  })

  it('bubbles past elements that do not answer the command', () => {
    const atApp = vi.fn()
    on(document, 'search', atApp)
    expect(perform(desk, 'search', { query: 'chain' })).toBe(true)
    expect(atApp).toHaveBeenCalledWith({ query: 'chain' })
  })

  it('reports false when nothing answers', () => {
    expect(perform(desk, 'nothing-here')).toBe(false)
  })

  it('lets a disabled responder stop the command rather than fall through', () => {
    const inWindow = vi.fn()
    const atApp = vi.fn()
    on(map, 'copy', inWindow, { enabled: () => false })
    on(document, 'copy', atApp)
    expect(perform(desk, 'copy')).toBe(false)
    expect(inWindow).not.toHaveBeenCalled()
    expect(atApp).not.toHaveBeenCalled()
  })

  it('follows the key window as it changes', () => {
    const inNotes = vi.fn()
    const inMap = vi.fn()
    on(notes, 'zoom', inNotes)
    on(map, 'zoom', inMap)
    perform(desk, 'zoom')
    desk.focus('notes')
    perform(desk, 'zoom')
    expect(inMap).toHaveBeenCalledOnce()
    expect(inNotes).toHaveBeenCalledOnce()
  })

  it('stops calling a handler once it is removed', () => {
    const handler = vi.fn()
    const remove = addCommandHandler(map, 'zoom', handler)
    remove()
    expect(perform(desk, 'zoom')).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('canPerform', () => {
  it('answers from the first responder that implements the command', () => {
    let selection = false
    on(map, 'copy', () => {}, { enabled: () => selection })
    on(document, 'copy', () => {})
    expect(canPerform(desk, 'copy')).toBe(false)
    selection = true
    expect(canPerform(desk, 'copy')).toBe(true)
  })

  it('is false when nothing implements the command', () => {
    expect(canPerform(desk, 'nothing-here')).toBe(false)
  })

  it('does not perform the command', () => {
    const handler = vi.fn()
    on(map, 'copy', handler)
    canPerform(desk, 'copy')
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('desk commands', () => {
  beforeEach(() => {
    removers.push(addDeskCommands(stage, desk))
  })

  it('closes the key window', () => {
    perform(desk, DeskCommands.closeWindow)
    expect(desk.getState().windows.map(w => w.id)).toEqual(['notes'])
  })

  it('cycles focus through windows in the order they opened', () => {
    perform(desk, DeskCommands.nextWindow)
    expect(focusedId(desk.getState())).toBe('notes')
    perform(desk, DeskCommands.previousWindow)
    expect(focusedId(desk.getState())).toBe('map')
  })

  it('offers Tile all only when something floats', () => {
    expect(canPerform(desk, DeskCommands.tileAll)).toBe(false)
    desk.float('map')
    expect(canPerform(desk, DeskCommands.tileAll)).toBe(true)
  })

  it('lets a window override a desk command', () => {
    const confirmClose = vi.fn()
    on(map, DeskCommands.closeWindow, confirmClose)
    perform(desk, DeskCommands.closeWindow)
    expect(confirmClose).toHaveBeenCalledOnce()
    expect(desk.getState().windows).toHaveLength(2)
  })

  it('disables window commands when nothing is open', () => {
    desk.closeAll()
    expect(canPerform(desk, DeskCommands.closeWindow)).toBe(false)
    expect(canPerform(desk, DeskCommands.nextWindow)).toBe(false)
  })
})
