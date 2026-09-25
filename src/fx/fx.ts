/*
 * Sounds for an app on the desk: `attention`, `ready` and `failed`, and any an app adds.
 *
 * WHEN to make one is the app's decision and the hard part; see HIG.md, "Sound". This is the
 * instrument: one audio context, opened on the first press, a repeat of the same sound inside a
 * short window heard once, and a mute this browser remembers.
 */
import { SCORES, scored, type BuiltInSound, type Sound } from './sounds.js'

export interface FxOptions<Extra extends string> {
  /** Sounds of the app's own, or replacements for the built-ins. */
  readonly sounds?: Readonly<Record<Extra, Sound>>
  /** Where the mute is kept. Two apps on one origin that should not share a switch need two keys. */
  readonly storageKey?: string
  /** A second request for the same sound inside this many milliseconds is the same event. */
  readonly coalesceMs?: number
  /** Master gain over every sound. */
  readonly volume?: number
}

export interface Fx<Name extends string> {
  /** Plays now if it can; whether it did. Silent when muted, repeated, or before any press. */
  play(name: Name, nowMs?: number): boolean
  /**
   * Opens audio on the first press. A browser refuses sound on a page nobody has touched, and a
   * sound arrives unasked, long after the last click: the press has to be taken while it happens.
   * Returns a teardown.
   */
  unlock(): () => void
  muted(): boolean
  setMuted(muted: boolean): void
  /** Told when the mute changes, here or in another tab. */
  subscribe(listener: () => void): () => void
  /** Schedules a sound into any context, an offline one included, for measuring. */
  render(ctx: BaseAudioContext, name: Name, out: AudioNode): void
}

type Ctor = typeof AudioContext

function audioContextClass(): Ctor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? (window as { webkitAudioContext?: Ctor }).webkitAudioContext ?? null
}

export function createFx<Extra extends string = never>(
  options: FxOptions<Extra> = {},
): Fx<BuiltInSound | Extra> {
  type Name = BuiltInSound | Extra
  const { storageKey = 'desk-fx-muted', coalesceMs = 1500, volume = 0.8 } = options
  const builtIn = Object.fromEntries(Object.entries(SCORES).map(([name, score]) => [name, scored(score)]))
  const sounds = { ...builtIn, ...options.sounds } as Record<Name, Sound>
  const lastPlayed = new Map<string, number>()
  const listeners = new Set<() => void>()
  let audio: AudioContext | null = null

  const context = (): AudioContext | null => {
    if (audio) return audio
    const Class = audioContextClass()
    if (!Class) return null
    try {
      audio = new Class()
    } catch {
      return null
    }
    return audio
  }

  const muted = (): boolean => {
    try {
      return localStorage.getItem(storageKey) === 'yes'
    } catch {
      return false
    }
  }

  const render = (ctx: BaseAudioContext, name: Name, out: AudioNode): void => {
    const master = ctx.createGain()
    const at = ctx.currentTime + 0.01
    master.gain.setValueAtTime(volume, at)
    master.connect(out)
    sounds[name](ctx, master, at)
  }

  return {
    play(name, nowMs = Date.now()) {
      if (muted()) return false
      const previous = lastPlayed.get(name)
      if (previous !== undefined && nowMs - previous < coalesceMs) return false
      const ctx = context()
      // Never resumed from here: outside a press the promise may never settle, and a sound that
      // lands a click late belongs to the wrong moment.
      if (!ctx || ctx.state !== 'running') return false
      lastPlayed.set(name, nowMs)
      try {
        render(ctx, name, ctx.destination)
        return true
      } catch {
        return false
      }
    },

    unlock() {
      if (typeof window === 'undefined') return () => undefined
      const stop = (): void => {
        window.removeEventListener('pointerdown', open)
        window.removeEventListener('keydown', open)
      }
      function open(): void {
        stop()
        const ctx = context()
        // Inside the handler, where the browser is willing to listen.
        if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined)
      }
      window.addEventListener('pointerdown', open)
      window.addEventListener('keydown', open)
      return stop
    },

    muted,

    setMuted(next) {
      try {
        if (next) localStorage.setItem(storageKey, 'yes')
        else localStorage.removeItem(storageKey)
      } catch {
        // Blocked site data: sounds stay on, which is the default.
      }
      listeners.forEach((listener) => listener())
    },

    subscribe(listener) {
      listeners.add(listener)
      const fromAnotherTab = (event: StorageEvent): void => {
        if (event.key === storageKey) listener()
      }
      if (typeof window !== 'undefined') window.addEventListener('storage', fromAnotherTab)
      return () => {
        listeners.delete(listener)
        if (typeof window !== 'undefined') window.removeEventListener('storage', fromAnotherTab)
      }
    },

    render,
  }
}
