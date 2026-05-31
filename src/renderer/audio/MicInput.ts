export class MicInput {
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private highpass: BiquadFilterNode | null = null
  private _levelAnalyser: AnalyserNode | null = null
  private _error: string | null = null

  get active(): boolean {
    return this.stream !== null
  }

  get levelAnalyser(): AnalyserNode | null {
    return this._levelAnalyser
  }

  get error(): string | null {
    return this._error
  }

  /** Output node for modulation paths (post high-pass + gain). */
  get modulatorOut(): AudioNode | null {
    return this.gainNode
  }

  async acquire(ctx: AudioContext): Promise<void> {
    this.release()
    this._error = null

    if (!navigator.mediaDevices?.getUserMedia) {
      this._error = 'Microphone not available in this environment.'
      throw new Error(this._error)
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      this.source = ctx.createMediaStreamSource(this.stream)
      this.highpass = ctx.createBiquadFilter()
      this.highpass.type = 'highpass'
      this.highpass.frequency.value = 80
      this.highpass.Q.value = 0.707

      this.gainNode = ctx.createGain()
      this.gainNode.gain.value = 1

      this._levelAnalyser = ctx.createAnalyser()
      this._levelAnalyser.fftSize = 2048
      this._levelAnalyser.smoothingTimeConstant = 0.5

      this.source.connect(this.highpass)
      this.highpass.connect(this.gainNode)
      this.gainNode.connect(this._levelAnalyser)
    } catch (err) {
      this._error =
        err instanceof Error ? err.message : 'Microphone permission denied.'
      this.release()
      throw err
    }
  }

  setGain(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(value, this.gainNode.context.currentTime, 0.01)
    }
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.source?.disconnect()
    this.highpass?.disconnect()
    this.gainNode?.disconnect()
    this._levelAnalyser?.disconnect()
    this.source = null
    this.highpass = null
    this.gainNode = null
    this._levelAnalyser = null
  }
}

export function readMicPeak(analyser: AnalyserNode): number {
  const buf = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(buf)
  let peak = 0
  for (let i = 0; i < buf.length; i++) {
    peak = Math.max(peak, Math.abs(buf[i] ?? 0))
  }
  return peak
}
