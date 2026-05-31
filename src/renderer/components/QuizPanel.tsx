import type { QuizSession } from '@/quiz/quizEngine'
import { modeLabel, QUIZ_GUESS_MODES } from '@/quiz/quizEngine'
import type { SignalMode } from '@/audio/types'

export interface QuizPanelProps {
  session: QuizSession
  onStart: () => void
  onGuess: (mode: SignalMode) => void
  onNext: () => void
  onExit: () => void
}

export default function QuizPanel({ session, onStart, onGuess, onNext, onExit }: QuizPanelProps) {
  const { phase, score, streak, bestStreak, total, correct, currentPreset, guess, lastCorrect } =
    session

  return (
    <div className="quiz-panel">
      <div className="quiz-header">
        <span className="quiz-score">
          Score {score} · Streak {streak} · Best {bestStreak}
          {total > 0 && ` · ${correct}/${total} correct`}
        </span>
        <button type="button" className="btn btn-sm" onClick={onExit}>
          Exit quiz
        </button>
      </div>

      {phase === 'idle' && (
        <div className="quiz-body">
          <p>Listen to a hidden signal, then identify the modulation type.</p>
          <button type="button" className="btn primary" onClick={onStart}>
            Start question
          </button>
        </div>
      )}

      {phase === 'listen' && (
        <div className="quiz-body">
          <p className="quiz-prompt">Listen… identify the modulation.</p>
          <p className="quiz-sub">Scope, spectrum, and waterfall are live — mode hidden.</p>
        </div>
      )}

      {phase === 'guess' && (
        <div className="quiz-body">
          <p className="quiz-prompt">What modulation is this?</p>
          <div className="quiz-guess-grid">
            {QUIZ_GUESS_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn quiz-guess-btn"
                onClick={() => onGuess(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'reveal' && currentPreset && (
        <div className="quiz-body">
          <p className={lastCorrect ? 'quiz-result ok' : 'quiz-result bad'}>
            {lastCorrect ? 'Correct!' : 'Not quite.'} Answer:{' '}
            <strong>{modeLabel(currentPreset.mode)}</strong>
            {guess && !lastCorrect && ` (you said ${modeLabel(guess)})`}
          </p>
          <p className="quiz-analogy">{currentPreset.rfAnalogy}</p>
          <button type="button" className="btn primary" onClick={onNext}>
            Next question
          </button>
        </div>
      )}
    </div>
  )
}
