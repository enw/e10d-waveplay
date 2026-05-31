import type { SuperhetStage } from '@/audio/types'

const STAGES: { id: SuperhetStage; label: string }[] = [
  { id: 'rf', label: 'RF' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'if', label: 'IF' },
  { id: 'demod', label: 'Demod' },
  { id: 'audio', label: 'Audio' }
]

interface SuperhetDiagramProps {
  stage: SuperhetStage
  onStageChange: (stage: SuperhetStage) => void
}

export default function SuperhetDiagram({ stage, onStageChange }: SuperhetDiagramProps) {
  return (
    <div className="superhet-diagram" role="tablist" aria-label="Superhet signal chain">
      {STAGES.map((s, i) => (
        <div key={s.id} className="superhet-diagram__segment">
          <button
            type="button"
            role="tab"
            aria-selected={stage === s.id}
            className={stage === s.id ? 'superhet-block active' : 'superhet-block'}
            onClick={() => onStageChange(s.id)}
          >
            {s.label}
          </button>
          {i < STAGES.length - 1 && <span className="superhet-arrow">→</span>}
        </div>
      ))}
    </div>
  )
}
