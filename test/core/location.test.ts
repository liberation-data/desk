import { describe, expect, it } from 'vitest'
import { createDesk, focusedId, parse, serialize, syncWithLocation } from '../../src/core/index.js'
import type { LocationEnv } from '../../src/core/index.js'

const stage = { width: 1200, height: 800 }

describe('serialize and parse', () => {
  it('round-trips open windows, modes and focus, but not frames', () => {
    const desk = createDesk()
    desk.open('notes')
    desk.open('clock')
    desk.open('inspector', { mode: 'floating' })
    desk.focus('clock')

    const params = serialize(desk.getState())
    expect(params.get('w')).toBe('notes,clock,inspector~')
    expect(params.get('f')).toBe('clock')

    const restored = parse(params, stage)
    expect(restored.windows.map(w => `${w.id}:${w.mode}`)).toEqual(['notes:filled', 'clock:filled', 'inspector:floating'])
    expect(focusedId(restored)).toBe('clock')
  })

  it('survives ids with commas and tildes', () => {
    const desk = createDesk()
    desk.open('a,b~c')
    expect(parse(serialize(desk.getState()), stage).windows[0]?.id).toBe('a,b~c')
  })

  it('drops ids the app does not know', () => {
    const restored = parse(new URLSearchParams('w=notes,evil,clock'), stage, { isKnown: id => id !== 'evil' })
    expect(restored.windows.map(w => w.id)).toEqual(['notes', 'clock'])
  })

  it('ignores a focus that is not open', () => {
    const restored = parse(new URLSearchParams('w=a,b&f=zzz'), stage)
    expect(focusedId(restored)).toBe('b')
  })

  it('writes nothing for an empty desk', () => {
    expect(serialize(createDesk().getState()).toString()).toBe('')
  })
})

function fakeEnv(hash = '') {
  const entries: string[] = [hash]
  let index = 0
  let onPop: (() => void) | null = null
  const env: LocationEnv = {
    location: {
      get hash() {
        return entries[index] ?? ''
      },
      set hash(value: string) {
        entries[index] = value
      },
    },
    history: {
      pushState: (_d, _u, url) => {
        entries.splice(index + 1, entries.length, url)
        index += 1
      },
      replaceState: (_d, _u, url) => {
        entries[index] = url
      },
    },
    addEventListener: (_t, listener) => {
      onPop = listener
    },
    removeEventListener: () => {
      onPop = null
    },
  }
  const back = () => {
    index -= 1
    onPop?.()
  }
  return { env, entries: () => entries.slice(0, index + 1), back }
}

describe('syncWithLocation', () => {
  it('opens what the URL names when it starts', () => {
    const { env } = fakeEnv('#w=notes,clock~&f=notes')
    const desk = createDesk()
    syncWithLocation(desk, () => stage, {}, env)
    expect(desk.getState().windows.map(w => w.id)).toEqual(['notes', 'clock'])
    expect(focusedId(desk.getState())).toBe('notes')
  })

  it('keeps windows the app opened when the URL names none', () => {
    const { env, entries } = fakeEnv('#tab=home')
    const desk = createDesk()
    desk.open('about')
    syncWithLocation(desk, () => stage, {}, env)
    expect(desk.getState().windows.map(w => w.id)).toEqual(['about'])
    expect(env.location.hash).toBe('#tab=home&w=about&f=about')
    expect(entries()).toHaveLength(1)
  })

  it('pushes when a window opens, so Back closes it', () => {
    const { env, back } = fakeEnv()
    const desk = createDesk()
    syncWithLocation(desk, () => stage, {}, env)
    desk.open('notes')
    desk.open('clock')
    expect(env.location.hash).toBe('#w=notes,clock&f=clock')
    back()
    expect(desk.getState().windows.map(w => w.id)).toEqual(['notes'])
  })

  it('replaces rather than pushes on focus and mode changes', () => {
    const { env, entries } = fakeEnv()
    const desk = createDesk()
    syncWithLocation(desk, () => stage, {}, env)
    desk.open('notes')
    desk.open('clock')
    const depth = entries().length
    desk.focus('notes')
    desk.toggleMode('clock')
    expect(entries()).toHaveLength(depth)
    expect(env.location.hash).toBe('#w=notes,clock~&f=clock')
  })

  it('keeps the app’s own hash parameters', () => {
    const { env } = fakeEnv('#tab=query')
    const desk = createDesk()
    syncWithLocation(desk, () => stage, {}, env)
    desk.open('notes')
    expect(new URLSearchParams(env.location.hash.slice(1)).get('tab')).toBe('query')
  })
})
