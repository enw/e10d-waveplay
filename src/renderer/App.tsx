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
import Waterfall from '@/components/Waterfall'
import PresetPicker from '@/components/PresetPicker'
import QuizPanel from '@/components/QuizPanel'
import type { Preset } from '@/presets'
import { exportScreenshot, exportWav } from '@/export/ExportService'
import { defaultSpectrumView, type SpectrumView } from '@/viz/spectrumView'
import {
  advanceToGuess,
  applyPresetToState,
  initialQuizSession,
  pickRandomPreset,
  startQuestion,
  submitGuess,
  type QuizSession
} from '@/quiz/quizEngine'

type AppMode = 'study' | 'quiz'

const MODES: { id: SignalMode; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'am', label: 'AM' },
  { id: 'fm', label: 'FM' },
  { id: 'mix', label: 'Mix' },
  { id: 'cw', label: 'CW' },
  { id: 'ssb', label: 'SSB' }
]

const SHAPES: WaveShape[] = ['sine', 'square', 'triangle', 'sawtooth']
const QUIZ_LISTEN_MS = 4000

export default function App() {
  const graphRef = useRef<SignalGraph | null>(null)
  const listenTimerRef = useRef<number | null>(null)

  const [appMode, setAppMode] = useState<AppMode>('study')
  const [state, setState] = useState<SignalState>(defaultSignalState)
  const [quiz, setQuiz] = useState<QuizSession>(initialQuizSession)
  const [rfAnalogy, setRfAnalogy] = useState('')
  const [presetId, setPresetId] = useState<string>('')
  const [exportDuration, setExportDuration] = useState(3)
  const [spectrumView, setSpectrumView] = useState<SpectrumView>(defaultSpectrumView)
  const stateRef = useRef(state)

  stateRef.current = state

  if (!graphRef.current) {
    graphRef.current = new SignalGraph()
  }
  const graph = graphRef.current

  const hints = useMemo(() => getVizHints(state), [state])
  const displayHint = rfAnalogy || hints.rfHint
  const hideVizLabels = appMode === 'quiz' && quiz.phase !== 'reveal'
  const hideStudyEnvelope = appMode === 'quiz' && quiz.phase !== 'reveal'

  useEffect(() => {
    graph.setVolume(state.volume)
  }, [graph, state.volume])

  useEffect(() => {
    if (!state.playing) return
    graph.updateParams(state)
  }, [graph, state.mode, state.basic, state.am, state.fm, state.mix, state.cw, state.ssb, state.playing])

  const clearListenTimer = (): void => {
    if (listenTimerRef.current !== null) {
      window.clearTimeout(listenTimerRef.current)
      listenTimerRef.current = null
    }
  }

  useEffect(() => () => clearListenTimer(), [])

  const togglePlay = useCallback(async () => {
    if (appMode === 'quiz' && quiz.phase === 'listen') return
    const current = stateRef.current
    if (current.playing) {
      graph.stop()
      setState((s) => ({ ...s, playing: false }))
    } else {
      await graph.start(stateRef.current)
      setState((s) => ({ ...s, playing: true }))
    }
  }, [graph, appMode, quiz.phase])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }
      event.preventDefault()
      void togglePlay()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay])

  const setMode = (mode: SignalMode) => {
    setPresetId('')
    setRfAnalogy('')
    setState((s) => ({ ...s, mode }))
  }

  const applyPreset = (preset: Preset) => {
    setPresetId(preset.id)
    setRfAnalogy(preset.rfAnalogy)
    setState((s) => {
      const next: SignalState = {
        ...s,
        mode: preset.mode,
        [preset.mode]: preset.params
      } as SignalState
      if (s.playing) {
        graph.rebuild(next)
      }
      return next
    })
  }

  const beginQuestion = useCallback(
    async (preset: Preset) => {
      clearListenTimer()
      const nextState = applyPresetToState(stateRef.current, preset)
      setPresetId('')
      setRfAnalogy('')
      setState({ ...nextState, playing: true })
      await graph.start(nextState)
      setQuiz((s) => startQuestion(s, preset))
      listenTimerRef.current = window.setTimeout(() => {
        setQuiz((s) => advanceToGuess(s))
      }, QUIZ_LISTEN_MS)
    },
    [graph]
  )

  const handleQuizStart = (): void => {
    void beginQuestion(pickRandomPreset())
  }

  const handleQuizNext = (): void => {
    void beginQuestion(pickRandomPreset(quiz.currentPreset?.id))
  }

  const handleQuizGuess = (mode: SignalMode): void => {
    setQuiz((s) => submitGuess(s, mode))
  }

  const exitQuiz = (): void => {
    clearListenTimer()
    graph.stop()
    setAppMode('study')
    setQuiz(initialQuizSession())
    setState((s) => ({ ...s, playing: false }))
  }

  const enterQuiz = (): void => {
    graph.stop()
    setQuiz(initialQuizSession())
    setState((s) => ({ ...s, playing: false }))
    setAppMode('quiz')
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
      case 'cw':
        return `fc=${state.cw.carrierHz} gate=${state.cw.gateHz} Hz`
      case 'ssb':
        return `${state.ssb.sideband.toUpperCase()} fc=${state.ssb.carrierHz} fm=${state.ssb.modulatorHz}${state.ssb.carrierPilot ? ' +pilot' : ''}`
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
      paramsText: paramsSummary(),
      spectrumView
    })
  }

  return (
    <div className="app">
      <header className="header">
        <h1>WavePlay</h1>
        <div className="header-actions">
          <div className="app-mode-tabs">
            <button
              type="button"
              className={appMode === 'study' ? 'tab active' : 'tab'}
              onClick={() => {
                if (appMode === 'quiz') exitQuiz()
                setAppMode('study')
              }}
            >
              Study
            </button>
            <button
              type="button"
              className={appMode === 'quiz' ? 'tab active' : 'tab'}
              onClick={enterQuiz}
            >
              Quiz
            </button>
          </div>
          {appMode === 'study' && (
            <PresetPicker selectedId={presetId} onSelect={applyPreset} />
          )}
        </div>
      </header>

      <div className="viz-row viz-row-3">
        <div className="viz-panel">
          <div className="viz-label">Scope</div>
          <Scope
            analyser={graph.analyser}
            active={state.playing}
            envelope={hideStudyEnvelope ? undefined : hints.envelope}
          />
        </div>
        <div className="viz-panel spectrum-panel">
          <div className="viz-label">Spectrum</div>
          <Spectrum
            analyser={graph.analyser}
            active={state.playing}
            labels={hideVizLabels ? undefined : hints.spectrumLabels}
            sampleRate={graph.context.sampleRate}
            view={spectrumView}
            onViewChange={setSpectrumView}
          />
        </div>
        <div className="viz-panel waterfall-panel">
          <div className="viz-label">Waterfall</div>
          <Waterfall
            analyser={graph.analyser}
            active={state.playing}
            sampleRate={graph.context.sampleRate}
            view={spectrumView}
          />
        </div>
      </div>

      {appMode === 'study' ? (
        <div className="rf-panel">{displayHint}</div>
      ) : (
        <QuizPanel
          session={quiz}
          onStart={handleQuizStart}
          onGuess={handleQuizGuess}
          onNext={handleQuizNext}
          onExit={exitQuiz}
        />
      )}

      {appMode === 'study' && (
        <>
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
                  onChange={(v) =>
                    setState((s) => ({ ...s, basic: { ...s.basic, frequencyHz: v } }))
                  }
                />
                <Slider
                  label="Amplitude"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.basic.amplitude}
                  onChange={(v) =>
                    setState((s) => ({ ...s, basic: { ...s.basic, amplitude: v } }))
                  }
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

            {state.mode === 'cw' && (
              <>
                <Slider
                  label="Carrier (Hz)"
                  min={100}
                  max={4000}
                  value={state.cw.carrierHz}
                  onChange={(v) => setState((s) => ({ ...s, cw: { ...s.cw, carrierHz: v } }))}
                />
                <Slider
                  label="Gate rate (Hz)"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={state.cw.gateHz}
                  onChange={(v) => setState((s) => ({ ...s, cw: { ...s.cw, gateHz: v } }))}
                />
                <Slider
                  label="Amplitude"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.cw.amplitude}
                  onChange={(v) => setState((s) => ({ ...s, cw: { ...s.cw, amplitude: v } }))}
                />
              </>
            )}

            {state.mode === 'ssb' && (
              <>
                <Slider
                  label="Carrier (Hz)"
                  min={100}
                  max={4000}
                  value={state.ssb.carrierHz}
                  onChange={(v) => setState((s) => ({ ...s, ssb: { ...s.ssb, carrierHz: v } }))}
                />
                <Slider
                  label="Modulator (Hz)"
                  min={1}
                  max={500}
                  value={state.ssb.modulatorHz}
                  onChange={(v) => setState((s) => ({ ...s, ssb: { ...s.ssb, modulatorHz: v } }))}
                />
                <Slider
                  label="Amplitude"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.ssb.amplitude}
                  onChange={(v) =>
                    setState((s) => ({ ...s, ssb: { ...s.ssb, amplitude: v } }))
                  }
                />
                <label>
                  Sideband
                  <select
                    value={state.ssb.sideband}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        ssb: { ...s.ssb, sideband: e.target.value as 'usb' | 'lsb' }
                      }))
                    }
                  >
                    <option value="usb">USB</option>
                    <option value="lsb">LSB</option>
                  </select>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={state.ssb.carrierPilot}
                    onChange={(e) =>
                      setState((s) => ({ ...s, ssb: { ...s.ssb, carrierPilot: e.target.checked } }))
                    }
                  />
                  Carrier pilot (−20 dB)
                </label>
              </>
            )}
          </div>

          <footer className="transport">
            <button type="button" className="btn primary" onClick={() => void togglePlay()}>
              {state.playing ? 'Stop' : 'Play'}
            </button>
            <span className="kbd-hint">Space</span>
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
        </>
      )}
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
