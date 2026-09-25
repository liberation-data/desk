// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFx } from '../../src/fx/index.js'
import { SoundsToggle } from '../../src/react/index.js'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('SoundsToggle', () => {
  it('is a switch, on by default, that mutes the fx it is given', () => {
    const fx = createFx()
    render(<SoundsToggle fx={fx} description="When a ride needs you" />)
    const toggle = screen.getByRole('switch', { name: 'Sounds' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('When a ride needs you')).toBeTruthy()
    fireEvent.click(toggle)
    expect(fx.muted()).toBe(true)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('follows a mute set elsewhere', () => {
    const fx = createFx()
    render(<SoundsToggle fx={fx} />)
    act(() => fx.setMuted(true))
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })
})
