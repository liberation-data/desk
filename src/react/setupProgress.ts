import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Where someone got to in setup, kept so that closing the tab on step four does
 * not send them back to step one, and so that a finished setup is not shown
 * again. The toolkit does not decide where that lives: this browser by default,
 * or the app's own server.
 *
 * Keep answers to what a person would mind retyping. Never a password or a key:
 * the default store is this browser's local storage.
 */

export interface SetupRecord<Answers> {
  readonly index: number
  readonly answers: Answers
  readonly finished: boolean
}

export interface SetupStore<Answers> {
  /** What was saved, or undefined when nothing was. May be async, for a server. */
  load(): SetupRecord<Answers> | undefined | Promise<SetupRecord<Answers> | undefined>
  save(record: SetupRecord<Answers>): void | Promise<void>
  clear(): void | Promise<void>
}

/** This browser's local storage. Quietly does nothing where storage is unavailable. */
export function localSetupStore<Answers>(key: string): SetupStore<Answers> {
  const name = `desk.setup.${key}`
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(name)
        return raw ? (JSON.parse(raw) as SetupRecord<Answers>) : undefined
      } catch {
        return undefined
      }
    },
    save(record) {
      try {
        globalThis.localStorage?.setItem(name, JSON.stringify(record))
      } catch {
        // Private windows and full storage: setup still works, it just is not remembered.
      }
    },
    clear() {
      try {
        globalThis.localStorage?.removeItem(name)
      } catch {
        // As above.
      }
    },
  }
}

export interface SetupProgress<Answers> {
  /** False until the store has answered; show nothing, or a quiet loading state, until then. */
  readonly loaded: boolean
  readonly index: number
  readonly setIndex: (index: number) => void
  readonly answers: Answers
  /** Merges into the answers: `answer({ rider: 'Jasper Blues' })`. */
  readonly answer: (patch: Partial<Answers>) => void
  readonly finished: boolean
  readonly finish: () => void
  /** Forgets everything: "Set up again". */
  readonly reset: () => void
}

export interface SetupProgressOptions<Answers> {
  /** Names what is being set up, so two setups do not share a record. */
  readonly key: string
  readonly initial: Answers
  /** Default: this browser's local storage. */
  readonly store?: SetupStore<Answers>
}

export function useSetupProgress<Answers extends object>({ key, initial, store }: SetupProgressOptions<Answers>): SetupProgress<Answers> {
  const storeRef = useRef(store ?? localSetupStore<Answers>(key))
  const initialRef = useRef(initial)
  const [record, setRecord] = useState<SetupRecord<Answers>>({ index: 0, answers: initial, finished: false })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let current = true
    void Promise.resolve(storeRef.current.load()).then(saved => {
      if (!current) return
      // Answers added since the record was saved take their initial values.
      if (saved) setRecord({ ...saved, answers: { ...initialRef.current, ...saved.answers } })
      setLoaded(true)
    })
    return () => {
      current = false
    }
  }, [])

  const update = useCallback((change: (record: SetupRecord<Answers>) => SetupRecord<Answers>) => {
    setRecord(previous => {
      const next = change(previous)
      void storeRef.current.save(next)
      return next
    })
  }, [])

  const setIndex = useCallback((index: number) => update(r => ({ ...r, index })), [update])
  const answer = useCallback((patch: Partial<Answers>) => update(r => ({ ...r, answers: { ...r.answers, ...patch } })), [update])
  const finish = useCallback(() => update(r => ({ ...r, finished: true })), [update])
  const reset = useCallback(() => {
    void storeRef.current.clear()
    setRecord({ index: 0, answers: initialRef.current, finished: false })
  }, [])

  return { loaded, index: record.index, setIndex, answers: record.answers, answer, finished: record.finished, finish, reset }
}
