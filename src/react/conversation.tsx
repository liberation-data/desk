import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button } from './controls.js'

/*
 * A conversation: the thread, and the box you type into. Presentational only —
 * it holds no transport and knows nothing about who is answering. Messages come
 * in as props; sending, streaming and retrying are the app's to do.
 */

export interface Message {
  readonly id: string
  /** Matches `me` on the thread for your own messages. Anything else is somebody else. */
  readonly from: string
  /** Shown above the first message of a run. Falls back to `from`. */
  readonly authorName?: string
  /**
   * Shown beside the first message of a run, for messages that are not yours.
   *
   * A NODE, not a URL: who is speaking is drawn differently by different applications — a photo,
   * a monogram, a mark that animates while the thing is thinking — and a component that took an
   * image source would serve the first of those and block the rest.
   *
   * Only on a run start, and never on your own messages, for the same reason the author name is:
   * the person reading a conversation knows which side is theirs, and repeating an avatar down
   * every message of one turn is decoration where the eye is trying to follow a sentence.
   */
  readonly avatar?: ReactNode
  readonly body: ReactNode
  readonly at?: Date | string
  /** `sending` dims it, `failed` offers Retry. */
  readonly state?: 'sending' | 'sent' | 'failed'
}

export interface ThreadProps {
  readonly messages: readonly Message[]
  /** Which `from` is you. Default `me`. */
  readonly me?: string
  /** Shown while the other side is composing: `true` for dots, or your own node. */
  readonly typing?: boolean | ReactNode
  readonly onRetry?: (id: string) => void
  readonly empty?: ReactNode
  readonly label?: string
  readonly className?: string
}

const time = (at: Date | string | undefined) =>
  at === undefined ? null
  : typeof at === 'string' ? at
  : at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function Thread({ messages, me = 'me', typing, onRetry, empty, label = 'Conversation', className }: ThreadProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const [missed, setMissed] = useState(0)

  const toBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const element = scroller.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
    atBottom.current = true
    setMissed(0)
  }, [])

  // Follow the conversation only while the reader is at the end of it: scrolling
  // back to read something must not be yanked away by the next message.
  useLayoutEffect(() => {
    if (atBottom.current) toBottom()
    else setMissed(n => n + 1)
  }, [messages.length, toBottom])

  useEffect(() => {
    toBottom()
  }, [toBottom])

  const onScroll = () => {
    const element = scroller.current
    if (!element) return
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32
    if (atBottom.current) setMissed(0)
  }

  let previous: string | null = null
  return (
    <div className={['desk-thread', className].filter(Boolean).join(' ')}>
      <div ref={scroller} className="desk-thread-scroll" role="log" aria-label={label} aria-live="polite" onScroll={onScroll}>
        {messages.length === 0 && !typing && empty}
        {messages.map(message => {
          const mine = message.from === me
          const runStart = message.from !== previous
          previous = message.from
          const stamp = time(message.at)
          return (
            <article
              key={message.id}
              className="desk-message"
              data-mine={mine || undefined}
              data-state={message.state ?? 'sent'}
              data-run-start={runStart || undefined}
            >
              {runStart && !mine && (
                <span className="desk-message-author">
                  {message.avatar && <span className="desk-message-avatar">{message.avatar}</span>}
                  {message.authorName ?? message.from}
                </span>
              )}
              <div className="desk-bubble">{message.body}</div>
              <span className="desk-message-foot">
                {stamp && <time>{stamp}</time>}
                {message.state === 'sending' && <span>Sending…</span>}
                {message.state === 'failed' && (
                  <>
                    <span className="desk-message-failed">Not sent</span>
                    {onRetry && (
                      <Button size="small" intent="quiet" onClick={() => onRetry(message.id)}>
                        Retry
                      </Button>
                    )}
                  </>
                )}
              </span>
            </article>
          )
        })}
        {typing && (
          <div className="desk-typing" aria-label="Typing">
            {typing === true ? (
              <span className="desk-typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              typing
            )}
          </div>
        )}
      </div>
      {missed > 0 && (
        <Button className="desk-thread-jump" size="small" onClick={() => toBottom('smooth')}>
          {missed === 1 ? '1 new message' : `${missed} new messages`} ↓
        </Button>
      )}
    </div>
  )
}

export interface ComposerProps {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Called on Enter or Send, with the trimmed text. Clearing the box is yours to do. */
  readonly onSubmit: (value: string) => void
  readonly placeholder?: string
  readonly label?: string
  readonly disabled?: boolean
  /** An answer is arriving: Send becomes Stop when `onStop` is given. */
  readonly busy?: boolean
  readonly onStop?: () => void
  /** Beside the send button — attachments, a model picker. */
  readonly accessory?: ReactNode
  readonly maxRows?: number
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Say something…',
  label = 'Message',
  disabled,
  busy,
  onStop,
  accessory,
  maxRows = 8,
}: ComposerProps) {
  const field = useRef<HTMLTextAreaElement>(null)

  // Grow with the text, up to maxRows, then scroll.
  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    const line = parseFloat(getComputedStyle(element).lineHeight || '20') || 20
    element.style.height = `${Math.min(element.scrollHeight, line * maxRows)}px`
  }, [value, maxRows])

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSubmit(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a new line. IME composition must never send.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <div className="desk-composer" data-disabled={disabled || undefined}>
      <textarea
        ref={field}
        className="desk-composer-field"
        aria-label={label}
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {accessory}
      {busy && onStop ? (
        <Button aria-label="Stop" onClick={onStop}>
          Stop
        </Button>
      ) : (
        <Button intent="default" aria-label="Send" disabled={disabled || !value.trim()} onClick={submit}>
          Send
        </Button>
      )}
    </div>
  )
}
