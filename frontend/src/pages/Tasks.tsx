import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import TaskPanel from '@/components/shared/TaskPanel'
import { useTasks } from '@/hooks/useTasks'

export default function Tasks() {
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  // Single query keyed on scope — stats and the list below both read from it,
  // so "Assigned to me" actually filters what's shown, not just the counts.
  const { data: tasks = [] } = useTasks(scope === 'mine' ? { mine: true } : {})

  const stat = (s: string) => tasks.filter(t => t.status === s).length

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <CheckSquare size={20} color="#5D78FF" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Tasks</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['all', 'mine'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none',
              background: scope === s ? '#5D78FF' : '#F4F5F9', color: scope === s ? '#fff' : '#555',
            }}>{s === 'all' ? 'All Tasks' : 'Assigned to me'}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: tasks.length, color: '#5D78FF' },
          { label: 'Pending', value: stat('Pending'), color: '#FF9B52' },
          { label: 'In Progress', value: stat('InProgress'), color: '#5D78FF' },
          { label: 'On Hold', value: stat('OnHold'), color: '#8C8C8C' },
          { label: 'Submitted', value: stat('Submitted'), color: '#A855F7' },
          { label: 'Done', value: stat('Done'), color: '#2BC155' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <TaskPanel title={scope === 'mine' ? 'My Tasks' : 'All Tasks'} mine={scope === 'mine'} />
    </div>
  )
}
