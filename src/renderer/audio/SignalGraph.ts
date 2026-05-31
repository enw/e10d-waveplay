import type { AmParams, BasicParams, CwParams, FmParams, MixParams, SignalMode, SignalState, WaveShape } from './types'
import { clampAmp, clampFreq, clampModIndex } from './types'

type Disposer = () => void

export class SignalGraph {
  readonly context: AudioContext
  readonly analyser: AnalyserNode
  private masterGain: GainNode
  private disposeGraph: Disposer | null = null
  private _playing = false

  constructor() {
    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 4096
    this.analyser.smoothingTimeConstant = 0.75
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(this.analyser)
    this.analyser.connect(this.context.destination)
  }

  get playing(): boolean {
    return this._playing
  }

  async ensureRunning(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  async start(state: SignalState): Promise<void> {
    await this.ensureRunning()
    this.rebuild(state)
    this._playing = true
  }

  stop(): void {
    this.disposeGraph?.()
    this.disposeGraph = null
    this._playing = false
  }

  setVolume(v: number): void {
    this.masterGain.gain.setTargetAtTime(clampAmp(v), this.context.currentTime, 0.01)
  }

  rebuild(state: SignalState): void {
    this.disposeGraph?.()
    this.disposeGraph = this.buildGraph(state)
    if (state.volume !== undefined) {
      this.setVolume(state.volume)
    }
  }

  updateParams(state: SignalState): void {
    if (!this._playing) return
    this.rebuild(state)
  }

  private buildGraph(state: SignalState): Disposer {
    switch (state.mode) {
      case 'basic':
        return this.buildBasic(state.basic)
      case 'am':
        return this.buildAm(state.am)
      case 'fm':
        return this.buildFm(state.fm)
      case 'mix':
        return this.buildMix(state.mix)
      case 'cw':
        return this.buildCw(state.cw)
    }
  }

  private buildBasic(params: BasicParams): Disposer {
    const osc = this.context.createOscillator()
    osc.type = params.waveShape
    osc.frequency.value = clampFreq(params.frequencyHz)
    const gain = this.context.createGain()
    gain.gain.value = clampAmp(params.amplitude)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start()
    return () => {
      osc.stop()
      osc.disconnect()
      gain.disconnect()
    }
  }

  private buildAm(params: AmParams): Disposer {
    const carrierHz = clampFreq(params.carrierHz)
    const modulatorHz = clampFreq(params.modulatorHz, 1, 500)
    const m = clampModIndex(params.modulationIndex)

    const carrier = this.context.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = carrierHz

    const modulator = this.context.createOscillator()
    modulator.type = 'sine'
    modulator.frequency.value = modulatorHz

    const modGain = this.context.createGain()
    modGain.gain.value = m

    const offset = this.context.createConstantSource()
    offset.offset.value = 1

    const ampGain = this.context.createGain()
    ampGain.gain.value = 0.5 * (1 + m)

    modulator.connect(modGain)
    modGain.connect(ampGain.gain)
    offset.connect(ampGain.gain)
    carrier.connect(ampGain)
    ampGain.connect(this.masterGain)

    carrier.start()
    modulator.start()
    offset.start()

    return () => {
      carrier.stop()
      modulator.stop()
      offset.stop()
      carrier.disconnect()
      modulator.disconnect()
      modGain.disconnect()
      offset.disconnect()
      ampGain.disconnect()
    }
  }

  private buildFm(params: FmParams): Disposer {
    const carrierHz = clampFreq(params.carrierHz)
    const modulatorHz = clampFreq(params.modulatorHz, 1, 500)
    const deviationHz = Math.min(500, Math.max(0, params.deviationHz))

    const carrier = this.context.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = carrierHz

    const modulator = this.context.createOscillator()
    modulator.type = 'sine'
    modulator.frequency.value = modulatorHz

    const devGain = this.context.createGain()
    devGain.gain.value = deviationHz

    const outGain = this.context.createGain()
    outGain.gain.value = 0.5

    modulator.connect(devGain)
    devGain.connect(carrier.frequency)
    carrier.connect(outGain)
    outGain.connect(this.masterGain)

    carrier.start()
    modulator.start()

    return () => {
      carrier.stop()
      modulator.stop()
      carrier.disconnect()
      modulator.disconnect()
      devGain.disconnect()
      outGain.disconnect()
    }
  }

  private buildMix(params: MixParams): Disposer {
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

    if (params.mixMode === 'sum') {
      gainA.connect(this.masterGain)
      gainB.connect(this.masterGain)
    } else {
      const productGain = this.context.createGain()
      productGain.gain.value = 0
      gainA.connect(productGain)
      gainB.connect(productGain.gain)
      productGain.connect(this.masterGain)
      oscA.start()
      oscB.start()
      return () => {
        oscA.stop()
        oscB.stop()
        oscA.disconnect()
        oscB.disconnect()
        gainA.disconnect()
        gainB.disconnect()
        productGain.disconnect()
      }
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
    }
  }

  private buildCw(params: CwParams): Disposer {
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
    ampGain.connect(this.masterGain)

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
    }
  }
}

export function shapeLabel(shape: WaveShape): string {
  return shape.charAt(0).toUpperCase() + shape.slice(1)
}

export type { SignalMode, SignalState }
