// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localSetupStore, useSetupProgress } from '../../src/react/index.js'
import type { SetupRecord, SetupStore } from '../../src/react/index.js'

afterEach(cleanup)
beforeEach(() => localStorage.clear())

interface Answers {
  readonly rider: string
  readonly maps: string
}

function Probe({ store }: { readonly store?: SetupStore<Answers> }) {
  const setup = useSetupProgress<Answers>({ key: 'garage', initial: { rider: '', maps: 'online' }, ...(store ? { store } : {}) })
  if (!setup.loaded) return <p>loading</p>
  return (
    <>
      <p>{`step ${setup.index} · ${setup.answers.rider || 'nobody'} · ${setup.answers.maps} · ${setup.finished ? 'finished' : 'not finished'}`}</p>
      <button type="button" onClick={() => setup.setIndex(setup.index + 1)}>Next</button>
      <button type="button" onClick={() => setup.answer({ rider: 'Jasper Blues' })}>Name</button>
      <button type="button" onClick={setup.finish}>Finish</button>
      <button type="button" onClick={setup.reset}>Reset</button>
    </>
  )
}

const press = (name: string) => act(() => void fireEvent.click(screen.getByRole('button', { name })))
const line = () => screen.getByText(/^step /).textContent

describe('useSetupProgress', () => {
  it('picks up where it was after a reload', async () => {
    const first = render(<Probe />)
    await screen.findByText(/^step /)
    press('Next')
    press('Next')
    press('Name')
    first.unmount()

    render(<Probe />)
    await screen.findByText(/^step /)
    expect(line()).toBe('step 2 · Jasper Blues · online · not finished')
  })

  it('remembers that setup is finished, until it is reset', async () => {
    const first = render(<Probe />)
    await screen.findByText(/^step /)
    press('Finish')
    first.unmount()

    const second = render(<Probe />)
    await screen.findByText(/^step /)
    expect(line()).toContain('finished')
    press('Reset')
    expect(line()).toBe('step 0 · nobody · online · not finished')
    second.unmount()

    render(<Probe />)
    await screen.findByText(/^step /)
    expect(line()).toBe('step 0 · nobody · online · not finished')
  })

  it('waits for a store that answers later, such as a server', async () => {
    let answer!: (record: SetupRecord<Answers>) => void
    const saved: SetupRecord<Answers>[] = []
    const server: SetupStore<Answers> = {
      load: () => new Promise(resolve => (answer = resolve)),
      save: record => void saved.push(record),
      clear: () => {},
    }
    render(<Probe store={server} />)
    expect(screen.getByText('loading')).toBeTruthy()
    await act(async () => answer({ index: 3, answers: { rider: 'Rod', maps: 'none' }, finished: false }))
    expect(line()).toBe('step 3 · Rod · none · not finished')
    press('Next')
    expect(saved.at(-1)).toEqual({ index: 4, answers: { rider: 'Rod', maps: 'none' }, finished: false })
  })

  it('fills in answers added since the record was saved', async () => {
    localSetupStore<Partial<Answers>>('garage').save({ index: 1, answers: { rider: 'Jasper Blues' }, finished: false })
    render(<Probe />)
    await screen.findByText(/^step /)
    expect(line()).toBe('step 1 · Jasper Blues · online · not finished')
  })
})
