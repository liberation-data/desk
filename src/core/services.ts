/*
 * A SERVICE: SOMETHING THE DESK KEEPS GOING THAT IS NOT A WINDOW.
 *
 * A window's data dies with the window. Some of what an app knows has to outlive that: a count on
 * the dock for a window that is shut, or a list a window should not have to wait for when it opens.
 *
 * A service is a VALUE, readable by anything, and optionally a PROCESS that keeps the value true.
 *
 * IT RUNS WHILE SOMEBODY HOLDS IT. A desk holds the services it was given for as long as it is on
 * screen; a component that reads one with `useService` holds it for as long as it is mounted. The
 * process starts on the first hold and stops on the last release, so a window drawn without a desk
 * (a test, a preview) still gets its data, and a desk already running it costs that window nothing.
 * Holds are counted: two holders are independent, and neither's teardown may stop the service while
 * the other still needs it.
 *
 * A SERVICE DOES NOT KNOW HOW TO FETCH. Its process brings its own way of getting data, and its own
 * caching and retrying if it wants them. What is here is when it runs and who can read it.
 */

/** What a service's process is given to work with. */
export interface ServiceRun<T> {
  readonly now: () => T
  /** Replace the value and tell every reader. Setting the value it already has tells nobody. */
  readonly set: (next: T) => void
  /** False once this run has been stopped. Check it after every await, so a late answer is dropped. */
  readonly live: () => boolean
}

export interface ServiceOptions<T> {
  /** Named for a log line and a test, as a window is named by its id. */
  readonly id: string
  readonly initial: T
  /** The process, started on the first hold. What it returns is run on the last release. */
  readonly run?: (run: ServiceRun<T>) => (() => void) | void
}

export interface Service<T> {
  readonly id: string
  readonly now: () => T
  readonly set: (next: T) => void
  readonly subscribe: (listener: () => void) => () => void
  /** Keep it running. Gives back the release, which may be called more than once. */
  readonly hold: () => () => void
  /** True while anything holds it. */
  readonly running: () => boolean
}

/** Anything that can be held: a service of any value. */
export type Holdable = Pick<Service<unknown>, 'hold'>

export function createService<T>({ id, initial, run }: ServiceOptions<T>): Service<T> {
  let value = initial
  let holds = 0
  let stop: (() => void) | null = null
  const listeners = new Set<() => void>()

  const now = () => value
  const set = (next: T) => {
    if (Object.is(next, value)) return
    value = next
    for (const listener of [...listeners]) listener()
  }

  const start = () => {
    let live = true
    const ended = run?.({ now, set, live: () => live })
    stop = () => {
      live = false
      if (typeof ended === 'function') ended()
    }
  }

  const hold = () => {
    holds += 1
    if (holds === 1) start()
    let released = false
    return () => {
      if (released) return
      released = true
      holds -= 1
      if (holds > 0) return
      stop?.()
      stop = null
    }
  }

  return {
    id,
    now,
    set,
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    hold,
    running: () => holds > 0,
  }
}

/** Hold several at once, and give back one release for all of them. */
export function holdAll(services: readonly Holdable[]): () => void {
  const releases = services.map(service => service.hold())
  return () => {
    for (const release of releases) release()
  }
}
