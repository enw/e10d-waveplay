import { describe, expect, it } from 'vitest'
import { clampFreq, clampModIndex, getVizHints } from './types'
import { encodeWav } from '../export/wav'

describe('types', () => {
  it('clamps frequency', () => {
    expect(clampFreq(10)).toBe(20)
    expect(clampFreq(5000)).toBe(4000)
  })

  it('clamps modulation index', () => {
    expect(clampModIndex(1.5)).toBe(1)
    expect(clampModIndex(-0.1)).toBe(0)
  })

  it('returns AM spectrum labels', () => {
    const hints = getVizHints({
      mode: 'am',
      basic: { waveShape: 'sine', frequencyHz: 1000, amplitude: 0.5 },
      am: { carrierHz: 1000, modulatorHz: 100, modulationIndex: 1 },
      fm: { carrierHz: 440, modulatorHz: 5, deviationHz: 25 },
      mix: { oscAHz: 1000, oscAAmp: 0.5, oscBHz: 1005, oscBAmp: 0.5, mixMode: 'sum' },
      volume: 0.5,
      playing: false
    })
    expect(hints.spectrumLabels?.map((l) => l.label)).toEqual(['LSB', 'carrier', 'USB'])
  })
})

describe('encodeWav', () => {
  it('writes valid RIFF header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1])
    const buf = encodeWav(samples, 44100)
    const view = new DataView(buf)
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe(
      'RIFF'
    )
    expect(buf.byteLength).toBeGreaterThan(44)
  })
})
