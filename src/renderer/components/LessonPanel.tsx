import type { SignalState, SuperhetStage } from '../audio/types'
import {
  advanceStep,
  applyStepState,
  checkStep,
  currentStep,
  getLesson,
  initialLessonSession,
  LESSONS,
  startLesson,
  type Lesson,
  type LessonSession
} from '../lessons'

export interface LessonPanelProps {
  session: LessonSession
  state: SignalState
  superhetStage: SuperhetStage
  onSessionChange: (session: LessonSession) => void
  onApplyState: (state: SignalState) => void
  onExit: () => void
}

export default function LessonPanel({
  session,
  state,
  superhetStage,
  onSessionChange,
  onApplyState,
  onExit
}: LessonPanelProps) {
  const lesson = session.lessonId ? getLesson(session.lessonId) : null
  const step = lesson ? currentStep(lesson, session) : null

  const pickLesson = (l: Lesson): void => {
    const first = l.steps[0]
    let nextState = state
    if (first?.applyState) {
      nextState = applyStepState(state, first)
      onApplyState(nextState)
    }
    onSessionChange(startLesson(l))
  }

  const handleAdvance = (): void => {
    if (!lesson) return
    const nextSession = advanceStep(lesson, session)
    const nextStep = currentStep(lesson, nextSession)
    if (nextStep?.applyState) {
      onApplyState(applyStepState(state, nextStep))
    }
    onSessionChange(nextSession)
  }

  if (!lesson) {
    return (
      <div className="lesson-panel">
        <div className="lesson-header">
          <h2 className="lesson-title">Guided lessons</h2>
          <button type="button" className="btn btn-sm" onClick={onExit}>
            Back to Study
          </button>
        </div>
        <p className="lesson-intro">
          Step-by-step paths with checkpoints. Complete each task to advance.
        </p>
        <ul className="lesson-list">
          {LESSONS.map((l) => (
            <li key={l.id}>
              <button type="button" className="lesson-card" onClick={() => pickLesson(l)}>
                <strong>{l.title}</strong>
                <span>{l.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (session.completed) {
    return (
      <div className="lesson-panel">
        <div className="lesson-header">
          <h2 className="lesson-title">{lesson.title} — complete</h2>
          <button type="button" className="btn btn-sm" onClick={onExit}>
            Back to Study
          </button>
        </div>
        <p className="lesson-done">{lesson.rfAnalogy}</p>
        <div className="lesson-actions">
          <button type="button" className="btn primary" onClick={() => pickLesson(lesson)}>
            Restart lesson
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onSessionChange(initialLessonSession())}
          >
            All lessons
          </button>
        </div>
      </div>
    )
  }

  const progress = `${session.stepIndex + 1} / ${lesson.steps.length}`

  return (
    <div className="lesson-panel">
      <div className="lesson-header">
        <div>
          <h2 className="lesson-title">{lesson.title}</h2>
          <span className="lesson-progress">{progress}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onExit}>
          Exit
        </button>
      </div>
      <p className="lesson-rf">{lesson.rfAnalogy}</p>
      {step && (
        <>
          <p className="lesson-step">{step.instruction}</p>
          {step.hint && !session.stepComplete && (
            <p className="lesson-hint">Hint: {step.hint}</p>
          )}
          {session.stepComplete ? (
            <div className="lesson-actions">
              <p className="lesson-ok">Step complete</p>
              <button type="button" className="btn primary" onClick={handleAdvance}>
                Next
              </button>
            </div>
          ) : (
            <p className="lesson-wait">Complete the step above to continue.</p>
          )}
        </>
      )}
    </div>
  )
}

export { checkStep, initialLessonSession, type LessonSession }
