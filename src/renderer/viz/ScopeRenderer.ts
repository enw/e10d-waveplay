import type { VizHints } from '../audio/types'

const BG = '#0c0c12'
const GRID = '#1e293b'
const GRID_MAJOR = '#334155'
const TRACE = '#4ade80'
const ENVELOPE = '#fbbf24'

export type EnvelopeHint = NonNullable<VizHints['envelope']>

export class ScopeRenderer {
  private readonly buffer: Float32Array

  constructor(analyser: AnalyserNode) {
    this.buffer = new Float32Array(analyser.fftSize)
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    analyser: AnalyserNode,
    sampleRate: number,
    envelope?: EnvelopeHint
  ): void {
    analyser.getFloatTimeDomainData(this.buffer)

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)

    this.drawGrid(ctx, width, height)

    const midY = height / 2
    const ampScale = height * 0.42

    if (envelope) {
      this.drawEnvelope(ctx, width, midY, ampScale, sampleRate, this.buffer.length, envelope)
    }

    this.drawWaveform(ctx, width, midY, ampScale)
  }

  renderIdle(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)
    this.drawGrid(ctx, width, height)
    ctx.fillStyle = '#64748b'
    ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Press Play to start', width / 2, height / 2)
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cols = 10
    const rows = 8

    ctx.strokeStyle = GRID
    ctx.lineWidth = 1

    for (let i = 1; i < cols; i++) {
      const x = (i / cols) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let i = 1; i < rows; i++) {
      const y = (i / rows) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.strokeStyle = GRID_MAJOR
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }

  private drawEnvelope(
    ctx: CanvasRenderingContext2D,
    width: number,
    midY: number,
    ampScale: number,
    sampleRate: number,
    bufferLength: number,
    envelope: EnvelopeHint
  ): void {
    const m = envelope.max
    const mMin = envelope.min
    const fm = envelope.modulatorHz
    const duration = bufferLength / sampleRate
    const shape = envelope.shape ?? 'cos'

    ctx.save()
    ctx.strokeStyle = ENVELOPE
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.globalAlpha = 0.85

    const envelopeAmp = (t: number): number => {
      if (shape === 'square') {
        const on = Math.sin(2 * Math.PI * fm * t) >= 0 ? 1 : 0
        return mMin + (m - mMin) * on
      }
      return m * Math.cos(2 * Math.PI * fm * t)
    }

    ctx.beginPath()
    for (let x = 0; x <= width; x++) {
      const t = (x / width) * duration
      const amp = envelopeAmp(t)
      const y = midY - amp * ampScale
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    if (shape !== 'square') {
      ctx.beginPath()
      for (let x = 0; x <= width; x++) {
        const t = (x / width) * duration
        const amp = -m * Math.cos(2 * Math.PI * fm * t)
        const y = midY - amp * ampScale
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    ctx.restore()
  }

  private drawWaveform(
    ctx: CanvasRenderingContext2D,
    width: number,
    midY: number,
    ampScale: number
  ): void {
    const len = this.buffer.length
    const step = len / width

    ctx.strokeStyle = TRACE
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.beginPath()

    for (let x = 0; x < width; x++) {
      const idx = Math.min(len - 1, Math.floor(x * step))
      const y = midY - this.buffer[idx] * ampScale
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.stroke()
  }
}
