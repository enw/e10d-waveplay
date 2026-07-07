import type { SignalMode, SignalState } from '@/audio/types'
import { mergePresetParams } from '@/audio/types'
import type { Preset } from '@/presets'
import { PRESETS } from '@/presets'

export type QuizPhase = 'idle' | 'listen' | 'guess' | 'reveal'

export interface QuizSession {
  phase: QuizPhase
  score: number
  streak: number
  bestStreak: number
  total: number
  correct: number
  currentPreset: Preset | null
  guess: SignalMode | null
  lastCorrect: boolean | null
}

export const QUIZ_GUESS_MODES: { id: SignalMode; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'am', label: 'AM' },
  { id: 'fm', label: 'FM' },
  { id: 'mix', label: 'Mix' },
  { id: 'cw', label: 'CW' },
  { id: 'ssb', label: 'SSB' }
]

export function initialQuizSession(): QuizSession {
  return {
    phase: 'idle',
    score: 0,
    streak: 0,
    bestStreak: 0,
    total: 0,
    correct: 0,
    currentPreset: null,
    guess: null,
    lastCorrect: null
  }
}

export function pickRandomPreset(excludeId?: string): Preset {
  const pool = excludeId ? PRESETS.filter((p) => p.id !== excludeId) : PRESETS
  return pool[Math.floor(Math.random() * pool.length)] ?? PRESETS[0]
}

export function applyPresetToState(state: SignalState, preset: Preset): SignalState {
  let next: SignalState = {
    ...state,
    mode: preset.mode,
    [preset.mode]: mergePresetParams(preset.mode, preset.params)
  } as SignalState
  if (preset.filter) {
    next = { ...next, filter: { ...next.filter, ...preset.filter } }
  }
  if (preset.noise) {
    next = { ...next, noise: { ...next.noise, ...preset.noise } }
  }
  return next
}

export function submitGuess(session: QuizSession, guess: SignalMode): QuizSession {
  if (!session.currentPreset || session.phase !== 'guess') return session
  const correct = guess === session.currentPreset.mode
  const streak = correct ? session.streak + 1 : 0
  return {
    ...session,
    phase: 'reveal',
    guess,
    lastCorrect: correct,
    total: session.total + 1,
    correct: session.correct + (correct ? 1 : 0),
    score: session.score + (correct ? 10 + session.streak * 2 : 0),
    streak,
    bestStreak: Math.max(session.bestStreak, streak)
  }
}

export function startQuestion(session: QuizSession, preset: Preset): QuizSession {
  return {
    ...session,
    phase: 'listen',
    currentPreset: preset,
    guess: null,
    lastCorrect: null
  }
}

export function advanceToGuess(session: QuizSession): QuizSession {
  if (session.phase !== 'listen') return session
  return { ...session, phase: 'guess' }
}

export function modeLabel(mode: SignalMode): string {
  return QUIZ_GUESS_MODES.find((m) => m.id === mode)?.label ?? mode
}
