# WavePlay

A client-only desktop lab for **hearing and seeing** radio-style wave concepts in the audio band. Built for amateur-radio learners who want intuition for carriers, modulation, sidebands, and heterodyning.

Everything runs locally in **Electron**. No account, no network.

## Quick start

```bash
pnpm install
pnpm dev
```

Click **Play** to start the audio context, then try presets or tweak controls.

## Features

### Core (v1)

- **Basic waveforms** — sine, square, triangle, saw (20 Hz–4 kHz)
- **AM / FM / Mix / CW / SSB** — modulation modes with scope + spectrum labels
- **Waterfall + zoomable spectrum**
- **Quiz mode** — identify modulation from audio + viz
- **Export** — WAV (1/3/5 s) and PNG screenshot

### v3 lab extensions

- **Mic modulator** — speak into AM, FM, or SSB; live sidebands from your voice
- **Parameter sweeps** — animate modulation index, deviation, filter BW, LO, etc.
- **IF bandpass filter** — overlay on any mode; ghost response on spectrum
- **Superheterodyne chain** — RF → Mixer → IF → Demod block diagram with stage-selectable viz

### v4 lab extensions

- **Constellation / phasor view** — I/Q plane for AM, FM, SSB, and Mix
- **Noise & QRM lab** — AWGN, adjacent-channel QRM, and 60 Hz hum
- **Guided lessons** — checkpoint-based paths (sidebands, SSB vs AM, filters, superhet, noise)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Electron dev with hot reload |
| `pnpm build` | Production build |
| `pnpm package` | Build + electron-builder distributable |
| `pnpm test` | Vitest unit tests |

## Docs

- v1 spec: [`docs/superpowers/specs/2026-05-31-waveplay-design.md`](docs/superpowers/specs/2026-05-31-waveplay-design.md)
- v3 spec: [`docs/superpowers/specs/2026-05-31-waveplay-v3-design.md`](docs/superpowers/specs/2026-05-31-waveplay-v3-design.md)
- v3 plan: [`docs/superpowers/plans/2026-05-31-waveplay-v3-implementation.md`](docs/superpowers/plans/2026-05-31-waveplay-v3-implementation.md)

## Tech

Electron · Vite · React · TypeScript · Web Audio API · Canvas 2D

## License

TBD
