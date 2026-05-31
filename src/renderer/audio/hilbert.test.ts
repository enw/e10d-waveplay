import { describe, expect, it } from 'vitest'
import { expectedHilbertPhaseRad } from './hilbert'

describe('hilbert', () => {
  it('approximates 90° phase shift at 100 Hz', () => {
    const phase = expectedHilbertPhaseRad(100, 44100)
    const degrees = (phase * 180) / Math.PI
    expect(degrees).toBeGreaterThan(75)
    expect(degrees).toBeLessThan(105)
  })
})
