export function computeBandpassResponse(
  centerHz: number,
  bandwidthHz: number,
  sampleRate: number,
  binCount: number
): Float32Array {
  const q = Math.max(0.5, centerHz / Math.max(100, bandwidthHz))
  const w0 = (2 * Math.PI * centerHz) / sampleRate
  const alpha = Math.sin(w0) / (2 * q)
  const cosW0 = Math.cos(w0)
  const a0 = 1 + alpha

  const b0 = alpha / a0
  const b1 = 0
  const b2 = -alpha / a0
  const a1 = (-2 * cosW0) / a0
  const a2 = (1 - alpha) / a0

  const nyquist = sampleRate / 2
  const out = new Float32Array(binCount)

  for (let k = 0; k < binCount; k++) {
    const freq = (k / binCount) * nyquist
    const w = (2 * Math.PI * freq) / sampleRate
    const cos1 = Math.cos(-w)
    const cos2 = Math.cos(-2 * w)
    const sin1 = Math.sin(-w)
    const sin2 = Math.sin(-2 * w)

    const numRe = b0 + b1 * cos1 + b2 * cos2
    const numIm = b1 * sin1 + b2 * sin2
    const denRe = 1 + a1 * cos1 + a2 * cos2
    const denIm = a1 * sin1 + a2 * sin2

    const mag = Math.sqrt(numRe * numRe + numIm * numIm) / Math.sqrt(denRe * denRe + denIm * denIm)
    out[k] = mag
  }

  return out
}
