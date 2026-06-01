import type { NoiseParams, SignalState } from '../audio/types'

export interface NoisePanelProps {
  noise: NoiseParams
  onChange: (patch: Partial<NoiseParams>) => void
}

export default function NoisePanel({ noise, onChange }: NoisePanelProps) {
  return (
    <div className="noise-panel">
      <div className="panel-heading">Noise &amp; QRM lab</div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={noise.awgnEnabled}
          onChange={(e) => onChange({ awgnEnabled: e.target.checked })}
        />
        Band noise (AWGN)
      </label>
      {noise.awgnEnabled && (
        <label className="slider">
          <span>
            SNR (dB): <strong>{Math.round(noise.snrDb)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={noise.snrDb}
            onChange={(e) => onChange({ snrDb: Number(e.target.value) })}
          />
        </label>
      )}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={noise.qrmEnabled}
          onChange={(e) => onChange({ qrmEnabled: e.target.checked })}
        />
        Adjacent QRM
      </label>
      {noise.qrmEnabled && (
        <>
          <label className="slider">
            <span>
              Offset (Hz): <strong>{Math.round(noise.qrmOffsetHz)}</strong>
            </span>
            <input
              type="range"
              min={50}
              max={800}
              step={10}
              value={noise.qrmOffsetHz}
              onChange={(e) => onChange({ qrmOffsetHz: Number(e.target.value) })}
            />
          </label>
          <label className="slider">
            <span>
              QRM level: <strong>{noise.qrmLevel.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={noise.qrmLevel}
              onChange={(e) => onChange({ qrmLevel: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={noise.humEnabled}
          onChange={(e) => onChange({ humEnabled: e.target.checked })}
        />
        60 Hz hum
      </label>
      {noise.humEnabled && (
        <label className="slider">
          <span>
            Hum level: <strong>{noise.humLevel.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={noise.humLevel}
            onChange={(e) => onChange({ humLevel: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  )
}
