import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/authStore'
import {
  ClipboardCheck, CheckCircle, XCircle, Clock, UserPlus,
  AlertCircle, User, Calendar,
} from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

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
  escalationTier: number
  lastEscalatedAt: string
  currentReviewerRole?: string
}

const TIER_LABEL = ['Manager', 'Project Head', 'Business Head', 'Super Admin']

const STATUS_META: Record<string, { color: string; bg: string; Icon: React.ElementType; label: string }> = {
  pending:  { color: '#F59E0B', bg: '#FFFBEB', Icon: Clock,        label: 'Pending' },
  approved: { color: '#22C55E', bg: '#F0FDF4', Icon: CheckCircle,  label: 'Approved' },
  rejected: { color: '#EF4444', bg: '#FEF2F2', Icon: XCircle,      label: 'Rejected' },
  used:     { color: '#94A3B8', bg: '#F8FAFC', Icon: AlertCircle,  label: 'Used' },
}

function typeLabel(entityType: string, action: string) {
  if (entityType === 'hr_user' && action === 'activate') return 'New Employee Activation'
  return `${action.replace(/_/g, ' ')} — ${entityType.replace(/_/g, ' ')}`
}

export default function Approvals() {
  const qc = useQueryClient()
  const can = useAuthStore(s => s.can)
  const canReview = can('approval_request', 'review')
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: requests = [], isLoading, isError, refetch } = useQuery<ApprovalReq[]>({
    queryKey: ['approval-requests', filter],
    queryFn: () =>
      api.get('/approval-requests', { params: filter === 'pending' ? { status: 'pending' } : {} }).then(r => r.data),
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/approval-requests/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-requests'] }),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/approval-requests/${id}/reject`, { rejectReason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approval-requests'] })
      setRejectId(null)
      setRejectReason('')
    },
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <ClipboardCheck size={20} color="#5D78FF" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Approval Requests</h1>
        {pendingCount > 0 && filter === 'all' && (
          <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#D97706', borderRadius: 20, padding: '2px 10px' }}>
            {pendingCount} pending
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['pending', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
              cursor: 'pointer', border: 'none',
              background: filter === f ? '#5D78FF' : '#f4f5f9',
              color: filter === f ? '#fff' : '#555',
            }}>
              {f === 'pending' ? 'Pending' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: '#999', fontSize: 14 }}>Loading…</p>
      ) : isError ? (
        <EmptyState icon={AlertCircle} title="Failed to load approval requests" subtitle="Something went wrong fetching this data."
          action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 12, border: '1px solid #f0f1f5' }}>
          <CheckCircle size={32} color="#22C55E" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: '#374557', fontWeight: 600, margin: '0 0 4px' }}>All clear</p>
          <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>No pending approval requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map(req => {
            const sm = STATUS_META[req.status] ?? STATUS_META.used
            const StatusIcon = sm.Icon
            const isHrActivate = req.entityType === 'hr_user' && req.action === 'activate'

            return (
              <div key={req.id} style={{
                background: '#fff',
                border: `1px solid ${req.status === 'pending' ? '#e0e7ff' : '#f0f1f5'}`,
                borderLeft: `4px solid ${sm.color}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                {/* Main row */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>

                    {/* Icon */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                      background: isHrActivate ? '#EEF2FF' : '#f4f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isHrActivate
                        ? <UserPlus size={18} color="#5D78FF" />
                        : <AlertCircle size={18} color="#94A3B8" />
                      }
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      {/* Type + Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>
                          {typeLabel(req.entityType, req.action)}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: sm.bg, color: sm.color,
                        }}>
                          <StatusIcon size={9} />
                          {sm.label}
                        </span>
                        {req.status === 'pending' && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: req.escalationTier > 0 ? '#FEF2F2' : '#EEF2FF',
                            color: req.escalationTier > 0 ? '#EF4444' : '#5D78FF',
                          }}>
                            With: {TIER_LABEL[req.escalationTier] ?? req.currentReviewerRole}
                            {req.escalationTier > 0 && ' (escalated)'}
                          </span>
                        )}
                      </div>

                      {/* Reason / detail */}
                      {req.reason && (
                        <p style={{ fontSize: 12, color: '#555', margin: '0 0 6px', lineHeight: 1.5 }}>
                          {req.reason}
                        </p>
                      )}

                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94A3B8' }}>
                          <User size={11} />
                          {req.requestedBy?.name} &middot; {req.requestedBy?.roleName}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94A3B8' }}>
                          <Calendar size={11} />
                          {new Date(req.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {req.reviewedBy && (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>
                            Reviewed by {req.reviewedBy.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {req.status === 'pending' && canReview && (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <button
                          onClick={() => { if (confirm(`Approve this request? ${typeLabel(req.entityType, req.action)}`)) approve.mutate(req.id) }}
                          disabled={approve.isPending}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '8px 16px', background: '#22C55E', color: '#fff',
                            border: 'none', borderRadius: 8, cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, opacity: approve.isPending ? 0.6 : 1,
                          }}
                        >
                          <CheckCircle size={13} /> Approve
                        </button>
                        <button
                          onClick={() => setRejectId(rejectId === req.id ? null : req.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '8px 14px', background: '#FEF2F2', color: '#EF4444',
                            border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer',
                            fontSize: 12, fontWeight: 600,
                          }}
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reject reason input */}
                {rejectId === req.id && (
                  <div style={{ borderTop: '1px solid #fef2f2', background: '#fff8f8', padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      style={{ flex: 1, minWidth: 200, border: '1px solid #FECACA', borderRadius: 6, padding: '7px 10px', fontSize: 12, outline: 'none' }}
                    />
                    <button
                      onClick={() => reject.mutate({ id: req.id, reason: rejectReason })}
                      style={{ padding: '7px 16px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => { setRejectId(null); setRejectReason('') }}
                      style={{ padding: '7px 12px', background: '#f4f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#555' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
