/*
 * A LAMP, NOT A WORD.
 *
 * Off, green, amber or red — and what each means is the owner's to say. A source that is connected,
 * a document still being read, a key the provider refused: the desk cannot know which, so the colour
 * is named for what it looks like and the owner says in words what it is. An LED is never the only
 * thing carrying a state (HIG.md §2, "Never use colour alone"): somebody who cannot tell green from red still has to be told.
 *
 * THE COLOURS ARE ITS OWN, not the state tokens. `--desk-ok` and friends are tuned to be read as
 * TEXT, which on a light ground means dark — and a dark green lamp on white looks switched off. A
 * lamp is lit when it is bright, so it keeps the bright colour on both grounds and takes a thin
 * darker rim on a light one, where the glow that makes it look lit on a dark one has nothing to
 * glow against.
 */

export type LedColor = 'off' | 'green' | 'amber' | 'red'

export interface LedProps {
  readonly color: LedColor
  /**
   * What the lamp says, when nothing beside it says it already, e.g. "Connected". Read aloud; without
   * one the lamp is decorative and kept out of the reading, which is right when a label sits beside it.
   */
  readonly label?: string
  readonly className?: string
}

/** A status lamp, inline — in a row, beside a name, on a card. */
export function Led({ color, label, className }: LedProps) {
  return (
    <span
      className={['desk-led', className].filter(Boolean).join(' ')}
      data-color={color}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
