import type {
  AmParams,
  BasicParams,
  CwParams,
  FmParams,
  MixParams,
  SignalMode,
  SignalState,
  SsbParams,
  SuperhetParams,
  SuperhetStage,
  WaveShape
} from './types'
import {
  clampAmp,
  clampFreq,
  clampMicGain,
  clampModIndex,
  stateNeedsMic
} from './types'
import { MicInput } from './MicInput'
import { createHilbertSplit } from './hilbert'
import { connectFilterStage, updateFilterNode } from './FilterStage'
import { buildSuperhetChain } from './SuperhetChain'

type Disposer = () => void

export class SignalGraph {
  readonly context: AudioContext
  readonly analyser: AnalyserNode
  readonly micInput = new MicInput()

  private masterGain: GainNode
  private disposeGraph: Disposer | null = null
  private _playing = false
  private superhetStage: SuperhetStage = 'audio'
  private superhetStages: Record<SuperhetStage, AudioNode> | null = null
  private liveFilter: BiquadFilterNode | null = null
  private vizTapNode: AudioNode | null = null

  constructor() {
    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 4096
    this.analyser.smoothingTimeConstant = 0.75
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(this.context.destination)
  }

  get playing(): boolean {
    return this._playing
  }

  async ensureRunning(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  async prepare(state: SignalState): Promise<void> {
    if (stateNeedsMic(state)) {
      await this.micInput.acquire(this.context)
      const gain =
        state.mode === 'am'
          ? state.am.micGain
          : state.mode === 'fm'
            ? state.fm.micGain
            : state.ssb.micGain
      this.micInput.setGain(clampMicGain(gain))
    } else {
      this.micInput.release()
    }
  }

  async start(state: SignalState): Promise<void> {
    await this.ensureRunning()
    await this.prepare(state)
    this.rebuild(state)
    this._playing = true
  }

  stop(): void {
    this.disposeGraph?.()
    this.disposeGraph = null
    this.superhetStages = null
    this.liveFilter = null
    this.vizTapNode = null
    this.micInput.release()
    this._playing = false
  }

  setVolume(v: number): void {
    this.masterGain.gain.setTargetAtTime(clampAmp(v), this.context.currentTime, 0.01)
  }

  setSuperhetStage(stage: SuperhetStage): void {
    this.superhetStage = stage
    if (this.superhetStages) {
      this.setAnalyserTap(this.superhetStages[stage])
    }
  }

  rebuild(state: SignalState): void {
    this.disposeGraph?.()
    this.disposeGraph = null
    this.superhetStages = null
    this.liveFilter = null
    this.vizTapNode = null
    this.disposeGraph = this.buildGraph(state)
    if (state.volume !== undefined) {
      this.setVolume(state.volume)
    }
  }

  async updateParams(state: SignalState): Promise<void> {
    if (!this._playing) return
    await this.prepare(state)
    if (state.mode === 'superhet' && this.liveFilter && state.filter.enabled) {
      updateFilterNode(this.liveFilter, {
        enabled: true,
        centerHz: state.superhet.ifCenterHz,
        bandwidthHz: state.superhet.ifBandwidthHz
      })
    } else if (this.liveFilter && state.filter.enabled) {
      updateFilterNode(this.liveFilter, state.filter)
    } else {
      this.rebuild(state)
    }
  }

  scheduleSweepParam(paramKey: string, value: number, state: SignalState): void {
    const t = this.context.currentTime
    if (paramKey === 'am.modulationIndex' && state.mode === 'am') {
      this.rebuild({ ...state, am: { ...state.am, modulationIndex: value } })
    } else if (paramKey === 'fm.deviationHz' && state.mode === 'fm') {
      this.rebuild({ ...state, fm: { ...state.fm, deviationHz: value } })
    } else if (paramKey === 'mix.oscBHz' && state.mode === 'mix') {
      this.rebuild({ ...state, mix: { ...state.mix, oscBHz: value } })
    } else if (paramKey === 'filter.bandwidthHz') {
      if (this.liveFilter) {
        updateFilterNode(this.liveFilter, { ...state.filter, bandwidthHz: value })
      } else {
        this.rebuild(applySweepState(state, paramKey, value))
      }
    } else {
      this.rebuild(applySweepState(state, paramKey, value))
    }
    void t
  }

  private setAnalyserTap(node: AudioNode): void {
    if (this.vizTapNode) {
      try {
        this.vizTapNode.disconnect(this.analyser)
      } catch {
        // Previous tap was disposed during rebuild.
      }
    }
    node.connect(this.analyser)
    this.vizTapNode = node
  }

  private connectOutput(source: AudioNode, state: SignalState): Disposer {
    if (state.mode === 'superhet') {
      source.connect(this.masterGain)
      return () => source.disconnect(this.masterGain)
    }

    const filter = connectFilterStage(this.context, state.filter)
    this.liveFilter = filter.filter
    source.connect(filter.input)
    filter.output.connect(this.masterGain)
    this.setAnalyserTap(filter.output)

    return () => {
      filter.dispose()
      this.liveFilter = null
    }
  }

  private buildGraph(state: SignalState): Disposer {
    switch (state.mode) {
      case 'basic':
        return this.buildBasic(state.basic, state)
      case 'am':
        return this.buildAm(state.am, state)
      case 'fm':
        return this.buildFm(state.fm, state)
      case 'mix':
        return this.buildMix(state.mix, state)
      case 'cw':
        return this.buildCw(state.cw, state)
      case 'ssb':
        return this.buildSsb(state.ssb, state)
      case 'superhet':
        return this.buildSuperhet(state.superhet, state)
    }
  }

  private buildBasic(params: BasicParams, state: SignalState): Disposer {
    const osc = this.context.createOscillator()
    osc.type = params.waveShape
    osc.frequency.value = clampFreq(params.frequencyHz)
    const gain = this.context.createGain()
    gain.gain.value = clampAmp(params.amplitude)
    osc.connect(gain)
    const outDispose = this.connectOutput(gain, state)
    osc.start()
    return () => {
      osc.stop()
      osc.disconnect()
      gain.disconnect()
      outDispose()
    }
  }

  private buildAm(params: AmParams, state: SignalState): Disposer {
    const carrierHz = clampFreq(params.carrierHz)
    const modulatorHz = clampFreq(params.modulatorHz, 1, 500)
    const m = clampModIndex(params.modulationIndex)
    const useMic = params.modulatorSource === 'mic'

    const carrier = this.context.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = carrierHz

    const modGain = this.context.createGain()
    modGain.gain.value = m

    const offset = this.context.createConstantSource()
    offset.offset.value = 1

    const ampGain = this.context.createGain()
    ampGain.gain.value = 0.5 * (1 + m)

    const disposers: Disposer[] = []

    if (useMic) {
      const mod = this.micInput.modulatorOut
      if (mod) mod.connect(modGain)
    } else {
      const modulator = this.context.createOscillator()
      modulator.type = 'sine'
      modulator.frequency.value = modulatorHz
      modulator.connect(modGain)
      modulator.start()
      disposers.push(() => {
        modulator.stop()
        modulator.disconnect()
      })
    }

    modGain.connect(ampGain.gain)
    offset.connect(ampGain.gain)
    carrier.connect(ampGain)
    const outDispose = this.connectOutput(ampGain, state)

    carrier.start()
    offset.start()

    return () => {
      carrier.stop()
      offset.stop()
      carrier.disconnect()
      modGain.disconnect()
      offset.disconnect()
      ampGain.disconnect()
      disposers.forEach((d) => d())
      outDispose()
    }
  }

  private buildFm(params: FmParams, state: SignalState): Disposer {
    const carrierHz = clampFreq(params.carrierHz)
    const modulatorHz = clampFreq(params.modulatorHz, 1, 500)
    const deviationHz = Math.min(500, Math.max(0, params.deviationHz))
    const useMic = params.modulatorSource === 'mic'

    const carrier = this.context.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = carrierHz

    const devGain = this.context.createGain()
    devGain.gain.value = useMic ? deviationHz * 2 : deviationHz

    const outGain = this.context.createGain()
    outGain.gain.value = 0.5

    const disposers: Disposer[] = []

    if (useMic) {
      const mod = this.micInput.modulatorOut
      if (mod) mod.connect(devGain)
    } else {
      const modulator = this.context.createOscillator()
      modulator.type = 'sine'
      modulator.frequency.value = modulatorHz
      modulator.connect(devGain)
      modulator.start()
      disposers.push(() => {
        modulator.stop()
        modulator.disconnect()
      })
    }

    devGain.connect(carrier.frequency)
    carrier.connect(outGain)
    const outDispose = this.connectOutput(outGain, state)

    carrier.start()

    return () => {
      carrier.stop()
      carrier.disconnect()
      devGain.disconnect()
      outGain.disconnect()
      disposers.forEach((d) => d())
      outDispose()
    }
  }

  private buildMix(params: MixParams, state: SignalState): Disposer {
    const oscA = this.context.createOscillator()
    oscA.type = 'sine'
    oscA.frequency.value = clampFreq(params.oscAHz)

    const oscB = this.context.createOscillator()
    oscB.type = 'sine'
    oscB.frequency.value = clampFreq(params.oscBHz)

    const gainA = this.context.createGain()
    gainA.gain.value = clampAmp(params.oscAAmp)

    const gainB = this.context.createGain()
    gainB.gain.value = clampAmp(params.oscBAmp)

    oscA.connect(gainA)
    oscB.connect(gainB)

    let outDispose: Disposer

    if (params.mixMode === 'sum') {
      const sumGain = this.context.createGain()
      sumGain.gain.value = 1
      gainA.connect(sumGain)
      gainB.connect(sumGain)
      outDispose = this.connectOutput(sumGain, state)
    } else {
      const productGain = this.context.createGain()
      productGain.gain.value = 0
      gainA.connect(productGain)
      gainB.connect(productGain.gain)
      outDispose = this.connectOutput(productGain, state)
    }

    oscA.start()
    oscB.start()

    return () => {
      oscA.stop()
      oscB.stop()
      oscA.disconnect()
      oscB.disconnect()
      gainA.disconnect()
      gainB.disconnect()
      outDispose()
    }
  }

  private buildCw(params: CwParams, state: SignalState): Disposer {
    const carrierHz = clampFreq(params.carrierHz)
    const gateHz = clampFreq(params.gateHz, 0.5, 20)
    const amp = clampAmp(params.amplitude)

    const carrier = this.context.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = carrierHz

    const gate = this.context.createOscillator()
    gate.type = 'square'
    gate.frequency.value = gateHz

    const modGain = this.context.createGain()
    modGain.gain.value = amp * 0.5

    const offset = this.context.createConstantSource()
    offset.offset.value = amp * 0.5

    const ampGain = this.context.createGain()

    gate.connect(modGain)
    modGain.connect(ampGain.gain)
    offset.connect(ampGain.gain)
    carrier.connect(ampGain)
    const outDispose = this.connectOutput(ampGain, state)

    carrier.start()
    gate.start()
    offset.start()

    return () => {
      carrier.stop()
      gate.stop()
      offset.stop()
      carrier.disconnect()
      gate.disconnect()
      modGain.disconnect()
      offset.disconnect()
      ampGain.disconnect()
      outDispose()
    }
  }

  private buildSsb(params: SsbParams, state: SignalState): Disposer {
    const carrierHz = clampFreq(params.carrierHz)
    const modulatorHz = clampFreq(params.modulatorHz, 1, 500)
    const amp = clampAmp(params.amplitude)
    const useMic = params.modulatorSource === 'mic'

    const hilbert = createHilbertSplit(this.context)
    const disposers: Disposer[] = []

    if (useMic) {
      const mod = this.micInput.modulatorOut
      if (mod) mod.connect(hilbert.input)
    } else {
      const voice = this.context.createOscillator()
      voice.type = 'sine'
      voice.frequency.value = modulatorHz
      voice.connect(hilbert.input)
      voice.start()
      disposers.push(() => {
        voice.stop()
        voice.disconnect()
      })
    }

    const cosOsc = this.context.createOscillator()
    cosOsc.type = 'sine'
    cosOsc.frequency.value = carrierHz

    const sinDelay = this.context.createDelay(1)
    sinDelay.delayTime.value = Math.min(1 / (4 * carrierHz), 0.05)

    const cosGain = this.context.createGain()
    cosGain.gain.value = 0
    const sinGain = this.context.createGain()
    sinGain.gain.value = 0

    hilbert.i.connect(cosGain)
    cosOsc.connect(cosGain.gain)

    hilbert.q.connect(sinGain)
    cosOsc.connect(sinDelay)
    sinDelay.connect(sinGain.gain)

    const sign = params.sideband === 'usb' ? -1 : 1
    const qScale = this.context.createGain()
    qScale.gain.value = sign

    const sum = this.context.createGain()
    sum.gain.value = amp * 0.5

    cosGain.connect(sum)
    sinGain.connect(qScale)
    qScale.connect(sum)

    const outDispose = this.connectOutput(sum, state)

    cosOsc.start()

    let pilotOsc: OscillatorNode | null = null
    let pilotGain: GainNode | null = null

    if (params.carrierPilot) {
      pilotOsc = this.context.createOscillator()
      pilotOsc.type = 'sine'
      pilotOsc.frequency.value = carrierHz
      pilotGain = this.context.createGain()
      pilotGain.gain.value = amp * 0.1
      pilotOsc.connect(pilotGain)
      pilotGain.connect(this.masterGain)
      pilotOsc.start()
    }

    return () => {
      cosOsc.stop()
      cosOsc.disconnect()
      sinDelay.disconnect()
      cosGain.disconnect()
      sinGain.disconnect()
      qScale.disconnect()
      sum.disconnect()
      hilbert.dispose()
      disposers.forEach((d) => d())
      pilotOsc?.stop()
      pilotOsc?.disconnect()
      pilotGain?.disconnect()
      outDispose()
    }
  }

  private buildSuperhet(params: SuperhetParams, state: SignalState): Disposer {
    const chain = buildSuperhetChain(this.context, params)
    this.superhetStages = chain.stages
    this.liveFilter = null

    chain.stages.audio.connect(this.masterGain)
    this.setAnalyserTap(chain.stages[this.superhetStage])

    return () => {
      chain.dispose()
      chain.stages.audio.disconnect(this.masterGain)
      this.superhetStages = null
    }
  }
}

function applySweepState(state: SignalState, paramKey: string, value: number): SignalState {
  const [section, field] = paramKey.split('.')
  if (!section || !field) return state
  if (section === 'filter') {
    return { ...state, filter: { ...state.filter, [field]: value } }
  }
  const block = state[section as keyof SignalState]
  if (typeof block !== 'object' || block === null) return state
  return { ...state, [section]: { ...block, [field]: value } } as SignalState
}

export function shapeLabel(shape: WaveShape): string {
  return shape.charAt(0).toUpperCase() + shape.slice(1)
}

export type { SignalMode, SignalState, SuperhetStage }
