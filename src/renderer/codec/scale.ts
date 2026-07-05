import {
  CHORD_DEGREE_SEMITONES,
  DEFAULT_ROOT_HZ,
  SYNC_END_ROOT_RATIO,
  type CodecConfig
} from './types'

/** Map 4-bit nibble (0–15) to frequency on Am chord-tone ladder. */
export function nibbleToFreqHz(nibble: number, rootHz: number = DEFAULT_ROOT_HZ): number {
  const n = ((nibble & 0xf) + 16) % 16
  const octave = Math.floor(n / 8)
  const degree = n % 8
  const semitones = CHORD_DEGREE_SEMITONES[degree] + 12 * octave
  return rootHz * Math.pow(2, semitones / 12)
}

export function syncToneHz(config: Pick<CodecConfig, 'rootHz'>): number {
  return nibbleToFreqHz(0, config.rootHz * SYNC_END_ROOT_RATIO)
}

export function endToneHz(config: Pick<CodecConfig, 'rootHz'>): number {
  return nibbleToFreqHz(3, config.rootHz * SYNC_END_ROOT_RATIO)
}

/** All data-channel nibble frequencies (16 tones, two octave cycles). */
export function dataNibbleFreqs(config: Pick<CodecConfig, 'rootHz'>): number[] {
  return Array.from({ length: 16 }, (_, n) => nibbleToFreqHz(n, config.rootHz))
}

export function charToNibbles(charCode: number): { hi: number; lo: number } {
  const byte = charCode & 0x7f
  return { hi: (byte >> 4) & 0xf, lo: byte & 0xf }
}

export function nibblesToChar(hi: number, lo: number): number {
  return ((hi & 0xf) << 4) | (lo & 0xf)
}

/** Printable ASCII for encode; other code points are skipped. */
export function normalizeEncodeText(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code <= 126) out += ch
  }
  return out
}
