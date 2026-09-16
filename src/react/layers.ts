import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/*
 * What every overlay needs: a shared stack so Escape dismisses the topmost one
 * rather than all of them, and a focus trap that gives focus back on the way out.
 */

const layers: string[] = []
const isTopLayer = (id: string) => layers.at(-1) === id

export function useLayer(id: string, open: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!open) return
    layers.push(id)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isTopLayer(id)) return
      event.preventDefault()
      event.stopPropagation()
      onEscape()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      const at = layers.lastIndexOf(id)
      if (at >= 0) layers.splice(at, 1)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  })
}

const TABBABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

const tabbable = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(el => !el.closest('[inert]'))

/** Holds keyboard focus inside `panel` while open, and gives it back on close. */
export function useFocusTrap(panel: RefObject<HTMLElement | null>, open: boolean) {
  const returnTo = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = panel.current && (tabbable(panel.current)[0] ?? panel.current)
    first?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel.current) return
      const stops = tabbable(panel.current)
      if (!stops.length) return
      const [first, last] = [stops[0] as HTMLElement, stops.at(-1) as HTMLElement]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !panel.current.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (returnTo.current?.isConnected) returnTo.current.focus({ preventScroll: true })
    }
  }, [open, panel])
}

