// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextField, Wizard } from '../../src/react/index.js'
import type { WizardStep } from '../../src/react/index.js'

afterEach(cleanup)

function Harness({ onFinish = () => {}, onSkipKey = () => {} }: { readonly onFinish?: () => void; readonly onSkipKey?: () => void }) {
  const [index, setIndex] = useState(0)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [installed, setInstalled] = useState(false)

  const steps: WizardStep[] = [
    { id: 'welcome', name: 'Welcome', title: 'Welcome to the garage', description: 'This takes a minute.' },
    {
      id: 'rider',
      name: 'Rider',
      title: 'Who is riding?',
      complete: name.trim().length > 1,
      body: <TextField label="Your name" value={name} onChange={e => setName(e.target.value)} />,
    },
    {
      id: 'key',
      name: 'Key',
      title: 'Connect a weather service',
      complete: key.length > 3,
      skip: { label: 'Set up later', onSkip: onSkipKey },
      body: <TextField label="API key" value={key} onChange={e => setKey(e.target.value)} />,
    },
    {
      id: 'finishing',
      name: 'Finishing',
      title: 'Setting things up',
      working: true,
      complete: installed,
      continueLabel: 'Continue',
      onEnter: () => setInstalled(true),
    },
    { id: 'ready', name: 'Ready', title: 'Ready to ride', continueLabel: 'Start' },
  ]

  return <Wizard steps={steps} index={index} onIndexChange={setIndex} onFinish={onFinish} />
}

const heading = () => screen.getByRole('heading', { level: 1 })
const continueButton = () => screen.getByRole('button', { name: /Continue|Done|Start/ })

describe('Wizard', () => {
  it('shows one step at a time, and says where it is', () => {
    render(<Harness />)
    expect(heading().textContent).toBe('Welcome to the garage')
    const dots = within(screen.getByRole('list', { name: 'Progress' })).getAllByRole('listitem')
    expect(dots).toHaveLength(5)
    expect(dots[0]?.getAttribute('aria-current')).toBe('step')
  })

  it('will not continue until the step is answered', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(continueButton())
    expect(continueButton()).toHaveProperty('disabled', true)
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Jasper')
    expect(continueButton()).toHaveProperty('disabled', false)
  })

  it('goes back over what was answered, keeping the answer', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(continueButton())
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Jasper')
    await user.click(continueButton())
    expect(heading().textContent).toBe('Connect a weather service')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveProperty('value', 'Jasper')
  })

  it('has no Back on the first step', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('offers a quiet way past a step that can wait', async () => {
    const user = userEvent.setup()
    const onSkipKey = vi.fn()
    render(<Harness onSkipKey={onSkipKey} />)
    await user.click(continueButton())
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Jasper')
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'Set up later' }))
    expect(onSkipKey).toHaveBeenCalledOnce()
  })

  it('waits on a working step, and does not offer to go back from it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(continueButton())
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Jasper')
    await user.click(continueButton())
    await user.type(screen.getByRole('textbox', { name: 'API key' }), 'abcd')
    await user.click(continueButton())
    expect(heading().textContent).toBe('Setting things up')
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('finishes from the last step', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<Harness onFinish={onFinish} />)
    await user.click(continueButton())
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Jasper')
    await user.click(continueButton())
    await user.type(screen.getByRole('textbox', { name: 'API key' }), 'abcd')
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'Continue' })) // past the working step
    expect(heading().textContent).toBe('Ready to ride')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('moves focus to the new step, so it is announced', () => {
    render(<Harness />)
    expect(document.activeElement).toBe(heading())
    fireEvent.click(continueButton())
    expect(document.activeElement).toBe(heading())
    expect(heading().textContent).toBe('Who is riding?')
  })
})
