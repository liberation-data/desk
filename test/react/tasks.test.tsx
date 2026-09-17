// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Checklist, useTasks } from '../../src/react/index.js'
import type { Task } from '../../src/react/index.js'

afterEach(cleanup)

/** Work the test finishes by hand. */
function gate() {
  let open!: () => void
  let fail!: (error: Error) => void
  const promise = new Promise<void>((resolve, reject) => {
    open = resolve
    fail = reject
  })
  return { promise, open, fail }
}

function Setup({ tasks }: { readonly tasks: readonly Task[] }) {
  const run = useTasks(tasks)
  return (
    <>
      <button type="button" onClick={run.start}>Start</button>
      <button type="button" onClick={run.restart}>Restart</button>
      <output>{run.done ? 'all done' : run.failed ? 'stopped' : run.running ? 'running' : 'idle'}</output>
      <Checklist items={run.items} onRetry={run.start} label="Setting up" />
    </>
  )
}

const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement
const status = () => screen.getByRole('status').textContent ?? screen.getByText(/all done|stopped|running|idle/).textContent

describe('useTasks and Checklist', () => {
  it('runs tasks one after another, showing which is working', async () => {
    const install = gate()
    const read = gate()
    render(
      <Setup
        tasks={[
          { id: 'install', name: 'Save the profile', run: () => install.promise },
          { id: 'read', name: 'Import the rides', detail: 'Waiting for the profile', run: () => read.promise },
        ]}
      />,
    )
    expect(row('Save the profile').dataset.state).toBe('waiting')
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(row('Save the profile').dataset.state).toBe('working')
    expect(row('Import the rides').dataset.state).toBe('waiting')
    await act(async () => install.open())
    expect(row('Save the profile').dataset.state).toBe('done')
    expect(row('Import the rides').dataset.state).toBe('working')
    expect(screen.getByRole('progressbar', { name: 'Setting up' }).getAttribute('aria-valuenow')).toBe('1')
    await act(async () => read.open())
    expect(screen.getByText('all done')).toBeTruthy()
  })

  it('lets a task say how it is getting on', async () => {
    const finish = gate()
    render(
      <Setup
        tasks={[
          {
            id: 'import',
            name: 'Import rides',
            run: async report => {
              report('12 of 24')
              await finish.promise
              report('24 of 24')
            },
          },
        ]}
      />,
    )
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })))
    expect(within(row('Import rides')).getByText('12 of 24')).toBeTruthy()
    await act(async () => finish.open())
    expect(within(row('Import rides')).getByText('24 of 24')).toBeTruthy()
  })

  it('stops at a failure, says why, and retries from the task that failed', async () => {
    let installs = 0
    let reads = 0
    render(
      <Setup
        tasks={[
          { id: 'install', name: 'Save the profile', run: () => void (installs += 1) },
          {
            id: 'read',
            name: 'Import the rides',
            run: () => {
              reads += 1
              if (reads === 1) throw new Error('The ride log could not be opened. Check it still exists.')
            },
          },
          { id: 'watch', name: 'Watch for new ones', run: () => {} },
        ]}
      />,
    )
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })))
    expect(row('Import the rides').dataset.state).toBe('failed')
    expect(within(row('Import the rides')).getByRole('alert').textContent).toContain('could not be opened')
    expect(row('Watch for new ones').dataset.state).toBe('waiting')
    expect(screen.getByText('stopped')).toBeTruthy()

    await act(async () => fireEvent.click(within(row('Import the rides')).getByRole('button', { name: 'Try again' })))
    expect(screen.getByText('all done')).toBeTruthy()
    expect(installs).toBe(1)
    expect(reads).toBe(2)
  })

  it('runs everything again on restart', async () => {
    let installs = 0
    render(<Setup tasks={[{ id: 'install', name: 'Save the profile', run: () => void (installs += 1) }]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Restart' })))
    expect(installs).toBe(2)
    expect(status()).toBe('all done')
  })
})
