import { Component, createContext, lazy, Suspense, useContext } from 'react'
import type { ComponentType, ErrorInfo, LazyExoticComponent, ReactNode } from 'react'
import type { WindowId } from '../core/types.js'
import { Button } from './controls.js'

/*
 * Each window loads, and fails, on its own. One window fetching its code shows a
 * loading state in that window and nowhere else; one window throwing shows what
 * went wrong in that window, with a way to try again, while the rest of the desk
 * carries on.
 */

export type WindowLoading = (id: WindowId) => ReactNode
export type WindowFailed = (id: WindowId, error: Error, reload: () => void) => ReactNode

/** How many times this window has been reloaded: a lazy window loads afresh for each. */
const AttemptContext = createContext(0)

const defaultLoading: WindowLoading = () => (
  <div className="desk-window-status" role="status">
    Loading…
  </div>
)

const defaultFailed: WindowFailed = (_id, error, reload) => (
  <div className="desk-window-status" role="alert">
    <b>This window could not open</b>
    <span className="desk-window-status-detail">{error.message}</span>
    <Button size="small" onClick={reload}>
      Reload
    </Button>
  </div>
)

interface BoundaryProps {
  readonly id: WindowId
  readonly failed: WindowFailed | undefined
  readonly children: ReactNode
}

interface BoundaryState {
  readonly error: Error | null
  readonly attempt: number
}

class WindowErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Still reported: a window that cannot open is a bug somebody should hear about.
    console.error(`desk: window "${this.props.id}" could not open`, error, info.componentStack)
  }

  private readonly reload = () => this.setState(state => ({ error: null, attempt: state.attempt + 1 }))

  override render() {
    const { error, attempt } = this.state
    if (error) return (this.props.failed ?? defaultFailed)(this.props.id, error, this.reload)
    // A fresh key remounts the content, so a reload really starts again.
    return (
      <AttemptContext.Provider value={attempt} key={attempt}>
        {this.props.children}
      </AttemptContext.Provider>
    )
  }
}

export function WindowBoundary({
  id,
  loading,
  failed,
  children,
}: {
  readonly id: WindowId
  readonly loading: WindowLoading | undefined
  readonly failed: WindowFailed | undefined
  readonly children: ReactNode
}) {
  return (
    <WindowErrorBoundary id={id} failed={failed}>
      <Suspense fallback={(loading ?? defaultLoading)(id)}>{children}</Suspense>
    </WindowErrorBoundary>
  )
}

/**
 * A window whose code loads when it is first opened.
 *
 *   const QueryStudio = lazyWindow(() => import('./apps/QueryStudio'))
 *
 * Unlike `React.lazy`, a load that fails is not remembered: Reload in the window
 * tries the import again, so a dropped connection is not permanent.
 */
export function lazyWindow<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): ComponentType<P> {
  const byAttempt = new Map<number, LazyExoticComponent<ComponentType<P>>>()
  function LazyWindow(props: P) {
    const attempt = useContext(AttemptContext)
    let Loaded = byAttempt.get(attempt)
    if (!Loaded) {
      Loaded = lazy(load)
      byAttempt.set(attempt, Loaded)
    }
    return <Loaded {...props} />
  }
  return LazyWindow
}
