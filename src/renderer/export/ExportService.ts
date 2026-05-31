import type {
  AmParams,
  BasicParams,
  CwParams,
  FmParams,
  MixParams,
  SignalState
} from '../audio/types'
import { clampAmp, clampFreq, clampModIndex } from '../audio/types'
import { EXPORT_SAMPLE_RATE, type ExportScreenshotMeta } from './types'
import { encodeWav } from './wav'

function buildOfflineGraph(ctx: OfflineAudioContext, state: SignalState): void {
  const masterGain = ctx.createGain()
  masterGain.gain.value = clampAmp(state.volume)
  masterGain.connect(ctx.destination)

  switch (state.mode) {
    case 'basic':
      buildBasicOffline(ctx, state.basic, masterGain)
      break
    case 'am':
      buildAmOffline(ctx, state.am, masterGain)
      break
    case 'fm':
      buildFmOffline(ctx, state.fm, masterGain)
      break
    case 'mix':
      buildMixOffline(ctx, state.mix, masterGain)
      break
    case 'cw':
      buildCwOffline(ctx, state.cw, masterGain)
      break
  }
}

function buildBasicOffline(
  ctx: OfflineAudioContext,
  params: BasicParams,
  masterGain: GainNode
): void {
  const osc = ctx.createOscillator()
  osc.type = params.waveShape
  osc.frequency.value = clampFreq(params.frequencyHz)
  const gain = ctx.createGain()
  gain.gain.value = clampAmp(params.amplitude)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(0)
}

function buildAmOffline(ctx: OfflineAudioContext, params: AmParams, masterGain: GainNode): void {
  const carrierHz = clampFreq(params.carrierHz)
  const modulatorHz = clampFreq(params.modulatorHz, 1, 500)
  const m = clampModIndex(params.modulationIndex)

  const carrier = ctx.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = carrierHz

  const modulator = ctx.createOscillator()
  modulator.type = 'sine'
  modulator.frequency.value = modulatorHz

  const modGain = ctx.createGain()
  modGain.gain.value = m

  const offset = ctx.createConstantSource()
  offset.offset.value = 1

  const ampGain = ctx.createGain()
  ampGain.gain.value = 0.5 * (1 + m)

  modulator.connect(modGain)
  modGain.connect(ampGain.gain)
  offset.connect(ampGain.gain)
  carrier.connect(ampGain)
  ampGain.connect(masterGain)

  carrier.start(0)
  modulator.start(0)
  offset.start(0)
}

function buildFmOffline(ctx: OfflineAudioContext, params: FmParams, masterGain: GainNode): void {
  const carrierHz = clampFreq(params.carrierHz)
  const modulatorHz = clampFreq(params.modulatorHz, 1, 500)
  const deviationHz = Math.min(500, Math.max(0, params.deviationHz))

  const carrier = ctx.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = carrierHz

  const modulator = ctx.createOscillator()
  modulator.type = 'sine'
  modulator.frequency.value = modulatorHz

  const devGain = ctx.createGain()
  devGain.gain.value = deviationHz

  const outGain = ctx.createGain()
  outGain.gain.value = 0.5

  modulator.connect(devGain)
  devGain.connect(carrier.frequency)
  carrier.connect(outGain)
  outGain.connect(masterGain)

  carrier.start(0)
  modulator.start(0)
}

function buildMixOffline(ctx: OfflineAudioContext, params: MixParams, masterGain: GainNode): void {
  const oscA = ctx.createOscillator()
  oscA.type = 'sine'
  oscA.frequency.value = clampFreq(params.oscAHz)

  const oscB = ctx.createOscillator()
  oscB.type = 'sine'
  oscB.frequency.value = clampFreq(params.oscBHz)

  const gainA = ctx.createGain()
  gainA.gain.value = clampAmp(params.oscAAmp)

  const gainB = ctx.createGain()
  gainB.gain.value = clampAmp(params.oscBAmp)

  oscA.connect(gainA)
  oscB.connect(gainB)

  if (params.mixMode === 'sum') {
    gainA.connect(masterGain)
    gainB.connect(masterGain)
  } else {
    const productGain = ctx.createGain()
    productGain.gain.value = 0
    gainA.connect(productGain)
    gainB.connect(productGain.gain)
    productGain.connect(masterGain)
  }

  oscA.start(0)
  oscB.start(0)
}

function buildCwOffline(ctx: OfflineAudioContext, params: CwParams, masterGain: GainNode): void {
  const carrierHz = clampFreq(params.carrierHz)
  const gateHz = clampFreq(params.gateHz, 0.5, 20)
  const amp = clampAmp(params.amplitude)

  const carrier = ctx.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = carrierHz

  const gate = ctx.createOscillator()
  gate.type = 'square'
  gate.frequency.value = gateHz

  const modGain = ctx.createGain()
  modGain.gain.value = amp * 0.5

  const offset = ctx.createConstantSource()
  offset.offset.value = amp * 0.5

  const ampGain = ctx.createGain()

  gate.connect(modGain)
  modGain.connect(ampGain.gain)
  offset.connect(ampGain.gain)
  carrier.connect(ampGain)
  ampGain.connect(masterGain)

  carrier.start(0)
  gate.start(0)
  offset.start(0)
}

function compositeScreenshot(
  scopeCanvas: HTMLCanvasElement,
  spectrumCanvas: HTMLCanvasElement,
  meta: ExportScreenshotMeta
): HTMLCanvasElement {
  const width = 1200
  const height = 700
  const padding = 24
  const headerHeight = 72

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create offscreen canvas context')
  }

  ctx.fillStyle = '#121218'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#e8e8f0'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText(`WavePlay — ${meta.mode}`, padding, padding + 22)

  ctx.fillStyle = '#9090a8'
  ctx.font = '15px system-ui, sans-serif'
  ctx.fillText(meta.paramsText, padding, padding + 50)

  const vizTop = headerHeight + padding
  const vizHeight = height - vizTop - padding
  const gap = 16
  const colWidth = (width - padding * 2 - gap) / 2

  const drawViz = (source: HTMLCanvasElement, x: number, label: string) => {
    ctx.fillStyle = '#1a1a24'
    ctx.fillRect(x, vizTop, colWidth, vizHeight)
    ctx.strokeStyle = '#2a2a38'
    ctx.strokeRect(x, vizTop, colWidth, vizHeight)

    const scale = Math.min(colWidth / source.width, vizHeight / source.height)
    const drawW = source.width * scale
    const drawH = source.height * scale
    const drawX = x + (colWidth - drawW) / 2
    const drawY = vizTop + (vizHeight - drawH) / 2
    ctx.drawImage(source, drawX, drawY, drawW, drawH)

    ctx.fillStyle = '#707088'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(label, x + 8, vizTop + 18)
  }

  drawViz(scopeCanvas, padding, 'Scope')
  drawViz(spectrumCanvas, padding + colWidth + gap, 'Spectrum')

  return out
}

export async function renderOffline(
  state: SignalState,
  durationSec: number
): Promise<Float32Array> {
  const length = Math.ceil(EXPORT_SAMPLE_RATE * durationSec)
  const ctx = new OfflineAudioContext(1, length, EXPORT_SAMPLE_RATE)
  buildOfflineGraph(ctx, state)
  const buffer = await ctx.startRendering()
  return buffer.getChannelData(0).slice()
}

export async function exportWav(
  state: SignalState,
  durationSec: number
): Promise<{ ok: boolean; filePath?: string }> {
  const samples = await renderOffline(state, durationSec)
  const wavBuffer = encodeWav(samples, EXPORT_SAMPLE_RATE)
  return window.electronAPI.saveFile({
    defaultPath: `waveplay-${state.mode}.wav`,
    buffer: wavBuffer,
    filters: [{ name: 'WAV Audio', extensions: ['wav'] }]
  })
}

export async function exportScreenshot(
  scopeCanvas: HTMLCanvasElement,
  spectrumCanvas: HTMLCanvasElement,
  meta: ExportScreenshotMeta
): Promise<{ ok: boolean; filePath?: string }> {
  const composite = compositeScreenshot(scopeCanvas, spectrumCanvas, meta)
  const blob = await new Promise<Blob>((resolve, reject) => {
    composite.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Failed to encode PNG'))
    }, 'image/png')
  })
  const buffer = await blob.arrayBuffer()
  return window.electronAPI.saveFile({
    defaultPath: 'waveplay-screenshot.png',
    buffer,
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  })
}
