// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { Desktop, DeskShell, lazyWindow } from '../../src/react/index.js'
import type { WindowFailed, WindowLoading } from '../../src/react/index.js'

afterEach(cleanup)

beforeEach(() => {
  // A window that cannot open is reported; keep the test output to the assertions.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** A load the test decides the outcome of. */
function deferred() {
  let resolve!: (value: { default: () => React.JSX.Element }) => void
  let reject!: (error: Error) => void
  const promise = new Promise<{ default: () => React.JSX.Element }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const Studio = () => <p>Query studio</p>

function Broken(): React.JSX.Element {
  throw new Error('the realm is not installed')
}

function mount(renderWindow: (id: string) => React.ReactNode, extra: { loading?: WindowLoading; failed?: WindowFailed } = {}): Desk {
  const desk = createDesk()
  render(
    <DeskShell desk={desk}>
      <p>menu bar</p>
      <Desktop title={id => id} renderWindow={renderWindow} {...extra} />
    </DeskShell>,
  )
  return desk
}

const windowBody = (id: string) => document.querySelector(`[data-desk-window="${id}"] .desk-body`) as HTMLElement

describe('a window whose code loads when it opens', () => {
  it('shows it is loading, in that window, then shows the window', async () => {
    const load = deferred()
    const Query = lazyWindow(() => load.promise)
    const desk = mount(id => (id === 'query' ? <Query /> : <p>{id}</p>))
    act(() => desk.open('query'))
    expect(within(windowBody('query')).getByRole('status').textContent).toBe('Loading…')
    await act(async () => load.resolve({ default: Studio }))
    expect(within(windowBody('query')).getByText('Query studio')).toBeTruthy()
  })

  it('does not load until it is opened', () => {
    const load = vi.fn(() => Promise.resolve({ default: Studio }))
    const Query = lazyWindow(load)
    const desk = mount(id => (id === 'query' ? <Query /> : <p>{id}</p>))
    act(() => desk.open('notes'))
    expect(load).not.toHaveBeenCalled()
  })

  it('never blanks the rest of the desk while it loads', () => {
    const Query = lazyWindow(() => deferred().promise)
    const desk = mount(id => (id === 'query' ? <Query /> : <p>{`${id} content`}</p>))
    act(() => {
      desk.open('notes')
      desk.open('query')
    })
    expect(screen.getByText('notes content')).toBeTruthy()
    expect(screen.getByText('menu bar')).toBeTruthy()
  })
})

describe('a window that cannot open', () => {
  it('says so in that window, and the rest of the desk carries on', () => {
    const desk = mount(id => (id === 'broken' ? <Broken /> : <p>{`${id} content`}</p>))
    act(() => {
      desk.open('notes')
      desk.open('broken')
    })
    const alert = within(windowBody('broken')).getByRole('alert')
    expect(alert.textContent).toContain('This window could not open')
    expect(alert.textContent).toContain('the realm is not installed')
    expect(screen.getByText('notes content')).toBeTruthy()
    expect(screen.getByText('menu bar')).toBeTruthy()
  })

  it('tries the load again on Reload, rather than remembering the failure', async () => {
    let attempts = 0
    const Query = lazyWindow(async () => {
      attempts += 1
      if (attempts === 1) throw new Error('the network dropped')
      return { default: Studio }
    })
    const desk = mount(id => (id === 'query' ? <Query /> : null))
    await act(async () => desk.open('query'))
    expect(within(windowBody('query')).getByRole('alert').textContent).toContain('the network dropped')
    await act(async () => fireEvent.click(within(windowBody('query')).getByRole('button', { name: 'Reload' })))
    expect(within(windowBody('query')).getByText('Query studio')).toBeTruthy()
    expect(attempts).toBe(2)
  })

  it('reports it, so it does not fail silently', () => {
    const desk = mount(id => (id === 'broken' ? <Broken /> : null))
    act(() => desk.open('broken'))
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('window "broken" could not open'), expect.any(Error), expect.anything())
  })
})

describe('the app’s own wording', () => {
  it('uses the app’s loading and failure states when it gives them', async () => {
    const Query = lazyWindow(() => deferred().promise)
    const desk = mount(id => (id === 'query' ? <Query /> : <Broken />), {
      loading: id => <p>{`Opening ${id}…`}</p>,
      failed: (id, error) => <p>{`${id}: ${error.message}`}</p>,
    })
    act(() => {
      desk.open('query')
      desk.open('broken')
    })
    expect(screen.getByText('Opening query…')).toBeTruthy()
    expect(screen.getByText('broken: the realm is not installed')).toBeTruthy()
  })
})
