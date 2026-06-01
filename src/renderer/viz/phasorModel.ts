import type { SignalState } from '../audio/types'

export interface PhasorPoint {
  i: number
  q: number
}

export interface PhasorModel {
  supported: boolean
  title: string
  hint: string
  /** Primary trace (modulator / composite). */
  primary: PhasorPoint[]
  /** Secondary trace (e.g. second tone in mix sum). */
  secondary?: PhasorPoint[]
}

const TRAIL_POINTS = 256

function trail(fn: (t: number) => PhasorPoint, periodSec: number): PhasorPoint[] {
  const points: PhasorPoint[] = []
  for (let n = 0; n < TRAIL_POINTS; n++) {
    const t = (n / TRAIL_POINTS) * periodSec
    points.push(fn(t))
  }
  return points
}

function amBaseband(state: SignalState): PhasorModel {
  const { modulatorHz, modulationIndex } = state.am
  const m = modulationIndex
  const wm = 2 * Math.PI * modulatorHz
  const period = 1 / Math.max(modulatorHz, 1)
  return {
    supported: true,
    title: 'AM baseband',
    hint: 'Modulator phasor stays on the I axis — AM has no quadrature component.',
    primary: trail((t) => ({ i: 1 + m * Math.cos(wm * t), q: 0 }), period)
  }
}

function ssbBaseband(state: SignalState): PhasorModel {
  const { modulatorHz, sideband } = state.ssb
  const wm = 2 * Math.PI * modulatorHz
  const period = 1 / Math.max(modulatorHz, 1)
  const sign = sideband === 'usb' ? 1 : -1
  return {
    supported: true,
    title: `${sideband.toUpperCase()} baseband`,
    hint:
      sideband === 'usb'
        ? 'USB rotates counter-clockwise — upper sideband energy.'
        : 'LSB rotates clockwise — lower sideband energy.',
    primary: trail((t) => ({ i: Math.cos(wm * t), q: sign * Math.sin(wm * t) }), period)
  }
}

function mixPhasor(state: SignalState): PhasorModel {
  const { oscAHz, oscBHz, oscAAmp, oscBAmp, mixMode } = state.mix
  const wa = 2 * Math.PI * oscAHz
  const wb = 2 * Math.PI * oscBHz
  const period = 1 / Math.max(Math.abs(oscAHz - oscBHz), 1)

  if (mixMode === 'sum') {
    return {
      supported: true,
      title: 'Mix sum',
      hint: 'Two independent phasors — sum mode does not multiply them.',
      primary: trail((t) => ({ i: oscAAmp * Math.cos(wa * t), q: oscAAmp * Math.sin(wa * t) }), 1 / oscAHz),
      secondary: trail((t) => ({ i: oscBAmp * Math.cos(wb * t), q: oscBAmp * Math.sin(wb * t) }), 1 / oscBHz)
    }
  }

  return {
    supported: true,
    title: 'Mix product',
    hint: 'Product mode: phasor wobbles at the beat frequency — heterodyne intuition.',
    primary: trail((t) => {
      const s = Math.cos(wa * t) * Math.cos(wb * t)
      const i = s
      const q = 0
      return { i, q }
    }, period)
  }
}

function fmBaseband(state: SignalState): PhasorModel {
  const { modulatorHz, deviationHz, carrierHz } = state.fm
  const wm = 2 * Math.PI * modulatorHz
  const beta = deviationHz / Math.max(modulatorHz, 1)
  const period = 1 / Math.max(modulatorHz, 1)
  return {
    supported: true,
    title: 'FM phasor',
    hint: `Instantaneous phase swings ±${Math.round(deviationHz)} Hz — FM fills a disk, not a line.`,
    primary: trail((t) => {
      const phase = 2 * Math.PI * carrierHz * t + beta * Math.sin(wm * t)
      return { i: Math.cos(phase), q: Math.sin(phase) }
    }, period)
  }
}

export function computePhasorModel(state: SignalState): PhasorModel {
  switch (state.mode) {
    case 'am':
      return amBaseband(state)
    case 'ssb':
      return ssbBaseband(state)
    case 'mix':
      return mixPhasor(state)
    case 'fm':
      return fmBaseband(state)
    default:
      return {
        supported: false,
        title: 'Constellation',
        hint: 'Switch to AM, FM, SSB, or Mix to see the I/Q phasor.',
        primary: []
      }
  }
}
