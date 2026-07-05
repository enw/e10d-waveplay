import { useCallback, useRef, useState } from 'react'
import type { SignalGraph } from '@/audio/SignalGraph'
import type { SignalState } from '@/audio/types'
import { encodeWav } from '@/export/wav'
import { EXPORT_SAMPLE_RATE } from '@/export/types'
import {
  decodeFromSamples,
  decodeWavBuffer,
  encodeTextToSamples,
  startDecodeSession,
  type DecodePhase
} from '@/codec'

export interface TonePanelProps {
  graph: SignalGraph
  state: SignalState
  setState: React.Dispatch<React.SetStateAction<SignalState>>
  onMicError: (msg: string | null) => void
}

export default function TonePanel({ graph, state, setState, onMicError }: TonePanelProps) {
  const [decoded, setDecoded] = useState('')
  const [decodePhase, setDecodePhase] = useState<DecodePhase | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const decodeSessionRef = useRef<ReturnType<typeof startDecodeSession> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const codecConfig = {
    rootHz: state.tonetext.rootHz,
    amplitude: state.tonetext.amplitude
  }

  const playTransmission = useCallback(async () => {
    onMicError(null)
    setDecodeError(null)
    await graph.ensureRunning()
    const next: SignalState = {
      ...state,
      mode: 'tonetext',
      playing: true,
      tonetext: {
        ...state.tonetext,
        text: state.tonetext.text || 'Hello world!'
      }
    }
    setState(next)
    try {
      await graph.start(next)
    } catch (err) {
      onMicError(err instanceof Error ? err.message : 'Playback error')
    }
  }, [graph, onMicError, setState, state])

  const exportTransmission = useCallback(() => {
    setDecodeError(null)
    const text = state.tonetext.text || 'Hello world!'
    const samples = encodeTextToSamples(text, EXPORT_SAMPLE_RATE, codecConfig)
    const wav = encodeWav(samples, EXPORT_SAMPLE_RATE)
    const blob = new Blob([wav], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tonetext.wav'
    a.click()
    URL.revokeObjectURL(url)
  }, [codecConfig, state.tonetext.text])

  const verifyRoundTrip = useCallback(() => {
    setDecodeError(null)
    const text = state.tonetext.text || 'Hello world!'
    const samples = encodeTextToSamples(text, EXPORT_SAMPLE_RATE, codecConfig)
    const result = decodeFromSamples(samples, EXPORT_SAMPLE_RATE, codecConfig)
    setDecoded(result.text)
    setDecodePhase(result.phase)
    if (result.error) setDecodeError(result.error)
  }, [codecConfig, state.tonetext.text])

  const startMicDecode = useCallback(async () => {
    onMicError(null)
    setDecodeError(null)
    setDecoded('')
    setDecodePhase('hunting')
    try {
      await graph.micInput.acquire(graph.context)
      const analyser = graph.micInput.levelAnalyser
      if (!analyser) throw new Error('Mic analyser unavailable')
      setListening(true)
      decodeSessionRef.current = startDecodeSession(analyser, codecConfig, {
        onPhase: setDecodePhase,
        onComplete: (result) => {
          setDecoded(result.text)
          if (result.error) setDecodeError(result.error)
          setListening(false)
          graph.micInput.release()
        }
      })
    } catch (err) {
      onMicError(err instanceof Error ? err.message : 'Mic error')
      setListening(false)
    }
  }, [codecConfig, graph, onMicError])

  const stopMicDecode = useCallback(() => {
    decodeSessionRef.current?.stop()
    decodeSessionRef.current = null
    setListening(false)
  }, [])

  const importWav = useCallback(async (file: File) => {
    setDecodeError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = decodeWavBuffer(buffer, codecConfig)
      setDecoded(result.text)
      setDecodePhase(result.phase)
      if (result.error) setDecodeError(result.error)
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Import failed')
    }
  }, [codecConfig])

  return (
    <div className="tone-panel">
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
          onChange={(e) =>
            setState((s) => ({
              ...s,
              tonetext: { ...s.tonetext, rootHz: Number(e.target.value) }
            }))
          }
        />
      </label>

      <div className="tone-panel__actions">
        <button type="button" className="btn primary" onClick={() => void playTransmission()}>
          Transmit
        </button>
        <button type="button" className="btn" onClick={exportTransmission}>
          Export WAV
        </button>
        <button type="button" className="btn" onClick={verifyRoundTrip}>
          Verify decode
        </button>
      </div>

      <div className="tone-panel__decode">
        <div className="panel-heading">Decode</div>
        <div className="tone-panel__actions">
          {!listening ? (
            <button type="button" className="btn" onClick={() => void startMicDecode()}>
              Listen (mic)
            </button>
          ) : (
            <button type="button" className="btn" onClick={stopMicDecode}>
              Stop listening
            </button>
          )}
          <button
            type="button"
            className="btn"
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
