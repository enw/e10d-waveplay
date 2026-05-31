# WavePlay — Design Spec

**Date:** 2026-05-31  
**Status:** Approved (pending final spec review)  
**Repo:** e10d-waveplay

## Summary

Client-only Electron desktop app for learning amateur-radio wave concepts in the audio band. Users experiment in a sandbox or load radio-themed presets while watching time-domain scope and frequency-domain spectrum visualizations. All six v1 features ship together: basic waveforms, AM, FM, beat/mixing, dual visualization, and export.

## Goals

| Goal | Success criteria |
|------|------------------|
| Learn DSP/radio concepts | Sidebands, envelope, beat freq visible and labeled |
| Engineering clarity | Precise Hz controls, modulation index/deviation in real units |
| Visual engagement | Smooth 60 fps scope + spectrum, readable annotations |
| Study workflow | Presets with RF analogy notes; export WAV + screenshot |

## Non-Goals (v1)

- SSB, PM, digital modes
- Waterfall / spectrogram
- Actual RF frequencies or SDR hardware
- Network, accounts, cloud sync
- macOS-only features (target cross-platform via Electron)

## User Persona

Amateur-radio student who understands concepts better when heard and seen at audio frequencies (20 Hz–20 kHz), with explicit mapping to RF ideas in preset copy.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron Main Process                          │
│  - BrowserWindow lifecycle                      │
│  - Native file save dialogs (WAV export)        │
│  - Optional: app menu (Play/Stop shortcuts)     │
├─────────────────────────────────────────────────┤
│  Renderer (React + Vite + TypeScript)           │
│                                                 │
│  ┌──────────────┐    ┌─────────────────────┐  │
│  │ PresetManager│───▶│ SignalGraph         │  │
│  │ (JSON presets)│    │ Web Audio API       │  │
│  └──────────────┘    │ - OscillatorBank    │  │
│                       │ - AM / FM / Mix     │  │
│  ┌──────────────┐    │ - Master gain       │  │
│  │ AppState     │◀──▶│ - AnalyserNode tap  │  │
│  │ (React)      │    └──────────┬──────────┘  │
│  └──────────────┘               │             │
│         │              ┌────────┴────────┐    │
│         ▼              ▼                 ▼    │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Controls   │  │ Scope    │  │ Spectrum │  │
│  │ Panel      │  │ Canvas   │  │ Canvas   │  │
│  └────────────┘  └──────────┘  └──────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ExportService                            │  │
│  │ - OfflineAudioContext → WAV              │  │
│  │ - Canvas composite → PNG                 │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Module Boundaries

| Module | Responsibility | Depends on |
|--------|----------------|------------|
| `SignalGraph` | Build/tear down Web Audio node graph per mode | Web Audio API |
| `OscillatorBank` | Sine/square/triangle/saw oscillators | SignalGraph |
| `AmModulator` | AM: carrier × (1 + m·modulator) | OscillatorBank |
| `FmModulator` | FM: phase integration with deviation | AudioWorklet |
| `Mixer` | Two-tone sum; optional ring-mod product | OscillatorBank |
| `AnalyserTap` | Shared AnalyserNode; waveform + FFT buffers | SignalGraph |
| `ScopeRenderer` | Time-domain canvas draw loop | AnalyserTap |
| `SpectrumRenderer` | FFT canvas + peak/sideband labels | AnalyserTap |
| `PresetManager` | Load preset JSON → AppState + SignalGraph | AppState |
| `ExportService` | WAV via OfflineAudioContext; PNG via canvas | SignalGraph |
| `electron/main` | Window, IPC for save dialog only | Electron |

## Signal Modes

### Basic

- **Controls:** wave shape, frequency (20–4000 Hz default range), amplitude (0–1)
- **Graph:** single `OscillatorNode` → master gain → destination + analyser
- **Visualization:** single tone on scope; one peak in spectrum

### AM (Amplitude Modulation)

- **Controls:** carrier Hz, modulator Hz, modulation index m (0–1, display as 0–100%)
- **Implementation:** `carrierGain.gain` modulated by `(1 + m * modulatorSignal)` via `GainNode` + `ConstantSourceNode` offset, or AudioWorklet for clarity
- **Visualization:**
  - Scope: carrier with envelope overlay (computed from modulator, dashed line)
  - Spectrum: peaks at fc − fm, fc, fc + fm; labels when m > 0
- **RF note in UI:** "At RF, fc is your transmit frequency; fm is baseband (voice/data)"

### FM (Frequency Modulation)

- **Controls:** carrier Hz, modulator Hz, deviation (Hz, 0–500 audio-scale)
- **Implementation:** AudioWorklet integrating `phase += 2π·(fc + deviation·modulator)·dt`
- **Visualization:**
  - Scope: dense FM waveform
  - Spectrum: Bessel sidebands; annotate carrier and first sideband pair when β = deviation/fm is small integer-ish
- **RF note:** "Deviation at RF is kHz; here we use Hz so you can hear it"

### Mix (Beat / Heterodyne)

- **Controls:** oscillator A (Hz, amp), oscillator B (Hz, amp), mode: **sum** | **product**
- **Sum:** hear beat when frequencies are close (e.g. 1000 + 1005 → 5 Hz beat)
- **Product:** ring mod — sum/difference frequencies emphasized
- **Visualization:**
  - Scope: combined waveform
  - Spectrum: label f1, f2, |f1−f2|, f1+f2 as applicable

## Preset Library

Presets are JSON files in `src/presets/*.json`:

```json
{
  "id": "am-100pct-sidebands",
  "name": "AM at 100% — see the sidebands",
  "mode": "am",
  "params": {
    "carrierHz": 1000,
    "modulatorHz": 100,
    "modulationIndex": 1.0
  },
  "rfAnalogy": "On HF AM, your voice (≈300–3000 Hz) modulates the carrier. Here we use 100 Hz so the envelope is visible on the scope."
}
```

### v1 Presets (minimum set)

1. **Pure 1 kHz tone** — Basic mode reference
2. **AM at 100%** — 1 kHz carrier, 100 Hz modulator, m = 1.0
3. **AM low modulation** — same, m = 0.3 (compare sideband amplitude)
4. **FM narrow deviation** — 440 Hz carrier, 5 Hz modulator, 25 Hz deviation
5. **FM wide deviation** — 440 Hz carrier, 100 Hz modulator, 200 Hz deviation
6. **Beat frequency 5 Hz** — 1000 + 1005 Hz sum
7. **Ring mod heterodyne** — product mode, 500 + 520 Hz
8. **CW intuition** — 800 Hz carrier gated at 5 Hz square (on/off keying); demonstrates carrier presence vs silence, not Morse input

Preset picker: dropdown in header. Selecting a preset updates controls and shows `rfAnalogy` in an info panel.

## UI Layout

```
┌─ WavePlay ─────────────── [Presets ▼] ─────────┐
│  ┌─ Scope (time) ─────┐ ┌─ Spectrum (FFT) ───┐ │
│  │                    │ │  fc±fm labels      │ │
│  │  ~300ms window     │ │  peak markers      │ │
│  └────────────────────┘ └────────────────────┘ │
│  ┌─ RF Analogy (preset or mode hint) ─────────┐ │
│  └────────────────────────────────────────────┘ │
│  Mode: [Basic] [AM] [FM] [Mix]                  │
│  ┌─ Context controls (mode-specific) ──────────┐ │
│  └────────────────────────────────────────────┘ │
│  [▶ Play] [⏹ Stop]  Vol ────●──  📷  💾        │
└─────────────────────────────────────────────────┘
```

- Dark theme, high-contrast traces (green scope, amber spectrum — classic bench look)
- Controls use labeled sliders + numeric inputs for precision
- Play/Stop toggles audio context (resume on first play if suspended)

## Visualization Details

### Scope

- Source: `AnalyserNode.getFloatTimeDomainData`
- Display: ~1–3 carrier periods (auto-scale window based on dominant frequency)
- AM mode: overlay envelope from modulator math (not from rectified signal — pedagogically correct)
- Grid: optional horizontal center line, vertical time divisions

### Spectrum

- Source: `AnalyserNode.getFloatFrequencyData` (FFT size 2048 or 4096)
- Window: Hann (via AnalyserNode default or custom if needed)
- dB scale on Y-axis (relative, auto-normalized to peak)
- Peak detection: simple local-max finder for annotation labels
- Log-ish frequency axis optional v1.1; v1 uses linear 0–5 kHz default view

### Render Loop

- Single `requestAnimationFrame` loop reads analyser once, updates both canvases
- Pause drawing when stopped (optional: freeze last frame)

## Export

### WAV

- `OfflineAudioContext` rebuilds current graph params
- Duration: user-selectable 1 / 3 / 5 seconds (default 3)
- Sample rate: 44100
- Save via Electron `dialog.showSaveDialog` → write buffer as 16-bit PCM WAV

### Screenshot

- Composite both canvases + mode label + key params into offscreen canvas
- Save as PNG via save dialog

## Tech Stack

| Layer | Choice |
|-------|--------|
| Shell | Electron 33+ |
| Build | Vite + electron-vite or vite-plugin-electron |
| UI | React 19, TypeScript |
| Styling | CSS modules or Tailwind (minimal) |
| Audio | Web Audio API, AudioWorklet for FM |
| Viz | Canvas 2D |
| Packaging | electron-builder |
| Tests | Vitest for DSP math; manual audio QA |

## Project Structure

```
e10d-waveplay/
├── electron/
│   ├── main.ts
│   └── preload.ts          # contextBridge: saveFile dialog only
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── audio/
│   │   ├── SignalGraph.ts
│   │   ├── worklets/fm-processor.ts
│   │   └── types.ts
│   ├── viz/
│   │   ├── ScopeRenderer.ts
│   │   └── SpectrumRenderer.ts
│   ├── components/
│   │   ├── Scope.tsx
│   │   ├── Spectrum.tsx
│   │   ├── Controls/
│   │   └── PresetPicker.tsx
│   ├── presets/*.json
│   ├── export/ExportService.ts
│   └── hooks/useSignalGraph.ts
├── docs/superpowers/specs/
├── package.json
├── vite.config.ts
└── electron-builder.yml
```

## Data Flow

1. User selects mode → `SignalGraph` disposes old nodes, builds new graph
2. Slider change → update AudioParam (smooth) or worklet port message
3. `AnalyserNode` tapped post-gain, pre-destination
4. rAF loop → read buffers → render canvases
5. Preset load → set React state → `SignalGraph.rebuild(params)`
6. Export → clone params → OfflineAudioContext offline render → IPC save

## Error Handling

| Case | Behavior |
|------|----------|
| AudioContext suspended | Auto-resume on Play click; show hint if blocked |
| Invalid param (freq ≤ 0) | Clamp to min; show inline validation |
| Export cancelled | Silent no-op |
| Worklet load fail | Fallback message; FM mode disabled |

## Security

- `contextIsolation: true`, no `nodeIntegration` in renderer
- Preload exposes only `saveFile(path, buffer)` IPC
- No remote content; `webSecurity: true`

## Testing Strategy

- **Unit:** AM envelope formula, FM phase step, peak detection, WAV header writer
- **Manual:** each preset audibly matches expectation; sidebands visible at AM 100%
- **Smoke:** app launches, play tone, export WAV opens in Audacity

## Implementation Phases

1. **Scaffold** — Electron + Vite + React, empty window
2. **Basic mode** — oscillator, scope, spectrum, play/stop
3. **AM + FM + Mix** — modes + worklet
4. **Presets** — JSON loader + analogy panel
5. **Export** — WAV + screenshot
6. **Polish** — theme, keyboard shortcuts, README

## Open Questions (resolved)

| Question | Decision |
|----------|----------|
| React vs vanilla | React |
| Sandbox vs guided | Both (C) |
| All 6 features in v1 | Yes |
| Native audio vs Web Audio | Web Audio |

## Future (post-v1)

- Waterfall spectrogram (WebGL)
- SSB demonstration (hilbert transform)
- Quiz mode ("what modulation is this?")
- Adjustable frequency axis zoom
