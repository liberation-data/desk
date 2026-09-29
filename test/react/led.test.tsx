// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Led } from '../../src/react/index.js'

afterEach(cleanup)

describe('Led', () => {
  it('lights in the colour asked for', () => {
    const { container } = render(<Led color="amber" />)
    expect(container.querySelector('.desk-led')?.getAttribute('data-color')).toBe('amber')
  })

  it('stays out of the reading when words beside it say the state', () => {
    const { container } = render(<Led color="green" />)
    const led = container.querySelector('.desk-led')
    expect(led?.getAttribute('aria-hidden')).toBe('true')
    expect(led?.hasAttribute('role')).toBe(false)
  })

  it('is read aloud when it is the only thing saying the state', () => {
    render(<Led color="red" label="The provider refused the key" />)
    const led = screen.getByRole('img', { name: 'The provider refused the key' })
    expect(led.hasAttribute('aria-hidden')).toBe(false)
  })

  it('keeps the class an app gives it', () => {
    const { container } = render(<Led color="off" className="rack-led" />)
    expect(container.querySelector('.desk-led')?.classList.contains('rack-led')).toBe(true)
  })
})
