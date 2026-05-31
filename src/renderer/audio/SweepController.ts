export interface SweepConfig {
  enabled: boolean
  paramKey: string
  from: number
  to: number
  durationSec: number
  loop: boolean
}

export interface SweepableParam {
  key: string
  label: string
  from: number
  to: number
}

type ValueCallback = (value: number) => void

export class SweepController {
  private config: SweepConfig | null = null
  private startTime = 0
  private rafId = 0
  private onValue: ValueCallback | null = null
  private currentValue = 0

  get value(): number {
    return this.currentValue
  }

  get running(): boolean {
    return this.config?.enabled === true
  }

  start(config: SweepConfig, initialValue: number, onValue: ValueCallback): void {
    this.stop()
    if (!config.enabled) return

    this.config = config
    this.onValue = onValue
    this.currentValue = config.from
    this.startTime = performance.now()
    onValue(config.from)

    const tick = (): void => {
      if (!this.config?.enabled) return
      const elapsed = (performance.now() - this.startTime) / 1000
      const { durationSec, from, to, loop } = this.config
      let t = elapsed / durationSec
      if (loop) t = t % 1
      else if (t >= 1) {
        this.currentValue = to
        onValue(to)
        return
      }
      const value = from + (to - from) * t
      this.currentValue = value
      onValue(value)
      this.rafId = requestAnimationFrame(tick)
    }

    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.config = null
    this.onValue = null
  }

  /** Linear interpolation at normalized time 0..1 (for unit tests). */
  static valueAt(config: SweepConfig, t: number): number {
    const clamped = config.loop ? t % 1 : Math.min(1, Math.max(0, t))
    return config.from + (config.to - config.from) * clamped
  }
}

export const SWEEPABLE_BY_MODE: Record<string, SweepableParam[]> = {
  am: [{ key: 'am.modulationIndex', label: 'Modulation index', from: 0, to: 1 }],
  fm: [{ key: 'fm.deviationHz', label: 'Deviation (Hz)', from: 0, to: 300 }],
  mix: [{ key: 'mix.oscBHz', label: 'Osc B (Hz)', from: 1000, to: 1020 }],
  ssb: [{ key: 'ssb.modulatorHz', label: 'Modulator (Hz)', from: 50, to: 300 }],
  superhet: [{ key: 'superhet.loHz', label: 'LO (Hz)', from: 900, to: 1300 }],
  filter: [{ key: 'filter.bandwidthHz', label: 'Filter BW (Hz)', from: 200, to: 3000 }]
}

export function applyParamKey(
  state: import('./types').SignalState,
  paramKey: string,
  value: number
): import('./types').SignalState {
  const [section, field] = paramKey.split('.')
  if (!section || !field) return state

  if (section === 'filter') {
    return {
      ...state,
      filter: { ...state.filter, [field]: value }
    }
  }

  const block = state[section as keyof typeof state]
  if (typeof block !== 'object' || block === null) return state

  return {
    ...state,
    [section]: { ...block, [field]: value }
  } as import('./types').SignalState
}
