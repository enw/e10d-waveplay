import { describe, expect, it } from 'vitest'
import { clampMicGain, defaultSignalState, getVizHints, usesMicModulator } from './types'
import { encodeWav } from '../export/wav'

describe('types', () => {
  it('clamps mic gain', () => {
    expect(clampMicGain(3)).toBe(2)
    expect(clampMicGain(-1)).toBe(0)
  })

  it('detects mic modulator', () => {
    const state = defaultSignalState()
    expect(usesMicModulator(state)).toBe(false)
    expect(
      usesMicModulator({
        ...state,
        mode: 'am',
        am: { ...state.am, modulatorSource: 'mic' }
      })
    ).toBe(true)
  })

  it('returns AM spectrum labels', () => {
    const base = defaultSignalState()
    const hints = getVizHints({
      ...base,
      mode: 'am',
      am: { ...base.am, carrierHz: 1000, modulatorHz: 100, modulationIndex: 1 }
    })
    expect(hints.spectrumLabels?.map((l) => l.label)).toEqual(['LSB', 'carrier', 'USB'])
  })

  it('returns mic AM hint', () => {
    const base = defaultSignalState()
    const hints = getVizHints({
      ...base,
      mode: 'am',
      am: { ...base.am, modulatorSource: 'mic' }
    })
    expect(hints.envelope?.micLive).toBe(true)
    expect(hints.rfHint).toContain('voice')
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
