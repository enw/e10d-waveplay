import { useMemo } from 'react'
import type { SignalMode, SignalState } from '@/audio/types'
import { SWEEPABLE_BY_MODE, type SweepConfig } from '@/audio/SweepController'

interface SweepPanelProps {
  mode: SignalMode
  filterEnabled: boolean
  config: SweepConfig
  onChange: (config: SweepConfig) => void
}

const DURATIONS = [2, 5, 10, 20]

export default function SweepPanel({ mode, filterEnabled, config, onChange }: SweepPanelProps) {
  const options = useMemo(() => {
    const base = SWEEPABLE_BY_MODE[mode] ?? []
    if (filterEnabled && mode !== 'superhet') {
      return [...base, ...(SWEEPABLE_BY_MODE.filter ?? [])]
    }
    return base
  }, [mode, filterEnabled])

  if (options.length === 0) return null

  const selected = options.find((o) => o.key === config.paramKey) ?? options[0]

  return (
    <details className="sweep-panel">
      <summary>Parameter sweep</summary>
      <div className="sweep-panel__body">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          />
          Enable sweep
        </label>
        {config.enabled && (
          <>
            <label>
              Target
              <select
                value={config.paramKey}
                onChange={(e) => {
                  const opt = options.find((o) => o.key === e.target.value) ?? selected
                  onChange({
                    ...config,
                    paramKey: opt.key,
                    from: opt.from,
                    to: opt.to
                  })
                }}
              >
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="slider">
              <span>
                From: <strong>{config.from.toFixed(2)}</strong>
              </span>
              <input
                type="range"
                min={selected.from}
                max={selected.to}
                step={0.01}
                value={config.from}
                onChange={(e) => onChange({ ...config, from: Number(e.target.value) })}
              />
            </label>
            <label className="slider">
              <span>
                To: <strong>{config.to.toFixed(2)}</strong>
              </span>
              <input
                type="range"
                min={selected.from}
                max={selected.to}
                step={0.01}
                value={config.to}
                onChange={(e) => onChange({ ...config, to: Number(e.target.value) })}
              />
            </label>
            <label>
              Duration (s)
              <select
                value={config.durationSec}
                onChange={(e) => onChange({ ...config, durationSec: Number(e.target.value) })}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={config.loop}
                onChange={(e) => onChange({ ...config, loop: e.target.checked })}
              />
              Loop
            </label>
            <p className="sweep-hint">Tip: open Waterfall to watch the spectrum evolve.</p>
          </>
        )}
      </div>
    </details>
  )
}

export function defaultSweepConfig(mode: SignalMode): SweepConfig {
  const opts = SWEEPABLE_BY_MODE[mode]?.[0]
  return {
    enabled: false,
    paramKey: opts?.key ?? 'am.modulationIndex',
    from: opts?.from ?? 0,
    to: opts?.to ?? 1,
    durationSec: 5,
    loop: true
  }
}

export type { SignalState }
