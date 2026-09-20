// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { useBus, useDeskState, useDocumentTitle, useToast } from '../../src/react/index.js'

afterEach(cleanup)

/*
 * The message is what a React error boundary shows; the stack is not. So the caller's own
 * hook — the line that has to change — has to be in the message.
 */

/** React logs the thrown error itself; the assertion is on what render() rethrows. */
const messageFrom = (ui: ReactElement): string => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(() => render(ui)).toThrow()
    try {
      render(ui)
      return ''
    } catch (thrown) {
      return (thrown as Error).message
    }
  } finally {
    error.mockRestore()
  }
}

function TitleWithoutDesk() {
  useDocumentTitle(id => id)
  return null
}

function BusWithoutDesk() {
  useBus()
  return null
}

function ToastWithoutProvider() {
  useToast()
  return null
}

function StateWithoutDesk() {
  useDeskState()
  return null
}

describe('a hook used outside its provider', () => {
  it('names the caller, not the context hook it reached', () => {
    const message = messageFrom(<TitleWithoutDesk />)
    expect(message).toContain('useDesk must be used inside a <DeskProvider>')
    expect(message).toContain('useDocumentTitle')
  })

  it('names the component when it read the context itself', () => {
    expect(messageFrom(<StateWithoutDesk />)).toContain('StateWithoutDesk')
  })

  it('says where the caller is', () => {
    expect(messageFrom(<TitleWithoutDesk />)).toMatch(/documentTitle\.ts:\d+/)
  })

  it('carries the caller for a bus too', () => {
    const message = messageFrom(<BusWithoutDesk />)
    expect(message).toContain('useBus must be used inside a <DeskProvider> or <BusProvider>')
    expect(message).toContain('BusWithoutDesk')
  })

  it('carries the caller for a toast too', () => {
    const message = messageFrom(<ToastWithoutProvider />)
    expect(message).toContain('useToast must be used inside a <ToastProvider>')
    expect(message).toContain('ToastWithoutProvider')
  })
})
