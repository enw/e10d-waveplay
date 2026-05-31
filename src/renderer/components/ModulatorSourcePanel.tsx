import { useEffect, useState } from 'react'
import type { AmParams, FmParams, ModulatorSource, SsbParams } from '@/audio/types'
import { clampMicGain } from '@/audio/types'
import { readMicPeak, type MicInput } from '@/audio/MicInput'

interface ModulatorSourcePanelProps {
  params: Pick<AmParams | FmParams | SsbParams, 'modulatorSource' | 'micGain'>
  micInput: MicInput
  micActive: boolean
  micError: string | null
  onChange: (patch: { modulatorSource?: ModulatorSource; micGain?: number }) => void
}

export default function ModulatorSourcePanel({
  params,
  micInput,
  micActive,
  micError,
  onChange
}: ModulatorSourcePanelProps) {
  const [peak, setPeak] = useState(0)

  useEffect(() => {
    if (!micActive || params.modulatorSource !== 'mic') {
      setPeak(0)
      return
    }

    let raf = 0
    const tick = (): void => {
      const analyser = micInput.levelAnalyser
      if (analyser) setPeak(readMicPeak(analyser))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [micActive, micInput, params.modulatorSource])

  return (
    <div className="mod-source-panel">
      <div className="mod-source-tabs">
        <button
          type="button"
          className={params.modulatorSource === 'tone' ? 'tab active' : 'tab'}
          onClick={() => onChange({ modulatorSource: 'tone' })}
        >
          Tone
        </button>
        <button
          type="button"
          className={params.modulatorSource === 'mic' ? 'tab active' : 'tab'}
          onClick={() => onChange({ modulatorSource: 'mic' })}
        >
          Mic
        </button>
        {micActive && params.modulatorSource === 'mic' && (
          <span className="mic-live" title="Live microphone — not recording to disk">
            ● Live
          </span>
        )}
      </div>
      {params.modulatorSource === 'mic' && (
        <>
          <label className="slider">
            <span>
              Mic gain: <strong>{params.micGain.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={params.micGain}
              onChange={(e) => onChange({ micGain: clampMicGain(Number(e.target.value)) })}
            />
          </label>
          <div className="mic-meter">
            <div className="mic-meter__bar" style={{ width: `${Math.min(100, peak * 100 * 2)}%` }} />
          </div>
          {micError && <p className="mic-error">{micError}</p>}
          <p className="mic-hint">Use headphones to avoid feedback.</p>
        </>
      )}
    </div>
  )
}
