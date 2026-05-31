import type { FilterParams, SignalMode, SignalState } from '@/audio/types'
import { DEFAULT_FILTER, suggestIfCenter } from '@/audio/types'

interface FilterPanelProps {
  filter: FilterParams
  mode: SignalMode
  state: SignalState
  onChange: (patch: Partial<FilterParams>) => void
}

export default function FilterPanel({ filter, mode, state, onChange }: FilterPanelProps) {
  if (mode === 'superhet') return null

  const trackCarrier = (): void => {
    let center = DEFAULT_FILTER.centerHz
    switch (state.mode) {
      case 'basic':
        center = state.basic.frequencyHz
        break
      case 'am':
        center = state.am.carrierHz
        break
      case 'fm':
        center = state.fm.carrierHz
        break
      case 'ssb':
        center = state.ssb.carrierHz
        break
      case 'cw':
        center = state.cw.carrierHz
        break
      default:
        break
    }
    onChange({ centerHz: center })
  }

  return (
    <div className="filter-panel">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={filter.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        IF bandpass filter
      </label>
      {filter.enabled && (
        <>
          <label className="slider">
            <span>
              Center (Hz): <strong>{Math.round(filter.centerHz)}</strong>
            </span>
            <input
              type="range"
              min={100}
              max={4000}
              value={filter.centerHz}
              onChange={(e) => onChange({ centerHz: Number(e.target.value) })}
            />
          </label>
          <label className="slider">
            <span>
              Bandwidth (Hz): <strong>{Math.round(filter.bandwidthHz)}</strong>
            </span>
            <input
              type="range"
              min={100}
              max={4000}
              value={filter.bandwidthHz}
              onChange={(e) => onChange({ bandwidthHz: Number(e.target.value) })}
            />
          </label>
          <button type="button" className="btn btn-sm" onClick={trackCarrier}>
            Track carrier
          </button>
        </>
      )}
    </div>
  )
}

export function SuperhetIfPanel({
  superhet,
  onChange
}: {
  superhet: SignalState['superhet']
  onChange: (patch: Partial<SignalState['superhet']>) => void
}) {
  return (
    <div className="filter-panel">
      <label className="slider">
        <span>
          IF center (Hz): <strong>{Math.round(superhet.ifCenterHz)}</strong>
        </span>
        <input
          type="range"
          min={20}
          max={4000}
          value={superhet.ifCenterHz}
          onChange={(e) => onChange({ ifCenterHz: Number(e.target.value) })}
        />
      </label>
      <label className="slider">
        <span>
          IF bandwidth (Hz): <strong>{Math.round(superhet.ifBandwidthHz)}</strong>
        </span>
        <input
          type="range"
          min={100}
          max={2000}
          value={superhet.ifBandwidthHz}
          onChange={(e) => onChange({ ifBandwidthHz: Number(e.target.value) })}
        />
      </label>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() =>
          onChange({ ifCenterHz: suggestIfCenter(superhet.rfCarrierHz, superhet.loHz) })
        }
      >
        Sync IF to |RF − LO|
      </button>
    </div>
  )
}
