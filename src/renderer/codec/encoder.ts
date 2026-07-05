import {
  ATTACK_MS,
  HARMONIC_MIX,
  RELEASE_MS,
  type CodecConfig,
  type FramePlan,
  type ToneKind
} from './types'
import { buildFrame } from './frame'

function synthesizeTone(
  out: Float32Array,
  sampleRate: number,
  startSample: number,
  durationSamples: number,
  freqHz: number,
  amplitude: number,
  withHarmonic: boolean
): void {
  const attackSamples = Math.floor((ATTACK_MS / 1000) * sampleRate)
  const releaseSamples = Math.floor((RELEASE_MS / 1000) * sampleRate)
  const endSample = Math.min(out.length, startSample + durationSamples)

  for (let i = startSample; i < endSample; i++) {
    const local = i - startSample
    const t = local / sampleRate
    let env = 1
    if (local < attackSamples && attackSamples > 0) {
      env = local / attackSamples
    } else if (local > durationSamples - releaseSamples && releaseSamples > 0) {
      env = Math.max(0, (durationSamples - local) / releaseSamples)
    }
    let sample = Math.sin(2 * Math.PI * freqHz * t)
    if (withHarmonic) {
      sample += HARMONIC_MIX * Math.sin(2 * Math.PI * freqHz * 2 * t)
    }
    out[i] += sample * amplitude * env
  }
}

export function renderFrameToSamples(
  plan: FramePlan,
  sampleRate: number,
  amplitude: number
): Float32Array {
  const length = Math.ceil(plan.totalDurationSec * sampleRate)
  const out = new Float32Array(length)

  for (const slot of plan.slots) {
    const startSample = Math.floor(slot.startSec * sampleRate)
    const durationSamples = Math.floor(slot.durationSec * sampleRate)
    const withHarmonic = slot.kind === 'data'
    synthesizeTone(
      out,
      sampleRate,
      startSample,
      durationSamples,
      slot.freqHz,
      amplitude,
      withHarmonic
    )
  }

  let peak = 0
  for (let i = 0; i < out.length; i++) {
    peak = Math.max(peak, Math.abs(out[i]))
  }
  if (peak > 1) {
    const scale = 0.95 / peak
    for (let i = 0; i < out.length; i++) out[i] *= scale
  }

  return out
}

export function encodeTextToSamples(
  text: string,
  sampleRate: number,
  config: CodecConfig
): Float32Array {
  const plan = buildFrame(text, config)
  return renderFrameToSamples(plan, sampleRate, config.amplitude)
}

export function encodeTextToWavBuffer(
  text: string,
  sampleRate: number,
  config: CodecConfig,
  encodeWav: (samples: Float32Array, sampleRate: number) => ArrayBuffer
): ArrayBuffer {
  return encodeWav(encodeTextToSamples(text, sampleRate, config), sampleRate)
}

export function scheduleLivePlayback(
  ctx: AudioContext,
  plan: FramePlan,
  destination: AudioNode,
  amplitude: number,
  startTime = ctx.currentTime
): () => void {
  const disposers: (() => void)[] = []

  for (const slot of plan.slots) {
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = slot.freqHz

    const gain = ctx.createGain()
    gain.gain.value = 0

    osc1.connect(gain)
    gain.connect(destination)

    const t0 = startTime + slot.startSec
    const t1 = t0 + slot.durationSec
    const attack = ATTACK_MS / 1000
    const release = RELEASE_MS / 1000
    const sustainEnd = Math.max(t0 + attack, t1 - release)

    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(amplitude, t0 + attack)
    gain.gain.setValueAtTime(amplitude, sustainEnd)
    gain.gain.linearRampToValueAtTime(0, t1)

    if (slot.kind === 'data') {
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = slot.freqHz * 2
      const hGain = ctx.createGain()
      hGain.gain.value = 0
      osc2.connect(hGain)
      hGain.connect(destination)
      hGain.gain.setValueAtTime(0, t0)
      hGain.gain.linearRampToValueAtTime(amplitude * HARMONIC_MIX, t0 + attack)
      hGain.gain.setValueAtTime(amplitude * HARMONIC_MIX, sustainEnd)
      hGain.gain.linearRampToValueAtTime(0, t1)
      osc2.start(t0)
      osc2.stop(t1 + 0.01)
      disposers.push(() => {
        osc2.disconnect()
        hGain.disconnect()
      })
    }

    osc1.start(t0)
    osc1.stop(t1 + 0.01)
    disposers.push(() => {
      osc1.disconnect()
      gain.disconnect()
    })
  }

  return () => disposers.forEach((d) => d())
}

export type { ToneKind }
