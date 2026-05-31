import { useId } from 'react'

import type { Preset } from '@/presets'
import { PRESETS } from '@/presets'

export interface PresetPickerProps {
  onSelect: (preset: Preset) => void
  selectedId?: string
}

export function PresetPicker({ onSelect, selectedId }: PresetPickerProps) {
  const labelId = useId()

  return (
    <label htmlFor={labelId} className="preset-picker">
      <span className="preset-picker__label">Presets</span>
      <select
        id={labelId}
        className="preset-picker__select"
        value={selectedId ?? ''}
        onChange={(event) => {
          const preset = PRESETS.find((item) => item.id === event.target.value)
          if (preset) {
            onSelect(preset)
          }
        }}
      >
        <option value="" disabled>
          Select a preset…
        </option>
        {PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default PresetPicker
