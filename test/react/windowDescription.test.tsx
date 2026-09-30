// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { DeskProvider, Desktop, Tabs, useWindowInfo, useWindowNote } from '../../src/react/index.js'

afterEach(cleanup)

type View = 'runs' | 'logs' | 'plain'

const ENDPOINT: Record<View, string | null> = { runs: '/api/v1/runs', logs: '/api/v1/logs', plain: null }
const ABOUT: Record<View, ReactNode> = { runs: <p>Every run.</p>, logs: null, plain: null }

let took: { note: boolean; info: boolean } | null = null

function Panel({ view }: { readonly view: View }) {
  took = { note: useWindowNote(ENDPOINT[view]), info: useWindowInfo(ABOUT[view]) }
  return <p>{view}</p>
}

function Tabbed() {
  const [view, setView] = useState<View>('runs')
  return (
    <Tabs
      label="Jobs"
      value={view}
      onChange={setView}
      tabs={[
        { value: 'runs', label: 'Runs' },
        { value: 'logs', label: 'Logs' },
        { value: 'plain', label: 'Plain' },
      ]}
    >
      <Panel view={view} />
    </Tabs>
  )
}

const mount = (content: ReactNode = <Tabbed />) => {
  const desk = createDesk()
  render(
    <DeskProvider desk={desk}>
      <Desktop
        title={id => id}
        note={id => `/api/v1/${id}`}
        info={() => <p>About the window.</p>}
        renderWindow={id => (id === 'jobs' ? content : <p>{id}</p>)}
      />
    </DeskProvider>,
  )
  act(() => {
    desk.open('jobs')
    desk.open('other')
  })
  return desk
}

const noteOf = (id: string) => document.querySelector(`[data-desk-window="${id}"] .desk-window-note`)?.textContent ?? null
const infoOf = (id: string) => {
  const button = document.querySelector<HTMLElement>(`[data-desk-window="${id}"] button.desk-window-info`)
  if (!button) return null
  if (!button.hasAttribute('data-open')) fireEvent.click(button)
  return document.querySelector('.desk-infotip-body')?.textContent ?? null
}

describe('a note reported from inside a window', () => {
  it('replaces the note the window was given, in that window only', () => {
    mount()
    expect(noteOf('jobs')).toBe('/api/v1/runs')
    expect(noteOf('other')).toBe('/api/v1/other')
    expect(took?.note).toBe(true)
  })

  it('follows the tabs', () => {
    mount()
    fireEvent.click(screen.getByRole('tab', { name: 'Logs' }))
    expect(noteOf('jobs')).toBe('/api/v1/logs')
  })

  it('gives the window its own note back when the view reports nothing', () => {
    mount()
    fireEvent.click(screen.getByRole('tab', { name: 'Plain' }))
    expect(noteOf('jobs')).toBe('/api/v1/jobs')
  })

  it('takes the note away when the view reports false', () => {
    mount(<NoNote />)
    expect(noteOf('jobs')).toBeNull()
  })

  it('gives the window its own note back when the view unmounts', () => {
    mount(<Toggle />)
    expect(noteOf('jobs')).toBe('/api/v1/toggled')
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(noteOf('jobs')).toBe('/api/v1/jobs')
  })

  it('tells content outside any window that nothing took it', () => {
    render(<Panel view="runs" />)
    expect(took).toEqual({ note: false, info: false })
  })
})

describe('an (i) reported from inside a window', () => {
  it('replaces what the window was given, and gives it back when the view reports nothing', () => {
    mount()
    expect(infoOf('jobs')).toBe('Every run.')
    expect(took?.info).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Logs' }))
    expect(infoOf('jobs')).toBe('About the window.')
  })
})

function NoNote() {
  useWindowNote(false)
  return null
}

function Toggle() {
  const [shown, setShown] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setShown(false)}>
        Hide
      </button>
      {shown && <Reports note="/api/v1/toggled" />}
    </>
  )
}

function Reports({ note }: { readonly note: string }) {
  useWindowNote(note)
  return null
}
