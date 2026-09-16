import type {
  CascadeOptions,
  DeskOptions,
  DeskState,
  DeskWindow,
  Frame,
  OpenOptions,
  Size,
  TileOptions,
  WindowId,
} from './types.js'

export interface Desk {
  getState(): DeskState
  subscribe(listener: (state: DeskState) => void): () => void
  /** Opens a window, or brings it to the front if it is already open. */
  open(id: WindowId, options?: OpenOptions): void
  close(id: WindowId): void
  closeAll(): void
  focus(id: WindowId): void
  /** Floats a tiled window, or moves a floating one when a frame is given. */
  float(id: WindowId, frame?: Frame): void
  /** Returns a floating window to the tiles. Not limited by maxTiled: the user asked for it. */
  tile(id: WindowId, options?: TileOptions): void
  toggleMode(id: WindowId): void
  tileAll(): void
  /** Replaces the whole state, e.g. from a URL. Unknown shapes are normalised, not trusted. */
  restore(state: DeskState): void
  setStage(stage: () => Size): void
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

export const focusedId = (state: DeskState): WindowId | null => state.stack.at(-1) ?? null

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

/** Drops duplicate ids and makes the stack agree with the windows. */
export function normalise(state: DeskState): DeskState {
  const windows = state.windows.filter((w, i, all) => all.findIndex(o => o.id === w.id) === i)
  const ids = new Set(windows.map(w => w.id))
  const stacked = state.stack.filter((id, i, all) => ids.has(id) && all.indexOf(id) === i)
  const unstacked = windows.map(w => w.id).filter(id => !stacked.includes(id))
  return { windows, stack: [...unstacked, ...stacked] }
}

export function createDesk(options: DeskOptions = {}): Desk {
  const maxTiled = options.maxTiled ?? 2
  const cascade: CascadeOptions = { ...DEFAULT_CASCADE, ...options.cascade }
  let stage = options.stage ?? (() => DEFAULT_STAGE)
  let state = normalise(options.initial ?? EMPTY)
  const listeners = new Set<(state: DeskState) => void>()

  const commit = (next: DeskState) => {
    if (next === state) return
    state = next
    listeners.forEach(listener => listener(state))
  }

  const toFront = (s: DeskState, id: WindowId): DeskState =>
    s.stack.at(-1) === id ? s : { ...s, stack: [...s.stack.filter(x => x !== id), id] }

  const nextFrame = (s: DeskState) => nextCascadeFrame(s.windows, stage(), cascade)

  const replace = (s: DeskState, window: DeskWindow): DeskState => ({
    ...s,
    windows: s.windows.map(w => (w.id === window.id ? window : w)),
  })

  const find = (id: WindowId) => state.windows.find(w => w.id === id)

  /** Where each window last floated, so tiling and floating again is not a surprise. */
  const remembered = new Map<WindowId, Frame>()

  /** A remembered frame is only worth restoring while it still lands on this screen. */
  const fits = (frame: Frame | undefined) => {
    if (!frame) return undefined
    const { width, height } = stage()
    return frame.x + 40 <= width && frame.y + 20 <= height && frame.x >= 0 && frame.y >= 0 ? frame : undefined
  }

  // Plain functions rather than methods, so `const { open } = desk` works.
  const float = (id: WindowId, frame?: Frame) => {
    const window = find(id)
    if (!window) return
    if (window.mode === 'floating' && !frame) return
    const next = frame ?? fits(remembered.get(id)) ?? nextFrame(state)
    if (frame) remembered.set(id, frame)
    commit(toFront(replace(state, { id, mode: 'floating', frame: next }), id))
  }

  const tile = (id: WindowId, options: TileOptions = {}) => {
    const window = find(id)
    if (!window || (window.mode === 'tiled' && !options.at)) return
    // Coming back from floating, remember where it was: floating it again should
    // put it back where the person left it, not at the next step of the cascade.
    if (window.mode === 'floating') remembered.set(id, window.frame)
    const tiled: DeskWindow = { id, mode: 'tiled' }
    const rest = state.windows.filter(w => w.id !== id)
    const windows =
      options.at === 'start' ? [tiled, ...rest]
      : options.at === 'end' ? [...rest, tiled]
      : state.windows.map(w => (w.id === id ? tiled : w))
    commit(toFront({ ...state, windows }, id))
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
      const tiled = state.windows.filter(w => w.mode === 'tiled').length
      const mode = opts.mode ?? (tiled < maxTiled ? 'tiled' : 'floating')
      const window: DeskWindow = mode === 'tiled' ? { id, mode } : { id, mode, frame: opts.frame ?? nextFrame(state) }
      commit({ windows: [...state.windows, window], stack: [...state.stack, id] })
    },

    close(id) {
      if (!find(id)) return
      commit({ windows: state.windows.filter(w => w.id !== id), stack: state.stack.filter(x => x !== id) })
    },

    closeAll() {
      if (state.windows.length) commit(EMPTY)
    },

    focus(id) {
      if (find(id)) commit(toFront(state, id))
    },

    float,
    tile,

    toggleMode(id) {
      const window = find(id)
      if (!window) return
      if (window.mode === 'tiled') float(id)
      else tile(id)
    },

    tileAll() {
      if (state.windows.every(w => w.mode === 'tiled')) return
      commit({ ...state, windows: state.windows.map(w => ({ id: w.id, mode: 'tiled' as const })) })
    },

    restore(next) {
      commit(normalise(next))
    },

    setStage(next) {
      stage = next
    },
  }
}
