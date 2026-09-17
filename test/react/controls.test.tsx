// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, ChoiceGroup, SegmentedControl, TextField, Toggle } from '../../src/react/index.js'

afterEach(cleanup)

describe('Button', () => {
  it('is a button that does not submit unless asked', () => {
    render(<Button>Save ride</Button>)
    expect(screen.getByRole('button', { name: 'Save ride' }).getAttribute('type')).toBe('button')
  })

  it('marks the one action a view leads with', () => {
    render(<Button intent="default">Save ride</Button>)
    expect(screen.getByRole('button').dataset.intent).toBe('default')
  })

  it('does not act while disabled', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Delete</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('keeps an icon out of the accessible name', () => {
    render(<Button icon={<svg />} aria-label="Close">{null}</Button>)
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})

describe('SegmentedControl', () => {
  const OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'road', label: 'Road' },
    { value: 'gravel', label: 'Gravel', disabled: true },
    { value: 'mtb', label: 'MTB' },
  ] as const

  function Harness() {
    const [value, setValue] = useState<(typeof OPTIONS)[number]['value']>('all')
    return <SegmentedControl label="Filter by bike" options={OPTIONS} value={value} onChange={setValue} />
  }

  it('is a radio group with one checked option', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Filter by bike' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true')
  })

  it('selects on click', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('radio', { name: 'Road' }))
    expect(screen.getByRole('radio', { name: 'Road' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('false')
  })

  it('is one tab stop, and arrow keys move the selection past disabled options', () => {
    render(<Harness />)
    const radios = screen.getAllByRole('radio')
    expect(radios.filter(r => r.tabIndex === 0)).toHaveLength(1)
    radios[0]?.focus()
    fireEvent.keyDown(radios[0] as HTMLElement, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Road' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'MTB' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('Toggle', () => {
  function Harness() {
    const [on, setOn] = useState(false)
    return <Toggle checked={on} onChange={setOn} label="Service reminders" description="Remind me at 90% wear" />
  }

  it('is a switch labelled by its row, described by its note', () => {
    render(<Harness />)
    const toggle = screen.getByRole('switch', { name: 'Service reminders' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Remind me at 90% wear').id).toBe(toggle.getAttribute('aria-describedby'))
  })

  it('flips on click and from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await user.keyboard('{ }')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('can stand alone with an aria-label', () => {
    render(<Toggle checked onChange={() => {}} aria-label="Kilometres" />)
    expect(screen.getByRole('switch', { name: 'Kilometres' })).toBeTruthy()
  })
})

describe('TextField', () => {
  it('links its label and help text', () => {
    render(<TextField label="Rider name" help="Shown on exported rides" />)
    const input = screen.getByRole('textbox', { name: 'Rider name' })
    expect(screen.getByText('Shown on exported rides').id).toBe(input.getAttribute('aria-describedby'))
  })

  it('marks itself invalid and points at the error', () => {
    render(<TextField label="Wheel size" error="Enter a size in millimetres, like 622" />)
    const input = screen.getByRole('textbox', { name: 'Wheel size' })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(/millimetres/).id).toBe(input.getAttribute('aria-describedby'))
  })

  it('shows the error instead of the help text', () => {
    render(<TextField label="Wheel size" help="Usually 622" error="Enter a number" />)
    expect(screen.queryByText('Usually 622')).toBeNull()
  })

  it('keeps a hidden label available to assistive technology', () => {
    render(<TextField label="Search rides" labelHidden placeholder="Search" />)
    expect(screen.getByRole('textbox', { name: 'Search rides' })).toBeTruthy()
  })

  it('types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TextField label="Rider name" onChange={onChange} />)
    await user.type(screen.getByRole('textbox'), 'Jasper')
    expect(onChange).toHaveBeenCalledTimes(6)
  })
})

describe('ChoiceGroup', () => {
  function Maps({ onChange = () => {} }: { readonly onChange?: (value: string) => void }) {
    const [value, setValue] = useState<'online' | 'offline' | 'none'>('online')
    return (
      <ChoiceGroup
        label="Map source"
        value={value}
        onChange={next => {
          setValue(next)
          onChange(next)
        }}
        options={[
          { value: 'online', label: 'As you go', description: 'Nothing to download.' },
          { value: 'offline', label: 'On this machine', tag: '~1.1 GB', description: 'Works with no signal.' },
          { value: 'none', label: 'Not now', disabled: true },
        ]}
      />
    )
  }

  it('is a group of radios, one of them chosen, named by its label', () => {
    render(<Maps />)
    const group = screen.getByRole('group', { name: 'Map source' })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(new Set(radios.map(r => r.getAttribute('name'))).size).toBe(1)
    expect(screen.getByRole('radio', { name: /As you go/ })).toHaveProperty('checked', true)
    expect(screen.getByRole('radio', { name: /On this machine/ }).getAttribute('aria-describedby')).toBeTruthy()
  })

  it('chooses a card when it is pressed anywhere', () => {
    const onChange = vi.fn()
    render(<Maps onChange={onChange} />)
    fireEvent.click(screen.getByText('Works with no signal.'))
    expect(onChange).toHaveBeenCalledWith('offline')
    expect(screen.getByRole('radio', { name: /On this machine/ })).toHaveProperty('checked', true)
  })

  it('does not choose a disabled card', () => {
    const onChange = vi.fn()
    render(<Maps onChange={onChange} />)
    fireEvent.click(screen.getByText('Not now'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
