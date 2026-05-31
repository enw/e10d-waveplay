import { describe, expect, it } from 'vitest'
import { SweepController } from './SweepController'

describe('SweepController', () => {
  it('interpolates linearly at midpoint', () => {
    const config = {
      enabled: true,
      paramKey: 'am.modulationIndex',
      from: 0,
      to: 1,
      durationSec: 10,
      loop: false
    }
    expect(SweepController.valueAt(config, 0)).toBe(0)
    expect(SweepController.valueAt(config, 0.5)).toBe(0.5)
    expect(SweepController.valueAt(config, 1)).toBe(1)
  })

  it('wraps when looping', () => {
    const config = {
      enabled: true,
      paramKey: 'am.modulationIndex',
      from: 0,
      to: 1,
      durationSec: 10,
      loop: true
    }
    expect(SweepController.valueAt(config, 1.5)).toBe(0.5)
  })
})
