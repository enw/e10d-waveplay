import type { SpectrumView } from './spectrumView'
import { formatViewRange, viewSpan } from './spectrumView'

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
  private readonly historyHeight: number
  private history: Uint8Array
  private writeRow = 0

  constructor(analyser: AnalyserNode, historyHeight = 320) {
    this.fftBuffer = new Float32Array(analyser.frequencyBinCount)
    this.historyHeight = historyHeight
    this.history = new Uint8Array(historyHeight * analyser.frequencyBinCount)
  }

  reset(): void {
    this.history.fill(0)
    this.writeRow = 0
  }

  pushRow(analyser: AnalyserNode, sampleRate: number, view: SpectrumView): void {
    analyser.getFloatFrequencyData(this.fftBuffer)
    const binWidth = sampleRate / analyser.fftSize
    const startBin = Math.max(0, Math.floor(view.minHz / binWidth))
    const endBin = Math.min(this.fftBuffer.length - 1, Math.ceil(view.maxHz / binWidth))

    let peakDb = -Infinity
    for (let i = startBin; i <= endBin; i++) {
      if (this.fftBuffer[i] > peakDb) peakDb = this.fftBuffer[i]
    }
    if (!Number.isFinite(peakDb)) peakDb = 0

    const rowOffset = this.writeRow * this.fftBuffer.length
    for (let i = 0; i < this.fftBuffer.length; i++) {
      const relativeDb = this.fftBuffer[i] - peakDb
      const clamped = Math.max(-DB_RANGE, Math.min(0, relativeDb))
      const norm = (clamped + DB_RANGE) / DB_RANGE
      this.history[rowOffset + i] = Math.floor(norm * 255)
    }

    this.writeRow = (this.writeRow + 1) % this.historyHeight
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
    const startBin = Math.max(0, Math.floor(view.minHz / binWidth))
    const endBin = Math.min(this.fftBuffer.length - 1, Math.ceil(view.maxHz / binWidth))
    const binsInView = Math.max(1, endBin - startBin + 1)

    const colW = width / binsInView
    const rowH = height / this.historyHeight

    for (let screenRow = 0; screenRow < this.historyHeight; screenRow++) {
      const age = this.historyHeight - 1 - screenRow
      const histRow = (this.writeRow - 1 - age + this.historyHeight) % this.historyHeight
      const y = screenRow * rowH

      for (let b = startBin; b <= endBin; b++) {
        const v = this.history[histRow * this.fftBuffer.length + b]
        const x = (b - startBin) * colW
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
