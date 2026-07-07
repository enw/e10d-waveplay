import type {
  AmParams,
  BasicParams,
  CwParams,
  FilterParams,
  FmParams,
  MixParams,
  NoiseParams,
  SsbParams,
  SuperhetParams,
  ToneTextParams
} from '@/audio/types'

import am100pct from './am-100pct.json'
import amLowMod from './am-low-mod.json'
import amMicVoice from './am-mic-voice.json'
import beat5hz from './beat-5hz.json'
import cwGate from './cw-gate.json'
import filterNarrowMuffled from './filter-narrow-muffled.json'
import filterSsb2k4 from './filter-ssb-2k4.json'
import filterWideAm from './filter-wide-am.json'
import fmMicSpeech from './fm-mic-speech.json'
import fmNarrow from './fm-narrow.json'
import fmWide from './fm-wide.json'
import pure1khz from './pure-1khz.json'
import ringMod from './ring-mod.json'
import ssbLsb from './ssb-lsb.json'
import ssbMicUsb from './ssb-mic-usb.json'
import ssbPilot from './ssb-pilot.json'
import ssbUsb from './ssb-usb.json'
import superhetClassicAm from './superhet-classic-am.json'
import superhetIfNarrow from './superhet-if-narrow.json'
import superhetLoSweep from './superhet-lo-sweep.json'
import tonetextHello from './tonetext-hello.json'
import tonetextHelloNoisy from './tonetext-hello-noisy.json'

type PresetBase = {
  id: string
  name: string
  rfAnalogy: string
  filter?: FilterParams
  noise?: NoiseParams
}

export type Preset =
  | (PresetBase & { mode: 'basic'; params: BasicParams })
  | (PresetBase & { mode: 'am'; params: AmParams })
  | (PresetBase & { mode: 'fm'; params: FmParams })
  | (PresetBase & { mode: 'mix'; params: MixParams })
  | (PresetBase & { mode: 'cw'; params: CwParams })
  | (PresetBase & { mode: 'tonetext'; params: ToneTextParams })
  | (PresetBase & { mode: 'ssb'; params: SsbParams })
  | (PresetBase & { mode: 'superhet'; params: SuperhetParams })

export const PRESETS: Preset[] = [
  pure1khz as Preset,
  am100pct as Preset,
  amLowMod as Preset,
  amMicVoice as Preset,
  fmNarrow as Preset,
  fmWide as Preset,
  fmMicSpeech as Preset,
  beat5hz as Preset,
  ringMod as Preset,
  cwGate as Preset,
  tonetextHello as Preset,
  tonetextHelloNoisy as Preset,
  ssbUsb as Preset,
  ssbLsb as Preset,
  ssbPilot as Preset,
  ssbMicUsb as Preset,
  filterSsb2k4 as Preset,
  filterNarrowMuffled as Preset,
  filterWideAm as Preset,
  superhetClassicAm as Preset,
  superhetIfNarrow as Preset,
  superhetLoSweep as Preset
]
