// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { DeskProvider, useDocumentTitle } from '../../src/react/index.js'
import type { DocumentTitleOptions } from '../../src/react/index.js'

afterEach(cleanup)
beforeEach(() => {
  document.title = 'Garage'
})

const NAMES: Record<string, string> = { rides: 'Rides', service: 'Service' }

function Probe({ desk, options }: { readonly desk: Desk; readonly options?: DocumentTitleOptions }) {
  return (
    <DeskProvider desk={desk}>
      <Title {...(options ? { options } : {})} />
    </DeskProvider>
  )
}

function Title({ options }: { readonly options?: DocumentTitleOptions }) {
  useDocumentTitle(id => NAMES[id] ?? id, options)
  return null
}

const mount = (options?: DocumentTitleOptions) => {
  const desk = createDesk()
  const view = render(<Probe desk={desk} {...(options ? { options } : {})} />)
  return { desk, view }
}

describe('the browser title', () => {
  it('says what is in front, ahead of the app it is in', () => {
    const { desk } = mount()
    act(() => desk.open('rides'))
    expect(document.title).toBe('Rides — Garage')
  })

  it('follows the front window as the stack changes', () => {
    const { desk } = mount()
    act(() => desk.open('rides'))
    act(() => desk.open('service'))
    expect(document.title).toBe('Service — Garage')

    act(() => desk.focus('rides'))
    expect(document.title).toBe('Rides — Garage')

    act(() => desk.close('rides'))
    expect(document.title).toBe('Service — Garage')
  })

  it('is the app’s own name with nothing open', () => {
    const { desk } = mount()
    act(() => desk.open('rides'))
    act(() => desk.closeAll())
    expect(document.title).toBe('Garage')
  })

  it('takes the app’s name from the page, so the app is named in one place', () => {
    document.title = 'Workshop'
    const { desk } = mount()
    act(() => desk.open('rides'))
    expect(document.title).toBe('Rides — Workshop')
  })

  it('prefers a name it is given over the page’s', () => {
    const { desk } = mount({ app: 'Workshop', separator: ' · ' })
    act(() => desk.open('rides'))
    expect(document.title).toBe('Rides · Workshop')
  })

  it('leaves the page called what it was, when the desk goes away', () => {
    const { desk, view } = mount()
    act(() => desk.open('rides'))
    view.unmount()
    expect(document.title).toBe('Garage')
  })
})
