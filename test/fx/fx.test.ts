// @vitest-environment jsdom
/*
 * Sounds without a sound card: what each is asked to play, and the rules that would be bugs rather
 * than bad notes — muted is silent, a burst is one sound, and nothing plays before a press.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFx, SCORES } from '../../src/fx/index.js'

class Param {
  value = 0
  events: [string, number, number][] = []
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]) }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['linear', v, t]) }
  exponentialRampToValueAtTime(v: number, t: number) { this.events.push(['exp', v, t]) }
}

interface Osc { type: string; frequency: Param; detune: Param; startedAt?: number; stoppedAt?: number }

function fakeAudio(state: 'running' | 'suspended' = 'running') {
  const score = { oscillators: [] as Osc[], gains: [] as { gain: Param }[], filters: [] as { type: string; frequency: Param }[], resumes: 0 }
  class Ctx {
    currentTime = 0
    destination = {}
    state = state
    resume() { score.resumes++; this.state = 'running'; return Promise.resolve() }
    createGain() { const n = { gain: new Param(), connect() {} }; score.gains.push(n); return n }
    createBiquadFilter() { const n = { type: '', Q: new Param(), frequency: new Param(), connect() {} }; score.filters.push(n); return n }
    createOscillator() {
      const n: Osc & Record<string, unknown> = {
        type: '', frequency: new Param(), detune: new Param(), connect() {},
        start(t: number) { n.startedAt = t }, stop(t: number) { n.stoppedAt = t },
      }
      score.oscillators.push(n)
      return n
    }
  }
  vi.stubGlobal('AudioContext', Ctx)
  return score
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('the built-in sounds', () => {
  it('attention rises; ready is small and high; failed is one low note', () => {
    const [first, ...rest] = SCORES.attention.notes
    expect(rest.at(-1)!.hz).toBeGreaterThan(first!.hz)
    expect(Math.min(...SCORES.ready.notes.map((n) => n.hz))).toBeGreaterThan(Math.max(...SCORES.attention.notes.map((n) => n.hz)))
    expect(SCORES.failed.notes).toHaveLength(1)
  })

  it('the bells are sines, and failed is a growl: sawtooth, opening filter, flutter, sag, and a cut', () => {
    for (const name of ['attention', 'ready'] as const) {
      const score = fakeAudio()
      createFx().play(name)
      expect(new Set(score.oscillators.map((o) => o.type))).toEqual(new Set(['sine']))
      expect(score.filters).toHaveLength(0)
    }
    const score = fakeAudio()
    createFx().play('failed')
    expect(score.oscillators.some((o) => o.type === 'sawtooth')).toBe(true)
    const [sweep] = score.filters.filter((f) => f.type === 'lowpass')
    const [closed, open, settle] = sweep!.frequency.events.map(([, v]) => v)
    expect(open).toBeGreaterThan(closed!)
    expect(open).toBeGreaterThan(settle!)
    expect(score.filters.some((f) => f.type === 'highpass')).toBe(true)
    expect(score.oscillators.some((o) => o.frequency.value > 15 && o.frequency.value < 30)).toBe(true)
    expect(score.oscillators.some((o) => (o.detune.events.at(-1)?.[1] ?? 0) < 0)).toBe(true)
  })

  it('every note starts, ends, and never ramps from or to zero, which would click', () => {
    const score = fakeAudio()
    const fx = createFx()
    for (const name of ['attention', 'ready', 'failed'] as const) expect(fx.play(name)).toBe(true)
    expect(score.oscillators.every((o) => o.stoppedAt! > o.startedAt!)).toBe(true)
    for (const { gain } of score.gains) expect(gain.events.every(([, v]) => v > 0)).toBe(true)
  })
})

describe('createFx', () => {
  it('hears a burst of one sound once, and does not hold back a different one', () => {
    fakeAudio()
    const fx = createFx({ coalesceMs: 1500 })
    expect(fx.play('attention', 1000)).toBe(true)
    expect(fx.play('attention', 2499)).toBe(false)
    expect(fx.play('ready', 1001)).toBe(true)
    expect(fx.play('attention', 2500)).toBe(true)
  })

  it('does not resume audio outside a press, and opens it on the first one', () => {
    const score = fakeAudio('suspended')
    const fx = createFx()
    expect(fx.play('attention')).toBe(false)
    expect(score.resumes).toBe(0)
    const stop = fx.unlock()
    window.dispatchEvent(new Event('pointerdown'))
    expect(score.resumes).toBe(1)
    window.dispatchEvent(new Event('pointerdown'))
    expect(score.resumes).toBe(1)
    stop()
  })

  it('is silent where the browser has no audio at all', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(createFx().play('attention')).toBe(false)
  })

  it('mutes every sound, remembers it under its own key, and says so to subscribers', () => {
    const score = fakeAudio()
    const fx = createFx({ storageKey: 'garage-sounds' })
    const heard = vi.fn()
    const stop = fx.subscribe(heard)
    fx.setMuted(true)
    expect(heard).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('garage-sounds')).toBe('yes')
    expect(createFx({ storageKey: 'garage-sounds' }).muted()).toBe(true)
    expect(createFx().muted()).toBe(false)
    expect(fx.play('attention')).toBe(false)
    expect(score.oscillators).toHaveLength(0)
    fx.setMuted(false)
    expect(fx.play('attention')).toBe(true)
    stop()
  })

  it('follows a mute set in another tab', () => {
    const fx = createFx()
    const heard = vi.fn()
    fx.subscribe(heard)
    window.dispatchEvent(new StorageEvent('storage', { key: 'desk-fx-muted' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }))
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('plays an app’s own sound through the same mute and master', () => {
    fakeAudio()
    const chime = vi.fn()
    const fx = createFx({ sounds: { chime } })
    expect(fx.play('chime')).toBe(true)
    expect(chime).toHaveBeenCalledOnce()
    fx.setMuted(true)
    expect(fx.play('chime')).toBe(false)
    expect(chime).toHaveBeenCalledOnce()
  })
})
