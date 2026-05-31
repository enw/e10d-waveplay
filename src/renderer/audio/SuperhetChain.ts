import type { SuperhetParams } from './types'
import { clampAmp, clampFreq, clampModIndex } from './types'
import { connectFilterStage } from './FilterStage'

type Disposer = () => void

export interface SuperhetBuildResult {
  dispose: Disposer
  stages: Record<'rf' | 'mixer' | 'if' | 'demod' | 'audio', AudioNode>
}

export function buildSuperhetChain(
  ctx: BaseAudioContext,
  params: SuperhetParams
): SuperhetBuildResult {
  const rfCarrierHz = clampFreq(params.rfCarrierHz)
  const rfModHz = clampFreq(params.rfModHz, 1, 500)
  const m = clampModIndex(params.modulationIndex)
  const loHz = clampFreq(params.loHz)
  const ifCenter = clampFreq(params.ifCenterHz, 20, 4000)
  const ifBw = Math.min(4000, Math.max(100, params.ifBandwidthHz))

  const rfCarrier = ctx.createOscillator()
  rfCarrier.type = 'sine'
  rfCarrier.frequency.value = rfCarrierHz

  const rfMod = ctx.createOscillator()
  rfMod.type = 'sine'
  rfMod.frequency.value = rfModHz

  const modGain = ctx.createGain()
  modGain.gain.value = m
  const offset = ctx.createConstantSource()
  offset.offset.value = 1
  const rfGain = ctx.createGain()
  rfGain.gain.value = 0.5 * (1 + m)

  rfMod.connect(modGain)
  modGain.connect(rfGain.gain)
  offset.connect(rfGain.gain)
  rfCarrier.connect(rfGain)

  const lo = ctx.createOscillator()
  lo.type = 'sine'
  lo.frequency.value = loHz

  const mixerGain = ctx.createGain()
  mixerGain.gain.value = 0
  rfGain.connect(mixerGain)
  lo.connect(mixerGain.gain)

  const ifStage = connectFilterStage(ctx, {
    enabled: true,
    centerHz: ifCenter,
    bandwidthHz: ifBw
  })
  mixerGain.connect(ifStage.input)

  const rectifier = ctx.createWaveShaperNode()
  rectifier.curve = makeAbsCurve()
  rectifier.oversample = 'none'
  ifStage.output.connect(rectifier)

  const demodLpf = ctx.createBiquadFilter()
  demodLpf.type = 'lowpass'
  demodLpf.frequency.value = 250
  demodLpf.Q.value = 0.707
  rectifier.connect(demodLpf)

  const audioGain = ctx.createGain()
  audioGain.gain.value = 0.8
  demodLpf.connect(audioGain)

  rfCarrier.start()
  rfMod.start()
  offset.start()
  lo.start()

  return {
    stages: {
      rf: rfGain,
      mixer: mixerGain,
      if: ifStage.output,
      demod: demodLpf,
      audio: audioGain
    },
    dispose: () => {
      rfCarrier.stop()
      rfMod.stop()
      offset.stop()
      lo.stop()
      rfCarrier.disconnect()
      rfMod.disconnect()
      modGain.disconnect()
      offset.disconnect()
      rfGain.disconnect()
      lo.disconnect()
      mixerGain.disconnect()
      ifStage.dispose()
      rectifier.disconnect()
      demodLpf.disconnect()
      audioGain.disconnect()
    }
  }
}

function makeAbsCurve(): Float32Array {
  const n = 256
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.abs(x)
  }
  return curve
}

export function suggestIfCenter(rfCarrierHz: number, loHz: number): number {
  return Math.abs(rfCarrierHz - loHz)
}
