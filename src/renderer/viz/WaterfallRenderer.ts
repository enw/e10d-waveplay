import type { SpectrumView } from './spectrumView'
import { formatViewRange, freqToX, viewSpan } from './spectrumView'

const BG = '#0c0c12'
const DB_RANGE = 60

function heatColor(v: number): string {
  const t = v / 255
  const r = Math.floor(20 + t * 200)
  const g = Math.floor(10 + t * 140)
  const b = Math.floor(8 + t * 20)
  return `rgb(${r},${g},${b})`
}

export class WaterfallRenderer {
  private readonly fftBuffer: Float32Array
  private readonly historyWidth: number
  private history: Uint8Array
  private writeCol = 0

  constructor(analyser: AnalyserNode, historyWidth = 320) {
    this.fftBuffer = new Float32Array(analyser.frequencyBinCount)
    this.historyWidth = historyWidth
    this.history = new Uint8Array(historyWidth * analyser.frequencyBinCount)
  }

  reset(): void {
    this.history.fill(0)
    this.writeCol = 0
  }

  pushColumn(analyser: AnalyserNode, sampleRate: number, view: SpectrumView): void {
    analyser.getFloatFrequencyData(this.fftBuffer)
    const binWidth = sampleRate / analyser.fftSize
    const startBin = Math.max(0, Math.floor(view.minHz / binWidth))
    const endBin = Math.min(this.fftBuffer.length - 1, Math.ceil(view.maxHz / binWidth))

    let peakDb = -Infinity
    for (let i = startBin; i <= endBin; i++) {
      if (this.fftBuffer[i] > peakDb) peakDb = this.fftBuffer[i]
    }
    if (!Number.isFinite(peakDb)) peakDb = 0

    const colOffset = this.writeCol * this.fftBuffer.length
    for (let i = 0; i < this.fftBuffer.length; i++) {
      const relativeDb = this.fftBuffer[i] - peakDb
      const clamped = Math.max(-DB_RANGE, Math.min(0, relativeDb))
      const norm = (clamped + DB_RANGE) / DB_RANGE
      this.history[colOffset + i] = Math.floor(norm * 255)
    }

    this.writeCol = (this.writeCol + 1) % this.historyWidth
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sampleRate: number,
    fftSize: number,
    view: SpectrumView
  ): void {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)

    const binWidth = sampleRate / fftSize
    const span = viewSpan(view)
    const startBin = Math.max(0, Math.floor(view.minHz / binWidth))
    const endBin = Math.min(this.fftBuffer.length - 1, Math.ceil(view.maxHz / binWidth))
    const binsInView = Math.max(1, endBin - startBin + 1)

    const colW = width / this.historyWidth
    const rowH = height / binsInView

    for (let col = 0; col < this.historyWidth; col++) {
      const age = (this.writeCol - 1 - col + this.historyWidth) % this.historyWidth
      const histCol = (this.writeCol - 1 - age + this.historyWidth) % this.historyWidth
      const x = width - (col + 1) * colW

      for (let b = startBin; b <= endBin; b++) {
        const v = this.history[histCol * this.fftBuffer.length + b]
        const y = height - (b - startBin + 1) * rowH
        ctx.fillStyle = heatColor(v)
        ctx.fillRect(x, y, Math.ceil(colW) + 1, Math.ceil(rowH) + 1)
      }
    }

    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height - 1)
    ctx.lineTo(width, height - 1)
    ctx.stroke()

    ctx.fillStyle = '#64748b'
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(formatViewRange(view), width - 6, height - 4)
  }

  renderIdle(ctx: CanvasRenderingContext2D, width: number, height: number, view: SpectrumView): void {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#64748b'
    ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Press Play to start', width / 2, height / 2)
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(formatViewRange(view), width - 6, height - 4)
  }
}
