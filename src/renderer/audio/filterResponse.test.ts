import { describe, expect, it } from 'vitest'
import { bandwidthToQ } from './FilterStage'
import { computeBandpassResponse } from './filterResponse'

describe('FilterStage', () => {
  it('derives Q from bandwidth', () => {
    expect(bandwidthToQ(1000, 500)).toBe(2)
  })
})

describe('filterResponse', () => {
  it('peaks near center frequency', () => {
    const response = computeBandpassResponse(1000, 400, 44100, 512)
    const centerBin = Math.round(1000 / (44100 / 2) * 512)
    const edgeBin = Math.round(200 / (44100 / 2) * 512)
    expect(response[centerBin]).toBeGreaterThan(response[edgeBin])
  })
})
