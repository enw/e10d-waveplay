import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { SignalState } from '../audio/types'
import { computePhasorModel } from '../viz/phasorModel'
import { ConstellationRenderer } from '../viz/ConstellationRenderer'

export interface ConstellationProps {
  state: SignalState
  active: boolean
  canvasId?: string
}

function Constellation({ state, active, canvasId = 'waveplay-constellation' }: ConstellationProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef(new ConstellationRenderer())
  const sizeRef = useRef({ width: 0, height: 0 })
  const phaseRef = useRef(0)
  const activeRef = useRef(active)
  const modelRef = useRef(computePhasorModel(state))

  const model = useMemo(
    () => computePhasorModel(state),
    [state.mode, state.am, state.fm, state.mix, state.ssb]
  )

  activeRef.current = active
  modelRef.current = model

  const measure = useCallback((): void => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const rect = host.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))

    if (sizeRef.current.width === width && sizeRef.current.height === height) return

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    sizeRef.current = { width, height }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const ro = new ResizeObserver(measure)
    ro.observe(host)
    measure()
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    measure()
    if (active) {
      phaseRef.current = 0
    }
  }, [active, model, measure])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let rafId = 0
    let last = performance.now()

    const draw = (now: number): void => {
      const dt = (now - last) / 1000
      last = now

      const isActive = activeRef.current
      const currentModel = modelRef.current

      if (sizeRef.current.width <= 1 || sizeRef.current.height <= 1) {
        measure()
      }

      if (isActive && currentModel.supported) {
        phaseRef.current = (phaseRef.current + dt * 0.4) % 1
      }

      const { width, height } = sizeRef.current
      if (width > 0 && height > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        if (isActive) {
          rendererRef.current.render(ctx, width, height, currentModel, phaseRef.current)
        } else {
          rendererRef.current.renderIdle(ctx, width, height)
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [measure])

  return (
    <div ref={hostRef} className="viz-canvas-host">
      <canvas
        id={canvasId}
        ref={canvasRef}
        aria-label={`Constellation: ${model.title}`}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default Constellation
