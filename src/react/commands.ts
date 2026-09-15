import { useCallback, useContext, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { addCommandHandler, canPerform, perform } from '../core/commands.js'
import type { CommandHandler, CommandId } from '../core/commands.js'
import { bindShortcuts } from '../core/shortcuts.js'
import type { Keymap, ShortcutOptions } from '../core/shortcuts.js'
import { useDesk, WindowContext } from './context.js'

export interface UseCommandOptions {
  /** Whether the handler can act right now. Read when the command arrives and when a menu opens. */
  readonly enabled?: boolean | (() => boolean)
  /**
   * Where in the chain this responder sits.
   * - `'window'` (the default inside a window): the window this component is rendered in.
   * - `'app'` (the default outside windows): the top of the chain.
   * - a ref: that element, e.g. an editor that answers Copy only while it has focus.
   */
  readonly at?: 'window' | 'app' | RefObject<Element | null>
}

/** Answers a command when it reaches this component's place in the responder chain. */
export function useCommand<Args = unknown>(command: CommandId, handler: CommandHandler<Args>, options: UseCommandOptions = {}): void {
  const window = useContext(WindowContext)
  // Latest handler and enablement without re-registering on every render.
  const latest = useRef({ handler, enabled: options.enabled })
  latest.current = { handler, enabled: options.enabled }

  const at = options.at ?? (window ? 'window' : 'app')
  const ref = typeof at === 'object' ? at : at === 'window' ? window?.element : null

  useEffect(() => {
    const target: EventTarget | null | undefined = at === 'app' ? document : ref?.current
    if (!target) return
    return addCommandHandler<Args>(target, command, args => latest.current.handler(args), {
      enabled: () => {
        const enabled = latest.current.enabled
        return typeof enabled === 'function' ? enabled() : (enabled ?? true)
      },
    })
  }, [command, at, ref])
}

/** Returns a function that sends a command along the chain, and reports whether anything handled it. */
export function usePerform(): <Args = unknown>(command: CommandId, args?: Args) => boolean {
  const desk = useDesk()
  return useCallback((command, args) => perform(desk, command, args), [desk])
}

/** Returns a function that asks whether a command would be handled right now — what a menu calls as it opens. */
export function useCanPerform(): (command: CommandId) => boolean {
  const desk = useDesk()
  return useCallback(command => canPerform(desk, command), [desk])
}

/** Performs commands from keyboard shortcuts while mounted. Pass a stable keymap. */
export function useShortcuts(keymap: Keymap, options: ShortcutOptions = {}): void {
  const desk = useDesk()
  const { target, apple } = options
  useEffect(() => bindShortcuts(desk, keymap, { ...(target ? { target } : {}), ...(apple === undefined ? {} : { apple }) }), [desk, keymap, target, apple])
}
