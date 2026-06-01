import { useEffect, useRef } from 'react'
import type { SpectrumView } from '../viz/spectrumView'
import { WaterfallRenderer } from '../viz/WaterfallRenderer'

export interface WaterfallProps {
  analyser: AnalyserNode
  active: boolean
  sampleRate: number
  view: SpectrumView
  canvasId?: string
}

function Waterfall({
  analyser,
  active,
  sampleRate,
  view,
  canvasId = 'waveplay-waterfall'
}: WaterfallProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WaterfallRenderer | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const viewRef = useRef(view)
  const activeRef = useRef(active)

  viewRef.current = view
  activeRef.current = active

  useEffect(() => {
    rendererRef.current = new WaterfallRenderer(analyser)
  }, [analyser])

  useEffect(() => {
    rendererRef.current?.reset()
  }, [view.minHz, view.maxHz])

  useEffect(() => {
    if (!active) rendererRef.current?.reset()
  }, [active])

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
    let lastPush = 0

    const draw = (): void => {
      const { width, height } = sizeRef.current
      const renderer = rendererRef.current
      const currentView = viewRef.current

      if (width > 0 && height > 0 && renderer) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        if (activeRef.current) {
          const now = performance.now()
          if (now - lastPush > 33) {
            renderer.pushRow(analyser, sampleRate, currentView)
            lastPush = now
          }
          renderer.render(ctx, width, height, sampleRate, analyser.fftSize, currentView)
        } else {
          renderer.renderIdle(ctx, width, height, currentView)
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [analyser, sampleRate, view, active])

  return (
    <div ref={hostRef} className="viz-canvas-host waterfall-canvas-host">
      <canvas
        id={canvasId}
        ref={canvasRef}
        aria-label="Waterfall spectrogram"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default Waterfall
