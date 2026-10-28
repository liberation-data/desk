// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk, routeOf } from '../../src/core/index.js'
import { Desktop, DeskProvider, useWindowRoute } from '../../src/react/index.js'

afterEach(cleanup)

function Settings() {
  const [route, setRoute] = useWindowRoute()
  return (
    <>
      <p>{`at ${route || 'the start'}`}</p>
      <button type="button" onClick={() => setRoute('look')}>
        Look
      </button>
    </>
  )
}

function mount() {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <Desktop title={id => id} renderWindow={() => <Settings />} />
    </DeskProvider>,
  )
  return desk
}

describe('useWindowRoute', () => {
  it('reads where the window was opened', () => {
    const desk = mount()
    act(() => desk.open('settings', { route: 'agents' }))
    expect(screen.getByText('at agents')).toBeTruthy()
  })

  it('follows a link to a window already open', () => {
    const desk = mount()
    act(() => desk.open('settings'))
    expect(screen.getByText('at the start')).toBeTruthy()
    act(() => desk.open('settings', { route: 'agents' }))
    expect(screen.getByText('at agents')).toBeTruthy()
  })

  it('says where the window has got to', () => {
    const desk = mount()
    act(() => desk.open('settings', { route: 'agents' }))
    fireEvent.click(screen.getByRole('button', { name: 'Look' }))
    expect(routeOf(desk.getState(), 'settings')).toBe('look')
    expect(screen.getByText('at look')).toBeTruthy()
  })

  it('keeps its own route outside a window, with a desk or without one', () => {
    const desk = createDesk()
    render(
      <DeskProvider desk={desk}>
        <Settings />
      </DeskProvider>,
    )
    expect(screen.getByText('at the start')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Look' }))
    expect(screen.getByText('at look')).toBeTruthy()
    expect(desk.getState().routes).toBeUndefined()
    cleanup()
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Look' }))
    expect(screen.getByText('at look')).toBeTruthy()
  })
})

describe('useWindowRoute in windows of one kind', () => {
  it('gives each instance its own route', () => {
    const desk = createDesk()
    function Query() {
      const [route] = useWindowRoute()
      return <p>{`at ${route}`}</p>
    }
    render(
      <DeskProvider desk={desk}>
        <Desktop title={id => id} renderWindow={() => <Query />} />
      </DeskProvider>,
    )
    act(() => {
      desk.open('query', { route: 'one' })
      desk.openInstance('query', { route: 'two' })
    })
    expect(screen.getByText('at one')).toBeTruthy()
    expect(screen.getByText('at two')).toBeTruthy()
  })

  it('does not render again when something else on the desk changes', () => {
    const desk = createDesk()
    const renders: string[] = []
    function Counted() {
      const [route] = useWindowRoute()
      renders.push(route)
      return <p>{route}</p>
    }
    // The same element each time, so only the hook can make it render again.
    const content = <Counted />
    render(
      <DeskProvider desk={desk}>
        <Desktop title={id => id} renderWindow={id => (id === 'settings' ? content : null)} />
      </DeskProvider>,
    )
    act(() => desk.open('settings', { route: 'agents' }))
    act(() => desk.open('notes'))
    const before = renders.length
    act(() => desk.setRoute('notes', 'elsewhere'))
    expect(renders.length).toBe(before)
    act(() => desk.setRoute('settings', 'look'))
    expect(renders.at(-1)).toBe('look')
  })
})
