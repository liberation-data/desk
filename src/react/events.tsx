import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { perform } from '../core/commands.js'
import { createBus, InputCommands } from '../core/events.js'
import type { Bus, DeskEvent, EventHandler, InputDescription, SubscribeOptions } from '../core/events.js'
import type { WindowId } from '../core/types.js'
import { useCommand, useShortcuts } from './commands.js'
import { Composer } from './conversation.js'
import { useFocusTrap, useLayer } from './layers.js'
import { missingProvider } from './missingProvider.js'
import { BusContext, useDesk, useDeskState, useWindowId } from './context.js'

/** Supplies a bus of your own, or shares one across several desks. A desk already has one. */
export function BusProvider({ bus, children }: { readonly bus?: Bus; readonly children: ReactNode }) {
  const [value] = useState(() => bus ?? createBus())
  return <BusContext.Provider value={value}>{children}</BusContext.Provider>
}

export function useBus(): Bus {
  const bus = useContext(BusContext)
  if (!bus) throw missingProvider('useBus', 'a <DeskProvider> or <BusProvider>')
  return bus
}

/** Publishes an event, stamped with the window it came from. */
export function usePublish(): <T>(topic: string, payload: T) => DeskEvent<T> {
  const bus = useBus()
  const from = useWindowId()
  return useCallback((topic, payload) => bus.publish(topic, payload, { from }), [bus, from])
}

/** Answers events on a topic (`ride.selected`, `ride.*`, `*`) while mounted. */
export function useDeskEvent<T = unknown>(topic: string, handler: EventHandler<T>, options: SubscribeOptions = {}): void {
  const bus = useBus()
  const latest = useRef(handler)
  latest.current = handler
  const { replay } = options
  useEffect(() => bus.subscribe<T>(topic, event => latest.current(event), { replay: replay ?? false }), [bus, topic, replay])
}

export interface WindowInputOptions {
  readonly placeholder?: string
  /** What the bar says the text will reach. Defaults to the window's id. */
  readonly target?: string
  readonly disabled?: boolean
}

/**
 * Takes the text typed into the desk's input bar while this window is key.
 * A window that registers nothing lets the bar's own fallback have it.
 */
export function useWindowInput(handler: (text: string) => void, options: WindowInputOptions = {}): void {
  const windowId = useWindowId()
  const { placeholder, target, disabled } = options
  useCommand<string>(InputCommands.submit, handler, { enabled: !disabled })
  // The bar asks the chain how to present itself; the answer is written into the object it sends.
  useCommand<InputDescription>(InputCommands.describe, description => {
    if (placeholder) description.placeholder = placeholder
    const named = target ?? windowId
    if (named) description.target = named
    description.disabled = disabled ?? false
  })
}

export interface InputBarProps {
  /** Used when no window takes the text. */
  readonly onSubmit: (text: string) => void
  readonly fallbackPlaceholder?: string
  readonly fallbackTarget?: string
  readonly label?: string
  /**
   * `summoned` (the default) stays out of the way until called for, then opens
   * over the middle of the screen. `inline` is always there, wherever you put it.
   */
  readonly mode?: 'summoned' | 'inline'
  /** Summons the bar. Default `mod+j`; `null` binds nothing (a menu item may own the key). */
  readonly shortcut?: string | null
  readonly className?: string
}

/** One place to type, which reaches whichever window you are working in. */
export function InputBar({
  onSubmit,
  fallbackPlaceholder = 'Type here…',
  fallbackTarget,
  label = 'Type here',
  mode = 'summoned',
  shortcut = 'mod+j',
  className,
}: InputBarProps) {
  const desk = useDesk()
  const state = useDeskState()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(mode === 'inline')
  const [description, setDescription] = useState<InputDescription>({})
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  const summoned = mode === 'summoned'
  useCommand(InputCommands.open, () => setOpen(true), { at: 'app' })
  useShortcuts(useMemo(() => (shortcut && summoned ? { [shortcut]: InputCommands.open } : {}), [shortcut, summoned]))
  useLayer(id, summoned && open, () => setOpen(false))
  useFocusTrap(panel, summoned && open)

  // Re-ask whenever the key window changes, or the bar is summoned: it belongs to whoever is in front.
  const key: WindowId | null = state.stack.at(-1) ?? null
  useEffect(() => {
    if (!open) return
    const answer: InputDescription = {}
    perform(desk, InputCommands.describe, answer)
    setDescription(answer)
  }, [desk, key, open, id])

  if (!open) return null

  const submit = (text: string) => {
    if (!perform(desk, InputCommands.submit, text)) onSubmit(text)
    setValue('')
    if (summoned) setOpen(false)
  }

  const target = description.target ?? fallbackTarget
  const bar = (
    <div ref={panel} className={['desk-inputbar', className].filter(Boolean).join(' ')} data-mode={mode}>
      <Composer
        value={value}
        onChange={setValue}
        onSubmit={submit}
        label={label}
        placeholder={description.placeholder ?? fallbackPlaceholder}
        maxRows={4}
        {...(description.disabled ? { disabled: true } : {})}
      />
      {target && (
        <span className="desk-inputbar-target" aria-live="polite">
          goes to <b>{target}</b>
        </span>
      )}
    </div>
  )

  if (!summoned) return bar
  return createPortal(
    <div className="desk-inputbar-scrim" onPointerDown={event => event.target === event.currentTarget && setOpen(false)}>
      {bar}
    </div>,
    document.body,
  )
}
