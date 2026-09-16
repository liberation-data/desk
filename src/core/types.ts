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
  /** Fills the desk, at whatever size the desk is. */
  | { readonly id: WindowId; readonly mode: 'filled' }
  | { readonly id: WindowId; readonly mode: 'floating'; readonly frame: Frame }

export type WindowMode = DeskWindow['mode']

export interface DeskState {
  /** Open windows in the order they were opened. Arrange lays them out in this order, so focusing never reshuffles them. */
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
  readonly cascade?: Partial<CascadeOptions>
  /** Reports the stage's size, so floating windows open inside it. */
  readonly stage?: () => Size
  readonly initial?: DeskState
}

export interface OpenOptions {
  /** Open as a free window rather than filling the desk. Given a frame, it floats there. */
  readonly mode?: WindowMode
  readonly frame?: Frame
}
