import { describe, expect, it } from 'vitest'
import { buildFrame } from './frame'
import { encodeTextToSamples } from './encoder'
import { decodeFromSamples, decodeWavBuffer } from './decoder'
import { encodeWav } from '../export/wav'
import { DEFAULT_CODEC_CONFIG, DEFAULT_MESSAGE } from './types'
import { charToNibbles, nibbleToFreqHz } from './scale'

describe('nibbleToFreqHz', () => {
  it('maps 16 nibbles with no collisions', () => {
    const freqs = Array.from({ length: 16 }, (_, n) => nibbleToFreqHz(n, 220))
    const unique = new Set(freqs.map((f) => Math.round(f * 100)))
    expect(unique.size).toBe(16)
  })
})

describe('charToNibbles', () => {
  it('splits hello world chars', () => {
    expect(charToNibbles('h'.charCodeAt(0))).toEqual({ hi: 6, lo: 8 })
    expect(charToNibbles('!'.charCodeAt(0))).toEqual({ hi: 2, lo: 1 })
  })
})

describe('buildFrame', () => {
  it('frames sync, payload, and end for default message', () => {
    const plan = buildFrame(DEFAULT_MESSAGE, DEFAULT_CODEC_CONFIG)
    expect(plan.text).toBe(DEFAULT_MESSAGE)
    expect(plan.slots.filter((s) => s.kind === 'sync')).toHaveLength(3)
    expect(plan.slots.filter((s) => s.kind === 'end')).toHaveLength(2)
    expect(plan.slots.filter((s) => s.kind === 'data')).toHaveLength(DEFAULT_MESSAGE.length * 2)
  })
})

describe('round-trip codec', () => {
  it('encodes and decodes hello world', () => {
    const text = 'hello world!'
    const sampleRate = 44100
    const samples = encodeTextToSamples(text, sampleRate, DEFAULT_CODEC_CONFIG)
    const result = decodeFromSamples(samples, sampleRate, DEFAULT_CODEC_CONFIG)
    expect(result.phase).toBe('done')
    expect(result.text).toBe(text)
  })

  it('round-trips through WAV', () => {
    const text = 'hello world!'
    const sampleRate = 44100
    const samples = encodeTextToSamples(text, sampleRate, DEFAULT_CODEC_CONFIG)
    const wav = encodeWav(samples, sampleRate)
    const result = decodeWavBuffer(wav, DEFAULT_CODEC_CONFIG)
    expect(result.phase).toBe('done')
    expect(result.text).toBe(text)
  })

  it('decodes with payload delayed 15ms (mic latency)', () => {
    const text = 'hello world!'
    const sampleRate = 44100
    const samples = encodeTextToSamples(text, sampleRate, DEFAULT_CODEC_CONFIG)
    const delaySamples = Math.floor(0.015 * sampleRate)
    const delayed = new Float32Array(samples.length + delaySamples)
    delayed.set(samples, delaySamples)
    const result = decodeFromSamples(delayed, sampleRate, DEFAULT_CODEC_CONFIG)
    expect(result.text).toBe(text)
    expect(['done', 'locked']).toContain(result.phase)
  })
})
