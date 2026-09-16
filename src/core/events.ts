import type { WindowId } from './types.js'

/*
 * Windows talk to each other by publishing what happened, not by calling each
 * other: Rides says a ride was chosen, and whoever cares — the map, a chat
 * window — answers. Nobody holds a reference to anybody.
 *
 * Topics are dotted names. A subscriber can take a whole branch with `ride.*`,
 * or everything with `*`.
 */

export interface DeskEvent<T = unknown> {
  readonly topic: string
  readonly payload: T
  /** The window it came from, when it came from one. */
  readonly from: WindowId | null
  readonly at: number
}

export type EventHandler<T = unknown> = (event: DeskEvent<T>) => void

export interface SubscribeOptions {
  /**
   * Deliver the last event on this topic straight away, if there was one. A window
   * opened by the event that concerns it would otherwise miss it by a frame.
   */
  readonly replay?: boolean
}

export interface Bus {
  publish<T>(topic: string, payload: T, options?: { readonly from?: WindowId | null }): DeskEvent<T>
  subscribe<T>(topic: string, handler: EventHandler<T>, options?: SubscribeOptions): () => void
  /** The last event on a topic, if one has been published. */
  last<T>(topic: string): DeskEvent<T> | undefined
}

export function topicMatches(pattern: string, topic: string): boolean {
  if (pattern === '*' || pattern === topic) return true
  if (!pattern.endsWith('.*')) return false
  const branch = pattern.slice(0, -2)
  return topic === branch || topic.startsWith(`${branch}.`)
}

export function createBus(): Bus {
  const subscribers = new Set<{ pattern: string; handler: EventHandler<never> }>()
  const latest = new Map<string, DeskEvent<unknown>>()

  return {
    publish(topic, payload, options = {}) {
      const event: DeskEvent<typeof payload> = { topic, payload, from: options.from ?? null, at: Date.now() }
      latest.set(topic, event as DeskEvent<unknown>)
      // Copy first: a handler may subscribe or unsubscribe while this one is being delivered.
      for (const subscriber of [...subscribers]) {
        if (subscribers.has(subscriber) && topicMatches(subscriber.pattern, topic)) {
          ;(subscriber.handler as EventHandler<typeof payload>)(event)
        }
      }
      return event
    },

    subscribe(topic, handler, options = {}) {
      const subscriber = { pattern: topic, handler: handler as EventHandler<never> }
      subscribers.add(subscriber)
      if (options.replay) {
        const previous = [...latest.values()]
          .filter(event => topicMatches(topic, event.topic))
          .sort((a, b) => a.at - b.at)
          .at(-1)
        if (previous) (handler as EventHandler<unknown>)(previous)
      }
      return () => {
        subscribers.delete(subscriber)
      }
    },

    last(topic) {
      return latest.get(topic) as DeskEvent<never> | undefined
    },
  }
}

/* ── Typed input: text with no target, which goes to the key window ── */

export const InputCommands = {
  /** Brings up the bar. A menu item can perform this, as a shortcut does. */
  open: 'desk.input.open',
  /** Sent with the text. A window that takes typed input answers this. */
  submit: 'desk.input.submit',
  /** Asks the chain how the bar should present itself for the key window. */
  describe: 'desk.input.describe',
} as const

/** Filled in by whichever responder answers `desk.input.describe`. */
export interface InputDescription {
  placeholder?: string
  /** What the text will reach, for the bar to show: "Rides", "Chat". */
  target?: string
  disabled?: boolean
}
