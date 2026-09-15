export type WindowId = string

export interface Frame {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export type DeskWindow =
  | { readonly id: WindowId; readonly mode: 'tiled' }
  | { readonly id: WindowId; readonly mode: 'floating'; readonly frame: Frame }

export type WindowMode = DeskWindow['mode']

export interface DeskState {
  /** Open windows in the order they were opened. Tiles are laid out in this order, so focusing never reshuffles them. */
  readonly windows: readonly DeskWindow[]
  /** Window ids back to front. The last one has focus. */
  readonly stack: readonly WindowId[]
}

export interface CascadeOptions {
  readonly maxWidth: number
  readonly maxHeight: number
  readonly margin: number
  readonly step: { readonly x: number; readonly y: number }
  /** After this many floating windows the cascade wraps back to the top-left. */
  readonly wrap: number
}

export interface DeskOptions {
  /** How many windows share the stage before new ones float. Default 2. */
  readonly maxTiled?: number
  readonly cascade?: Partial<CascadeOptions>
  /** Reports the stage's size, so floating windows open inside it. */
  readonly stage?: () => Size
  readonly initial?: DeskState
}

export interface OpenOptions {
  /** Force a mode instead of following the tile-first rule. */
  readonly mode?: WindowMode
  readonly frame?: Frame
}
