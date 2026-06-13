import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ClipboardCheck, CheckCircle, XCircle } from 'lucide-react'

interface ApprovalReq {
  id: string
  entityType: string
  entityId: string
  action: string
  status: string
  reason: string | null
  createdAt: string
  expiresAt: string | null
  requestedBy: { id: string; name: string; roleName: string }
  reviewedBy?: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  approved: '#22C55E',
  rejected: '#EF4444',
  used: '#94A3B8',
}

export default function Approvals() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: requests = [], isLoading } = useQuery<ApprovalReq[]>({
    queryKey: ['approval-requests', filter],
    queryFn: () => api.get('/approval-requests', { params: filter === 'pending' ? { status: 'pending' } : {} }).then(r => r.data),
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/approval-requests/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-requests'] }),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/approval-requests/${id}/reject`, { rejectReason: reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-requests'] }); setRejectId(null); setRejectReason('') },
  })

  return (
    <div style={{ padding: '24px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <ClipboardCheck size={22} color="#5D78FF" />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#374557', margin: 0 }}>Approval Requests</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['pending', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none',
                background: filter === f ? '#5D78FF' : '#f4f5f9',
                color: filter === f ? '#fff' : '#555',
              }}
            >
              {f === 'pending' ? 'Pending' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p style={{ color: '#999', fontSize: 14 }}>Loading…</p> : requests.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: 14 }}>No requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(req => (
            <div key={req.id} style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                      background: STATUS_COLORS[req.status] + '20',
                      color: STATUS_COLORS[req.status],
                    }}>{req.status.toUpperCase()}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>
                      {req.entityType === 'hr_user' && req.action === 'activate' ? (
                        <>🔑 Activate User</>
                      ) : (
                        <>{req.action} on {req.entityType}</>
                      )}
                    </span>
                  </div>
                  {req.entityType === 'hr_user' && req.reason && (
                    <p style={{ fontSize: 12, color: '#555', margin: '0 0 4px', fontWeight: 500 }}>
                      📋 {req.reason}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: '#666', margin: '0 0 4px' }}>
                    Requested by <b>{req.requestedBy?.name}</b> ({req.requestedBy?.roleName})
                  </p>
                  {req.reason && <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{req.reason}</p>}
                  <p style={{ fontSize: 10, color: '#ccc', margin: '4px 0 0' }}>{new Date(req.createdAt).toLocaleString()}</p>
                </div>
                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => approve.mutate(req.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button
                      onClick={() => setRejectId(req.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#FEE2E2', color: '#EF4444', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                )}
              </div>
              {rejectId === req.id && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
                  />
                  <button
                    onClick={() => reject.mutate({ id: req.id, reason: rejectReason })}
                    style={{ padding: '6px 14px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setRejectId(null)}
                    style={{ padding: '6px 10px', background: '#f4f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#555' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
