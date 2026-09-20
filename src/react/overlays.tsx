import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { windowElement } from '../core/commands.js'
import { Button } from './controls.js'
import { useWindowId } from './context.js'
import { useFocusTrap, useLayer } from './layers.js'
import { missingProvider } from './missingProvider.js'

/*
 * Interruption, least to most (HIG.md §7): a popover belongs to one control, a
 * sheet to one window, an alert to the whole app, and a toast interrupts nothing.
 *
 * Escape always dismisses the topmost layer, so overlays share one stack rather
 * than each listening for their own key.
 */

/* ── Popover: a small task tied to one control ── */

export interface PopoverTriggerProps {
  readonly ref: RefObject<HTMLButtonElement | null>
  readonly 'aria-haspopup': 'dialog'
  readonly 'aria-expanded': boolean
  readonly onClick: () => void
}

export interface PopoverProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** The accessible name of the popover. */
  readonly label: string
  /** Renders the control the popover hangs from; spread the props it is given. */
  readonly trigger: (props: PopoverTriggerProps) => ReactElement
  readonly placement?: 'below' | 'above'
  readonly align?: 'start' | 'end'
  readonly children: ReactNode
}

export function Popover({ open, onOpenChange, label, trigger, placement = 'below', align = 'start', children }: PopoverProps) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useLayer(id, open, () => onOpenChange(false))
  useFocusTrap(panel, open)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !button.current?.contains(target)) onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, onOpenChange])

  return (
    <span className="desk-popover-anchor">
      {trigger({ ref: button, 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => onOpenChange(!open) })}
      {open && (
        <div ref={panel} role="dialog" aria-label={label} className="desk-popover" data-placement={placement} data-align={align}>
          {children}
        </div>
      )}
    </span>
  )
}

/* ── Sheet: a task that belongs to one window, and blocks only that window ── */

export interface SheetProps {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly title: string
  readonly description?: ReactNode
  /** Buttons, trailing-aligned. Cancel before the default button. */
  readonly actions?: ReactNode
  readonly children?: ReactNode
}

export function Sheet({ open, onDismiss, title, description, actions, children }: SheetProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const windowId = useWindowId()
  // A sheet blocks its own window and nothing else, so it lives inside that window. It is
  // found in the document rather than through a ref: a window's ref is attached after the
  // effects of the content it holds have already run.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!open) {
      setHost(null)
      return
    }
    const element = windowId ? windowElement(document, windowId) : null
    setHost(element instanceof HTMLElement ? element : document.body)
  }, [open, windowId])
  useLayer(id, open, onDismiss)
  useFocusTrap(panel, open && host !== null)
  if (!open || !host) return null

  return createPortal(
    <div className="desk-sheet-scrim">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="desk-sheet">
        <h2 id={`${id}-title`} className="desk-sheet-title">{title}</h2>
        {description && <p className="desk-sheet-description">{description}</p>}
        {children}
        {actions && <div className="desk-sheet-actions">{actions}</div>}
      </div>
    </div>,
    host,
  )
}

/* ── Alert: the app cannot continue until this is decided. Rare. ── */

export interface AlertProps {
  readonly open: boolean
  readonly title: string
  readonly message?: ReactNode
  /** The action the alert is asking about. */
  readonly confirmLabel: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly cancelLabel?: string
  /** Use for anything that cannot be undone. */
  readonly destructive?: boolean
}

export function Alert({ open, title, message, confirmLabel, onConfirm, onCancel, cancelLabel = 'Cancel', destructive }: AlertProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  useLayer(id, open, onCancel)
  useFocusTrap(panel, open)
  if (!open) return null

  return createPortal(
    <div className="desk-alert-scrim">
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={message ? `${id}-message` : undefined}
        className="desk-alert"
      >
        <h2 id={`${id}-title`} className="desk-alert-title">{title}</h2>
        {message && <p id={`${id}-message`} className="desk-alert-message">{message}</p>}
        <div className="desk-alert-actions">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button intent={destructive ? 'destructive' : 'default'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Toast: a background action finished; it interrupts nothing ── */

export interface Toast {
  readonly id: string
  readonly message: ReactNode
  readonly tone?: 'neutral' | 'ok' | 'bad'
  /** Usually Undo. Dismisses the toast when chosen. */
  readonly action?: { readonly label: string; readonly onSelect: () => void }
  /** Milliseconds. 0 keeps it until dismissed. Default 6000. */
  readonly duration?: number
}

export type ToastInput = Omit<Toast, 'id'> & { readonly id?: string }

interface ToastApi {
  show: (toast: ToastInput) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => setToasts(list => list.filter(t => t.id !== id)), [])
  const show = useCallback((toast: ToastInput) => {
    const id = toast.id ?? `toast-${(counter.current += 1)}`
    setToasts(list => [...list.filter(t => t.id !== id), { ...toast, id }])
    return id
  }, [])
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw missingProvider('useToast', 'a <ToastProvider>')
  return api
}

function ToastStack({ toasts, onDismiss }: { readonly toasts: readonly Toast[]; readonly onDismiss: (id: string) => void }) {
  if (!toasts.length) return null
  return createPortal(
    <div className="desk-toasts">
      {toasts.map(toast => (
        <ToastView key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>,
    document.body,
  )
}

function ToastView({ toast, onDismiss }: { readonly toast: Toast; readonly onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const duration = toast.duration ?? 6000

  useEffect(() => {
    if (!duration || paused) return
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [duration, paused, onDismiss])

  return (
    <div
      className="desk-toast"
      data-tone={toast.tone ?? 'neutral'}
      role={toast.tone === 'bad' ? 'alert' : 'status'}
      // Reading it, or reaching for Undo, should not start the clock against you.
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <span className="desk-toast-message">{toast.message}</span>
      {toast.action && (
        <Button
          size="small"
          intent="quiet"
          onClick={() => {
            toast.action?.onSelect()
            onDismiss()
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <Button size="small" intent="quiet" aria-label="Dismiss" onClick={onDismiss}>
        ✕
      </Button>
    </div>
  )
}
