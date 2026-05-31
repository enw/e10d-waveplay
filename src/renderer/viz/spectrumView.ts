export const SPECTRUM_MAX_HZ = 5000
export const MIN_SPAN_HZ = 50

export interface SpectrumView {
  minHz: number
  maxHz: number
}

export function defaultSpectrumView(): SpectrumView {
  return { minHz: 0, maxHz: SPECTRUM_MAX_HZ }
}

export function viewSpan(view: SpectrumView): number {
  return view.maxHz - view.minHz
}

export function clampView(view: SpectrumView): SpectrumView {
  let span = Math.max(MIN_SPAN_HZ, Math.min(SPECTRUM_MAX_HZ, viewSpan(view)))
  const center = (view.minHz + view.maxHz) / 2
  let minHz = center - span / 2
  let maxHz = center + span / 2
  if (minHz < 0) {
    minHz = 0
    maxHz = span
  }
  if (maxHz > SPECTRUM_MAX_HZ) {
    maxHz = SPECTRUM_MAX_HZ
    minHz = maxHz - span
  }
  return { minHz, maxHz }
}

export function zoomToCenter(_view: SpectrumView, centerHz: number, spanHz: number): SpectrumView {
  return clampView({
    minHz: centerHz - spanHz / 2,
    maxHz: centerHz + spanHz / 2
  })
}

export function zoomIn(view: SpectrumView): SpectrumView {
  const center = (view.minHz + view.maxHz) / 2
  return zoomToCenter(view, center, viewSpan(view) / 2)
}

export function zoomOut(view: SpectrumView): SpectrumView {
  const center = (view.minHz + view.maxHz) / 2
  return zoomToCenter(view, center, viewSpan(view) * 2)
}

export function pan(view: SpectrumView, deltaHz: number): SpectrumView {
  return clampView({
    minHz: view.minHz + deltaHz,
    maxHz: view.maxHz + deltaHz
  })
}

export function xToFreq(x: number, width: number, view: SpectrumView): number {
  if (width <= 0) return view.minHz
  return view.minHz + (x / width) * viewSpan(view)
}

export function freqToX(freq: number, width: number, view: SpectrumView): number {
  const span = viewSpan(view)
  if (span <= 0) return 0
  return ((freq - view.minHz) / span) * width
}

export function formatViewRange(view: SpectrumView): string {
  const min = Math.round(view.minHz)
  const max = Math.round(view.maxHz)
  return `view: ${min}–${max} Hz`
}
