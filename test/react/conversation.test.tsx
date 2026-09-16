// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Composer, Thread } from '../../src/react/index.js'
import type { Message } from '../../src/react/index.js'

afterEach(cleanup)

const MESSAGES: Message[] = [
  { id: '1', from: 'clerk', authorName: 'Ledger clerk', body: 'Two suppliers are overdue.', at: '09:41' },
  { id: '2', from: 'clerk', authorName: 'Ledger clerk', body: 'Halden is the older one.', at: '09:41' },
  { id: '3', from: 'me', body: 'Draft a reminder to Halden.', at: '09:42' },
]

// jsdom gives every element a zero height, so scrolling is described here.
function measure(element: HTMLElement, { scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true })
  Object.defineProperty(element, 'scrollTop', { value: scrollTop, writable: true, configurable: true })
}

describe('Thread', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
  })

  it('is a log, with your messages set apart from theirs', () => {
    render(<Thread messages={MESSAGES} />)
    const log = screen.getByRole('log', { name: 'Conversation' })
    const messages = within(log).getAllByRole('article')
    expect(messages).toHaveLength(3)
    expect(messages[0]?.dataset.mine).toBeUndefined()
    expect(messages[2]?.dataset.mine).toBe('true')
  })

  it('names the author once per run', () => {
    render(<Thread messages={MESSAGES} />)
    expect(screen.getAllByText('Ledger clerk')).toHaveLength(1)
  })

  it('offers Retry on a message that did not send', () => {
    const onRetry = vi.fn()
    render(<Thread messages={[{ id: '9', from: 'me', body: 'Send this', state: 'failed' }]} onRetry={onRetry} />)
    expect(screen.getByText('Not sent')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledWith('9')
  })

  it('shows a typing indicator, and an empty state only when there is nothing at all', () => {
    const { rerender } = render(<Thread messages={[]} empty={<p>No messages yet</p>} />)
    expect(screen.getByText('No messages yet')).toBeTruthy()
    rerender(<Thread messages={[]} typing empty={<p>No messages yet</p>} />)
    expect(screen.queryByText('No messages yet')).toBeNull()
    expect(screen.getByLabelText('Typing')).toBeTruthy()
  })

  it('follows the conversation while you are at the end of it', () => {
    const { rerender } = render(<Thread messages={MESSAGES} />)
    const log = screen.getByRole('log')
    measure(log, { scrollHeight: 900, clientHeight: 300, scrollTop: 600 })
    fireEvent.scroll(log)
    rerender(<Thread messages={[...MESSAGES, { id: '4', from: 'clerk', body: 'Drafted.' }]} />)
    expect(log.scrollTo).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /new message/ })).toBeNull()
  })

  it('does not yank you away when you have scrolled back, and counts what you missed', () => {
    const { rerender } = render(<Thread messages={MESSAGES} />)
    const log = screen.getByRole('log')
    measure(log, { scrollHeight: 900, clientHeight: 300, scrollTop: 0 })
    fireEvent.scroll(log)
    rerender(<Thread messages={[...MESSAGES, { id: '4', from: 'clerk', body: 'Drafted.' }]} />)
    rerender(<Thread messages={[...MESSAGES, { id: '4', from: 'clerk', body: 'Drafted.' }, { id: '5', from: 'clerk', body: 'Sent.' }]} />)
    const jump = screen.getByRole('button', { name: /2 new messages/ })
    fireEvent.click(jump)
    expect(screen.queryByRole('button', { name: /new message/ })).toBeNull()
  })
})

describe('Composer', () => {
  function Harness({ busy, onStop }: { readonly busy?: boolean; readonly onStop?: () => void }) {
    const [value, setValue] = useState('')
    const [sent, setSent] = useState<string[]>([])
    return (
      <>
        <Composer
          value={value}
          onChange={setValue}
          onSubmit={text => {
            setSent(list => [...list, text])
            setValue('')
          }}
          {...(busy === undefined ? {} : { busy })}
          {...(onStop ? { onStop } : {})}
        />
        <ul>{sent.map(text => <li key={text}>{text}</li>)}</ul>
      </>
    )
  }

  it('sends on Enter, and keeps Shift+Enter for a new line', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const field = screen.getByRole('textbox', { name: 'Message' })
    await user.type(field, 'first line{Shift>}{Enter}{/Shift}second line')
    expect(field).toHaveProperty('value', 'first line\nsecond line')
    await user.type(field, '{Enter}')
    expect(screen.getByRole('listitem').textContent).toBe('first line\nsecond line')
    expect(field).toHaveProperty('value', '')
  })

  it('will not send nothing', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Send' })).toHaveProperty('disabled', true)
  })

  it('sends from the button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('textbox'), '  Draft a reminder  ')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('listitem').textContent).toBe('Draft a reminder')
  })

  it('offers Stop while an answer is arriving', async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    render(<Harness busy onStop={onStop} />)
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('does not send while an input method is composing', () => {
    render(<Harness />)
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: 'にほんご' } })
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
    expect(screen.queryByRole('listitem')).toBeNull()
  })
})
