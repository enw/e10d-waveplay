import { useEffect, useRef } from 'react'
import type { VizHints } from '../audio/types'
import { SpectrumRenderer } from '../viz/SpectrumRenderer'

export interface SpectrumProps {
  analyser: AnalyserNode
  active: boolean
  labels?: VizHints['spectrumLabels']
  sampleRate: number
  canvasId?: string
}

function Spectrum({
  analyser,
  active,
  labels,
  sampleRate,
  canvasId = 'waveplay-spectrum'
}: SpectrumProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SpectrumRenderer | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })

  useEffect(() => {
    rendererRef.current = new SpectrumRenderer(analyser)
  }, [analyser])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const resize = (): void => {
      const rect = host.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      sizeRef.current = { width, height }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let rafId = 0

    const draw = (): void => {
      const { width, height } = sizeRef.current
      if (width > 0 && height > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const renderer = rendererRef.current
        if (renderer) {
          if (active) {
            renderer.render(ctx, width, height, analyser, sampleRate, labels)
          } else {
            renderer.renderIdle(ctx, width, height)
          }
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [active, analyser, labels, sampleRate])

  return (
    <div ref={hostRef} className="viz-canvas-host">
      <canvas
        id={canvasId}
        ref={canvasRef}
        aria-label="Spectrum analyzer"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default Spectrum
