/*
 * How loud a sound is to a listener, measured rather than judged by ear: rendered offline,
 * K-weighted (ITU-R BS.1770: a +4 dB shelf above ~1.7 kHz and a high-pass near 38 Hz, roughly the
 * ear's sensitivity), and scored by its loudest 400 ms — momentary loudness, the right figure for
 * a sound shorter than the gated programme measure. Browser only: it needs OfflineAudioContext.
 */
import type { Fx } from './fx.js'

export interface Loudness {
  /** Momentary loudness, LUFS. */
  readonly lufs: number
  /** Sample peak before weighting, dBFS: how close it comes to clipping. */
  readonly peakDb: number
}

export interface MeasureOptions {
  /**
   * `laptop` adds a 4th-order high-pass at 200 Hz, about where small speakers give up. Level for
   * that one: it is what most people have.
   */
  readonly speaker?: 'full' | 'laptop'
  /** Seconds rendered; longer than the sound. */
  readonly seconds?: number
}

const RATE = 48000

// Web Audio reads a pass filter's Q in dB, not linear.
const dB = (q: number): number => 20 * Math.log10(q)

export async function measureLoudness<Name extends string>(
  fx: Fx<Name>,
  name: Name,
  { speaker = 'full', seconds = 3 }: MeasureOptions = {},
): Promise<Loudness> {
  const weighted = new OfflineAudioContext(1, RATE * seconds, RATE)
  const shelf = new BiquadFilterNode(weighted, { type: 'highshelf', frequency: 1682, gain: 4 })
  const rest = [
    new BiquadFilterNode(weighted, { type: 'highpass', frequency: 38, Q: dB(0.5) }),
    ...(speaker === 'laptop'
      ? [
          new BiquadFilterNode(weighted, { type: 'highpass', frequency: 200, Q: dB(0.541) }),
          new BiquadFilterNode(weighted, { type: 'highpass', frequency: 200, Q: dB(1.307) }),
        ]
      : []),
  ]
  const last = rest.reduce<AudioNode>((from, to) => (from.connect(to), to), shelf)
  last.connect(weighted.destination)
  fx.render(weighted, name, shelf)

  const plain = new OfflineAudioContext(1, RATE * seconds, RATE)
  fx.render(plain, name, plain.destination)

  const [w, p] = await Promise.all([weighted.startRendering(), plain.startRendering()])
  return { lufs: momentary(w.getChannelData(0)), peakDb: 20 * Math.log10(peak(p.getChannelData(0))) }
}

function momentary(x: Float32Array): number {
  const window = RATE * 0.4
  const hop = RATE * 0.1
  const starts = Array.from({ length: Math.max(0, Math.floor((x.length - window) / hop) + 1) }, (_, i) => i * hop)
  const loudest = starts.reduce((best, start) => {
    let sum = 0
    for (let j = start; j < start + window; j++) sum += (x[j] ?? 0) ** 2
    return Math.max(best, sum / window)
  }, 0)
  return -0.691 + 10 * Math.log10(loudest)
}

const peak = (x: Float32Array): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
