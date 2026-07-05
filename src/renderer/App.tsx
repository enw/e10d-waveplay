import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SignalGraph } from '@/audio/SignalGraph'
import { SweepController } from '@/audio/SweepController'
import {
  defaultSignalState,
  getVizHints,
  mergePresetParams,
  usesMicModulator,
  type SignalMode,
  type SignalState,
  type SuperhetStage,
  type WaveShape
} from '@/audio/types'
import Scope from '@/components/Scope'
import Spectrum from '@/components/Spectrum'
import Waterfall from '@/components/Waterfall'
import PresetPicker from '@/components/PresetPicker'
import QuizPanel from '@/components/QuizPanel'
import ModulatorSourcePanel from '@/components/ModulatorSourcePanel'
import FilterPanel, { SuperhetIfPanel } from '@/components/FilterPanel'
import SweepPanel, { defaultSweepConfig } from '@/components/SweepPanel'
import LessonPanel, { initialLessonSession, type LessonSession } from '@/components/LessonPanel'
import Constellation from '@/components/Constellation'
import NoisePanel from '@/components/NoisePanel'
import TonePanel from '@/components/TonePanel'
import type { Preset } from '@/presets'
import { exportScreenshot, exportWav } from '@/export/ExportService'
import { defaultSpectrumView, type SpectrumView } from '@/viz/spectrumView'
import type { SweepConfig } from '@/audio/SweepController'
import SuperhetDiagram from '@/components/SuperhetDiagram'
import { getLesson } from '@/lessons'
import {
  advanceToGuess,
  applyPresetToState,
  initialQuizSession,
  pickRandomPreset,
  startQuestion,
  submitGuess,
  type QuizSession
} from '@/quiz/quizEngine'

type AppMode = 'study' | 'quiz' | 'lessons'

const MODES: { id: SignalMode; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'am', label: 'AM' },
  { id: 'fm', label: 'FM' },
  { id: 'mix', label: 'Mix' },
  { id: 'cw', label: 'CW' },
  { id: 'tonetext', label: 'ToneText' },
  { id: 'ssb', label: 'SSB' },
  { id: 'superhet', label: 'Superhet' }
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
  const [superhetStage, setSuperhetStage] = useState<SuperhetStage>('audio')
  const [sweepConfig, setSweepConfig] = useState<SweepConfig>(() => defaultSweepConfig('basic'))
  const [micError, setMicError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [lessonSession, setLessonSession] = useState<LessonSession>(initialLessonSession)
  const [tonetextDecoded, setTonetextDecoded] = useState('')
  const sweepRef = useRef(new SweepController())
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
    // Sweep drives audio via scheduleSweepParam; avoid duplicate rebuilds.
    if (sweepConfig.enabled) return
    void graph.updateParams(state).catch((err: unknown) => {
      setMicError(err instanceof Error ? err.message : 'Microphone error')
    })
  }, [
    graph,
    state.mode,
    state.basic,
    state.am,
    state.fm,
    state.mix,
    state.cw,
    state.tonetext,
    state.ssb,
    state.superhet,
    state.filter,
    state.noise,
    state.playing,
    sweepConfig.enabled
  ])

  useEffect(() => {
    if (state.mode === 'superhet') {
      graph.setSuperhetStage(superhetStage)
    }
  }, [graph, state.mode, superhetStage])

  useEffect(() => {
    sweepRef.current.stop()
    if (!state.playing || !sweepConfig.enabled) return

    sweepRef.current.start(sweepConfig, 0, (value) => {
      graph.scheduleSweepParam(sweepConfig.paramKey, value, stateRef.current)
      setState((s) => {
        const [section, field] = sweepConfig.paramKey.split('.')
        if (section === 'filter') {
          return { ...s, filter: { ...s.filter, [field!]: value } }
        }
        const block = s[section as keyof SignalState]
        if (typeof block !== 'object' || block === null) return s
        return { ...s, [section]: { ...block, [field!]: value } } as SignalState
      })
    })

    return () => sweepRef.current.stop()
  }, [graph, state.playing, sweepConfig])

  const clearListenTimer = (): void => {
    if (listenTimerRef.current !== null) {
      window.clearTimeout(listenTimerRef.current)
      listenTimerRef.current = null
    }
  }

  useEffect(() => () => clearListenTimer(), [])

  useEffect(() => {
    if (appMode !== 'lessons' || !lessonSession.lessonId || lessonSession.completed) return
    const lesson = getLesson(lessonSession.lessonId)
    if (!lesson) return
    const step = lesson.steps[lessonSession.stepIndex]
    if (!step) return
    const ok = step.validate(state, { superhetStage, tonetextDecoded })
    if (ok !== lessonSession.stepComplete) {
      setLessonSession((s) => ({ ...s, stepComplete: ok }))
    }
  }, [
    appMode,
    lessonSession.lessonId,
    lessonSession.stepIndex,
    lessonSession.completed,
    lessonSession.stepComplete,
    state,
    superhetStage,
    tonetextDecoded
  ])

  const togglePlay = useCallback(async () => {
    if (appMode === 'quiz' && quiz.phase === 'listen') return
    const current = stateRef.current
    if (current.playing) {
      graph.stop()
      setState((s) => ({ ...s, playing: false }))
    } else {
      setMicError(null)
      try {
        await graph.start(stateRef.current)
        setState((s) => ({ ...s, playing: true }))
      } catch (err) {
        setMicError(err instanceof Error ? err.message : 'Microphone error')
      }
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
    setSweepConfig(defaultSweepConfig(mode))
    setState((s) => ({ ...s, mode }))
  }

  const applyPreset = (preset: Preset) => {
    setPresetId(preset.id)
    setRfAnalogy(preset.rfAnalogy)
    if (preset.filter) {
      setState((s) => {
        const next: SignalState = {
          ...s,
          mode: preset.mode,
          [preset.mode]: mergePresetParams(preset.mode, preset.params),
          filter: preset.filter ?? s.filter
        } as SignalState
        if (s.playing) void graph.updateParams(next)
        return next
      })
      return
    }
    setState((s) => {
      const next: SignalState = {
        ...s,
        mode: preset.mode,
        [preset.mode]: mergePresetParams(preset.mode, preset.params)
      } as SignalState
      if (s.playing) void graph.updateParams(next)
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
    setLessonSession(initialLessonSession())
    setAppMode('quiz')
  }

  const enterLessons = (): void => {
    graph.stop()
    setQuiz(initialQuizSession())
    setState((s) => ({ ...s, playing: false }))
    setLessonSession(initialLessonSession())
    setAppMode('lessons')
  }

  const exitLessons = (): void => {
    setLessonSession(initialLessonSession())
    setAppMode('study')
  }

  const applyLessonState = (next: SignalState): void => {
    setPresetId('')
    setRfAnalogy('')
    setState(next)
    if (next.playing) {
      void graph.start(next).catch((err: unknown) => {
        setMicError(err instanceof Error ? err.message : 'Microphone error')
      })
    } else if (stateRef.current.playing) {
      void graph.updateParams(next)
    }
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
      case 'tonetext':
        return `root=${state.tonetext.rootHz} Hz "${state.tonetext.text.slice(0, 24)}${state.tonetext.text.length > 24 ? '…' : ''}"`
      case 'ssb':
        return `${state.ssb.sideband.toUpperCase()} fc=${state.ssb.carrierHz} fm=${state.ssb.modulatorHz}${state.ssb.carrierPilot ? ' +pilot' : ''}${state.ssb.modulatorSource === 'mic' ? ' mic' : ''}`
      case 'superhet':
        return `RF=${state.superhet.rfCarrierHz} LO=${state.superhet.loHz} IF=${state.superhet.ifCenterHz}`
    }
  }

  const micModActive = usesMicModulator(state) && graph.micInput.active

  const handleExportWav = async () => {
    setExportError(null)
    const result = await exportWav(state, exportDuration)
    if (result.error) setExportError(result.error)
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
                if (appMode === 'lessons') exitLessons()
                setAppMode('study')
              }}
            >
              Study
            </button>
            <button
              type="button"
              className={appMode === 'lessons' ? 'tab active' : 'tab'}
              onClick={enterLessons}
            >
              Lessons
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

      {state.mode === 'superhet' && (appMode === 'study' || appMode === 'lessons') && (
        <SuperhetDiagram
          stage={superhetStage}
          onStageChange={(stage) => {
            setSuperhetStage(stage)
            graph.setSuperhetStage(stage)
          }}
        />
      )}

      <div className="viz-row viz-row-4">
        <div className="viz-panel">
          <div className="viz-label">Scope</div>
          <Scope
            analyser={graph.analyser}
            active={state.playing}
            envelope={hideStudyEnvelope ? undefined : hints.envelope}
            micAnalyser={
              hints.envelope?.micLive ? graph.micInput.levelAnalyser : undefined
            }
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
            filterOverlay={hints.filterOverlay}
          />
        </div>
        <div className="viz-panel constellation-panel">
          <div className="viz-label">Constellation</div>
          <Constellation state={state} active={state.playing} />
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
      ) : appMode === 'lessons' ? (
        <LessonPanel
          session={lessonSession}
          state={state}
          superhetStage={superhetStage}
          onSessionChange={setLessonSession}
          onApplyState={applyLessonState}
          onExit={exitLessons}
        />
      ) : (
        <QuizPanel
          session={quiz}
          onStart={handleQuizStart}
          onGuess={handleQuizGuess}
          onNext={handleQuizNext}
          onExit={exitQuiz}
        />
      )}

      {(appMode === 'study' || appMode === 'lessons') && (
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
                <ModulatorSourcePanel
                  params={state.am}
                  micInput={graph.micInput}
                  micActive={micModActive}
                  micError={micError}
                  onChange={(patch) =>
                    setState((s) => ({ ...s, am: { ...s.am, ...patch } }))
                  }
                />
                <Slider
                  label="Carrier (Hz)"
                  min={100}
                  max={4000}
                  value={state.am.carrierHz}
                  onChange={(v) => setState((s) => ({ ...s, am: { ...s.am, carrierHz: v } }))}
                />
                {state.am.modulatorSource === 'tone' && (
                  <Slider
                    label="Modulator (Hz)"
                    min={1}
                    max={500}
                    value={state.am.modulatorHz}
                    onChange={(v) => setState((s) => ({ ...s, am: { ...s.am, modulatorHz: v } }))}
                  />
                )}
                <Slider
                  label="Modulation index (%)"
                  min={0}
                  max={100}
                  value={state.am.modulationIndex * 100}
                  disabled={sweepConfig.enabled && sweepConfig.paramKey === 'am.modulationIndex'}
                  onChange={(v) =>
                    setState((s) => ({ ...s, am: { ...s.am, modulationIndex: v / 100 } }))
                  }
                />
              </>
            )}

            {state.mode === 'fm' && (
              <>
                <ModulatorSourcePanel
                  params={state.fm}
                  micInput={graph.micInput}
                  micActive={micModActive}
                  micError={micError}
                  onChange={(patch) =>
                    setState((s) => ({ ...s, fm: { ...s.fm, ...patch } }))
                  }
                />
                <Slider
                  label="Carrier (Hz)"
                  min={100}
                  max={4000}
                  value={state.fm.carrierHz}
                  onChange={(v) => setState((s) => ({ ...s, fm: { ...s.fm, carrierHz: v } }))}
                />
                {state.fm.modulatorSource === 'tone' && (
                  <Slider
                    label="Modulator (Hz)"
                    min={1}
                    max={500}
                    value={state.fm.modulatorHz}
                    onChange={(v) => setState((s) => ({ ...s, fm: { ...s.fm, modulatorHz: v } }))}
                  />
                )}
                <Slider
                  label="Deviation (Hz)"
                  min={0}
                  max={500}
                  value={state.fm.deviationHz}
                  disabled={sweepConfig.enabled && sweepConfig.paramKey === 'fm.deviationHz'}
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
                <ModulatorSourcePanel
                  params={state.ssb}
                  micInput={graph.micInput}
                  micActive={micModActive}
                  micError={micError}
                  onChange={(patch) =>
                    setState((s) => ({ ...s, ssb: { ...s.ssb, ...patch } }))
                  }
                />
                <Slider
                  label="Carrier (Hz)"
                  min={100}
                  max={4000}
                  value={state.ssb.carrierHz}
                  onChange={(v) => setState((s) => ({ ...s, ssb: { ...s.ssb, carrierHz: v } }))}
                />
                {state.ssb.modulatorSource === 'tone' && (
                  <Slider
                    label="Modulator (Hz)"
                    min={1}
                    max={500}
                    value={state.ssb.modulatorHz}
                    onChange={(v) =>
                      setState((s) => ({ ...s, ssb: { ...s.ssb, modulatorHz: v } }))
                    }
                  />
                )}
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

            {state.mode === 'superhet' && (
              <>
                <Slider
                  label="RF carrier (Hz)"
                  min={100}
                  max={4000}
                  value={state.superhet.rfCarrierHz}
                  onChange={(v) =>
                    setState((s) => ({ ...s, superhet: { ...s.superhet, rfCarrierHz: v } }))
                  }
                />
                <Slider
                  label="RF modulator (Hz)"
                  min={1}
                  max={500}
                  value={state.superhet.rfModHz}
                  onChange={(v) =>
                    setState((s) => ({ ...s, superhet: { ...s.superhet, rfModHz: v } }))
                  }
                />
                <Slider
                  label="Modulation index (%)"
                  min={0}
                  max={100}
                  value={state.superhet.modulationIndex * 100}
                  onChange={(v) =>
                    setState((s) => ({
                      ...s,
                      superhet: { ...s.superhet, modulationIndex: v / 100 }
                    }))
                  }
                />
                <Slider
                  label="LO (Hz)"
                  min={100}
                  max={4000}
                  value={state.superhet.loHz}
                  disabled={sweepConfig.enabled && sweepConfig.paramKey === 'superhet.loHz'}
                  onChange={(v) =>
                    setState((s) => ({ ...s, superhet: { ...s.superhet, loHz: v } }))
                  }
                />
                <SuperhetIfPanel
                  superhet={state.superhet}
                  onChange={(patch) =>
                    setState((s) => ({ ...s, superhet: { ...s.superhet, ...patch } }))
                  }
                />
              </>
            )}

            <FilterPanel
              filter={state.filter}
              mode={state.mode}
              state={state}
              onChange={(patch) => setState((s) => ({ ...s, filter: { ...s.filter, ...patch } }))}
            />

            <NoisePanel
              noise={state.noise}
              onChange={(patch) => setState((s) => ({ ...s, noise: { ...s.noise, ...patch } }))}
            />

            <TonePanel
              graph={graph}
              state={state}
              setState={setState}
              onMicError={setMicError}
              onDecodedChange={setTonetextDecoded}
            />

            <SweepPanel
              mode={state.mode}
              filterEnabled={state.filter.enabled}
              config={sweepConfig}
              onChange={setSweepConfig}
            />
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
            <button
              type="button"
              className="btn"
              disabled={usesMicModulator(state)}
              title={
                usesMicModulator(state)
                  ? 'WAV export requires tone modulator (live mic not supported in v3.0)'
                  : undefined
              }
              onClick={() => void handleExportWav()}
            >
              Export WAV
            </button>
            {exportError && <span className="export-error">{exportError}</span>}
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
  disabled,
  onChange
}: {
  label: string
  min: number
  max: number
  step?: number
  value: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <label className={`slider${disabled ? ' slider--disabled' : ''}`}>
      <span>
        {label}: <strong>{step < 1 ? value.toFixed(2) : Math.round(value)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
