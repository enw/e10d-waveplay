import { useCallback, useEffect, useRef } from 'react'
import type { VizHints } from '../audio/types'
import { SpectrumRenderer } from '../viz/SpectrumRenderer'
import {
  defaultSpectrumView,
  pan,
  type SpectrumView,
  xToFreq,
  zoomIn,
  zoomOut,
  zoomToCenter
} from '../viz/spectrumView'

export interface SpectrumProps {
  analyser: AnalyserNode
  active: boolean
  labels?: VizHints['spectrumLabels']
  sampleRate: number
  canvasId?: string
  view: SpectrumView
  onViewChange: (view: SpectrumView) => void
}

function Spectrum({
  analyser,
  active,
  labels,
  sampleRate,
  canvasId = 'waveplay-spectrum',
  view,
  onViewChange
}: SpectrumProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SpectrumRenderer | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const viewRef = useRef(view)
  const draggingRef = useRef(false)
  const lastDragXRef = useRef(0)

  viewRef.current = view

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
        const currentView = viewRef.current
        if (renderer) {
          if (active) {
            renderer.render(ctx, width, height, analyser, sampleRate, labels, currentView)
          } else {
            renderer.renderIdle(ctx, width, height, currentView)
          }
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [active, analyser, labels, sampleRate, view])

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault()
      const { width } = sizeRef.current
      if (width <= 0) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = event.clientX - rect.left
      const current = viewRef.current

      if (event.shiftKey) {
        const span = current.maxHz - current.minHz
        const deltaHz = (event.deltaY / width) * span
        onViewChange(pan(current, deltaHz))
        return
      }

      const anchorFreq = xToFreq(x, width, current)
      const span = current.maxHz - current.minHz
      const factor = event.deltaY > 0 ? 1.25 : 0.8
      onViewChange(zoomToCenter(current, anchorFreq, span * factor))
    },
    [onViewChange]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseDown = (event: MouseEvent): void => {
      draggingRef.current = true
      lastDragXRef.current = event.clientX
    }

    const onMouseMove = (event: MouseEvent): void => {
      if (!draggingRef.current) return
      const { width } = sizeRef.current
      if (width <= 0) return

      const deltaX = event.clientX - lastDragXRef.current
      lastDragXRef.current = event.clientX
      const current = viewRef.current
      const span = current.maxHz - current.minHz
      onViewChange(pan(current, (-deltaX / width) * span))
    }

    const onMouseUp = (): void => {
      draggingRef.current = false
    }

    const onDblClick = (event: MouseEvent): void => {
      const { width } = sizeRef.current
      if (width <= 0) return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const center = xToFreq(x, width, viewRef.current)
      onViewChange(zoomToCenter(viewRef.current, center, 100))
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('dblclick', onDblClick)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('dblclick', onDblClick)
    }
  }, [handleWheel, onViewChange])

  return (
    <div className="spectrum-stack">
      <div className="spectrum-toolbar">
        <button type="button" className="btn btn-sm" onClick={() => onViewChange(zoomIn(view))}>
          Zoom in
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onViewChange(zoomOut(view))}>
          Zoom out
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onViewChange(defaultSpectrumView())}>
          Reset
        </button>
        <span className="spectrum-hint">Drag pan · Shift+scroll pan · Scroll zoom · Dbl-click ±50 Hz</span>
      </div>
      <div ref={hostRef} className="viz-canvas-host spectrum-canvas-host">
        <canvas
          id={canvasId}
          ref={canvasRef}
          aria-label="Spectrum analyzer"
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
        />
      </div>
    </div>
  )
}

export default Spectrum
