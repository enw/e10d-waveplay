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
  type FramePlan,
  type ToneSlot
} from './types'
import { endToneHz, normalizeEncodeText, syncToneHz, nibbleToFreqHz, charToNibbles } from './scale'

const MS = 0.001

export function buildFrame(text: string, config: CodecConfig = DEFAULT_CODEC_CONFIG): FramePlan {
  const payload = normalizeEncodeText(text)
  const slots: ToneSlot[] = []
  let t = 0

  const syncHz = syncToneHz(config)
  for (let i = 0; i < 3; i++) {
    slots.push({
      kind: 'sync',
      freqHz: syncHz,
      startSec: t,
      durationSec: SYNC_TONE_MS * MS
    })
    t += SYNC_TONE_MS * MS + SYNC_GAP_MS * MS
  }
  t += POST_SYNC_GAP_MS * MS - SYNC_GAP_MS * MS
  const payloadStartSec = t

  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i)
    const { hi, lo } = charToNibbles(code)

    slots.push({
      kind: 'data',
      freqHz: nibbleToFreqHz(hi, config.rootHz),
      startSec: t,
      durationSec: DATA_TONE_MS * MS,
      nibble: hi,
      charIndex: i,
      nibbleRole: 'hi'
    })
    t += DATA_TONE_MS * MS + NIBBLE_GAP_MS * MS

    slots.push({
      kind: 'data',
      freqHz: nibbleToFreqHz(lo, config.rootHz),
      startSec: t,
      durationSec: DATA_TONE_MS * MS,
      nibble: lo,
      charIndex: i,
      nibbleRole: 'lo'
    })
    t += DATA_TONE_MS * MS + CHAR_GAP_MS * MS
  }

  const endHz = endToneHz(config)
  for (let i = 0; i < 2; i++) {
    slots.push({
      kind: 'end',
      freqHz: endHz,
      startSec: t,
      durationSec: END_TONE_MS * MS
    })
    t += END_TONE_MS * MS + (i === 0 ? END_GAP_MS * MS : 0)
  }

  return {
    slots,
    totalDurationSec: t + 0.05,
    payloadStartSec,
    text: payload
  }
}
