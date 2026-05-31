import { describe, expect, it } from 'vitest'
import {
  applyPresetToState,
  initialQuizSession,
  pickRandomPreset,
  startQuestion,
  submitGuess
} from './quizEngine'
import { defaultSignalState } from '@/audio/types'

describe('quizEngine', () => {
  it('starts a question with preset mode', () => {
    const preset = pickRandomPreset()
    const session = startQuestion(initialQuizSession(), preset)
    expect(session.phase).toBe('listen')
    expect(session.currentPreset?.id).toBe(preset.id)
  })

  it('scores correct guess', () => {
    const preset = pickRandomPreset()
    let session = startQuestion(initialQuizSession(), preset)
    session = { ...session, phase: 'guess' }
    session = submitGuess(session, preset.mode)
    expect(session.lastCorrect).toBe(true)
    expect(session.correct).toBe(1)
    expect(session.score).toBeGreaterThan(0)
  })

  it('applies preset params to state', () => {
    const preset = pickRandomPreset()
    const next = applyPresetToState(defaultSignalState(), preset)
    expect(next.mode).toBe(preset.mode)
  })
})
