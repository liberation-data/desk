// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDesk, focusedId } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { AppFrame, Desktop, DeskShell, useBus, withAppBridge } from '../../src/react/index.js'
import type { Bus } from '../../src/core/index.js'

/*
 * The host side of the bridge. jsdom does not run a sandboxed frame's scripts, so
 * the app is played by hand: its messages are dispatched as if they came from the
 * frame's window, and what the host sends it is caught on that window.
 */

afterEach(cleanup)

let bus: Bus
function Capture() {
  bus = useBus()
  return null
}

function mount(props: Partial<Parameters<typeof AppFrame>[0]> = {}): { desk: Desk; frame: HTMLIFrameElement; sent: ReturnType<typeof vi.fn> } {
  const desk = createDesk()
  render(
    <DeskShell desk={desk}>
      <Capture />
      <Desktop
        title={id => id}
        renderWindow={id =>
          id === 'card' ? (
            <AppFrame title="Ride card" srcDoc="<p>card</p>" listens={['ride.*']} says={['ride.selected']} accepts="ride" opens={['map']} {...props} />
          ) : (
            <p>{id}</p>
          )
        }
      />
    </DeskShell>,
  )
  act(() => desk.open('card'))
  const frame = document.querySelector('iframe') as HTMLIFrameElement
  const sent = vi.fn()
  ;(frame.contentWindow as Window).postMessage = sent as unknown as Window['postMessage']
  return { desk, frame, sent }
}

/** A message as if the app inside the frame sent it. */
const fromApp = (frame: HTMLIFrameElement, data: unknown) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source: frame.contentWindow }))
  })

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('AppFrame', () => {
  it('runs the app sandboxed: scripts, but no same-origin access', () => {
    const { frame } = mount()
    expect(frame.getAttribute('title')).toBe('Ride card')
    const sandbox = frame.getAttribute('sandbox') ?? ''
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-same-origin')
  })

  it('says hello when the app is ready, with what it was granted', () => {
    const { frame, sent } = mount()
    fromApp(frame, { desk: 1, kind: 'ready' })
    expect(sent).toHaveBeenCalledWith({ desk: 1, kind: 'hello', window: 'card', listens: ['ride.*'], says: ['ride.selected'] }, '*')
  })

  it('passes on the topics it may hear, and nothing else', () => {
    const { sent } = mount()
    act(() => {
      bus.publish('ride.selected', { name: 'Dandenongs loop' }, { from: 'rides' })
      bus.publish('part.worn', { name: 'Chain' }, { from: 'parts' })
    })
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent).toHaveBeenCalledWith({ desk: 1, kind: 'event', topic: 'ride.selected', payload: { name: 'Dandenongs loop' }, from: 'rides' }, '*')
  })

  it('publishes what the app says on a granted topic, stamped with its window', () => {
    const { frame } = mount()
    const heard = vi.fn()
    act(() => {
      bus.subscribe('ride.selected', heard)
    })
    fromApp(frame, { desk: 1, kind: 'publish', topic: 'ride.selected', payload: { name: 'Beach Road bunch' } })
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ topic: 'ride.selected', from: 'card', payload: { name: 'Beach Road bunch' } }))
  })

  it('drops anything the app says on a topic it was not granted', () => {
    const { frame } = mount()
    const heard = vi.fn()
    act(() => {
      bus.subscribe('*', heard)
    })
    fromApp(frame, { desk: 1, kind: 'publish', topic: 'account.delete', payload: {} })
    expect(heard).not.toHaveBeenCalled()
  })

  it('does not echo the app its own words', () => {
    const { frame, sent } = mount()
    fromApp(frame, { desk: 1, kind: 'publish', topic: 'ride.selected', payload: {} })
    expect(sent).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'event' }), '*')
  })

  it('ignores messages that do not come from its own frame', () => {
    mount()
    const heard = vi.fn()
    act(() => {
      bus.subscribe('*', heard)
    })
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { desk: 1, kind: 'publish', topic: 'ride.selected', payload: {} }, source: window }))
    })
    expect(heard).not.toHaveBeenCalled()
  })

  it('ignores messages in another protocol', () => {
    const { frame } = mount()
    const heard = vi.fn()
    act(() => {
      bus.subscribe('*', heard)
    })
    fromApp(frame, { desk: 2, kind: 'publish', topic: 'ride.selected', payload: {} })
    fromApp(frame, 'ride.selected')
    expect(heard).not.toHaveBeenCalled()
  })

  it('opens a window the app may ask for, and only that', () => {
    const { desk, frame } = mount()
    fromApp(frame, { desk: 1, kind: 'open', window: 'map' })
    expect(focusedId(desk.getState())).toBe('map')
    fromApp(frame, { desk: 1, kind: 'open', window: 'settings' })
    expect(desk.getState().windows.map(w => w.id)).not.toContain('settings')
  })

  it('makes its window a drop target for the types it accepts', () => {
    mount()
    expect(document.querySelector('.desk-app-frame')?.hasAttribute('data-desk-drop')).toBe(true)
  })

  it('is no drop target when it accepts nothing', () => {
    cleanup()
    const desk = createDesk()
    render(
      <DeskShell desk={desk}>
        <Desktop title={id => id} renderWindow={() => <AppFrame title="Clock" srcDoc="<p>12:00</p>" />} />
      </DeskShell>,
    )
    act(() => desk.open('clock'))
    expect(document.querySelector('.desk-app-frame')?.getAttribute('data-desk-drop')).toBeNull()
  })
})

describe('withAppBridge', () => {
  it('puts the bridge at the top of the head', () => {
    const page = withAppBridge('<html><head><title>Card</title></head><body></body></html>')
    expect(page.indexOf('<script>')).toBeLessThan(page.indexOf('<title>'))
    expect(page).toContain("kind: 'ready'")
  })

  it('works on a fragment with no head', () => {
    expect(withAppBridge('<p>hello</p>').startsWith('<script>')).toBe(true)
  })
})
