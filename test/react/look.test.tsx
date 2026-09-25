// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeskProvider, DeskShell, useLook } from '../../src/react/index.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const root = () => document.documentElement

function ShowLook() {
  return <p>{useLook()}</p>
}

describe('look', () => {
  it('reads the device when the app does not choose', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })
    render(<DeskProvider><ShowLook /></DeskProvider>)
    expect(screen.getByText('windows')).toBeTruthy()
    expect(root().dataset.look).toBe('windows')
  })

  it('takes the app’s choice over the device', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' })
    render(<DeskShell look="gnome"><ShowLook /></DeskShell>)
    expect(screen.getByText('gnome')).toBeTruthy()
    expect(root().dataset.look).toBe('gnome')
  })

  it('follows a change of mind without a reload', () => {
    const { rerender } = render(<DeskProvider look="mac"><ShowLook /></DeskProvider>)
    rerender(<DeskProvider look="windows"><ShowLook /></DeskProvider>)
    expect(screen.getByText('windows')).toBeTruthy()
    expect(root().dataset.look).toBe('windows')
  })

  it('takes its mark off the page when the desk goes', () => {
    // Menus and popovers are portalled outside the desk, which is why the look is on the root at all;
    // a desk that has gone must not leave the page styled as one.
    const { unmount } = render(<DeskProvider look="gnome"><ShowLook /></DeskProvider>)
    unmount()
    expect(root().dataset.look).toBeUndefined()
  })

  it('is the device’s look outside any desk', () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })
    render(<ShowLook />)
    expect(screen.getByText('gnome')).toBeTruthy()
  })
})
