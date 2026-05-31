import type { VizHints } from '../audio/types'

const BG = '#0c0c12'
const GRID = '#1e293b'
const GRID_MAJOR = '#334155'
const TRACE = '#fbbf24'
const LABEL_LINE = '#94a3b8'
const LABEL_TEXT = '#e2e8f0'

const MAX_FREQ_HZ = 5000
const DB_RANGE = 60

export type SpectrumLabel = NonNullable<VizHints['spectrumLabels']>[number]

export class SpectrumRenderer {
  private readonly buffer: Float32Array

  constructor(analyser: AnalyserNode) {
    this.buffer = new Float32Array(analyser.frequencyBinCount)
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    analyser: AnalyserNode,
    sampleRate: number,
    labels?: SpectrumLabel[]
  ): void {
    analyser.getFloatFrequencyData(this.buffer)

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)

    this.drawGrid(ctx, width, height)

    const binWidth = sampleRate / analyser.fftSize
    const binCount = Math.min(
      this.buffer.length,
      Math.ceil(MAX_FREQ_HZ / binWidth) + 1
    )

    let peakDb = -Infinity
    for (let i = 0; i < binCount; i++) {
      if (this.buffer[i] > peakDb) peakDb = this.buffer[i]
    }
    if (!Number.isFinite(peakDb)) peakDb = 0

    this.drawSpectrum(ctx, width, height, binWidth, binCount, peakDb)

    if (labels?.length) {
      this.drawLabels(ctx, width, height, binWidth, peakDb, labels)
    }
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
    const freqDivisions = 5
    const dbDivisions = 6

    ctx.strokeStyle = GRID
    ctx.lineWidth = 1

    for (let i = 1; i < freqDivisions; i++) {
      const x = (i / freqDivisions) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let i = 1; i < dbDivisions; i++) {
      const y = (i / dbDivisions) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.strokeStyle = GRID_MAJOR
    ctx.beginPath()
    ctx.moveTo(0, height - 1)
    ctx.lineTo(width, height - 1)
    ctx.stroke()
  }

  private dbToY(relativeDb: number, height: number): number {
    const clamped = Math.max(-DB_RANGE, Math.min(0, relativeDb))
    return height - ((clamped + DB_RANGE) / DB_RANGE) * height
  }

  private drawSpectrum(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    binWidth: number,
    binCount: number,
    peakDb: number
  ): void {
    ctx.strokeStyle = TRACE
    ctx.lineWidth = 1.5
    ctx.beginPath()

    for (let i = 0; i < binCount; i++) {
      const freq = i * binWidth
      if (freq > MAX_FREQ_HZ) break

      const x = (freq / MAX_FREQ_HZ) * width
      const relativeDb = this.buffer[i] - peakDb
      const y = this.dbToY(relativeDb, height)

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.stroke()
  }

  private drawLabels(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    binWidth: number,
    peakDb: number,
    labels: SpectrumLabel[]
  ): void {
    ctx.save()
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    for (const { freq, label } of labels) {
      if (freq < 0 || freq > MAX_FREQ_HZ) continue

      const bin = Math.min(
        this.buffer.length - 1,
        Math.max(0, Math.round(freq / binWidth))
      )
      const markerFreq = bin * binWidth
      const x = (markerFreq / MAX_FREQ_HZ) * width
      const relativeDb = this.buffer[bin] - peakDb
      const peakY = this.dbToY(relativeDb, height)

      ctx.strokeStyle = LABEL_LINE
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(x, height)
      ctx.lineTo(x, Math.max(14, peakY - 4))
      ctx.stroke()

      ctx.setLineDash([])
      ctx.fillStyle = LABEL_TEXT
      ctx.fillText(label, x, 12)
    }

    ctx.restore()
  }
}
