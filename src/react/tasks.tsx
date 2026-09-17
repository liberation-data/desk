import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './controls.js'

/*
 * The jobs a setup does while the person watches: install the realm, read the
 * documents, store the key. They run in order, each says how it is getting on,
 * and one that fails stops the rest and says why — with a retry that picks up
 * where it stopped, not from the top.
 */

export type TaskState = 'waiting' | 'working' | 'done' | 'failed'

export interface Task {
  readonly id: string
  readonly name: ReactNode
  /** The line under the name, until the task reports its own. */
  readonly detail?: ReactNode
  /** The work. `report` replaces the line under the name while it runs: "12 of 24". Throw to fail. */
  readonly run: (report: (detail: ReactNode) => void) => unknown
}

export interface TaskProgress {
  readonly id: string
  readonly name: ReactNode
  readonly state: TaskState
  readonly detail?: ReactNode
  /** Why it failed, for a person. */
  readonly error?: string
}

export interface Tasks {
  readonly items: readonly TaskProgress[]
  readonly running: boolean
  readonly done: boolean
  readonly failed: boolean
  /** Runs every task not yet done, in order. After a failure, this is the retry. */
  readonly start: () => void
  /** Forgets what ran and runs everything again: for a setup step entered a second time. */
  readonly restart: () => void
}

interface Status {
  readonly state: TaskState
  readonly reported?: ReactNode
  readonly error?: string
}

export function useTasks(tasks: readonly Task[]): Tasks {
  // The latest tasks, so a task's `run` sees the answers given since the step was drawn.
  const latest = useRef(tasks)
  latest.current = tasks
  const [status, setStatus] = useState<Readonly<Record<string, Status>>>({})
  const statusNow = useRef(status)
  statusNow.current = status
  // A run that has been superseded — by a restart, or by leaving — stops touching state.
  const generation = useRef(0)
  const [running, setRunning] = useState(false)

  useEffect(
    () => () => {
      generation.current += 1
    },
    [],
  )

  const run = useCallback(async (from: Readonly<Record<string, Status>>) => {
    const mine = ++generation.current
    const set = (id: string, next: Status) => {
      if (generation.current !== mine) return
      statusNow.current = { ...statusNow.current, [id]: next }
      setStatus(statusNow.current)
    }
    setRunning(true)
    for (const task of latest.current) {
      if (from[task.id]?.state === 'done') continue
      set(task.id, { state: 'working' })
      try {
        await task.run(detail => set(task.id, { state: 'working', reported: detail }))
        set(task.id, { state: 'done', reported: statusNow.current[task.id]?.reported })
      } catch (failure) {
        set(task.id, { state: 'failed', error: failure instanceof Error ? failure.message : String(failure) })
        break
      }
      if (generation.current !== mine) return
    }
    if (generation.current === mine) setRunning(false)
  }, [])

  const start = useCallback(() => {
    if (running) return
    void run(statusNow.current)
  }, [run, running])

  const restart = useCallback(() => {
    statusNow.current = {}
    setStatus({})
    void run({})
  }, [run])

  const items = tasks.map((task): TaskProgress => {
    const s = status[task.id]
    const detail = s?.reported ?? task.detail
    return {
      id: task.id,
      name: task.name,
      state: s?.state ?? 'waiting',
      ...(detail === undefined ? {} : { detail }),
      ...(s?.error === undefined ? {} : { error: s.error }),
    }
  })

  return {
    items,
    running,
    done: items.length > 0 && items.every(item => item.state === 'done'),
    failed: items.some(item => item.state === 'failed'),
    start,
    restart,
  }
}

export interface ChecklistProps {
  readonly items: readonly TaskProgress[]
  /** Offered beside a failed task. */
  readonly onRetry?: () => void
  /** A bar above the list, filling as tasks finish. Default true. */
  readonly progress?: boolean
  readonly label?: string
  readonly className?: string
}

/** Tasks as a person watches them: waiting, working, done, or failed with the reason. */
export function Checklist({ items, onRetry, progress = true, label = 'Progress', className }: ChecklistProps) {
  const done = items.filter(item => item.state === 'done').length
  return (
    <div className={['desk-checklist', className].filter(Boolean).join(' ')}>
      {progress && (
        <div
          className="desk-progress"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
        >
          <i style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
      )}
      <ul className="desk-tasks" aria-label={label}>
        {items.map(item => (
          <li key={item.id} className="desk-task" data-state={item.state}>
            <span className="desk-task-mark" aria-hidden="true">
              {item.state === 'done' ? '✓' : item.state === 'failed' ? '!' : ''}
            </span>
            <span className="desk-task-text">
              <span className="desk-task-name">{item.name}</span>
              {item.state === 'failed' ? (
                <span className="desk-task-error" role="alert">
                  {item.error}
                </span>
              ) : (
                item.detail !== undefined && <span className="desk-task-detail">{item.detail}</span>
              )}
            </span>
            {item.state === 'failed' && onRetry && (
              <Button size="small" onClick={onRetry}>
                Try again
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
