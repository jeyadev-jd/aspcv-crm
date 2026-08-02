import { Check } from 'lucide-react'

const STAGES = [
  { key: 'Lead',          label: 'Lead' },
  { key: 'QualifiedLead', label: 'Qualified' },
  { key: 'Deal',          label: 'Deal' },
  { key: 'Project',       label: 'Project' },
  { key: 'Installation',  label: 'Install' },
  { key: 'Support',       label: 'Support' },
] as const

type Stage = typeof STAGES[number]['key']

interface Props {
  current: Stage
  completedUpto?: Stage
  onStageClick?: (stage: Stage) => void
}

const stageIndex = (s: Stage) => STAGES.findIndex(x => x.key === s)

export default function LifecycleTimeline({ current, completedUpto, onStageClick }: Props) {
  const currentIdx = stageIndex(current)
  const completedIdx = completedUpto ? stageIndex(completedUpto) : currentIdx - 1

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '4px 0' }}>
      {STAGES.map((stage, i) => {
        const isDone = i <= completedIdx
        const isCurrent = i === currentIdx

        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* Node */}
            <div
              onClick={() => onStageClick?.(stage.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: onStageClick ? 'pointer' : 'default',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? '#22C55E' : isCurrent ? '#5D78FF' : '#F0F1F5',
                border: isCurrent ? '2px solid #5D78FF' : isDone ? '2px solid #22C55E' : '2px solid #E2E8F0',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}>
                {isDone
                  ? <Check size={12} style={{ color: '#fff', strokeWidth: 3 }} />
                  : <span style={{ fontSize: 10, fontWeight: 700, color: isCurrent ? '#fff' : '#B1B1BE' }}>{i + 1}</span>
                }
              </div>
              <span style={{
                fontSize: 9, fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? '#5D78FF' : isDone ? '#22C55E' : '#B1B1BE',
                whiteSpace: 'nowrap',
              }}>
                {stage.label}
              </span>
            </div>

            {/* Connector */}
            {i < STAGES.length - 1 && (
              <div style={{
                width: 32, height: 2,
                background: i < currentIdx ? '#22C55E' : '#E2E8F0',
                marginBottom: 16,
                flexShrink: 0,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
