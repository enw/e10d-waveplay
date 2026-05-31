import { describe, expect, it } from 'vitest'
import {
  defaultSpectrumView,
  formatViewRange,
  pan,
  viewSpan,
  xToFreq,
  zoomIn,
  zoomOut,
  zoomToCenter
} from './spectrumView'

describe('spectrumView', () => {
  it('defaults to full range', () => {
    const v = defaultSpectrumView()
    expect(v.minHz).toBe(0)
    expect(v.maxHz).toBe(5000)
  })

  it('zooms in around center', () => {
    const v = zoomIn(defaultSpectrumView())
    expect(viewSpan(v)).toBe(2500)
  })

  it('zooms out then caps at max span', () => {
    const v = zoomOut(defaultSpectrumView())
    expect(viewSpan(v)).toBe(5000)
  })

  it('zooms to center with min span', () => {
    const v = zoomToCenter(defaultSpectrumView(), 1000, 100)
    expect(v.minHz).toBe(950)
    expect(v.maxHz).toBe(1050)
  })

  it('pans without leaving bounds', () => {
    const narrow = zoomToCenter(defaultSpectrumView(), 2500, 1000)
    const v = pan(narrow, 3000)
    expect(v.minHz).toBeGreaterThanOrEqual(0)
    expect(v.maxHz).toBeLessThanOrEqual(5000)
    expect(v.maxHz - v.minHz).toBe(1000)
  })

  it('maps x to frequency', () => {
    const v = { minHz: 900, maxHz: 1100 }
    expect(xToFreq(50, 100, v)).toBe(1000)
  })

  it('formats view range', () => {
    expect(formatViewRange({ minHz: 980.4, maxHz: 1020.6 })).toBe('view: 980–1021 Hz')
  })
})
