// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTitleCase } from '../../src/core/index.js'
import { App, SURFACES } from '../../examples/garage/app.js'

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
  localStorage.clear()
})

/*
 * The sample's setup runs real, deliberate pauses — it is showing someone what setting up looks
 * like — and they come to about three seconds before "All set". A wait here is not a measurement of
 * that: it is the point at which a sample that never arrives is declared broken, so it is set well
 * clear of the work rather than just past it. `waitFor` returns the moment the condition holds, so
 * a ceiling this high costs nothing on a machine that is keeping up, and 4s cost a red build on one
 * that was not.
 */
const SETTLE = 10_000

const continueButton = () => screen.getByRole('button', { name: /Continue|Get started|Open the garage|Connect/ })
const dock = () => screen.getByRole('toolbar', { name: 'Garage dock' })

/** Through setup and onto the desktop. */
async function arrive(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Get started|Continue/ })) // Welcome
  await vi.waitFor(() => expect(continueButton()).toHaveProperty("disabled", false), { timeout: SETTLE }) // the workshop check
  await user.click(continueButton()) // Workshop
  await user.click(continueButton()) // Rider — prefilled
  await user.click(continueButton()) // Bikes
  await user.click(continueButton()) // Weather: checks the key before moving on
  await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'Where the maps come from' })).toBeTruthy(), { timeout: SETTLE })
  await user.click(continueButton()) // Maps
  await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'All set' })).toBeTruthy(), { timeout: SETTLE })
  await user.click(continueButton()) // Finishing
  await user.click(continueButton()) // Ready → the garage
}

describe('the garage sample', () => {
  it('names every window in title case', () => {
    expect(Object.values(SURFACES).map(s => s.title).filter(title => !isTitleCase(title))).toEqual([])
  })

  it('walks through setup and lands on the desktop, in the window chosen', async () => {
    const user = userEvent.setup()
    await arrive(user)
    expect(dock()).toBeTruthy()
    expect(screen.getByRole('menubar')).toBeTruthy()
    expect(document.querySelector('[data-desk-window="rides"]')?.hasAttribute('data-focused')).toBe(true)
  })

  it('resumes setup where it was after a reload, and skips it once finished', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.click(await screen.findByRole('button', { name: /Get started|Continue/ })) // Welcome
    await vi.waitFor(() => expect(continueButton()).toHaveProperty('disabled', false), { timeout: SETTLE })
    await user.click(continueButton()) // Workshop
    first.unmount()

    const second = render(<App />)
    expect(await screen.findByRole('heading', { name: 'Who is riding?' })).toBeTruthy()
    second.unmount()
    cleanup()
    localStorage.clear()

    await arrive(userEvent.setup())
    cleanup()
    render(<App />)
    expect(await screen.findByRole('menubar')).toBeTruthy()
  })

  it('offers the tour on arrival, and does not start it unasked', async () => {
    const user = userEvent.setup()
    await arrive(user)
    const offer = screen.getByRole('region', { name: 'Tour: What needs doing' })
    expect(within(offer).getByRole('button', { name: 'Show me' })).toBeTruthy()
    await user.click(within(offer).getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('region', { name: 'Tour: What needs doing' })).toBeNull()
  })

  it('keeps a weather key the service refuses on its step, and says why', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Get started|Continue/ })) // Welcome
    await vi.waitFor(() => expect(continueButton()).toHaveProperty('disabled', false), { timeout: SETTLE })
    await user.click(continueButton()) // Workshop
    await user.click(continueButton()) // Rider
    await user.click(continueButton()) // Bikes
    const field = screen.getByLabelText('Service key')
    await user.clear(field)
    await user.type(field, 'not-a-key')
    await user.click(screen.getByRole('button', { name: 'Connect' }))
    expect(screen.getByRole('button', { name: 'Checking the key…' })).toBeTruthy()
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('did not accept'), { timeout: SETTLE })
    expect(screen.getByRole('heading', { name: 'Connect a weather service' })).toBeTruthy()
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
      ['Garage', 'Parts & Wear'],
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

  it('has one switch for its sounds, in Settings, that it remembers', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(dock()).getByRole('button', { name: 'System' }))
    await user.click(within(screen.getByRole('dialog', { name: 'System' })).getByRole('button', { name: /Settings/ }))
    const sounds = screen.getByRole('switch', { name: 'Play sounds' })
    expect(sounds.getAttribute('aria-checked')).toBe('true')
    await user.click(sounds)
    expect(sounds.getAttribute('aria-checked')).toBe('false')
    expect(localStorage.getItem('garage.sounds-muted')).toBe('yes')
    // Each can be heard from here, and nowhere else plays one unasked. jsdom has no audio: silent.
    for (const name of ['Attention', 'Ready', 'Failed']) expect(screen.getByRole('button', { name })).toBeTruthy()
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
    await vi.waitFor(() => expect(screen.getByText(/road chain is at/)).toBeTruthy(), { timeout: SETTLE })
  })

  it('searches the whole garage from the menu bar', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Garage' }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Search/ }))
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'chain')
    // Results arrive after the typing, not with it: search may be async.
    expect((await screen.findAllByRole('option')).length).toBeGreaterThan(0)
  })

  it('runs setup again from the menu', async () => {
    const user = userEvent.setup()
    await arrive(user)
    await user.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Garage' }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Run setup again/ }))
    expect(screen.getByRole('heading', { name: 'Welcome to the garage' })).toBeTruthy()
  })
})
