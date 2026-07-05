import type { SignalMode, SignalState, SuperhetStage } from '../audio/types'

export interface LessonContext {
  superhetStage?: SuperhetStage
  tonetextDecoded?: string
}

export interface LessonStep {
  id: string
  instruction: string
  hint?: string
  applyState?: Partial<SignalState> & {
    mode?: SignalMode
    am?: Partial<SignalState['am']>
    ssb?: Partial<SignalState['ssb']>
    filter?: Partial<SignalState['filter']>
    superhet?: Partial<SignalState['superhet']>
    noise?: Partial<SignalState['noise']>
    tonetext?: Partial<SignalState['tonetext']>
  }
  validate: (state: SignalState, ctx: LessonContext) => boolean
}

export interface Lesson {
  id: string
  title: string
  description: string
  rfAnalogy: string
  steps: LessonStep[]
}

export interface LessonSession {
  lessonId: string | null
  stepIndex: number
  completed: boolean
  stepComplete: boolean
}

export function initialLessonSession(): LessonSession {
  return { lessonId: null, stepIndex: 0, completed: false, stepComplete: false }
}

export function startLesson(lesson: Lesson): LessonSession {
  return { lessonId: lesson.id, stepIndex: 0, completed: false, stepComplete: false }
}

export function currentStep(lesson: Lesson, session: LessonSession): LessonStep | null {
  if (session.completed) return null
  return lesson.steps[session.stepIndex] ?? null
}

export function checkStep(
  lesson: Lesson,
  session: LessonSession,
  state: SignalState,
  ctx: LessonContext
): LessonSession {
  if (session.completed || !session.lessonId) return session
  const step = lesson.steps[session.stepIndex]
  if (!step) return { ...session, completed: true }
  const ok = step.validate(state, ctx)
  return { ...session, stepComplete: ok }
}

export function advanceStep(lesson: Lesson, session: LessonSession): LessonSession {
  if (!session.stepComplete || session.completed) return session
  const next = session.stepIndex + 1
  if (next >= lesson.steps.length) {
    return { ...session, completed: true, stepComplete: false }
  }
  return { lessonId: session.lessonId, stepIndex: next, completed: false, stepComplete: false }
}

export function applyStepState(state: SignalState, step: LessonStep): SignalState {
  if (!step.applyState) return state
  const patch = step.applyState
  let next: SignalState = { ...state, ...patch }
  if (patch.am) next = { ...next, am: { ...next.am, ...patch.am } }
  if (patch.ssb) next = { ...next, ssb: { ...next.ssb, ...patch.ssb } }
  if (patch.filter) next = { ...next, filter: { ...next.filter, ...patch.filter } }
  if (patch.superhet) next = { ...next, superhet: { ...next.superhet, ...patch.superhet } }
  if (patch.noise) next = { ...next, noise: { ...next.noise, ...patch.noise } }
  if (patch.tonetext) next = { ...next, tonetext: { ...next.tonetext, ...patch.tonetext } }
  if (patch.mode) next = { ...next, mode: patch.mode }
  return next
}

export { LESSONS, getLesson } from './catalog'
