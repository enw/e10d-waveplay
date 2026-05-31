# WavePlay

A client-only desktop lab for **hearing and seeing** radio-style wave concepts in the audio band. Built for amateur-radio learners who want intuition for carriers, modulation, sidebands, and heterodyning—without needing an SDR or RF bench.

Everything runs locally in **Electron**. No account, no network, no backend.

## Why audio instead of RF?

Concepts like AM sidebands, FM deviation, and beat frequencies are easier to grasp when you can **listen** at 1 kHz and **watch** a scope and spectrum update in real time. WavePlay keeps frequencies in the audible range (roughly 20 Hz–5 kHz for controls and display) and uses preset notes to map what you see to what happens on the air.

## Features (v1)

| Feature | What you get |
|---------|----------------|
| **Basic waveforms** | Sine, square, triangle, saw — frequency and amplitude controls |
| **AM** | Carrier + modulator, envelope overlay, sidebands labeled in the spectrum |
| **FM** | Carrier + modulator, deviation in Hz, Bessel sideband structure |
| **Mix / beat** | Two oscillators, sum or product (heterodyne / ring-mod intuition) |
| **Dual visualization** | Time-domain scope + FFT spectrum analyzer |
| **Presets + sandbox** | Free experimentation plus radio-themed scenarios with RF analogy blurbs |
| **Export** | Save WAV clips and PNG screenshots for study notes |

## Preset examples

- Pure **1 kHz** reference tone
- **AM at 100%** modulation — 1 kHz carrier, 100 Hz modulator
- **FM** narrow vs wide deviation
- **Beat frequency** — 1000 Hz + 1005 Hz → 5 Hz beat
- **CW intuition** — gated carrier (on/off keying, not Morse input)

## Tech stack

- [Electron](https://www.electronjs.org/) — desktop shell, native save dialogs
- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript — UI
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — synthesis and analysis
- Canvas 2D — scope and spectrum rendering

## Project status

**Design complete, implementation not started.**

Full spec: [`docs/superpowers/specs/2026-05-31-waveplay-design.md`](docs/superpowers/specs/2026-05-31-waveplay-design.md)

## Development

Setup and run instructions will be added when the Electron + Vite scaffold lands. Planned scripts:

```bash
npm install
npm run dev      # Electron + hot reload
npm run build    # Production build
npm run package  # Distributable app
```

## Out of scope (for now)

- SSB, phase modulation, digital modes
- Waterfall / spectrogram
- Real RF frequencies or SDR hardware
- Cloud sync or online features

## License

TBD
