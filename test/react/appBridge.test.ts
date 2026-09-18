// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_BRIDGE_SCRIPT, withAppBridge } from '../../src/react/index.js'

/*
 * The app's half of the bridge, which is the half that runs in somebody else's page. jsdom does not
 * execute a frame's scripts, so the script is run here as the app would run it, and the host is
 * played by hand.
 */
const runBridge = () => {
  const sent: unknown[] = []
  vi.spyOn(window.parent, 'postMessage').mockImplementation((message: unknown) => void sent.push(message))
  // eslint-disable-next-line no-new-func
  new Function(APP_BRIDGE_SCRIPT)()
  return { sent, desk: (window as unknown as { desk: Record<string, unknown> }).desk }
}

const fromHost = (message: object) =>
  window.dispatchEvent(new MessageEvent('message', { data: { desk: 1, ...message }, source: window.parent as Window }))

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
})

const THEME = { mode: 'light' as const, tokens: { '--sb-accent': '#336699', '--sb-bg-dark': '#e8ecf1' } }

describe('the app side of the bridge', () => {
  it('says it is ready, so the host knows when to say hello', () => {
    const { sent } = runBridge()
    expect(sent).toEqual([{ desk: 1, kind: 'ready' }])
  })

  it('wears the theme that arrives with hello', () => {
    const { desk } = runBridge()
    fromHost({ kind: 'hello', window: 'app#report', listens: [], says: [], theme: THEME })
    const root = document.documentElement
    // `data-theme` is what desk's own stylesheet reads, and what the HIG asks app authors to honour.
    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')
    expect(root.style.getPropertyValue('--sb-accent')).toBe('#336699')
    expect(desk.theme).toEqual(THEME)
  })

  it('changes with the desk, and tells an app that asked to be told', () => {
    const { desk } = runBridge()
    const seen: string[] = []
    ;(desk.onTheme as (fn: (t: { mode: string }) => void) => void)(t => seen.push(t.mode))
    fromHost({ kind: 'hello', window: null, listens: [], says: [], theme: THEME })
    fromHost({ kind: 'theme', theme: { mode: 'dark', tokens: { '--sb-accent': '#625fff' } } })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--sb-accent')).toBe('#625fff')
    expect(seen).toEqual(['light', 'dark'])
  })

  it('leaves the page alone when the host offers no theme', () => {
    runBridge()
    fromHost({ kind: 'hello', window: null, listens: [], says: [], theme: null })
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('ignores a message that did not come from its host', () => {
    runBridge()
    window.dispatchEvent(new MessageEvent('message', { data: { desk: 1, kind: 'theme', theme: THEME } }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('puts itself in a page that has a head, and in one that has none', () => {
    expect(withAppBridge('<html><head><title>a</title></head><body>b</body></html>')).toContain('<head><script>')
    expect(withAppBridge('<p>bare</p>').startsWith('<script>')).toBe(true)
  })
})
