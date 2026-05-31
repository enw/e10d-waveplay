export type WaveShape = 'sine' | 'square' | 'triangle' | 'sawtooth'
export type SignalMode = 'basic' | 'am' | 'fm' | 'mix' | 'cw' | 'ssb' | 'superhet'
export type MixMode = 'sum' | 'product'
export type EnvelopeShape = 'cos' | 'square'
export type SsbSideband = 'usb' | 'lsb'
export type ModulatorSource = 'tone' | 'mic'
export type SuperhetStage = 'rf' | 'mixer' | 'if' | 'demod' | 'audio'

export interface BasicParams {
  waveShape: WaveShape
  frequencyHz: number
  amplitude: number
}

export interface AmParams {
  carrierHz: number
  modulatorHz: number
  modulationIndex: number
  modulatorSource: ModulatorSource
  micGain: number
}

export interface FmParams {
  carrierHz: number
  modulatorHz: number
  deviationHz: number
  modulatorSource: ModulatorSource
  micGain: number
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

export interface SsbParams {
  carrierHz: number
  modulatorHz: number
  sideband: SsbSideband
  amplitude: number
  carrierPilot: boolean
  modulatorSource: ModulatorSource
  micGain: number
}

export interface FilterParams {
  enabled: boolean
  centerHz: number
  bandwidthHz: number
}

export interface SuperhetParams {
  rfCarrierHz: number
  rfModHz: number
  modulationIndex: number
  loHz: number
  ifCenterHz: number
  ifBandwidthHz: number
}

export interface SignalState {
  mode: SignalMode
  basic: BasicParams
  am: AmParams
  fm: FmParams
  mix: MixParams
  cw: CwParams
  ssb: SsbParams
  superhet: SuperhetParams
  filter: FilterParams
  volume: number
  playing: boolean
}

export interface VizHints {
  envelope?: {
    min: number
    max: number
    modulatorHz: number
    carrierHz: number
    shape?: EnvelopeShape
    micLive?: boolean
  }
  spectrumLabels?: { freq: number; label: string }[]
  filterOverlay?: FilterParams
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
  modulationIndex: 1,
  modulatorSource: 'tone',
  micGain: 1
}

export const DEFAULT_FM: FmParams = {
  carrierHz: 440,
  modulatorHz: 5,
  deviationHz: 25,
  modulatorSource: 'tone',
  micGain: 1
}

export const DEFAULT_MIX: MixParams = {
  oscAHz: 1000,
  oscAAmp: 0.5,
  oscBHz: 1005,
  oscBAmp: 0.5,
  mixMode: 'sum'
}

export const DEFAULT_CW: CwParams = {
  carrierHz: 800,
  gateHz: 5,
  amplitude: 0.5
}

export const DEFAULT_SSB: SsbParams = {
  carrierHz: 1000,
  modulatorHz: 100,
  sideband: 'usb',
  amplitude: 0.5,
  carrierPilot: false,
  modulatorSource: 'tone',
  micGain: 1
}

export const DEFAULT_FILTER: FilterParams = {
  enabled: false,
  centerHz: 1000,
  bandwidthHz: 2400
}

export const DEFAULT_SUPERHET: SuperhetParams = {
  rfCarrierHz: 1000,
  rfModHz: 100,
  modulationIndex: 0.8,
  loHz: 1200,
  ifCenterHz: 200,
  ifBandwidthHz: 400
}

export function defaultSignalState(): SignalState {
  return {
    mode: 'basic',
    basic: { ...DEFAULT_BASIC },
    am: { ...DEFAULT_AM },
    fm: { ...DEFAULT_FM },
    mix: { ...DEFAULT_MIX },
    cw: { ...DEFAULT_CW },
    ssb: { ...DEFAULT_SSB },
    superhet: { ...DEFAULT_SUPERHET },
    filter: { ...DEFAULT_FILTER },
    volume: 0.5,
    playing: false
  }
}

export function clampMicGain(g: number): number {
  return Math.min(2, Math.max(0, g))
}

export function usesMicModulator(state: SignalState): boolean {
  switch (state.mode) {
    case 'am':
      return state.am.modulatorSource === 'mic'
    case 'fm':
      return state.fm.modulatorSource === 'mic'
    case 'ssb':
      return state.ssb.modulatorSource === 'mic'
    default:
      return false
  }
}

export function stateNeedsMic(state: SignalState): boolean {
  return usesMicModulator(state)
}

export function suggestIfCenter(rfCarrierHz: number, loHz: number): number {
  return Math.abs(rfCarrierHz - loHz)
}

export function mergePresetParams(mode: SignalMode, params: object): SignalState[SignalMode] {
  switch (mode) {
    case 'basic':
      return { ...DEFAULT_BASIC, ...params } as SignalState['basic']
    case 'am':
      return { ...DEFAULT_AM, ...params } as SignalState['am']
    case 'fm':
      return { ...DEFAULT_FM, ...params } as SignalState['fm']
    case 'mix':
      return { ...DEFAULT_MIX, ...params } as SignalState['mix']
    case 'cw':
      return { ...DEFAULT_CW, ...params } as SignalState['cw']
    case 'ssb':
      return { ...DEFAULT_SSB, ...params } as SignalState['ssb']
    case 'superhet':
      return { ...DEFAULT_SUPERHET, ...params } as SignalState['superhet']
  }
}

export function getVizHints(state: SignalState): VizHints {
  switch (state.mode) {
    case 'basic':
      return {
        rfHint: 'Pure tone — like an unmodulated carrier before you key the mic.',
        spectrumLabels: [{ freq: state.basic.frequencyHz, label: 'tone' }],
        filterOverlay: state.filter.enabled ? state.filter : undefined
      }
    case 'am': {
      const { carrierHz, modulatorHz, modulationIndex, modulatorSource } = state.am
      const m = modulationIndex
      const mic = modulatorSource === 'mic'
      return {
        rfHint: mic
          ? 'Your voice modulates the carrier — speech formants become sidebands around fc.'
          : 'At RF, fc is your transmit frequency; fm is baseband (voice/data).',
        envelope: mic
          ? { min: 0, max: m, modulatorHz: 0, carrierHz, micLive: true }
          : {
              min: -m,
              max: m,
              modulatorHz,
              carrierHz
            },
        spectrumLabels: mic
          ? [{ freq: carrierHz, label: 'carrier' }]
          : [
              { freq: carrierHz - modulatorHz, label: 'LSB' },
              { freq: carrierHz, label: 'carrier' },
              { freq: carrierHz + modulatorHz, label: 'USB' }
            ],
        filterOverlay: state.filter.enabled ? state.filter : undefined
      }
    }
    case 'fm': {
      const { carrierHz, modulatorHz, deviationHz, modulatorSource } = state.fm
      const mic = modulatorSource === 'mic'
      return {
        rfHint: mic
          ? 'Your voice drives FM deviation — louder speech pushes sidebands farther from fc.'
          : 'Deviation at RF is in kHz; here we use Hz so you can hear the sidebands.',
        spectrumLabels: mic
          ? [{ freq: carrierHz, label: 'carrier' }]
          : [
              { freq: carrierHz - modulatorHz, label: '−fm' },
              { freq: carrierHz, label: 'carrier' },
              { freq: carrierHz + modulatorHz, label: '+fm' }
            ],
        filterOverlay: state.filter.enabled ? state.filter : undefined
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
        spectrumLabels: labels,
        filterOverlay: state.filter.enabled ? state.filter : undefined
      }
    }
    case 'cw': {
      const { carrierHz, gateHz } = state.cw
      return {
        rfHint: 'CW keys the carrier on and off — no voice sidebands, just carrier present or absent.',
        envelope: {
          min: 0,
          max: 1,
          modulatorHz: gateHz,
          carrierHz,
          shape: 'square'
        },
        spectrumLabels: [
          { freq: carrierHz, label: 'carrier' },
          { freq: carrierHz - gateHz, label: '−fg' },
          { freq: carrierHz + gateHz, label: '+fg' }
        ],
        filterOverlay: state.filter.enabled ? state.filter : undefined
      }
    }
    case 'ssb': {
      const { carrierHz, modulatorHz, sideband, carrierPilot, modulatorSource } = state.ssb
      const mic = modulatorSource === 'mic'
      const sideFreq =
        sideband === 'usb' ? carrierHz + modulatorHz : carrierHz - modulatorHz
      const labels = mic
        ? [{ freq: sideband === 'usb' ? carrierHz + 200 : carrierHz - 200, label: sideband.toUpperCase() }]
        : [{ freq: sideFreq, label: sideband.toUpperCase() }]
      if (carrierPilot) {
        labels.push({ freq: carrierHz, label: 'pilot' })
      }
      return {
        rfHint: mic
          ? 'Your voice becomes a single sideband — half the bandwidth of AM on HF.'
          : 'SSB sends one sideband — half the bandwidth of AM. Carrier suppressed saves transmit power on HF.',
        spectrumLabels: labels,
        filterOverlay: state.filter.enabled ? state.filter : undefined
      }
    }
    case 'superhet': {
      const { rfCarrierHz, rfModHz, loHz, ifCenterHz } = state.superhet
      const ifPeak = ifCenterHz
      return {
        rfHint:
          'Superhet: RF signal mixes with LO → IF filter selects difference frequency → demod recovers audio.',
        spectrumLabels: [
          { freq: rfCarrierHz, label: 'RF' },
          { freq: loHz, label: 'LO' },
          { freq: ifPeak, label: 'IF' },
          { freq: rfModHz, label: 'audio' }
        ],
        filterOverlay: state.filter.enabled ? state.filter : undefined
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
