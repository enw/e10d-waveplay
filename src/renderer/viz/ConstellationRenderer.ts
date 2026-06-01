import type { PhasorModel, PhasorPoint } from './phasorModel'

const BG = '#0c0c12'
const GRID = '#1e293b'
const GRID_MAJOR = '#334155'
const PRIMARY = '#60a5fa'
const SECONDARY = '#f472b6'
const TRAIL = 'rgba(96, 165, 250, 0.35)'

export class ConstellationRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    model: PhasorModel,
    phase: number
  ): void {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2
    const scale = Math.min(width, height) * 0.38

    this.drawGrid(ctx, cx, cy, scale)

    if (!model.supported || model.primary.length === 0) {
      ctx.fillStyle = '#64748b'
      ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(model.hint, cx, cy)
      return
    }

    this.drawTrail(ctx, cx, cy, scale, model.primary, TRAIL)
    if (model.secondary) {
      this.drawTrail(ctx, cx, cy, scale, model.secondary, 'rgba(244, 114, 182, 0.35)')
    }

    const idx = Math.floor(phase * model.primary.length) % model.primary.length
    const tip = model.primary[idx]!
    this.drawPhasor(ctx, cx, cy, scale, tip, PRIMARY)

    if (model.secondary) {
      const idx2 = Math.floor(phase * model.secondary.length) % model.secondary.length
      const tip2 = model.secondary[idx2]!
      this.drawPhasor(ctx, cx, cy, scale, tip2, SECONDARY)
    }

    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('I →', cx + scale + 8, cy - 6)
    ctx.textAlign = 'center'
    ctx.fillText('Q ↑', cx - 10, cy - scale - 14)
  }

  renderIdle(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#64748b'
    ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Press Play — AM / FM / SSB / Mix', width / 2, height / 2)
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number
  ): void {
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1

    for (let r = 0.25; r <= 1; r += 0.25) {
      ctx.beginPath()
      ctx.arc(cx, cy, scale * r, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.strokeStyle = GRID_MAJOR
    ctx.beginPath()
    ctx.moveTo(cx - scale * 1.1, cy)
    ctx.lineTo(cx + scale * 1.1, cy)
    ctx.moveTo(cx, cy - scale * 1.1)
    ctx.lineTo(cx, cy + scale * 1.1)
    ctx.stroke()
  }

  private drawTrail(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    points: PhasorPoint[],
    color: string
  ): void {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let n = 0; n < points.length; n++) {
      const p = points[n]!
      const x = cx + p.i * scale
      const y = cy - p.q * scale
      if (n === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  private drawPhasor(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    tip: PhasorPoint,
    color: string
  ): void {
    const x = cx + tip.i * scale
    const y = cy - tip.q * scale

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.stroke()

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}
