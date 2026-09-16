// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBus, createDesk } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import {
  BusProvider,
  Desktop,
  DeskProvider,
  InputBar,
  useDeskEvent,
  usePublish,
  useWindowInput,
} from '../../src/react/index.js'

afterEach(cleanup)

interface Ride {
  readonly name: string
}

function Rides() {
  const publish = usePublish()
  const [filter, setFilter] = useState('')
  useWindowInput(text => setFilter(text), { placeholder: 'Filter rides…', target: 'Rides' })
  return (
    <>
      <button type="button" onClick={() => publish<Ride>('ride.selected', { name: 'Dandenongs loop' })}>
        Dandenongs loop
      </button>
      <p>{filter ? `filtered by ${filter}` : 'no filter'}</p>
    </>
  )
}

function MapView() {
  const [showing, setShowing] = useState('nothing')
  // Replay: the map often opens because a ride was chosen, a beat after the event.
  useDeskEvent<Ride>('ride.selected', event => setShowing(`${event.payload.name} (from ${event.from})`), { replay: true })
  return <p>{`map: ${showing}`}</p>
}

function Weather() {
  return <p>weather</p>
}

function mount(): { desk: Desk; fallback: ReturnType<typeof vi.fn> } {
  const desk = createDesk()
  const fallback = vi.fn()
  render(
    <DeskProvider desk={desk}>
      <BusProvider bus={createBus()}>
        <Desktop
          title={id => id}
          renderWindow={id => (id === 'rides' ? <Rides /> : id === 'map' ? <MapView /> : <Weather />)}
        />
        <InputBar onSubmit={fallback} fallbackPlaceholder="Ask anything…" fallbackTarget="Chat" />
      </BusProvider>
    </DeskProvider>,
  )
  return { desk, fallback }
}

describe('events between windows', () => {
  it('carries what happened, and which window it came from', () => {
    const { desk } = mount()
    act(() => {
      desk.open('rides')
      desk.open('map')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dandenongs loop' }))
    expect(screen.getByText('map: Dandenongs loop (from rides)')).toBeTruthy()
  })

  it('reaches a window that opens just after the event, when it asks for the replay', () => {
    const { desk } = mount()
    act(() => desk.open('rides'))
    fireEvent.click(screen.getByRole('button', { name: 'Dandenongs loop' }))
    act(() => desk.open('map'))
    expect(screen.getByText('map: Dandenongs loop (from rides)')).toBeTruthy()
  })
})

describe('InputBar', () => {
  const field = () => screen.getByRole('textbox', { name: 'Type here' })

  it('takes the placeholder and target from the key window', async () => {
    const { desk } = mount()
    expect(field().getAttribute('placeholder')).toBe('Ask anything…')
    expect(screen.getByText('Chat')).toBeTruthy()
    act(() => desk.open('rides'))
    expect(field().getAttribute('placeholder')).toBe('Filter rides…')
    expect(screen.getByText('Rides')).toBeTruthy()
  })

  it('gives the text to the key window', async () => {
    const user = userEvent.setup()
    const { desk, fallback } = mount()
    act(() => desk.open('rides'))
    await user.type(field(), 'dandenongs{Enter}')
    expect(screen.getByText('filtered by dandenongs')).toBeTruthy()
    expect(fallback).not.toHaveBeenCalled()
    expect(field()).toHaveProperty('value', '')
  })

  it('falls back when the key window takes no typed input', async () => {
    const user = userEvent.setup()
    const { desk, fallback } = mount()
    act(() => {
      desk.open('rides')
      desk.open('weather')
    })
    expect(field().getAttribute('placeholder')).toBe('Ask anything…')
    await user.type(field(), 'is it raining{Enter}')
    expect(fallback).toHaveBeenCalledWith('is it raining')
    expect(screen.getByText('no filter')).toBeTruthy()
  })

  it('follows the key window as it changes', async () => {
    const user = userEvent.setup()
    const { desk, fallback } = mount()
    act(() => {
      desk.open('rides')
      desk.open('weather')
    })
    await user.type(field(), 'first{Enter}')
    act(() => desk.focus('rides'))
    await user.type(field(), 'second{Enter}')
    expect(fallback).toHaveBeenCalledExactlyOnceWith('first')
    expect(screen.getByText('filtered by second')).toBeTruthy()
  })
})
