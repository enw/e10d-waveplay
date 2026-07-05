import { useCallback, useEffect, useRef, useState } from 'react'
import type { SignalGraph } from '@/audio/SignalGraph'
import type { SignalState } from '@/audio/types'
import { encodeWav } from '@/export/wav'
import { EXPORT_SAMPLE_RATE } from '@/export/types'
import {
  decodeFromSamples,
  decodeWavBuffer,
  encodeTextToSamples,
  frameDurationMs,
  startDecodeSession,
  type DecodePhase
} from '@/codec'

const COUNTDOWN_SEC = 3
const CAPTURE_TAIL_MS = 500

export interface TonePanelProps {
  graph: SignalGraph
  state: SignalState
  setState: React.Dispatch<React.SetStateAction<SignalState>>
  onMicError: (msg: string | null) => void
  onDecodedChange?: (text: string) => void
}

type DemoPhase = 'idle' | 'countdown' | 'capturing'

export default function TonePanel({ graph, state, setState, onMicError, onDecodedChange }: TonePanelProps) {
  const [decoded, setDecoded] = useState('')
  const [decodePhase, setDecodePhase] = useState<DecodePhase | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle')
  const [countdown, setCountdown] = useState<number | null>(null)
  const decodeSessionRef = useRef<ReturnType<typeof startDecodeSession> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timersRef = useRef<number[]>([])
  const demoActiveRef = useRef(false)

  const codecConfig = {
    rootHz: state.tonetext.rootHz,
    amplitude: state.tonetext.amplitude
  }

  const messageText = state.tonetext.text || 'Hello world!'

  const reportDecoded = useCallback(
    (text: string) => {
      setDecoded(text)
      onDecodedChange?.(text)
    },
    [onDecodedChange]
  )

  const clearDemoTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }, [])

  const finishDemoCapture = useCallback(() => {
    if (!demoActiveRef.current) return
    demoActiveRef.current = false
    clearDemoTimers()
    setDemoPhase('idle')
    setCountdown(null)
    decodeSessionRef.current?.stop()
    decodeSessionRef.current = null
    graph.micInput.release()
    graph.stop()
    setState((s) => ({ ...s, playing: false }))
  }, [clearDemoTimers, graph, setState])

  const cancelDemo = useCallback(() => {
    demoActiveRef.current = false
    clearDemoTimers()
    setDemoPhase('idle')
    setCountdown(null)
    decodeSessionRef.current?.cancel()
    decodeSessionRef.current = null
    graph.micInput.release()
    graph.stop()
    setState((s) => ({ ...s, playing: false }))
  }, [clearDemoTimers, graph, setState])

  useEffect(() => () => {
    demoActiveRef.current = false
    clearDemoTimers()
    graph.micInput.release()
  }, [clearDemoTimers, graph])

  const transmit = useCallback(async () => {
    onMicError(null)
    setDecodeError(null)
    await graph.ensureRunning()
    const next: SignalState = {
      ...state,
      mode: 'tonetext',
      playing: true,
      tonetext: {
        ...state.tonetext,
        text: messageText
      }
    }
    setState(next)
    await graph.start(next)
  }, [graph, messageText, onMicError, setState, state])

  const playTransmission = useCallback(() => void transmit(), [transmit])

  const exportTransmission = useCallback(() => {
    setDecodeError(null)
    const samples = encodeTextToSamples(messageText, EXPORT_SAMPLE_RATE, codecConfig)
    const wav = encodeWav(samples, EXPORT_SAMPLE_RATE)
    const blob = new Blob([wav], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tonetext.wav'
    a.click()
    URL.revokeObjectURL(url)
  }, [codecConfig, messageText])

  const verifyRoundTrip = useCallback(() => {
    setDecodeError(null)
    const samples = encodeTextToSamples(messageText, EXPORT_SAMPLE_RATE, codecConfig)
    const result = decodeFromSamples(samples, EXPORT_SAMPLE_RATE, codecConfig)
    reportDecoded(result.text)
    setDecodePhase(result.phase)
    if (result.error) setDecodeError(result.error)
  }, [codecConfig, messageText, reportDecoded])

  const startListenAndDemo = useCallback(async () => {
    onMicError(null)
    setDecodeError(null)
    setDecoded('')
    setDecodePhase('hunting')

    try {
      await graph.micInput.acquire(graph.context)
      const analyser = graph.micInput.levelAnalyser
      if (!analyser) throw new Error('Mic analyser unavailable')

      demoActiveRef.current = true
      setDemoPhase('countdown')
      setCountdown(COUNTDOWN_SEC)

      decodeSessionRef.current = startDecodeSession(analyser, codecConfig, {
        onPhase: setDecodePhase,
        onComplete: (result) => {
          reportDecoded(result.text)
          if (result.error) setDecodeError(result.error)
        }
      })

      for (let tick = COUNTDOWN_SEC - 1; tick >= 1; tick--) {
        timersRef.current.push(
          window.setTimeout(() => setCountdown(tick), (COUNTDOWN_SEC - tick) * 1000)
        )
      }

      timersRef.current.push(
        window.setTimeout(() => {
          if (!demoActiveRef.current) return
          setCountdown(null)
          setDemoPhase('capturing')
          void transmit()
          const captureMs = frameDurationMs(messageText, codecConfig) + CAPTURE_TAIL_MS
          timersRef.current.push(window.setTimeout(finishDemoCapture, captureMs))
        }, COUNTDOWN_SEC * 1000)
      )
    } catch (err) {
      demoActiveRef.current = false
      setDemoPhase('idle')
      setCountdown(null)
      onMicError(err instanceof Error ? err.message : 'Mic error')
    }
  }, [
    codecConfig,
    finishDemoCapture,
    graph,
    messageText,
    onMicError,
    reportDecoded,
    transmit
  ])

  const importWav = useCallback(async (file: File) => {
    setDecodeError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = decodeWavBuffer(buffer, codecConfig)
      reportDecoded(result.text)
      setDecodePhase(result.phase)
      if (result.error) setDecodeError(result.error)
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Import failed')
    }
  }, [codecConfig, reportDecoded])

  const demoActive = demoPhase !== 'idle'

  return (
    <div className="tone-panel">
      {demoPhase === 'countdown' && countdown !== null && (
        <div className="tone-panel__countdown" aria-live="polite">
          {countdown}
        </div>
      )}

      <div className="panel-heading">ToneText codec</div>
      <p className="tone-panel__hint">
        Am minor-chord tones · two nibbles per character · sync + end framing
      </p>

      <label>
        Message
        <input
          type="text"
          className="tone-panel__text"
          value={state.tonetext.text}
          disabled={demoActive}
          onChange={(e) =>
            setState((s) => ({ ...s, tonetext: { ...s.tonetext, text: e.target.value } }))
          }
          placeholder="Hello world!"
        />
      </label>

      <label className="slider">
        <span>
          Root (Hz): <strong>{Math.round(state.tonetext.rootHz)}</strong>
        </span>
        <input
          type="range"
          min={110}
          max={440}
          step={1}
          value={state.tonetext.rootHz}
          disabled={demoActive}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              tonetext: { ...s.tonetext, rootHz: Number(e.target.value) }
            }))
          }
        />
      </label>

      <div className="tone-panel__actions">
        <button
          type="button"
          className="btn primary"
          disabled={demoActive}
          onClick={playTransmission}
        >
          Transmit
        </button>
        <button type="button" className="btn" disabled={demoActive} onClick={exportTransmission}>
          Export WAV
        </button>
        <button type="button" className="btn" disabled={demoActive} onClick={verifyRoundTrip}>
          Verify decode
        </button>
      </div>

      <div className="tone-panel__decode">
        <div className="panel-heading">Decode</div>
        <div className="tone-panel__actions">
          {!demoActive ? (
            <button type="button" className="btn primary" onClick={() => void startListenAndDemo()}>
              Listen &amp; demo
            </button>
          ) : (
            <button type="button" className="btn" onClick={cancelDemo}>
              Cancel demo
            </button>
          )}
          {demoPhase === 'capturing' && (
            <span className="tone-panel__capturing">Recording…</span>
          )}
          <button
            type="button"
            className="btn"
            disabled={demoActive}
            onClick={() => fileInputRef.current?.click()}
          >
            Import WAV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/wav,.wav"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importWav(file)
              e.target.value = ''
            }}
          />
        </div>
        {decodePhase && (
          <p className="tone-panel__status">
            Phase: <strong>{decodePhase}</strong>
          </p>
        )}
        {decoded && (
          <p className="tone-panel__decoded">
            Decoded: <strong>{decoded}</strong>
          </p>
        )}
        {decodeError && <p className="export-error">{decodeError}</p>}
      </div>
    </div>
  )
}
