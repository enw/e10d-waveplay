import type { NoiseParams, SignalState } from './types'
import { clampAmp, clampFreq, DEFAULT_NOISE } from './types'

export function resolveNoise(state: SignalState): NoiseParams {
  return state.noise ?? DEFAULT_NOISE
}

export function noiseActive(noise: NoiseParams): boolean {
  return noise.awgnEnabled || noise.qrmEnabled || noise.humEnabled
}

export interface NoiseStage {
  input: GainNode
  output: GainNode
  awgnGain: GainNode
  qrmGain: GainNode
  humGain: GainNode
  qrmOsc: OscillatorNode
  humOsc: OscillatorNode
  awgnSource: AudioBufferSourceNode
  dispose: () => void
}

function createWhiteNoiseSource(ctx: AudioContext): {
  source: AudioBufferSourceNode
  gain: GainNode
} {
  const bufferSize = Math.floor(ctx.sampleRate * 2)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = 0
  source.connect(gain)
  source.start()
  return { source, gain }
}

/** Map SNR dB (higher = cleaner) to noise mix gain. */
export function snrDbToNoiseGain(snrDb: number): number {
  const snr = Math.max(0.01, snrDb)
  return Math.min(1, 1 / Math.sqrt(Math.pow(10, snr / 10)))
}

export function carrierHzForQrm(state: SignalState): number {
  switch (state.mode) {
    case 'basic':
      return state.basic.frequencyHz
    case 'am':
      return state.am.carrierHz
    case 'fm':
      return state.fm.carrierHz
    case 'mix':
      return state.mix.oscAHz
    case 'cw':
      return state.cw.carrierHz
    case 'tonetext':
      return state.tonetext.rootHz
    case 'ssb':
      return state.ssb.carrierHz
    case 'superhet':
      return state.superhet.rfCarrierHz
  }
}

export function connectNoiseStage(ctx: AudioContext, state: SignalState): NoiseStage {
  const noiseParams = resolveNoise(state)
  const input = ctx.createGain()
  input.gain.value = 1
  const output = ctx.createGain()
  output.gain.value = 1

  input.connect(output)

  const { source: awgnSource, gain: awgnGain } = createWhiteNoiseSource(ctx)
  awgnGain.connect(output)

  const qrmOsc = ctx.createOscillator()
  qrmOsc.type = 'sine'
  qrmOsc.frequency.value = carrierHzForQrm(state)
  const qrmGain = ctx.createGain()
  qrmGain.gain.value = 0
  qrmOsc.connect(qrmGain)
  qrmGain.connect(output)
  qrmOsc.start()

  const humOsc = ctx.createOscillator()
  humOsc.type = 'sine'
  humOsc.frequency.value = 60
  const humGain = ctx.createGain()
  humGain.gain.value = 0
  humOsc.connect(humGain)
  humGain.connect(output)
  humOsc.start()

  const stage: NoiseStage = {
    input,
    output,
    awgnGain,
    qrmGain,
    humGain,
    qrmOsc,
    humOsc,
    awgnSource,
    dispose: () => {
      awgnSource.stop()
      awgnSource.disconnect()
      awgnGain.disconnect()
      qrmOsc.stop()
      qrmOsc.disconnect()
      qrmGain.disconnect()
      humOsc.stop()
      humOsc.disconnect()
      humGain.disconnect()
      input.disconnect()
      output.disconnect()
    }
  }

  updateNoiseStage(stage, noiseParams, state)
  return stage
}

export function updateNoiseStage(
  stage: NoiseStage,
  noise: NoiseParams | undefined,
  state: SignalState
): void {
  const params = noise ?? DEFAULT_NOISE
  const t = stage.input.context.currentTime
  stage.awgnGain.gain.setTargetAtTime(
    params.awgnEnabled ? snrDbToNoiseGain(params.snrDb) * 0.15 : 0,
    t,
    0.02
  )

  const qrmHz = clampFreq(carrierHzForQrm(state) + params.qrmOffsetHz, 20, 4000)
  stage.qrmOsc.frequency.setTargetAtTime(qrmHz, t, 0.02)
  stage.qrmGain.gain.setTargetAtTime(
    params.qrmEnabled ? clampAmp(params.qrmLevel) * 0.35 : 0,
    t,
    0.02
  )

  stage.humGain.gain.setTargetAtTime(
    params.humEnabled ? clampAmp(params.humLevel) * 0.12 : 0,
    t,
    0.02
  )
}

export function noiseRfHint(noise: NoiseParams | undefined): string {
  const params = noise ?? DEFAULT_NOISE
  const parts: string[] = []
  if (params.awgnEnabled) parts.push(`AWGN at ~${Math.round(params.snrDb)} dB SNR`)
  if (params.qrmEnabled) parts.push(`adjacent QRM +${Math.round(params.qrmOffsetHz)} Hz`)
  if (params.humEnabled) parts.push('60 Hz hum')
  if (parts.length === 0) return ''
  return `Noise lab: ${parts.join('; ')} — like band noise, nearby signals, and AC hum on HF.`
}

export type { SignalMode } from './types'
