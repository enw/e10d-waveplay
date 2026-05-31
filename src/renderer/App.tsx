import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SignalGraph } from '@/audio/SignalGraph'
import {
  defaultSignalState,
  getVizHints,
  type SignalMode,
  type SignalState,
  type WaveShape
} from '@/audio/types'
import Scope from '@/components/Scope'
import Spectrum from '@/components/Spectrum'
import PresetPicker from '@/components/PresetPicker'
import type { Preset } from '@/presets'
import { exportScreenshot, exportWav } from '@/export/ExportService'

const MODES: { id: SignalMode; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'am', label: 'AM' },
  { id: 'fm', label: 'FM' },
  { id: 'mix', label: 'Mix' }
]

const SHAPES: WaveShape[] = ['sine', 'square', 'triangle', 'sawtooth']

export default function App() {
  const graphRef = useRef<SignalGraph | null>(null)

  const [state, setState] = useState<SignalState>(defaultSignalState)
  const [rfAnalogy, setRfAnalogy] = useState('')
  const [presetId, setPresetId] = useState<string>('')
  const [exportDuration, setExportDuration] = useState(3)

  if (!graphRef.current) {
    graphRef.current = new SignalGraph()
  }
  const graph = graphRef.current

  const hints = useMemo(() => getVizHints(state), [state])
  const displayHint = rfAnalogy || hints.rfHint

  useEffect(() => {
    graph.setVolume(state.volume)
  }, [graph, state.volume])

  useEffect(() => {
    if (state.playing) {
      graph.updateParams(state)
    }
  }, [graph, state])

  const togglePlay = useCallback(async () => {
    if (state.playing) {
      graph.stop()
      setState((s) => ({ ...s, playing: false }))
    } else {
      await graph.start(state)
      setState((s) => ({ ...s, playing: true }))
    }
  }, [graph, state])

  const setMode = (mode: SignalMode) => {
    setPresetId('')
    setRfAnalogy('')
    setState((s) => ({ ...s, mode }))
  }

  const applyPreset = (preset: Preset) => {
    setPresetId(preset.id)
    setRfAnalogy(preset.rfAnalogy)
    setState((s) => ({
      ...s,
      mode: preset.mode,
      [preset.mode]: preset.params
    }))
  }

  const paramsSummary = (): string => {
    switch (state.mode) {
      case 'basic':
        return `${state.basic.waveShape} ${state.basic.frequencyHz} Hz`
      case 'am':
        return `fc=${state.am.carrierHz} fm=${state.am.modulatorHz} m=${(state.am.modulationIndex * 100).toFixed(0)}%`
      case 'fm':
        return `fc=${state.fm.carrierHz} fm=${state.fm.modulatorHz} dev=${state.fm.deviationHz} Hz`
      case 'mix':
        return `${state.mix.oscAHz}+${state.mix.oscBHz} Hz (${state.mix.mixMode})`
    }
  }

  const handleExportWav = async () => {
    await exportWav(state, exportDuration)
  }

  const handleScreenshot = async () => {
    const scope = document.getElementById('waveplay-scope') as HTMLCanvasElement | null
    const spectrum = document.getElementById('waveplay-spectrum') as HTMLCanvasElement | null
    if (!scope || !spectrum) return
    await exportScreenshot(scope, spectrum, {
      mode: state.mode,
      paramsText: paramsSummary()
    })
  }

  return (
    <div className="app">
      <header className="header">
        <h1>WavePlay</h1>
        <PresetPicker selectedId={presetId} onSelect={applyPreset} />
      </header>

      <div className="viz-row">
        <div className="viz-panel">
          <div className="viz-label">Scope</div>
          <Scope
            analyser={graph.analyser}
            active={state.playing}
            envelope={hints.envelope}
          />
        </div>
        <div className="viz-panel">
          <div className="viz-label">Spectrum</div>
          <Spectrum
            analyser={graph.analyser}
            active={state.playing}
            labels={hints.spectrumLabels}
            sampleRate={graph.context.sampleRate}
          />
        </div>
      </div>

      <div className="rf-panel">{displayHint}</div>

      <div className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={state.mode === m.id ? 'tab active' : 'tab'}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="controls">
        {state.mode === 'basic' && (
          <>
            <label>
              Wave
              <select
                value={state.basic.waveShape}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    basic: { ...s.basic, waveShape: e.target.value as WaveShape }
                  }))
                }
              >
                {SHAPES.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </label>
            <Slider
              label="Frequency (Hz)"
              min={20}
              max={4000}
              value={state.basic.frequencyHz}
              onChange={(v) => setState((s) => ({ ...s, basic: { ...s.basic, frequencyHz: v } }))}
            />
            <Slider
              label="Amplitude"
              min={0}
              max={1}
              step={0.01}
              value={state.basic.amplitude}
              onChange={(v) => setState((s) => ({ ...s, basic: { ...s.basic, amplitude: v } }))}
            />
          </>
        )}

        {state.mode === 'am' && (
          <>
            <Slider
              label="Carrier (Hz)"
              min={100}
              max={4000}
              value={state.am.carrierHz}
              onChange={(v) => setState((s) => ({ ...s, am: { ...s.am, carrierHz: v } }))}
            />
            <Slider
              label="Modulator (Hz)"
              min={1}
              max={500}
              value={state.am.modulatorHz}
              onChange={(v) => setState((s) => ({ ...s, am: { ...s.am, modulatorHz: v } }))}
            />
            <Slider
              label="Modulation index (%)"
              min={0}
              max={100}
              value={state.am.modulationIndex * 100}
              onChange={(v) =>
                setState((s) => ({ ...s, am: { ...s.am, modulationIndex: v / 100 } }))
              }
            />
          </>
        )}

        {state.mode === 'fm' && (
          <>
            <Slider
              label="Carrier (Hz)"
              min={100}
              max={4000}
              value={state.fm.carrierHz}
              onChange={(v) => setState((s) => ({ ...s, fm: { ...s.fm, carrierHz: v } }))}
            />
            <Slider
              label="Modulator (Hz)"
              min={1}
              max={500}
              value={state.fm.modulatorHz}
              onChange={(v) => setState((s) => ({ ...s, fm: { ...s.fm, modulatorHz: v } }))}
            />
            <Slider
              label="Deviation (Hz)"
              min={0}
              max={500}
              value={state.fm.deviationHz}
              onChange={(v) => setState((s) => ({ ...s, fm: { ...s.fm, deviationHz: v } }))}
            />
          </>
        )}

        {state.mode === 'mix' && (
          <>
            <Slider
              label="Osc A (Hz)"
              min={20}
              max={4000}
              value={state.mix.oscAHz}
              onChange={(v) => setState((s) => ({ ...s, mix: { ...s.mix, oscAHz: v } }))}
            />
            <Slider
              label="Osc A amp"
              min={0}
              max={1}
              step={0.01}
              value={state.mix.oscAAmp}
              onChange={(v) => setState((s) => ({ ...s, mix: { ...s.mix, oscAAmp: v } }))}
            />
            <Slider
              label="Osc B (Hz)"
              min={20}
              max={4000}
              value={state.mix.oscBHz}
              onChange={(v) => setState((s) => ({ ...s, mix: { ...s.mix, oscBHz: v } }))}
            />
            <Slider
              label="Osc B amp"
              min={0}
              max={1}
              step={0.01}
              value={state.mix.oscBAmp}
              onChange={(v) => setState((s) => ({ ...s, mix: { ...s.mix, oscBAmp: v } }))}
            />
            <label>
              Mix mode
              <select
                value={state.mix.mixMode}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    mix: { ...s.mix, mixMode: e.target.value as 'sum' | 'product' }
                  }))
                }
              >
                <option value="sum">Sum (beat)</option>
                <option value="product">Product (ring mod)</option>
              </select>
            </label>
          </>
        )}
      </div>

      <footer className="transport">
        <button type="button" className="btn primary" onClick={() => void togglePlay()}>
          {state.playing ? 'Stop' : 'Play'}
        </button>
        <Slider
          label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={state.volume}
          onChange={(v) => setState((s) => ({ ...s, volume: v }))}
        />
        <label>
          Export (s)
          <select
            value={exportDuration}
            onChange={(e) => setExportDuration(Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
        <button type="button" className="btn" onClick={() => void handleExportWav()}>
          Export WAV
        </button>
        <button type="button" className="btn" onClick={() => void handleScreenshot()}>
          Screenshot
        </button>
      </footer>
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange
}: {
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="slider">
      <span>
        {label}: <strong>{step < 1 ? value.toFixed(2) : Math.round(value)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
