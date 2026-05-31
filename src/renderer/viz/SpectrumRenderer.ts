import type { VizHints } from '../audio/types'
import type { SpectrumView } from './spectrumView'
import { defaultSpectrumView, formatViewRange, freqToX, viewSpan } from './spectrumView'

const BG = '#0c0c12'
const GRID = '#1e293b'
const GRID_MAJOR = '#334155'
const TRACE = '#fbbf24'
const LABEL_LINE = '#94a3b8'
const LABEL_TEXT = '#e2e8f0'
const AXIS_TEXT = '#64748b'

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
    labels: SpectrumLabel[] | undefined,
    view: SpectrumView
  ): void {
    analyser.getFloatFrequencyData(this.buffer)

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)

    this.drawGrid(ctx, width, height, view)

    const binWidth = sampleRate / analyser.fftSize
    const startBin = Math.max(0, Math.floor(view.minHz / binWidth))
    const endBin = Math.min(this.buffer.length - 1, Math.ceil(view.maxHz / binWidth))

    let peakDb = -Infinity
    for (let i = startBin; i <= endBin; i++) {
      if (this.buffer[i] > peakDb) peakDb = this.buffer[i]
    }
    if (!Number.isFinite(peakDb)) peakDb = 0

    this.drawSpectrum(ctx, width, height, binWidth, startBin, endBin, peakDb, view)

    if (labels?.length) {
      this.drawLabels(ctx, width, height, binWidth, peakDb, labels, view)
    }

    this.drawViewLabel(ctx, width, height, view)
  }

  renderIdle(ctx: CanvasRenderingContext2D, width: number, height: number, view?: SpectrumView): void {
    const v = view ?? defaultSpectrumView()
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)
    this.drawGrid(ctx, width, height, v)
    ctx.fillStyle = '#64748b'
    ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Press Play to start', width / 2, height / 2)
    this.drawViewLabel(ctx, width, height, v)
  }

  private drawViewLabel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    view: SpectrumView
  ): void {
    ctx.fillStyle = AXIS_TEXT
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(formatViewRange(view), width - 6, height - 4)
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, view: SpectrumView): void {
    const freqDivisions = 5
    const dbDivisions = 6
    const span = viewSpan(view)

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

    ctx.fillStyle = AXIS_TEXT
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i <= freqDivisions; i++) {
      const x = (i / freqDivisions) * width
      const freq = view.minHz + (i / freqDivisions) * span
      ctx.fillText(`${Math.round(freq)}`, x, height - 14)
    }
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
    startBin: number,
    endBin: number,
    peakDb: number,
    view: SpectrumView
  ): void {
    ctx.strokeStyle = TRACE
    ctx.lineWidth = 1.5
    ctx.beginPath()

    let started = false
    for (let i = startBin; i <= endBin; i++) {
      const freq = i * binWidth
      const x = freqToX(freq, width, view)
      const relativeDb = this.buffer[i] - peakDb
      const y = this.dbToY(relativeDb, height)

      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()
  }

  private drawLabels(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    binWidth: number,
    peakDb: number,
    labels: SpectrumLabel[],
    view: SpectrumView
  ): void {
    ctx.save()
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    const margin = viewSpan(view) * 0.02
    for (const { freq, label } of labels) {
      if (freq < view.minHz - margin || freq > view.maxHz + margin) continue

      const bin = Math.min(
        this.buffer.length - 1,
        Math.max(0, Math.round(freq / binWidth))
      )
      const x = freqToX(bin * binWidth, width, view)
      const relativeDb = this.buffer[bin] - peakDb
      const peakY = this.dbToY(relativeDb, height)

      ctx.strokeStyle = LABEL_LINE
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(x, height - 16)
      ctx.lineTo(x, Math.max(14, peakY - 4))
      ctx.stroke()

      ctx.setLineDash([])
      ctx.fillStyle = LABEL_TEXT
      ctx.fillText(label, x, 12)
    }

    ctx.restore()
  }
}
