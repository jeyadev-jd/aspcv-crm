import { Clock, UserPlus, RefreshCw, MessageSquare, ArrowRight } from 'lucide-react'
import { useTimeline } from '@/hooks/useTimeline'

const EVENT_ICONS: Record<string, React.ReactNode> = {
  CREATED: <UserPlus size={13} />,
  UPDATED: <RefreshCw size={13} />,
  STATUS_CHANGED: <ArrowRight size={13} />,
  STAGE_CHANGED: <ArrowRight size={13} />,
  DISCUSSION_ADDED: <MessageSquare size={13} />,
}

const EVENT_COLORS: Record<string, string> = {
  CREATED: '#10b981',
  UPDATED: '#3b82f6',
  STATUS_CHANGED: '#f59e0b',
  STAGE_CHANGED: '#8b5cf6',
  DISCUSSION_ADDED: '#06b6d4',
}

interface Props {
  entityType: string
  entityId: string
}

export default function TimelinePanel({ entityType, entityId }: Props) {
  const { data: events = [], isLoading } = useTimeline(entityType, entityId)

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 12 }}>
        <Clock size={16} /> Activity Timeline ({events.length})
      </div>
      {isLoading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>}
      {!isLoading && events.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No activity yet</div>
      )}
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        {events.length > 0 && <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: '#f1f5f9' }} />}
        {events.map(e => (
          <div key={e.id} style={{ position: 'relative', marginBottom: 12, paddingLeft: 16 }}>
            <div style={{
              position: 'absolute', left: -13, top: 2,
              width: 20, height: 20, borderRadius: '50%',
              background: EVENT_COLORS[e.eventType] || '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', zIndex: 1
            }}>
              {EVENT_ICONS[e.eventType] || <Clock size={10} />}
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 13, color: '#374151' }}>{e.description}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
