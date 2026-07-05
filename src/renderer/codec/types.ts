/** Minor-chord extension degrees → semitones above root (1, b3, 5, b7, 9, 11, 13, 15). */
export const CHORD_DEGREE_SEMITONES = [0, 3, 7, 10, 14, 17, 21, 24] as const

export const SYNC_TONE_MS = 150
export const SYNC_GAP_MS = 50
export const POST_SYNC_GAP_MS = 80
export const DATA_TONE_MS = 120
export const NIBBLE_GAP_MS = 40
export const CHAR_GAP_MS = 80
export const END_TONE_MS = 200
export const END_GAP_MS = 50

export const HARMONIC_MIX = 0.15
export const ATTACK_MS = 15
export const RELEASE_MS = 25

export const DEFAULT_ROOT_HZ = 220
export const SYNC_END_ROOT_RATIO = 0.5

export const DEFAULT_MESSAGE = 'Hello world!'

export interface CodecConfig {
  rootHz: number
  amplitude: number
}

export const DEFAULT_CODEC_CONFIG: CodecConfig = {
  rootHz: DEFAULT_ROOT_HZ,
  amplitude: 0.5
}

export type ToneKind = 'sync' | 'data' | 'end'

export interface ToneSlot {
  kind: ToneKind
  freqHz: number
  startSec: number
  durationSec: number
  nibble?: number
  charIndex?: number
  nibbleRole?: 'hi' | 'lo'
}

export interface FramePlan {
  slots: ToneSlot[]
  totalDurationSec: number
  payloadStartSec: number
  text: string
}

export type DecodePhase = 'hunting' | 'locked' | 'done' | 'error'

export interface DecodeResult {
  text: string
  phase: DecodePhase
  confidence: number
  error?: string
}
