/*
 * A hook that needs a provider names a hook its author never called: `useDesk`, reached through
 * `useDeskState`, reached through their own `useDocumentTitle`. An error boundary shows the
 * message and not the stack, so the message carries the first frame outside the accessors that
 * only re-expose a context — the line that has to change.
 */
const ACCESSORS = new Set(['caller', 'missingProvider', 'useDesk', 'useOptionalDesk', 'useDeskState', 'useBus', 'useToast'])

/** `at Object.name (loc)` and `name@loc`: V8 or not, either engine can be the one that throws. */
const FRAME = /^\s*(?:at\s+(?:[\w$.]*?([\w$]+)\s+\()?|([\w$]+)@)(.+?)\)?$/

function caller(): string {
  for (const line of (new Error().stack ?? '').split('\n')) {
    const frame = FRAME.exec(line)
    const name = frame?.[1] ?? frame?.[2]
    if (frame && name && !ACCESSORS.has(name)) return ` — called from ${name} (${frame[3]})`
  }
  return ''
}

/** What a context hook throws when its provider is missing, pointed at the caller. */
export const missingProvider = (hook: string, provider: string): Error =>
  new Error(`${hook} must be used inside ${provider}${caller()}`)
