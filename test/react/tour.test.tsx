// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDesk, focusedId } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { Desktop, DeskProvider, TourBar } from '../../src/react/index.js'
import type { Tour } from '../../src/react/index.js'

afterEach(cleanup)

const TOUR: Tour = {
  id: 'first',
  name: 'Find what needs doing',
  steps: [
    { window: 'service', point: 'first-job', caption: 'Here is what the bikes need.' },
    { window: 'parts', point: 'chain-wear', caption: 'Wear is counted from the rides.' },
    { window: 'parts', caption: 'Mark the chain done when you have replaced it.', yourTurn: true },
  ],
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function mount() {
  const desk = createDesk()
  const onFinish = vi.fn()
  const onStop = vi.fn()
  render(
    <DeskProvider desk={desk}>
      <Desktop
        title={id => id}
        renderWindow={id =>
          id === 'service' ? <p data-tour="first-job">Replace the road chain</p> : <p data-tour="chain-wear">Chain: 95% worn</p>
        }
      />
      <TourBar tour={TOUR} onFinish={onFinish} onStop={onStop} />
    </DeskProvider>,
  )
  return { desk, onFinish, onStop }
}

/** The bar points a frame after the window opens, so tests wait for that frame. */
const settle = async () => {
  await act(async () => {
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
  })
}

const next = () => fireEvent.click(screen.getByRole('button', { name: /Next|Finish/ }))
const pointed = () => document.querySelector('[data-desk-tour-pointed]')

describe('TourBar', () => {
  it('opens the window each step is about', async () => {
    const { desk } = mount()
    await settle()
    expect(focusedId(desk.getState())).toBe('service')
    next()
    await settle()
    expect(focusedId(desk.getState())).toBe('parts')
  })

  it('points at the control it is talking about, and stops pointing when it moves on', async () => {
    mount()
    await settle()
    expect(pointed()?.textContent).toBe('Replace the road chain')
    next()
    await settle()
    expect(pointed()?.textContent).toBe('Chain: 95% worn')
  })

  it('counts the steps and says where it is', async () => {
    mount()
    await settle()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
    expect(screen.getByText('Here is what the bikes need.')).toBeTruthy()
    next()
    await settle()
    expect(screen.getByText('Step 2 of 3')).toBeTruthy()
  })

  it('goes back, and cannot go back from the first step', async () => {
    mount()
    await settle()
    expect(screen.getByRole('button', { name: '‹ Back' })).toHaveProperty('disabled', true)
    next()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }))
    await settle()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
  })

  it('hands over on a your-turn step', async () => {
    const { onFinish } = mount()
    await settle()
    next()
    await settle()
    next()
    await settle()
    expect(screen.getByText('Your turn')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Next/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('can be restarted, and stopped', async () => {
    const { onStop } = mount()
    await settle()
    next()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    await settle()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop the tour' }))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('leaves nothing pointed at once it is gone', async () => {
    const { unmount } = (() => {
      const result = mount()
      return { ...result, unmount: cleanup }
    })()
    await settle()
    expect(pointed()).toBeTruthy()
    unmount()
    expect(pointed()).toBeNull()
  })
})
