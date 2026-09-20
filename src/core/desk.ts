import type {
  CascadeOptions,
  DeskOptions,
  DeskState,
  DeskWindow,
  Frame,
  OpenOptions,
  Size,
  WindowId,
} from './types.js'
import { fitFrame, stepFrom } from './layouts.js'

export interface Desk {
  getState(): DeskState
  subscribe(listener: (state: DeskState) => void): () => void
  /** Opens a window filling the desk, over the ones already open, or brings it to the front if it is open. */
  open(id: WindowId, options?: OpenOptions): void
  /** Opens another window of the same kind — `query#2` beside `query` — and returns its id. */
  openInstance(type: string, options?: OpenOptions): WindowId
  close(id: WindowId): void
  closeAll(): void
  /**
   * Off the desk without being closed: still open, still mounted, and keeping the mode and frame it
   * had. Focusing or opening it again brings it back.
   */
  minimize(id: WindowId): void
  /** Brings a window forward, and back onto the desk when it was minimized. */
  focus(id: WindowId): void
  /** Frees a window: where it last was, or at the next step of the cascade. Given a frame, puts it there. */
  float(id: WindowId, frame?: Frame): void
  /** Makes a window fill the desk, remembering where it was so freeing it again puts it back. */
  fill(id: WindowId): void
  /** Zooms: fills a free window, or frees a filled one. */
  toggleMode(id: WindowId): void
  /** Places windows exactly where they are given, as free windows. Arrange uses it. */
  placeAll(frames: Readonly<Record<WindowId, Frame>>): void
  /** Replaces the whole state, e.g. from a URL. Unknown shapes are normalised, not trusted. */
  restore(state: DeskState): void
  setStage(stage: () => Size): void
  /**
   * The desk changed size — an external display unplugged, a window resized. Brings every free
   * window back onto it, and puts each one back where it was when the room returns. Says which
   * windows had to be made smaller to fit, because more than one of those means a layout that no
   * longer exists and is worth laying out again.
   */
  fitToStage(): FitResult
}

/** What a resize did: nothing, moved a window in, shrank one, or gave one its old frame back. */
export interface FitResult {
  readonly moved: readonly WindowId[]
  readonly squeezed: readonly WindowId[]
  readonly restored: readonly WindowId[]
}

export const EMPTY: DeskState = { windows: [], stack: [] }

const DEFAULT_CASCADE: CascadeOptions = {
  maxWidth: 720,
  maxHeight: 520,
  margin: 16,
  step: { x: 32, y: 28 },
  wrap: 6,
}

const DEFAULT_STAGE: Size = { width: 1024, height: 768 }

/** Open, and off the desk: still mounted, and not somewhere anyone can point at. */
export const isMinimized = (state: DeskState, id: WindowId): boolean => state.minimized?.includes(id) ?? false

/** The windows on the desk, in the order they were opened: what Arrange lays out. */
export const onDesk = (state: DeskState): readonly DeskWindow[] =>
  state.minimized?.length ? state.windows.filter(w => !isMinimized(state, w.id)) : state.windows

/**
 * The key window: the frontmost one on the desk. A minimized window keeps its place in the stack,
 * so it comes back where it was, but is never key — there is nothing on screen to type into.
 */
export const focusedId = (state: DeskState): WindowId | null => {
  for (let i = state.stack.length - 1; i >= 0; i--) {
    const id = state.stack[i] as WindowId
    if (!isMinimized(state, id)) return id
  }
  return null
}

/**
 * Two windows onto the same thing — a second query beside the first — are the
 * same kind with different ids: `query`, then `query#2`. The part before the
 * `#` says what to render; the whole id says which one this is.
 */
export const windowType = (id: WindowId): string => id.split('#')[0] ?? id

export const instancesOf = (state: DeskState, type: string): readonly DeskWindow[] =>
  state.windows.filter(w => windowType(w.id) === type)

export const isOpen = (state: DeskState, id: WindowId): boolean => state.windows.some(w => w.id === id)

export function cascadeFrame(floatingCount: number, stage: Size, options: CascadeOptions = DEFAULT_CASCADE): Frame {
  const width = Math.max(0, Math.min(options.maxWidth, stage.width - options.margin * 2))
  const height = Math.max(0, Math.min(options.maxHeight, stage.height - options.margin * 2))
  const n = floatingCount % options.wrap
  return {
    x: Math.min(options.margin + n * options.step.x, Math.max(0, stage.width - width - options.margin)),
    y: Math.min(options.margin + n * options.step.y, Math.max(0, stage.height - height - options.margin)),
    width,
    height,
  }
}

/** Which cascade step a frame sits on, or -1 once it has been dragged off one. */
export function cascadeSlot(frame: Frame, stage: Size, options: CascadeOptions = DEFAULT_CASCADE): number {
  for (let slot = 0; slot < options.wrap; slot++) {
    const candidate = cascadeFrame(slot, stage, options)
    if (candidate.x === frame.x && candidate.y === frame.y) return slot
  }
  return -1
}

/**
 * The next free step of the cascade. Counting floating windows is not enough: a
 * window closed from the middle frees its step, and the count wraps — either way
 * a new window would open exactly on top of one already there, hiding it.
 */
export function nextCascadeFrame(windows: readonly DeskWindow[], stage: Size, options: CascadeOptions = DEFAULT_CASCADE): Frame {
  const taken = new Set(
    windows.flatMap(w => (w.mode === 'floating' ? [cascadeSlot(w.frame, stage, options)] : [])),
  )
  for (let slot = 0; slot < options.wrap; slot++) if (!taken.has(slot)) return cascadeFrame(slot, stage, options)
  return cascadeFrame(taken.size % options.wrap, stage, options)
}

/** Is this frame wholly on a desk of this size? */
const withinStage = (frame: Frame, stage: Size) =>
  frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= stage.width && frame.y + frame.height <= stage.height

/** Drops duplicate ids and makes the stack agree with the windows. */
export function normalise(state: DeskState): DeskState {
  const windows = state.windows.filter((w, i, all) => all.findIndex(o => o.id === w.id) === i)
  const ids = new Set(windows.map(w => w.id))
  const stacked = state.stack.filter((id, i, all) => ids.has(id) && all.indexOf(id) === i)
  const unstacked = windows.map(w => w.id).filter(id => !stacked.includes(id))
  const minimized = state.minimized?.filter((id, i, all) => ids.has(id) && all.indexOf(id) === i) ?? []
  const stack = [...unstacked, ...stacked]
  // Left out while nothing is minimized: the everyday state is the two lists it always was.
  return minimized.length ? { windows, stack, minimized } : { windows, stack }
}

/** Keeps the field out of the state while nothing is minimized, so the everyday state is two lists. */
function withMinimized(state: DeskState, ids: readonly WindowId[]): DeskState {
  if (ids.length) return { ...state, minimized: ids }
  if (!state.minimized) return state
  const { minimized: _none, ...rest } = state
  return rest
}

export function createDesk(options: DeskOptions = {}): Desk {
  const cascade: CascadeOptions = { ...DEFAULT_CASCADE, ...options.cascade }
  let stage = options.stage ?? (() => DEFAULT_STAGE)
  let state = normalise(options.initial ?? EMPTY)
  const listeners = new Set<(state: DeskState) => void>()
  const layouts = options.layouts

  const commit = (next: DeskState) => {
    if (next === state) return
    state = next
    listeners.forEach(listener => listener(state))
  }

  /*
   * Forward, and back onto the desk: there is no focused-but-minimized window, so every way of
   * choosing one comes back through here.
   */
  const toFront = (s: DeskState, id: WindowId): DeskState => {
    const shown = withMinimized(s, s.minimized?.filter(x => x !== id) ?? [])
    return shown.stack.at(-1) === id ? shown : { ...shown, stack: [...shown.stack.filter(x => x !== id), id] }
  }

  const nextFrame = (s: DeskState) => nextCascadeFrame(s.windows, stage(), cascade)

  const replace = (s: DeskState, window: DeskWindow): DeskState => ({
    ...s,
    windows: s.windows.map(w => (w.id === window.id ? window : w)),
  })

  const find = (id: WindowId) => state.windows.find(w => w.id === id)

  /** Where each window was last free, so filling it and freeing it again is not a surprise. */
  const remembered = new Map<WindowId, Frame>()

  /*
   * Where a window was before the desk got smaller.
   *
   * Undocking a laptop is not a decision about your layout: the windows you spread across a big
   * screen are suddenly past its edge, where they cannot be dragged back from. They are brought in
   * — and kept, so plugging the display back in puts them out again exactly as they were. Move a
   * window yourself while small and that is a decision, so the old frame is forgotten.
   */
  const beforeShrink = new Map<WindowId, Frame>()

  /** A remembered frame is only worth restoring while it still lands on this screen. */
  const fits = (frame: Frame | undefined) => {
    if (!frame) return undefined
    const { width, height } = stage()
    return frame.x + 40 <= width && frame.y + 20 <= height && frame.x >= 0 && frame.y >= 0 ? frame : undefined
  }

  /* Already in the mode being asked for, so nothing to change — except that it may be off the desk. */
  const restoreIfMinimized = (id: WindowId) => {
    if (isMinimized(state, id)) commit(toFront(state, id))
  }

  // Plain functions rather than methods, so `const { open } = desk` works.
  const float = (id: WindowId, frame?: Frame) => {
    const window = find(id)
    if (!window) return
    if (window.mode === 'floating' && !frame) return restoreIfMinimized(id)
    const next = frame ?? fits(remembered.get(id)) ?? nextFrame(state)
    if (frame) {
      remembered.set(id, frame)
      // Put here on purpose, so this is where it belongs now.
      beforeShrink.delete(id)
    }
    layouts?.save(windowType(id), { mode: 'floating', frame: next })
    commit(toFront(replace(state, { id, mode: 'floating', frame: next }), id))
  }

  const fill = (id: WindowId) => {
    const window = find(id)
    if (!window) return
    if (window.mode === 'filled') return restoreIfMinimized(id)
    remembered.set(id, window.frame)
    layouts?.save(windowType(id), { mode: 'filled' })
    commit(toFront(replace(state, { id, mode: 'filled' }), id))
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    open(id, opts = {}) {
      if (find(id)) {
        commit(toFront(state, id))
        return
      }
      const saved = opts.mode || opts.frame ? undefined : layouts?.load(windowType(id))
      const kept = saved?.mode === 'floating' ? fitFrame(saved.frame, stage()) : null
      const mode = opts.mode ?? (opts.frame || kept ? 'floating' : 'filled')
      const frame = () => {
        if (opts.frame) return opts.frame
        if (!kept) return nextFrame(state)
        const siblings = state.stack.flatMap(other => {
          const w = find(other)
          return w?.mode === 'floating' && windowType(w.id) === windowType(id) ? [w.frame] : []
        })
        return stepFrom(kept, siblings, stage(), cascade.step, cascade.margin)
      }
      const window: DeskWindow = mode === 'filled' ? { id, mode } : { id, mode, frame: frame() }
      // Spread, not a fresh pair: a state literal here drops `minimized`, and every window off the desk comes back.
      // Spread, not a fresh pair: a state literal here drops `minimized`, and every window off the desk comes back.
      commit({ ...state, windows: [...state.windows, window], stack: [...state.stack, id] })
    },

    openInstance(type, opts = {}) {
      const taken = new Set(state.windows.map(w => w.id))
      let id = type
      for (let n = 2; taken.has(id); n++) id = `${type}#${n}`
      this.open(id, opts)
      return id
    },

    close(id) {
      if (!find(id)) return
      const closed: DeskState = { windows: state.windows.filter(w => w.id !== id), stack: state.stack.filter(x => x !== id) }
      commit(withMinimized(closed, state.minimized?.filter(x => x !== id) ?? []))
    },

    minimize(id) {
      if (!find(id) || isMinimized(state, id)) return
      // The stack is left alone: a window comes back to where it was, not to the front of everything.
      commit(withMinimized(state, [...(state.minimized ?? []), id]))
    },

    closeAll() {
      if (state.windows.length) commit(EMPTY)
    },

    focus(id) {
      if (find(id)) commit(toFront(state, id))
    },

    float,
    fill,

    toggleMode(id) {
      const window = find(id)
      if (!window) return
      if (window.mode === 'filled') float(id)
      else fill(id)
    },

    placeAll(frames) {
      const ids = Object.keys(frames)
      if (!ids.length) return
      ids.forEach(id => {
        const frame = frames[id]
        if (frame) remembered.set(id, frame)
      })
      commit({
        ...state,
        windows: state.windows.map(w => {
          const frame = frames[w.id]
          return frame ? { id: w.id, mode: 'floating' as const, frame } : w
        }),
      })
    },

    restore(next) {
      commit(normalise(next))
    },

    setStage(next) {
      stage = next
    },

    fitToStage() {
      const nothing: FitResult = { moved: [], squeezed: [], restored: [] }
      const size = stage()
      if (size.width <= 0 || size.height <= 0) return nothing
      const moved: WindowId[] = []
      const squeezed: WindowId[] = []
      const restored: WindowId[] = []
      const windows = state.windows.map(window => {
        if (window.mode !== 'floating') return window
        // The desk is big enough again for where this window used to be: put it back.
        const before = beforeShrink.get(window.id)
        if (before && withinStage(before, size)) {
          beforeShrink.delete(window.id)
          restored.push(window.id)
          return { ...window, frame: before }
        }
        if (withinStage(window.frame, size)) return window
        const fitted = fitFrame(window.frame, size)
        if (!beforeShrink.has(window.id)) beforeShrink.set(window.id, before ?? window.frame)
        if (!fitted) {
          // Too small to be a window here at all: it fills the desk until there is room again.
          squeezed.push(window.id)
          return { id: window.id, mode: 'filled' as const }
        }
        // Only nudged back in, or actually made smaller? The second means its place is gone.
        if (fitted.width < window.frame.width || fitted.height < window.frame.height) squeezed.push(window.id)
        else moved.push(window.id)
        return { ...window, frame: fitted }
      })
      if (!moved.length && !squeezed.length && !restored.length) return nothing
      commit({ ...state, windows })
      return { moved, squeezed, restored }
    },
  }
}
