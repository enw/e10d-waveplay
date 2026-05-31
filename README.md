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

- **Basic waveforms** — sine, square, triangle, saw (20 Hz–4 kHz)
- **AM** — carrier, modulator, modulation index; envelope on scope; sideband labels
- **FM** — deviation in Hz; spectrum annotations
- **Mix** — sum (beat) or product (ring mod)
- **Scope + spectrum** — real-time dual visualization
- **8 presets** — radio-themed scenarios with RF analogy notes
- **Export** — WAV (1/3/5 s) and PNG screenshot

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Electron dev with hot reload |
| `pnpm build` | Production build |
| `pnpm package` | Build + electron-builder distributable |
| `pnpm test` | Vitest unit tests |

## Docs

- Design spec: [`docs/superpowers/specs/2026-05-31-waveplay-design.md`](docs/superpowers/specs/2026-05-31-waveplay-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-31-waveplay-implementation.md`](docs/superpowers/plans/2026-05-31-waveplay-implementation.md)

## Tech

Electron · Vite · React · TypeScript · Web Audio API · Canvas 2D

## License

TBD
