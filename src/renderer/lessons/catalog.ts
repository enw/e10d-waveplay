import type { SignalMode, SignalState, SuperhetStage } from '../audio/types'
import { DEFAULT_AM, DEFAULT_FILTER, DEFAULT_SSB, DEFAULT_SUPERHET } from '../audio/types'
import type { Lesson, LessonStep } from './lessonEngine'

export const LESSONS: Lesson[] = [
  {
    id: 'sidebands-101',
    title: 'Sidebands 101',
    description: 'See how AM modulation index controls sideband strength.',
    rfAnalogy:
      'On HF, your voice creates sidebands around the carrier — modulation depth sets how loud they are.',
    steps: [
      {
        id: 'mode-am',
        instruction: 'Switch to AM mode.',
        validate: (s) => s.mode === 'am'
      },
      {
        id: 'm-50',
        instruction: 'Set modulation index to about 50%.',
        hint: 'Drag the modulation index slider to the middle.',
        validate: (s) => s.am.modulationIndex >= 0.4 && s.am.modulationIndex <= 0.6
      },
      {
        id: 'play',
        instruction: 'Press Play and watch the spectrum labels (LSB / carrier / USB).',
        validate: (s) => s.playing
      },
      {
        id: 'm-100',
        instruction: 'Increase modulation index to 100% — sidebands grow louder.',
        validate: (s) => s.am.modulationIndex >= 0.95
      }
    ]
  },
  {
    id: 'ssb-vs-am',
    title: 'SSB vs AM',
    description: 'Compare single-sideband bandwidth to full AM.',
    rfAnalogy: 'SSB cuts bandwidth in half — why HF phone ops prefer it over AM broadcast width.',
    steps: [
      {
        id: 'am-baseline',
        instruction: 'Start in AM mode with tone modulator at 100 Hz.',
        applyState: {
          mode: 'am',
          am: { ...DEFAULT_AM, modulatorSource: 'tone', modulatorHz: 100, modulationIndex: 0.8 }
        },
        validate: (s) => s.mode === 'am' && s.am.modulatorSource === 'tone'
      },
      {
        id: 'play-am',
        instruction: 'Press Play — note carrier plus both sidebands.',
        validate: (s) => s.playing && s.mode === 'am'
      },
      {
        id: 'switch-ssb',
        instruction: 'Switch to SSB mode (USB).',
        validate: (s) => s.mode === 'ssb' && s.ssb.sideband === 'usb'
      },
      {
        id: 'play-ssb',
        instruction: 'Press Play again — one sideband, no carrier.',
        validate: (s) => s.playing && s.mode === 'ssb'
      },
      {
        id: 'constellation',
        instruction: 'Watch the Constellation panel — USB traces a circle (I/Q rotation).',
        hint: 'Scroll to the Constellation viz if needed.',
        validate: (s) => s.mode === 'ssb' && s.playing
      }
    ]
  },
  {
    id: 'filter-selectivity',
    title: 'Filter selectivity',
    description: 'Hear what happens when the IF filter is too narrow.',
    rfAnalogy: 'Crystal filters at 455 kHz IF define how much adjacent-channel energy gets through.',
    steps: [
      {
        id: 'ssb-start',
        instruction: 'Load SSB mode with filter overlay available.',
        applyState: {
          mode: 'ssb',
          ssb: { ...DEFAULT_SSB, modulatorSource: 'tone', modulatorHz: 150 },
          filter: { ...DEFAULT_FILTER, enabled: false }
        },
        validate: (s) => s.mode === 'ssb'
      },
      {
        id: 'enable-filter',
        instruction: 'Enable the IF / bandpass filter.',
        validate: (s) => s.filter.enabled
      },
      {
        id: 'narrow',
        instruction: 'Narrow bandwidth to 400 Hz or less.',
        validate: (s) => s.filter.enabled && s.filter.bandwidthHz <= 400
      },
      {
        id: 'play-muffled',
        instruction: 'Press Play — audio should sound muffled.',
        validate: (s) => s.playing && s.filter.enabled && s.filter.bandwidthHz <= 400
      }
    ]
  },
  {
    id: 'superhet-walkthrough',
    title: 'Superhet walkthrough',
    description: 'Click through RF → Mixer → IF → Demod and read each spectrum.',
    rfAnalogy:
      'Every HF receiver you own runs this chain — here at audio Hz so you can hear each stage.',
    steps: [
      {
        id: 'superhet-mode',
        instruction: 'Switch to Superhet mode.',
        applyState: { mode: 'superhet', superhet: { ...DEFAULT_SUPERHET } },
        validate: (s) => s.mode === 'superhet'
      },
      {
        id: 'play-superhet',
        instruction: 'Press Play.',
        validate: (s) => s.playing && s.mode === 'superhet'
      },
      {
        id: 'stage-mixer',
        instruction: 'Click the Mixer block in the diagram.',
        validate: (_s, ctx) => ctx.superhetStage === 'mixer'
      },
      {
        id: 'stage-if',
        instruction: 'Click the IF block — spectrum should center on the IF peak.',
        validate: (_s, ctx) => ctx.superhetStage === 'if'
      },
      {
        id: 'stage-demod',
        instruction: 'Click Demod — spectrum shows recovered audio near the modulator frequency.',
        validate: (_s, ctx) => ctx.superhetStage === 'demod' || ctx.superhetStage === 'audio'
      }
    ]
  },
  {
    id: 'noise-lab',
    title: 'Copy in the noise',
    description: 'Practice pulling a signal out of band noise and QRM.',
    rfAnalogy: 'Real HF: atmospheric noise, nearby stations, and AC hum — filters and mode choice matter.',
    steps: [
      {
        id: 'am-signal',
        instruction: 'Switch to AM and press Play.',
        applyState: { mode: 'am', am: { ...DEFAULT_AM } },
        validate: (s) => s.mode === 'am' && s.playing
      },
      {
        id: 'add-noise',
        instruction: 'Enable band noise (AWGN) and set SNR to 15 dB or lower.',
        validate: (s) => s.noise.awgnEnabled && s.noise.snrDb <= 15
      },
      {
        id: 'add-qrm',
        instruction: 'Enable adjacent QRM — listen for the interfering carrier.',
        validate: (s) => s.noise.qrmEnabled
      },
      {
        id: 'filter-help',
        instruction: 'Enable the bandpass filter and narrow it — QRM should fade.',
        validate: (s) => s.filter.enabled && s.filter.bandwidthHz <= 800
      }
    ]
  }
]

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

export type { LessonStep, SuperhetStage }
