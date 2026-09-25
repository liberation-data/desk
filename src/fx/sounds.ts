/*
 * The sounds themselves: synthesised, so nothing to fetch, decode or license, and a pitch or a level
 * is a code change.
 *
 * One family, in D major, told apart by contour and register rather than by timbre alone, because
 * people learn a few categories and never a catalogue: attention rises, ready is small and high,
 * failed growls low and sags.
 */

/** Schedules one sound into `out`, starting at `at` on the context's clock. */
export type Sound = (ctx: BaseAudioContext, out: AudioNode, at: number) => void

export interface Overtone {
  /** Multiple of the note's pitch. */
  readonly ratio: number
  readonly weight: number
  readonly wave: OscillatorType
}

export interface Voice {
  readonly partials: readonly Overtone[]
  /** Seconds to swell in: a bell is struck, a horn is blown. */
  readonly attack: number
  /**
   * A low-pass that opens as each note starts and settles back, as multiples of the note's pitch.
   * On a sawtooth this is what makes a horn rather than a buzz. `q` is in dB, as Web Audio reads it.
   */
  readonly brass?: { readonly closed: number; readonly open: number; readonly settle: number; readonly q: number }
  /** A fast amplitude wobble. Near 20 Hz it is neither pulses nor pitch: a growl. */
  readonly flutter?: { readonly hz: number; readonly depth: number }
  /** Cents the pitch sags over each note. */
  readonly droopCents?: number
  /** A high-pass over the whole sound, in Hz. */
  readonly cutHz?: number
}

export interface Note {
  readonly hz: number
  /** Seconds after the sound starts. */
  readonly at: number
  readonly gain: number
  /** Seconds to decay to silence. */
  readonly ring: number
}

export interface Score {
  readonly voice: Voice
  readonly notes: readonly Note[]
  /** Trim so sounds are equally loud rather than equally strong. Set by measuring, not by ear. */
  readonly levelDb: number
}

/** The bell: sine partials, with the inharmonic 2.76 a struck bar has and a synth does not. */
export const BELL: Voice = {
  partials: [
    { ratio: 1, weight: 1, wave: 'sine' },
    { ratio: 2, weight: 0.18, wave: 'sine' },
    { ratio: 2.76, weight: 0.06, wave: 'sine' },
  ],
  attack: 0.008,
}

/*
 * The growl: two sawtooths 2% apart beat about one and a half times a second; a quiet third a
 * tritone up (√2) sours it without being heard as a second note; the brass filter snarls.
 *
 * Pitched below what a laptop speaker reproduces, which works because a sawtooth carries every
 * harmonic and the ear supplies the missing fundamental. The cut at 140 Hz is for level matching:
 * below it is energy only headphones play, and left in it made this 10 dB louder on them than on a
 * laptop, so no one trim suited both. Cut, the gap is 3 dB.
 */
export const GROWL: Voice = {
  partials: [
    { ratio: 1, weight: 0.5, wave: 'sine' },
    { ratio: 1, weight: 0.6, wave: 'sawtooth' },
    { ratio: 1.02, weight: 0.4, wave: 'sawtooth' },
    { ratio: Math.SQRT2, weight: 0.16, wave: 'sawtooth' },
  ],
  attack: 0.05,
  brass: { closed: 5, open: 20, settle: 9, q: 4.5 },
  flutter: { hz: 22, depth: 0.85 },
  droopCents: 90,
  cutHz: 140,
}

const D2 = 73.42
const A4 = 440
const D5 = 587.33
const A5 = 880
const D6 = 1174.66

/*
 * Levels put each at -27 LUFS momentary through a 200 Hz high-pass standing in for a laptop speaker,
 * the common case. Failed runs about 3 dB over that on headphones.
 */
export const SCORES = {
  /** Something is waiting on this person: a rising fourth, twice. */
  attention: {
    voice: BELL,
    levelDb: -7,
    notes: [
      { hz: A4, at: 0, gain: 0.32, ring: 0.9 },
      { hz: D5, at: 0.13, gain: 0.34, ring: 1.3 },
      { hz: A4, at: 0.55, gain: 0.26, ring: 0.9 },
      { hz: D5, at: 0.68, gain: 0.28, ring: 1.6 },
    ],
  },
  /** Something to look at when they are ready: a grace note up to D6, over almost at once. */
  ready: {
    voice: BELL,
    levelDb: 4,
    notes: [
      { hz: A5, at: 0, gain: 0.09, ring: 0.35 },
      { hz: D6, at: 0.06, gain: 0.11, ring: 0.8 },
    ],
  },
  /** Their work did not finish: one low D that growls and sags. */
  failed: {
    voice: GROWL,
    levelDb: 9.5,
    notes: [{ hz: D2, at: 0, gain: 0.33, ring: 1.75 }],
  },
} as const satisfies Record<string, Score>

export type BuiltInSound = keyof typeof SCORES

/** A sound from a score: every note of it, through its voice. */
export function scored(score: Score): Sound {
  return (ctx, out, at) => {
    const level = ctx.createGain()
    level.gain.setValueAtTime(10 ** (score.levelDb / 20), at)
    level.connect(out)
    const { voice } = score
    const bus = voice.cutHz ? highpass(ctx, level, voice.cutHz) : level
    for (const note of score.notes) {
      const t = at + note.at
      const fluttered = voice.flutter ? flutter(ctx, bus, t, note, voice.flutter) : bus
      const into = voice.brass ? brass(ctx, fluttered, t, note, voice.brass, voice.attack) : fluttered
      for (const partial of voice.partials) strike(ctx, into, t, note, partial, voice)
    }
  }
}

function highpass(ctx: BaseAudioContext, out: AudioNode, hz: number): AudioNode {
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = hz
  // -3 dB is a linear Q of 0.707: flat, with no bump at the corner.
  filter.Q.value = -3
  filter.connect(out)
  return filter
}

function brass(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  note: Note,
  spec: NonNullable<Voice['brass']>,
  attack: number,
): AudioNode {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = spec.q
  filter.frequency.setValueAtTime(note.hz * spec.closed, t)
  filter.frequency.exponentialRampToValueAtTime(note.hz * spec.open, t + attack + 0.06)
  filter.frequency.exponentialRampToValueAtTime(note.hz * spec.settle, t + note.ring)
  filter.connect(out)
  return filter
}

function flutter(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  note: Note,
  spec: NonNullable<Voice['flutter']>,
): AudioNode {
  const tremolo = ctx.createGain()
  tremolo.gain.value = 1 - spec.depth / 2
  const lfo = ctx.createOscillator()
  const swing = ctx.createGain()
  lfo.type = 'triangle'
  lfo.frequency.value = spec.hz
  swing.gain.value = spec.depth / 2
  lfo.connect(swing)
  swing.connect(tremolo.gain)
  tremolo.connect(out)
  lfo.start(t)
  lfo.stop(t + note.ring + 0.05)
  return tremolo
}

function strike(ctx: BaseAudioContext, out: AudioNode, t: number, note: Note, partial: Overtone, voice: Voice): void {
  // Upper partials die sooner than the fundamental: most of what "bell" means.
  const ring = note.ring / Math.max(partial.ratio, 1) ** 0.5
  const osc = ctx.createOscillator()
  const envelope = ctx.createGain()
  osc.type = partial.wave
  osc.frequency.value = note.hz * partial.ratio
  // A few cents sharp and settling (or sagging): tuning that is perfect from the first millisecond
  // sounds like a test tone.
  osc.detune.setValueAtTime(6, t)
  osc.detune.linearRampToValueAtTime(-(voice.droopCents ?? 0), t + ring)
  // Never from or to zero: an exponential ramp cannot, and a linear edge on a sine clicks.
  envelope.gain.setValueAtTime(0.0001, t)
  envelope.gain.exponentialRampToValueAtTime(note.gain * partial.weight, t + voice.attack)
  envelope.gain.exponentialRampToValueAtTime(0.0001, t + ring)
  osc.connect(envelope)
  envelope.connect(out)
  osc.start(t)
  osc.stop(t + ring + 0.05)
}
