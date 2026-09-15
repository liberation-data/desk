import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { focusedId } from '../core/desk.js'
import type { DeskWindow, Frame, WindowId } from '../core/types.js'
import { useDesk, useDeskState } from './context.js'

export interface DesktopProps {
  readonly renderWindow: (id: WindowId) => ReactNode
  readonly title: (id: WindowId) => ReactNode
  /** Shown when no window is open. */
  readonly empty?: ReactNode
  readonly className?: string
}

const MIN_WIDTH = 240
const MIN_HEIGHT = 160

/** One column, then two side by side, then the smallest square grid that fits. */
const columnsFor = (tiled: number) => (tiled <= 2 ? Math.max(1, tiled) : Math.ceil(Math.sqrt(tiled)))

export function Desktop({ renderWindow, title, empty, className }: DesktopProps) {
  const desk = useDesk()
  const state = useDeskState()
  const stage = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    desk.setStage(() => ({ width: stage.current?.clientWidth ?? 1024, height: stage.current?.clientHeight ?? 768 }))
  }, [desk])

  const tiled = state.windows.filter(w => w.mode === 'tiled').length
  const focused = focusedId(state)
  const style = { '--desk-columns': columnsFor(tiled) } as CSSProperties

  return (
    <div ref={stage} className={['desk-stage', className].filter(Boolean).join(' ')} style={style}>
      {state.windows.length === 0 && empty}
      {state.windows.map(window => (
        <WindowView
          key={window.id}
          window={window}
          depth={state.stack.indexOf(window.id)}
          focused={window.id === focused}
          title={title(window.id)}
        >
          {renderWindow(window.id)}
        </WindowView>
      ))}
    </div>
  )
}

interface WindowViewProps {
  readonly window: DeskWindow
  readonly depth: number
  readonly focused: boolean
  readonly title: ReactNode
  readonly children: ReactNode
}

type Gesture = 'move' | 'resize'

function WindowView({ window, depth, focused, title, children }: WindowViewProps) {
  const desk = useDesk()
  // While dragging, the frame lives here and commits once on release, so a drag
  // re-renders one window rather than notifying every subscriber per pixel.
  const [live, setLive] = useState<Frame | null>(null)
  const titleId = `desk-title-${window.id}`

  const startGesture = (gesture: Gesture) => (event: ReactPointerEvent<HTMLElement>) => {
    if (window.mode !== 'floating' || event.button !== 0) return
    if (gesture === 'move' && (event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const origin = window.frame
    const startX = event.clientX
    const startY = event.clientY
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    let latest = origin

    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - startX
      const dy = move.clientY - startY
      latest =
        gesture === 'move'
          ? { ...origin, x: origin.x + dx, y: Math.max(0, origin.y + dy) }
          : { ...origin, width: Math.max(MIN_WIDTH, origin.width + dx), height: Math.max(MIN_HEIGHT, origin.height + dy) }
      setLive(latest)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      setLive(null)
      if (latest !== origin) desk.float(window.id, latest)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const frame = window.mode === 'floating' ? (live ?? window.frame) : null
  const style: CSSProperties | undefined = frame
    ? { left: frame.x, top: frame.y, width: frame.width, height: frame.height, zIndex: 10 + depth }
    : undefined

  return (
    <section
      className="desk-window"
      data-mode={window.mode}
      data-focused={focused || undefined}
      data-dragging={live ? true : undefined}
      aria-labelledby={titleId}
      style={style}
      onPointerDownCapture={() => {
        if (!focused) desk.focus(window.id)
      }}
    >
      <header className="desk-titlebar" onPointerDown={startGesture('move')}>
        <div className="desk-controls">
          <button type="button" className="desk-control" data-control="close" aria-label="Close" onClick={() => desk.close(window.id)} />
          <button
            type="button"
            className="desk-control"
            data-control="mode"
            aria-label={window.mode === 'tiled' ? 'Float' : 'Tile'}
            onClick={() => desk.toggleMode(window.id)}
          />
        </div>
        <h2 id={titleId} className="desk-title">
          {title}
        </h2>
      </header>
      <div className="desk-body">{children}</div>
      {window.mode === 'floating' && <div className="desk-grip" aria-hidden="true" onPointerDown={startGesture('resize')} />}
    </section>
  )
}
