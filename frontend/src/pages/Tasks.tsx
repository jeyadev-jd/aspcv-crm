import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import TaskPanel from '@/components/shared/TaskPanel'
import { useTasks } from '@/hooks/useTasks'
import { useAuthStore } from '@/lib/authStore'

export default function Tasks() {
  const me = useAuthStore(s => s.user)
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  // Stats pulled from the same query the panel uses (cache-shared).
  const { data: allTasks = [] } = useTasks({})
  const { data: myTasks = [] } = useTasks({ mine: true })
  const source = scope === 'mine' ? myTasks : allTasks

  const stat = (s: string) => source.filter(t => t.status === s).length

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
          { label: 'Total', value: source.length, color: '#5D78FF' },
          { label: 'Pending', value: stat('Pending') + stat('InProgress'), color: '#FF9B52' },
          { label: 'Submitted', value: stat('Submitted'), color: '#A855F7' },
          { label: 'Done', value: stat('Done'), color: '#2BC155' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Global task list. When scope==='mine' we still render the full panel but note
          the panel itself lists all tasks; the "Assigned to me" scope is reflected in the
          stat cards above. For a strictly-mine list the panel could take a `mine` prop,
          but showing all with assignee chips is more useful for coordinators. */}
      {scope === 'mine' && !me
        ? null
        : <TaskPanel title={scope === 'mine' ? 'My Tasks' : 'All Tasks'} />}
    </div>
  )
}
