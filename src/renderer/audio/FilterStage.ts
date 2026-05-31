import type { FilterParams } from './types'
import { clampFreq } from './types'

export interface FilterStageResult {
  input: GainNode
  output: GainNode
  filter: BiquadFilterNode | null
  dispose: () => void
}

export function clampBandwidthHz(bw: number): number {
  return Math.min(4000, Math.max(100, bw))
}

export function bandwidthToQ(centerHz: number, bandwidthHz: number): number {
  const center = clampFreq(centerHz)
  const bw = clampBandwidthHz(bandwidthHz)
  return Math.max(0.5, center / bw)
}

export function connectFilterStage(
  ctx: BaseAudioContext,
  params: FilterParams
): FilterStageResult {
  const input = ctx.createGain()
  input.gain.value = 1
  const output = ctx.createGain()
  output.gain.value = 1

  if (!params.enabled) {
    input.connect(output)
    return {
      input,
      output,
      filter: null,
      dispose: () => {
        input.disconnect()
        output.disconnect()
      }
    }
  }

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = clampFreq(params.centerHz)
  filter.Q.value = bandwidthToQ(params.centerHz, params.bandwidthHz)

  input.connect(filter)
  filter.connect(output)

  return {
    input,
    output,
    filter,
    dispose: () => {
      input.disconnect()
      filter.disconnect()
      output.disconnect()
    }
  }
}

export function updateFilterNode(filter: BiquadFilterNode, params: FilterParams): void {
  filter.frequency.setTargetAtTime(clampFreq(params.centerHz), filter.context.currentTime, 0.01)
  filter.Q.setTargetAtTime(
    bandwidthToQ(params.centerHz, params.bandwidthHz),
    filter.context.currentTime,
    0.01
  )
}
