export type WaveShape = 'sine' | 'square' | 'triangle' | 'sawtooth'
export type SignalMode = 'basic' | 'am' | 'fm' | 'mix'
export type MixMode = 'sum' | 'product'

export interface BasicParams {
  waveShape: WaveShape
  frequencyHz: number
  amplitude: number
}

export interface AmParams {
  carrierHz: number
  modulatorHz: number
  modulationIndex: number
}

export interface FmParams {
  carrierHz: number
  modulatorHz: number
  deviationHz: number
}

export interface MixParams {
  oscAHz: number
  oscAAmp: number
  oscBHz: number
  oscBAmp: number
  mixMode: MixMode
}

export interface CwParams {
  carrierHz: number
  gateHz: number
  amplitude: number
}

export interface SignalState {
  mode: SignalMode
  basic: BasicParams
  am: AmParams
  fm: FmParams
  mix: MixParams
  volume: number
  playing: boolean
}

export interface VizHints {
  envelope?: { min: number; max: number; modulatorHz: number; carrierHz: number }
  spectrumLabels?: { freq: number; label: string }[]
  rfHint: string
}

export const DEFAULT_BASIC: BasicParams = {
  waveShape: 'sine',
  frequencyHz: 1000,
  amplitude: 0.5
}

export const DEFAULT_AM: AmParams = {
  carrierHz: 1000,
  modulatorHz: 100,
  modulationIndex: 1
}

export const DEFAULT_FM: FmParams = {
  carrierHz: 440,
  modulatorHz: 5,
  deviationHz: 25
}

export const DEFAULT_MIX: MixParams = {
  oscAHz: 1000,
  oscAAmp: 0.5,
  oscBHz: 1005,
  oscBAmp: 0.5,
  mixMode: 'sum'
}

export function defaultSignalState(): SignalState {
  return {
    mode: 'basic',
    basic: { ...DEFAULT_BASIC },
    am: { ...DEFAULT_AM },
    fm: { ...DEFAULT_FM },
    mix: { ...DEFAULT_MIX },
    volume: 0.5,
    playing: false
  }
}

export function getVizHints(state: SignalState): VizHints {
  switch (state.mode) {
    case 'basic':
      return {
        rfHint: 'Pure tone — like an unmodulated carrier before you key the mic.',
        spectrumLabels: [{ freq: state.basic.frequencyHz, label: 'tone' }]
      }
    case 'am': {
      const { carrierHz, modulatorHz, modulationIndex } = state.am
      const m = modulationIndex
      return {
        rfHint: 'At RF, fc is your transmit frequency; fm is baseband (voice/data).',
        envelope: {
          min: -m,
          max: m,
          modulatorHz,
          carrierHz
        },
        spectrumLabels: [
          { freq: carrierHz - modulatorHz, label: 'LSB' },
          { freq: carrierHz, label: 'carrier' },
          { freq: carrierHz + modulatorHz, label: 'USB' }
        ]
      }
    }
    case 'fm': {
      const { carrierHz, modulatorHz, deviationHz } = state.fm
      return {
        rfHint: 'Deviation at RF is in kHz; here we use Hz so you can hear the sidebands.',
        spectrumLabels: [
          { freq: carrierHz - modulatorHz, label: '−fm' },
          { freq: carrierHz, label: 'carrier' },
          { freq: carrierHz + modulatorHz, label: '+fm' }
        ]
      }
    }
    case 'mix': {
      const { oscAHz, oscBHz, mixMode } = state.mix
      const beat = Math.abs(oscAHz - oscBHz)
      const sum = oscAHz + oscBHz
      const labels =
        mixMode === 'sum'
          ? [
              { freq: oscAHz, label: 'f1' },
              { freq: oscBHz, label: 'f2' },
              { freq: beat, label: 'beat' }
            ]
          : [
              { freq: Math.abs(oscAHz - oscBHz), label: 'Δf' },
              { freq: sum, label: 'f1+f2' }
            ]
      return {
        rfHint: 'Superheterodyne mixing: local oscillator + incoming signal → IF at the difference frequency.',
        spectrumLabels: labels
      }
    }
  }
}

export function clampFreq(hz: number, min = 20, max = 4000): number {
  return Math.min(max, Math.max(min, hz))
}

export function clampAmp(a: number): number {
  return Math.min(1, Math.max(0, a))
}

export function clampModIndex(m: number): number {
  return Math.min(1, Math.max(0, m))
}
