// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDesk, focusedId } from '../../src/core/index.js'
import { Desktop, DeskShell, useDraggable, useDropTarget } from '../../src/react/index.js'

afterEach(cleanup)

interface Ride {
  readonly name: string
}

const RIDE: Ride = { name: 'Dandenongs loop' }

function Rides() {
  const { dragProps, dragging } = useDraggable<Ride>({ type: 'ride', payload: RIDE, preview: RIDE.name })
  return (
    <p {...dragProps} data-testid="ride">
      {RIDE.name}
      {dragging && ' (lifted)'}
    </p>
  )
}

function MapView() {
  const [drawn, setDrawn] = useState<string>('nothing')
  const { dropProps, over, ready } = useDropTarget<Ride>({ accepts: 'ride', onDrop: drag => setDrawn(`${drag.payload.name} from ${drag.from}`) })
  return (
    <div {...dropProps} data-testid="map">
      <p>{`map: ${drawn}`}</p>
      <p>{`${ready ? 'ready' : 'idle'} ${over ? 'over' : ''}`.trim()}</p>
    </div>
  )
}

function Notes() {
  const { dropProps } = useDropTarget({ accepts: 'document', onDrop: () => {} })
  return <div {...dropProps} data-testid="notes">notes</div>
}

function mount() {
  const desk = createDesk()
  render(
    <DeskShell desk={desk}>
      <Desktop title={id => id} renderWindow={id => (id === 'rides' ? <Rides /> : id === 'map' ? <MapView /> : <Notes />)} />
    </DeskShell>,
  )
  act(() => {
    desk.open('rides')
    desk.open('map')
    desk.open('notes')
  })
  return desk
}

/** jsdom has no layout, so say what is under the pointer. */
const pointAt = (element: HTMLElement | null) => {
  document.elementFromPoint = () => element
}

const pickUp = (from: HTMLElement) => {
  fireEvent.pointerDown(from, { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
}

const moveTo = (x: number, y: number) => {
  act(() => {
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, cancelable: true }))
  })
}

const release = (x: number, y: number) => {
  act(() => {
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }))
  })
}

beforeEach(() => {
  Element.prototype.setPointerCapture = () => {}
  pointAt(null)
})

describe('dragging between windows', () => {
  it('carries the payload to a target that accepts it, and says where it came from', () => {
    mount()
    pointAt(screen.getByTestId('map'))
    pickUp(screen.getByTestId('ride'))
    moveTo(200, 200)
    release(200, 200)
    expect(screen.getByText('map: Dandenongs loop from rides')).toBeTruthy()
  })

  it('brings the window that took it forward', () => {
    const desk = mount()
    act(() => desk.focus('rides'))
    pointAt(screen.getByTestId('map'))
    pickUp(screen.getByTestId('ride'))
    moveTo(200, 200)
    release(200, 200)
    expect(focusedId(desk.getState())).toBe('map')
  })

  it('marks what could take it, and what it is over', () => {
    mount()
    const map = screen.getByTestId('map')
    pointAt(map)
    pickUp(screen.getByTestId('ride'))
    moveTo(200, 200)
    expect(map.dataset.ready).toBe('true')
    expect(map.dataset.over).toBe('true')
    expect(screen.getByTestId('notes').dataset.ready).toBeUndefined()
    expect(screen.getByText(/\(lifted\)/)).toBeTruthy()
  })

  it('shows what is being carried', () => {
    mount()
    pickUp(screen.getByTestId('ride'))
    moveTo(120, 90)
    const preview = document.querySelector('.desk-drag-preview') as HTMLElement
    expect(preview.textContent).toBe('Dandenongs loop')
    expect(preview.style.left).toBe('120px')
    release(120, 90)
    expect(document.querySelector('.desk-drag-preview')).toBeNull()
  })

  it('drops nothing on a target that does not take it', () => {
    mount()
    pointAt(screen.getByTestId('notes'))
    pickUp(screen.getByTestId('ride'))
    moveTo(200, 200)
    release(200, 200)
    expect(screen.getByText('map: nothing')).toBeTruthy()
  })

  it('does nothing when it is let go over open space', () => {
    mount()
    pointAt(null)
    pickUp(screen.getByTestId('ride'))
    moveTo(400, 400)
    release(400, 400)
    expect(screen.getByText('map: nothing')).toBeTruthy()
  })

  it('is called off by Escape', () => {
    mount()
    pointAt(screen.getByTestId('map'))
    pickUp(screen.getByTestId('ride'))
    moveTo(200, 200)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('.desk-drag-preview')).toBeNull()
    release(200, 200)
    expect(screen.getByText('map: nothing')).toBeTruthy()
  })

  it('is not a drag until the pointer has actually moved', () => {
    mount()
    pointAt(screen.getByTestId('map'))
    pickUp(screen.getByTestId('ride'))
    release(10, 10)
    expect(screen.getByText('map: nothing')).toBeTruthy()
    expect(document.querySelector('.desk-drag-preview')).toBeNull()
  })

  it('is never also a click on the thing it was picked up from', () => {
    mount()
    const ride = screen.getByTestId('ride')
    const clicked = vi.fn()
    ride.addEventListener('click', clicked)
    pointAt(screen.getByTestId('map'))
    pickUp(ride)
    moveTo(200, 200)
    release(200, 200)
    // The browser follows a captured release with a click on the capture target.
    fireEvent.click(ride)
    expect(clicked).not.toHaveBeenCalled()
    // But the next real click is a click.
    return new Promise<void>(resolve =>
      setTimeout(() => {
        fireEvent.click(ride)
        expect(clicked).toHaveBeenCalledOnce()
        resolve()
      }, 5),
    )
  })

  it('stops offering a target once it is gone', () => {
    const desk = mount()
    const map = screen.getByTestId('map')
    act(() => desk.close('map'))
    pointAt(map)
    pickUp(screen.getByTestId('ride'))
    moveTo(200, 200)
    release(200, 200)
    expect(screen.queryByText(/map:/)).toBeNull()
  })
})
