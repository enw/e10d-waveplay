import { describe, expect, it } from 'vitest'
import { carrierHzForQrm, snrDbToNoiseGain } from './NoiseStage'
import { defaultSignalState } from './types'

describe('NoiseStage', () => {
  it('maps higher SNR to lower noise gain', () => {
    expect(snrDbToNoiseGain(40)).toBeLessThan(snrDbToNoiseGain(10))
  })

  it('picks carrier for QRM from mode', () => {
    const state = defaultSignalState()
    expect(carrierHzForQrm({ ...state, mode: 'am', am: { ...state.am, carrierHz: 1500 } })).toBe(
      1500
    )
    expect(carrierHzForQrm({ ...state, mode: 'mix', mix: { ...state.mix, oscAHz: 900 } })).toBe(
      900
    )
  })
})
