import {
  CHAR_GAP_MS,
  DATA_TONE_MS,
  DEFAULT_CODEC_CONFIG,
  END_GAP_MS,
  END_TONE_MS,
  NIBBLE_GAP_MS,
  POST_SYNC_GAP_MS,
  SYNC_GAP_MS,
  SYNC_TONE_MS,
  type CodecConfig,
  type DecodePhase,
  type DecodeResult
} from './types'
import { dataNibbleFreqs, endToneHz, normalizeEncodeText, syncToneHz } from './scale'
import { detectStrongest, goertzelMagnitude } from './goertzel'

const MS = 0.001
const HI_SLOT_SEC = (DATA_TONE_MS + NIBBLE_GAP_MS) * MS
const LO_SLOT_SEC = (DATA_TONE_MS + CHAR_GAP_MS) * MS
const SYNC_BLOCK_SEC = (3 * SYNC_TONE_MS + 2 * SYNC_GAP_MS) * MS + POST_SYNC_GAP_MS * MS
const TONE_CENTER_SEC = DATA_TONE_MS * 0.5 * MS
const MAX_CHARS = 256

/** v1 timing slack for acoustic / mic decode paths. */
const SLOT_SEARCH_MS = 25
const SYNC_SPACING_MIN_MS = 150
const SYNC_SPACING_MAX_MS = 250
const END_SEARCH_MS = 40
const SYNC_THRESHOLD = 0.04
const NIBBLE_THRESHOLD = 0.008

function msToSamples(ms: number, sampleRate: number): number {
  return Math.floor(ms * MS * sampleRate)
}

function syncMagnitude(
  samples: Float32Array,
  start: number,
  sampleRate: number,
  config: CodecConfig
): number {
  const windowSamples = msToSamples(SYNC_TONE_MS, sampleRate)
  if (start < 0 || start + windowSamples >= samples.length) return 0
  return goertzelMagnitude(samples, start, windowSamples, sampleRate, syncToneHz(config))
}

function findSyncPeakNear(
  samples: Float32Array,
  expectedStart: number,
  searchMs: number,
  sampleRate: number,
  config: CodecConfig
): number | null {
  const searchSamples = msToSamples(searchMs, sampleRate)
  const step = Math.max(1, Math.floor(msToSamples(5, sampleRate)))
  let bestStart = -1
  let bestMag = SYNC_THRESHOLD

  for (let offset = -searchSamples; offset <= searchSamples; offset += step) {
    const mag = syncMagnitude(samples, expectedStart + offset, sampleRate, config)
    if (mag > bestMag) {
      bestMag = mag
      bestStart = expectedStart + offset
    }
  }

  return bestStart >= 0 ? bestStart : null
}

function findSyncStartSample(
  samples: Float32Array,
  sampleRate: number,
  config: CodecConfig
): number | null {
  const windowSamples = msToSamples(SYNC_TONE_MS, sampleRate)
  const step = Math.max(1, Math.floor(windowSamples / 8))

  for (let i = 0; i < samples.length - windowSamples * 6; i += step) {
    if (syncMagnitude(samples, i, sampleRate, config) < SYNC_THRESHOLD) continue

    const t1 = findSyncPeakInRange(
      samples,
      i + msToSamples(SYNC_SPACING_MIN_MS, sampleRate),
      i + msToSamples(SYNC_SPACING_MAX_MS, sampleRate),
      sampleRate,
      config
    )
    if (t1 === null) continue

    const t2 = findSyncPeakInRange(
      samples,
      t1 + msToSamples(SYNC_SPACING_MIN_MS, sampleRate),
      t1 + msToSamples(SYNC_SPACING_MAX_MS, sampleRate),
      sampleRate,
      config
    )
    if (t2 === null) continue

    return i
  }
  return null
}

function findSyncPeakInRange(
  samples: Float32Array,
  minStart: number,
  maxStart: number,
  sampleRate: number,
  config: CodecConfig
): number | null {
  const step = Math.max(1, Math.floor(msToSamples(5, sampleRate)))
  let bestStart = -1
  let bestMag = SYNC_THRESHOLD

  for (let pos = minStart; pos <= maxStart; pos += step) {
    const mag = syncMagnitude(samples, pos, sampleRate, config)
    if (mag > bestMag) {
      bestMag = mag
      bestStart = pos
    }
  }
  return bestStart >= 0 ? bestStart : null
}

function combinedNibbleEnergy(
  samples: Float32Array,
  centerSample: number,
  sampleRate: number,
  config: CodecConfig
): number {
  const windowSamples = Math.floor(DATA_TONE_MS * MS * sampleRate * 0.65)
  const start = Math.max(0, centerSample - Math.floor(windowSamples / 2))
  const freqs = dataNibbleFreqs(config)
  let total = 0
  for (const freqHz of freqs) {
    total += goertzelMagnitude(samples, start, windowSamples, sampleRate, freqHz)
  }
  return total
}

function refineSlotCenter(
  samples: Float32Array,
  expectedCenter: number,
  sampleRate: number,
  config: CodecConfig
): number {
  const searchSamples = msToSamples(SLOT_SEARCH_MS, sampleRate)
  const step = Math.max(1, Math.floor(msToSamples(2, sampleRate)))
  let bestCenter = expectedCenter
  let bestEnergy = 0

  for (let offset = -searchSamples; offset <= searchSamples; offset += step) {
    const center = expectedCenter + offset
    if (center < 0 || center >= samples.length) continue
    const energy = combinedNibbleEnergy(samples, center, sampleRate, config)
    if (energy > bestEnergy) {
      bestEnergy = energy
      bestCenter = center
    }
  }
  return bestCenter
}

function detectNibbleAtCenter(
  samples: Float32Array,
  centerSample: number,
  sampleRate: number,
  config: CodecConfig
): number | null {
  const windowSamples = Math.floor(DATA_TONE_MS * MS * sampleRate * 0.65)
  const start = Math.max(0, centerSample - Math.floor(windowSamples / 2))
  const freqs = dataNibbleFreqs(config)
  const candidates = freqs.map((freqHz, index) => ({ freqHz, index }))
  const best = detectStrongest(samples, start, windowSamples, sampleRate, candidates)
  if (!best || best.index === undefined || best.magnitude < NIBBLE_THRESHOLD) return null
  return best.index
}

function endMagnitude(
  samples: Float32Array,
  startSample: number,
  sampleRate: number,
  config: CodecConfig
): number {
  const windowSamples = Math.floor(END_TONE_MS * MS * sampleRate * 0.65)
  if (startSample < 0 || startSample + windowSamples >= samples.length) return 0
  return goertzelMagnitude(samples, startSample, windowSamples, sampleRate, endToneHz(config))
}

function findEndPeakNear(
  samples: Float32Array,
  expectedStart: number,
  sampleRate: number,
  config: CodecConfig
): number | null {
  const searchSamples = msToSamples(END_SEARCH_MS, sampleRate)
  const step = Math.max(1, Math.floor(msToSamples(4, sampleRate)))
  let bestStart = -1
  let bestMag = 0.025

  for (let offset = -searchSamples; offset <= searchSamples; offset += step) {
    const mag = endMagnitude(samples, expectedStart + offset, sampleRate, config)
    if (mag > bestMag) {
      bestMag = mag
      bestStart = expectedStart + offset
    }
  }
  return bestStart
}

function detectEndPair(
  samples: Float32Array,
  expectedStart: number,
  sampleRate: number,
  config: CodecConfig
): boolean {
  const end1 = findEndPeakNear(samples, expectedStart, sampleRate, config)
  if (end1 === null) return false
  const expectedEnd2 =
    end1 + msToSamples(END_TONE_MS + END_GAP_MS, sampleRate)
  return findEndPeakNear(samples, expectedEnd2, sampleRate, config) !== null
}

export function decodeFromSamples(
  samples: Float32Array,
  sampleRate: number,
  config: CodecConfig = DEFAULT_CODEC_CONFIG
): DecodeResult {
  const syncStart = findSyncStartSample(samples, sampleRate, config)
  if (syncStart === null) {
    return { text: '', phase: 'hunting', confidence: 0, error: 'Sync not found' }
  }

  const payloadStart = syncStart + Math.floor(SYNC_BLOCK_SEC * sampleRate)
  const chars: number[] = []
  let relSec = 0
  let hiNibble = 0
  let expectingHi = true
  let detections = 0
  let totalMag = 0

  for (let slot = 0; slot < MAX_CHARS * 2; slot++) {
    const expectedCenter =
      payloadStart + Math.floor((relSec + TONE_CENTER_SEC) * sampleRate)

    if (expectedCenter >= samples.length - 50) break

    const centerSample = refineSlotCenter(
      samples,
      expectedCenter,
      sampleRate,
      config
    )
    const nibble = detectNibbleAtCenter(samples, centerSample, sampleRate, config)

    if (expectingHi && nibble === null) {
      if (chars.length > 0) {
        const endExpected = payloadStart + Math.floor(relSec * sampleRate)
        if (detectEndPair(samples, endExpected, sampleRate, config)) {
          return {
            text: String.fromCharCode(...chars),
            phase: 'done',
            confidence: detections > 0 ? totalMag / detections : 0
          }
        }
      }
      break
    }

    if (nibble !== null) {
      detections++
      totalMag += 0.01
      if (expectingHi) {
        hiNibble = nibble
        expectingHi = false
        relSec += HI_SLOT_SEC
      } else {
        const code = (hiNibble << 4) | nibble
        if (code < 32 || code > 126) break
        chars.push(code)
        expectingHi = true
        relSec += LO_SLOT_SEC
      }
    } else if (expectingHi) {
      break
    } else {
      expectingHi = true
      relSec += LO_SLOT_SEC
    }
  }

  if (chars.length > 0) {
    const endSearchStart = payloadStart + Math.floor(relSec * sampleRate)
    const searchSpan = msToSamples(400, sampleRate)
    const step = msToSamples(10, sampleRate)
    for (let offset = -msToSamples(80, sampleRate); offset <= searchSpan; offset += step) {
      if (detectEndPair(samples, endSearchStart + offset, sampleRate, config)) {
        return {
          text: normalizeEncodeText(String.fromCharCode(...chars)),
          phase: 'done',
          confidence: detections > 0 ? totalMag / detections : 0
        }
      }
    }
    return {
      text: normalizeEncodeText(String.fromCharCode(...chars)),
      phase: 'locked',
      confidence: detections > 0 ? totalMag / detections : 0
    }
  }

  return { text: '', phase: 'error', confidence: 0, error: 'Payload decode failed' }
}

/** Parse mono 16-bit PCM WAV into float samples. */
export function decodeWavToSamples(buffer: ArrayBuffer): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(buffer)
  if (view.byteLength < 44) throw new Error('WAV too short')

  const readStr = (offset: number, len: number): string => {
    let s = ''
    for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i))
    return s
  }

  if (readStr(0, 4) !== 'RIFF' || readStr(8, 4) !== 'WAVE') {
    throw new Error('Not a WAV file')
  }

  let offset = 12
  let sampleRate = 44100
  let bitsPerSample = 16
  let dataOffset = 0
  let dataSize = 0

  while (offset + 8 <= view.byteLength) {
    const id = readStr(offset, 4)
    const size = view.getUint32(offset + 4, true)
    offset += 8
    if (id === 'fmt ') {
      sampleRate = view.getUint32(offset + 4, true)
      bitsPerSample = view.getUint16(offset + 14, true)
    } else if (id === 'data') {
      dataOffset = offset
      dataSize = size
      break
    }
    offset += size
  }

  if (dataOffset === 0 || bitsPerSample !== 16) {
    throw new Error('Unsupported WAV format (need 16-bit PCM)')
  }

  const numSamples = Math.floor(dataSize / 2)
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 0x8000
  }
  return { samples, sampleRate }
}

export function decodeWavBuffer(
  buffer: ArrayBuffer,
  config: CodecConfig = DEFAULT_CODEC_CONFIG
): DecodeResult {
  const { samples, sampleRate } = decodeWavToSamples(buffer)
  return decodeFromSamples(samples, sampleRate, config)
}

export interface DecodeSessionCallbacks {
  onChar?: (char: string) => void
  onPhase?: (phase: DecodePhase) => void
  onComplete?: (result: DecodeResult) => void
}

export interface DecodeSession {
  stop: () => void
}

/** Real-time decode from an analyser fed by mic or graph output. */
export function startDecodeSession(
  analyser: AnalyserNode,
  config: CodecConfig,
  callbacks: DecodeSessionCallbacks
): DecodeSession {
  const sampleRate = analyser.context.sampleRate
  const buf = new Float32Array(analyser.fftSize * 2)
  let recording: number[] = []
  let stopped = false
  let raf = 0

  callbacks.onPhase?.('hunting')

  const tick = (): void => {
    if (stopped) return
    analyser.getFloatTimeDomainData(buf)
    for (let i = 0; i < buf.length; i++) recording.push(buf[i])

    const maxSamples = Math.floor(sampleRate * 30)
    if (recording.length > maxSamples) {
      recording = recording.slice(-maxSamples)
    }

    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    stop: () => {
      stopped = true
      cancelAnimationFrame(raf)
      const samples = new Float32Array(recording)
      const result = decodeFromSamples(samples, sampleRate, config)
      if (result.text) {
        for (const ch of result.text) callbacks.onChar?.(ch)
      }
      callbacks.onPhase?.(result.phase)
      callbacks.onComplete?.(result)
    }
  }
}
