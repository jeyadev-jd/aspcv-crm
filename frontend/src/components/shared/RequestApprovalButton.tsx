import { useState } from 'react'
import { api } from '../../lib/api'

interface Props {
  entityType: string
  entityId: string
  action: 'edit' | 'delete'
  payload?: Record<string, unknown>
  label?: string
}

export function RequestApprovalButton({ entityType, entityId, action, payload, label }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

  async function handleRequest() {
    setStatus('loading')
    try {
      await api.post('/approval-requests', { entityType, entityId, action, payload })
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') return <span style={{ fontSize: 12, color: '#888' }}>Approval request sent</span>

  return (
    <button
      onClick={handleRequest}
      disabled={status === 'loading'}
      style={{
        padding: '4px 10px',
        fontSize: 12,
        background: '#f4f5f9',
        border: '1px solid #ddd',
        borderRadius: 6,
        cursor: 'pointer',
        color: status === 'error' ? '#e53e3e' : '#555',
      }}
    >
      {status === 'error' ? 'Failed — retry' : status === 'loading' ? '...' : (label ?? `Request ${action}`)}
    </button>
  )
}
