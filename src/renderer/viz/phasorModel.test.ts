import { describe, expect, it } from 'vitest'
import { computePhasorModel } from './phasorModel'
import { defaultSignalState } from '../audio/types'

describe('phasorModel', () => {
  it('AM baseband stays on I axis', () => {
    const state = defaultSignalState()
    state.mode = 'am'
    state.am.modulationIndex = 0.8
    state.am.modulatorHz = 100
    const model = computePhasorModel(state)
    expect(model.supported).toBe(true)
    expect(model.primary.every((p) => Math.abs(p.q) < 1e-10)).toBe(true)
  })

  it('USB rotates with positive Q', () => {
    const state = defaultSignalState()
    state.mode = 'ssb'
    state.ssb.sideband = 'usb'
    state.ssb.modulatorHz = 100
    const model = computePhasorModel(state)
    const maxQ = Math.max(...model.primary.map((p) => p.q))
    expect(maxQ).toBeGreaterThan(0.9)
  })

  it('unsupported for basic mode', () => {
    const model = computePhasorModel(defaultSignalState())
    expect(model.supported).toBe(false)
  })
})
