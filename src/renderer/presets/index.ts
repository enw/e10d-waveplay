import type { AmParams, BasicParams, CwParams, FmParams, MixParams, SsbParams } from '@/audio/types'

import am100pct from './am-100pct.json'
import amLowMod from './am-low-mod.json'
import beat5hz from './beat-5hz.json'
import cwGate from './cw-gate.json'
import fmNarrow from './fm-narrow.json'
import fmWide from './fm-wide.json'
import pure1khz from './pure-1khz.json'
import ringMod from './ring-mod.json'
import ssbLsb from './ssb-lsb.json'
import ssbPilot from './ssb-pilot.json'
import ssbUsb from './ssb-usb.json'

type PresetBase = {
  id: string
  name: string
  rfAnalogy: string
}

export type Preset =
  | (PresetBase & { mode: 'basic'; params: BasicParams })
  | (PresetBase & { mode: 'am'; params: AmParams })
  | (PresetBase & { mode: 'fm'; params: FmParams })
  | (PresetBase & { mode: 'mix'; params: MixParams })
  | (PresetBase & { mode: 'cw'; params: CwParams })
  | (PresetBase & { mode: 'ssb'; params: SsbParams })

export const PRESETS: Preset[] = [
  pure1khz as Preset,
  am100pct as Preset,
  amLowMod as Preset,
  fmNarrow as Preset,
  fmWide as Preset,
  beat5hz as Preset,
  ringMod as Preset,
  cwGate as Preset,
  ssbUsb as Preset,
  ssbLsb as Preset,
  ssbPilot as Preset
]
