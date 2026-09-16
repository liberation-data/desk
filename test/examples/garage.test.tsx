// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../examples/garage/app.js'

/*
 * The sample, walked through the way a person would. The library has its own
 * tests; this one exists because a sample can only break when someone clicks —
 * a missing provider blanked the whole app and nothing noticed.
 */

afterEach(cleanup)

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
  window.location.hash = ''
})

const continueButton = () => screen.getByRole('button', { name: /Continue|Get started|Open the garage/ })
const dock = () => screen.getByRole('toolbar', { name: 'Garage dock' })

/** Through setup and onto the desktop. */
async function arrive(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(continueButton()) // Welcome
  await vi.waitFor(() => expect(continueButton()).toHaveProperty("disabled", false), { timeout: 4000 }) // the workshop check
  await user.click(continueButton()) // Workshop
  await user.click(continueButton()) // Rider — prefilled
  await user.click(continueButton()) // Bikes
  await user.click(screen.getByRole('button', { name: 'Check the key' }))
  await vi.waitFor(() => expect(screen.getByText(/Connected/)).toBeTruthy(), { timeout: 4000 })
  await user.click(continueButton()) // Weather
  await user.click(continueButton()) // Maps
  await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'All set' })).toBeTruthy(), { timeout: 4000 })
  await user.click(continueButton()) // Finishing
  await user.click(continueButton()) // Ready → the garage
}

describe('the garage sample', () => {
  it('walks through setup and lands on the desktop', async () => {
    const user = userEvent.setup()
    await arrive(user)
    expect(dock()).toBeTruthy()
    expect(screen.getByRole('menubar')).toBeTruthy()
    expect(document.querySelector('[data-desk-window="rides"]')).toBeTruthy()
  })

  it('opens every window in the dock without falling over', async () => {
    const user = userEvent.setup()
    await arrive(user)
    for (const name of ['Rides', 'Service', 'Map', 'Chat']) {
      await user.click(within(dock()).getByRole('button', { name }))
      expect(document.querySelector(`[data-desk-window]`)).toBeTruthy()
    }
    // And the rest, through the stacks.
    for (const [stack, item] of [
      ['Garage', 'Bikes'],
      ['Garage', 'Parts & wear'],
      ['Plan', 'Routes'],
      ['Plan', 'Weather'],
      ['Plan', 'Calendar'],
      ['System', 'Settings'],
      ['System', 'Shortcuts'],
      ['System', 'About'],
    ] as const) {
      await user.click(within(dock()).getByRole('button', { name: stack }))
      await user.click(within(screen.getByRole('dialog', { name: stack })).getByRole('button', { name: new RegExp(item) }))
    }
    expect(screen.getByRole('menubar')).toBeTruthy()
  })

  it('filters the rides and sends one to the map', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(dock()).getByRole('button', { name: 'Rides' }))
    await user.click(screen.getByRole('radio', { name: 'MTB' }))
    expect(screen.getByText('Lysterfield singletrack')).toBeTruthy()
    expect(screen.queryByText('Dandenongs loop')).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'All' }))
    await user.click(screen.getByText('Dandenongs loop'))
    await user.click(within(dock()).getByRole('button', { name: 'Map' }))
    expect(screen.getAllByText('Dandenongs loop').length).toBeGreaterThan(1)
  })

  it('marks a service job done, with a way back', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(dock()).getByRole('button', { name: 'Service' }))
    await user.click(screen.getAllByRole('button', { name: 'Mark done' })[0] as HTMLElement)
    const toast = screen.getByRole('status')
    expect(toast.textContent).toContain('done')
    await user.click(within(toast).getByRole('button', { name: 'Undo' }))
    expect(screen.getAllByRole('button', { name: 'Mark done' }).length).toBeGreaterThan(0)
  })

  it('answers in the chat window', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(dock()).getByRole('button', { name: 'Chat' }))
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'what needs doing on the chain?{Enter}')
    await vi.waitFor(() => expect(screen.getByText(/road chain is at/)).toBeTruthy(), { timeout: 4000 })
  })

  it('searches the whole garage from the menu bar', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Garage' }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Search/ }))
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'chain')
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
  })

  it('runs setup again from the menu', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Garage' }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Run setup again/ }))
    expect(screen.getByRole('heading', { name: 'Welcome to the garage' })).toBeTruthy()
  })
})
