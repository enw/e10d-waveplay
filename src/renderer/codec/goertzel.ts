/** Single-frequency energy detector (Goertzel). Returns magnitude. */
export function goertzelMagnitude(
  samples: Float32Array,
  start: number,
  length: number,
  sampleRate: number,
  targetFreq: number
): number {
  if (length <= 0 || targetFreq <= 0) return 0
  const omega = (2 * Math.PI * targetFreq) / sampleRate
  const coeff = 2 * Math.cos(omega)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  const end = Math.min(start + length, samples.length)
  for (let i = start; i < end; i++) {
    s0 = samples[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  const real = s1 - s2 * Math.cos(omega)
  const imag = s2 * Math.sin(omega)
  return Math.sqrt(real * real + imag * imag) / length
}

export interface FreqCandidate {
  freqHz: number
  magnitude: number
  index?: number
}

/** Pick strongest frequency from candidates at a sample window. */
export function detectStrongest(
  samples: Float32Array,
  start: number,
  windowSamples: number,
  sampleRate: number,
  candidates: { freqHz: number; index?: number }[]
): FreqCandidate | null {
  let best: FreqCandidate | null = null
  for (const c of candidates) {
    const magnitude = goertzelMagnitude(samples, start, windowSamples, sampleRate, c.freqHz)
    if (!best || magnitude > best.magnitude) {
      best = { freqHz: c.freqHz, magnitude, index: c.index }
    }
  }
  return best
}
