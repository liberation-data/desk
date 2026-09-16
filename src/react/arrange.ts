import type { Frame, WindowId } from '../core/types.js'

/** The part of the stage windows are laid out in, and the gap between them. */
export interface Area extends Frame {
  readonly gap: number
}

export interface ArrangeLimits {
  readonly minWidth: number
  readonly minHeight: number
}

/**
 * Where Arrange puts each window. The same windows always land in the same places:
 * the focused window takes the first and largest place, the rest follow in the order
 * they were opened. Nothing here looks at where windows are now, so a small drag
 * never swaps two windows the next time.
 *
 *   1 fills the area · 2 side by side · 3 one tall on the left, two stacked on the right
 *   4 a 2 × 2 grid · more a grid, while every cell stays usable
 *
 * When a grid cell would be too small to use, the focused window and the one used
 * before it share the area and the rest cascade over the second half, so the focused
 * window, which stays in front, covers none of them.
 */
export function arrangement(
  ids: readonly WindowId[],
  focused: WindowId | null,
  previous: WindowId | null,
  area: Area,
  limits: ArrangeLimits,
): Record<WindowId, Frame> {
  const first = focused && ids.includes(focused) ? focused : ids[0]
  if (first === undefined) return {}
  const order = [first, ...ids.filter(id => id !== first)]
  const { x, y, width, height, gap } = area
  const half = (width - gap) / 2
  const place = (frames: readonly Frame[]) => Object.fromEntries(order.map((id, i) => [id, frames[i] as Frame]))

  if (order.length === 1) return place([{ x, y, width, height }])
  if (order.length === 2) return place([{ x, y, width: half, height }, { x: x + half + gap, y, width: half, height }])
  if (order.length === 3) {
    const stacked = (height - gap) / 2
    return place([
      { x, y, width: half, height },
      { x: x + half + gap, y, width: half, height: stacked },
      { x: x + half + gap, y: y + stacked + gap, width: half, height: stacked },
    ])
  }

  const columns = Math.ceil(Math.sqrt(order.length))
  const rows = Math.ceil(order.length / columns)
  const cellWidth = (width - gap * (columns - 1)) / columns
  const cellHeight = (height - gap * (rows - 1)) / rows
  if (cellWidth >= limits.minWidth && cellHeight >= limits.minHeight) {
    return place(
      order.map((_, i) => ({
        x: x + (i % columns) * (cellWidth + gap),
        y: y + Math.floor(i / columns) * (cellHeight + gap),
        width: cellWidth,
        height: cellHeight,
      })),
    )
  }

  // Too many to grid: the two most recent share the area, the rest cascade over the second half.
  const second = previous && previous !== first && ids.includes(previous) ? previous : (order[1] as WindowId)
  const rest = order.filter(id => id !== first && id !== second)
  const step = 28
  const floatWidth = Math.max(limits.minWidth, Math.min(720, half - step * 2))
  const floatHeight = Math.max(limits.minHeight, Math.min(520, height - step * 2))
  return {
    [first]: { x, y, width: half, height },
    [second]: { x: x + half + gap, y, width: half, height },
    ...Object.fromEntries(
      rest.map((id, i) => {
        const n = i % 6
        return [id, { x: x + half + gap + step + n * 32, y: y + step + n * step, width: floatWidth, height: floatHeight }]
      }),
    ),
  }
}
