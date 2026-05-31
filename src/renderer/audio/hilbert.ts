/** Wideband Hilbert approximation — I dry, Q via allpass chain. */

const ALLPASS_FREQS = [150, 450, 1350, 4050]

export interface HilbertSplit {
  input: GainNode
  i: GainNode
  q: GainNode
  dispose: () => void
}

export function createHilbertSplit(ctx: BaseAudioContext): HilbertSplit {
  const input = ctx.createGain()
  input.gain.value = 1

  const i = ctx.createGain()
  i.gain.value = 1
  input.connect(i)

  let qChain: AudioNode = input
  const filters: BiquadFilterNode[] = []

  for (const freq of ALLPASS_FREQS) {
    const ap = ctx.createBiquadFilter()
    ap.type = 'allpass'
    ap.frequency.value = Math.min(freq, ctx.sampleRate * 0.45)
    ap.Q.value = 0.707
    qChain.connect(ap)
    qChain = ap
    filters.push(ap)
  }

  const q = ctx.createGain()
  q.gain.value = 1
  qChain.connect(q)

  return {
    input,
    i,
    q,
    dispose: () => {
      input.disconnect()
      i.disconnect()
      q.disconnect()
      for (const f of filters) f.disconnect()
    }
  }
}

/** Phase lag of Q vs I at a single frequency (radians). Used in tests. */
export function expectedHilbertPhaseRad(freqHz: number, sampleRate: number): number {
  let phase = 0
  for (const f0 of ALLPASS_FREQS) {
    const f = Math.min(f0, sampleRate * 0.45)
    const w = (2 * Math.PI * freqHz) / sampleRate
    const w0 = (2 * Math.PI * f) / sampleRate
    phase += Math.atan2(2 * w0 * w, w0 * w0 - w * w)
  }
  return phase
}
