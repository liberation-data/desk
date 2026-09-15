// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk, DeskCommands } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { Desktop, DeskProvider, useCanPerform, useCommand, usePerform, useShortcuts, useWindowId } from '../../src/react/index.js'

afterEach(cleanup)

function Counter() {
  const id = useWindowId()
  const [count, setCount] = useState(0)
  useCommand('increment', () => setCount(c => c + 1))
  return <p>{`${id}: ${count}`}</p>
}

function Editor() {
  const field = useRef<HTMLTextAreaElement>(null)
  const [log, setLog] = useState('')
  useCommand('copy', () => setLog('copied from field'), { at: field })
  useCommand('copy', () => setLog('copied from window'))
  return (
    <>
      <textarea ref={field} aria-label="Editor" />
      <p>{log || 'nothing copied'}</p>
    </>
  )
}

const KEYMAP = { 'mod+i': 'increment' }

function MenuProbe() {
  const perform = usePerform()
  const can = useCanPerform()
  useShortcuts(KEYMAP, { apple: true })
  const [enabled, setEnabled] = useState<boolean | null>(null)
  return (
    <>
      <button type="button" onClick={() => perform('increment')}>Increment</button>
      <button type="button" onClick={() => perform('copy')}>Copy</button>
      <button type="button" onClick={() => setEnabled(can(DeskCommands.tileAll))}>Check tile all</button>
      <output>{enabled === null ? 'unchecked' : String(enabled)}</output>
    </>
  )
}

function mount(): Desk {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <MenuProbe />
      <Desktop title={id => id} renderWindow={id => (id === 'editor' ? <Editor /> : <Counter />)} />
    </DeskProvider>,
  )
  return desk
}

describe('useCommand', () => {
  it('answers in the key window, whichever that is', () => {
    const desk = mount()
    act(() => {
      desk.open('left')
      desk.open('right')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByText('right: 1')).toBeTruthy()
    expect(screen.getByText('left: 0')).toBeTruthy()
    act(() => desk.focus('left'))
    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByText('left: 1')).toBeTruthy()
  })

  it('prefers a responder on the focused element over its window', () => {
    const desk = mount()
    act(() => desk.open('editor'))
    const copy = screen.getByRole('button', { name: 'Copy' })
    fireEvent.click(copy)
    expect(screen.getByText('copied from window')).toBeTruthy()
    // fireEvent.click does not move focus, so the textarea stays the start of the chain.
    act(() => screen.getByRole('textbox', { name: 'Editor' }).focus())
    fireEvent.click(copy)
    expect(screen.getByText('copied from field')).toBeTruthy()
  })

  it('answers a keyboard shortcut', () => {
    const desk = mount()
    act(() => desk.open('solo'))
    fireEvent.keyDown(document.body, { key: 'i', metaKey: true })
    expect(screen.getByText('solo: 1')).toBeTruthy()
  })
})

describe('Desktop', () => {
  it('answers desk commands, so a menu can ask before drawing an item', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check tile all' }))
    expect(screen.getByText('false')).toBeTruthy()
    act(() => desk.float('a'))
    fireEvent.click(screen.getByRole('button', { name: 'Check tile all' }))
    expect(screen.getByText('true')).toBeTruthy()
  })

  it('moves keyboard focus into a window when it becomes key', () => {
    const desk = mount()
    act(() => {
      desk.open('a')
      desk.open('b')
    })
    act(() => desk.focus('a'))
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'a' }))
  })
})
