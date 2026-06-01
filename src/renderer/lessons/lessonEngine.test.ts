import { describe, expect, it } from 'vitest'
import { advanceStep, checkStep, startLesson } from './lessonEngine'
import { LESSONS } from './catalog'
import { defaultSignalState } from '../audio/types'

describe('lessonEngine', () => {
  it('marks AM mode step complete', () => {
    const lesson = LESSONS[0]!
    let session = startLesson(lesson)
    const state = defaultSignalState()
    session = checkStep(lesson, session, { ...state, mode: 'am' }, {})
    expect(session.stepComplete).toBe(true)
  })

  it('advances to next step', () => {
    const lesson = LESSONS[0]!
    let session = startLesson(lesson)
    session = { ...session, stepComplete: true }
    session = advanceStep(lesson, session)
    expect(session.stepIndex).toBe(1)
    expect(session.stepComplete).toBe(false)
  })

  it('completes lesson after final step', () => {
    const lesson = LESSONS[0]!
    let session = startLesson(lesson)
    session = { ...session, stepIndex: lesson.steps.length - 1, stepComplete: true }
    session = advanceStep(lesson, session)
    expect(session.completed).toBe(true)
  })
})
