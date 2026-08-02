import { useState } from 'react'
import { Plus, X, Check, XCircle, Calendar } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface LeaveType {
  id: string; code: string; name: string; annualQuota: number; monthlyAccrual: number
  maxCarryForward: number; isEncashable: boolean; isPaidLeave: boolean; halfDayAllowed: boolean
  sandwichApplicable: boolean; requiresDocument: boolean
}
interface LeaveBalance {
  id: string; leaveTypeId: string; year: number; opening: number; accrued: number
  taken: number; balance: number; carryForward: number
  leaveType: { code: string; name: string; annualQuota: number }
}
interface LeaveRequest {
  id: string; userId: string; fromDate: string; toDate: string; totalDays: number
  halfDayDate?: string; halfDaySession?: string; reason: string; status: string
  sandwichDays: number; createdAt: string
  user?: { id: string; name: string; department?: { name: string } }
  leaveType: { code: string; name: string }
}
interface Holiday { id: string; name: string; date: string; type: string; isOptional: boolean }

const statusStyle: Record<string, { bg: string; color: string }> = {
  Pending:   { bg: '#FEF3C7', color: '#D97706' },
  Approved:  { bg: '#E7FAF0', color: '#2BC155' },
  Rejected:  { bg: '#FEE2E2', color: '#DC2626' },
  Cancelled: { bg: '#F4F5F9', color: '#6B7280' },
  Revoked:   { bg: '#FEE2E2', color: '#991B1B' },
}

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Leave() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'balance' | 'requests' | 'team' | 'holidays'>('balance')
  const [showApply, setShowApply] = useState(false)
  const [form, setForm] = useState({ leaveTypeId: '', fromDate: '', toDate: '', reason: '', halfDayDate: '', halfDaySession: '' })
  const [formErr, setFormErr] = useState('')

  const year = new Date().getFullYear()

  const user = JSON.parse(localStorage.getItem('crm_user') || '{}')
  const isAdmin = ['SuperAdmin', 'HR', 'Manager', 'BusinessHead'].includes(user.roleName)

  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/leave/types').then(r => r.data),
  })

  const selectedType = leaveTypes.find(lt => lt.id === form.leaveTypeId)
  // The dedicated "Half Day" type is always a single half day, so it collapses
  // the date range into one date and forces the session picker.
  const isHalfDayType = selectedType?.code === 'HD'

  const { data: balances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balance', year],
    queryFn: () => api.get(`/leave/balance?year=${year}`).then(r => r.data),
  })

  const { data: myRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/leave/requests').then(r => r.data),
  })

  const { data: teamRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['leave-requests-team'],
    queryFn: () => api.get('/leave/requests?status=Pending').then(r => r.data),
    enabled: isAdmin,
  })

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ['holidays', year],
    queryFn: () => api.get(`/leave/holidays?year=${year}`).then(r => r.data),
  })

  const applyLeave = useMutation({
    mutationFn: (data: Omit<typeof form, 'halfDayDate' | 'halfDaySession'> & { halfDayDate?: string; halfDaySession?: string }) =>
      api.post('/leave/requests', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); setShowApply(false); setForm({ leaveTypeId: '', fromDate: '', toDate: '', reason: '', halfDayDate: '', halfDaySession: '' }) },
  })

  const approveLeave = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/requests/${id}/approve`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); qc.invalidateQueries({ queryKey: ['leave-requests-team'] }); qc.invalidateQueries({ queryKey: ['leave-balance'] }) },
  })

  const rejectLeave = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/leave/requests/${id}/reject`, { reason }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); qc.invalidateQueries({ queryKey: ['leave-requests-team'] }) },
  })

  const cancelLeave = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/requests/${id}/cancel`, { reason: 'Cancelled' }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); qc.invalidateQueries({ queryKey: ['leave-balance'] }) },
  })

  const initBalance = useMutation({
    mutationFn: (userId: string) => api.post('/leave/balance/initialize', { userId, year }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-balance'] }),
  })

  const inp = (err?: boolean): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
    border: `1px solid ${err ? '#FF5353' : '#E5E7EB'}`, outline: 'none', boxSizing: 'border-box',
  })

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Leave Management</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {balances.length === 0 && (
            <button onClick={() => initBalance.mutateAsync(user.id)}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#E8EDFF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}>
              Initialize Balance
            </button>
          )}
          <button onClick={() => setShowApply(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Plus size={13} /> Apply Leave
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {(['balance', 'requests', ...(isAdmin ? ['team'] : []), 'holidays'] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE',
          }}>
            {t === 'balance' ? 'My Balance' : t === 'requests' ? 'My Requests' : t === 'team' ? `Team (${teamRequests.length})` : 'Holidays'}
          </button>
        ))}
      </div>

      {/* Balance Cards */}
      {tab === 'balance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {balances.map(b => (
            <div key={b.id} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#B1B1BE', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{b.leaveType.name}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#374557', marginBottom: 8 }}>{b.balance}</p>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#B1B1BE' }}>
                <span>Quota: {b.leaveType.annualQuota}</span>
                <span>Used: {b.taken}</span>
              </div>
              {b.carryForward > 0 && (
                <p style={{ fontSize: 10, color: '#2BC155', marginTop: 4 }}>+{b.carryForward} carry forward</p>
              )}
            </div>
          ))}
          {balances.length === 0 && (
            <p style={{ fontSize: 13, color: '#B1B1BE', gridColumn: '1 / -1' }}>No leave balances. Click "Initialize Balance" to set up.</p>
          )}
        </div>
      )}

      {/* My Requests */}
      {tab === 'requests' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8F9FD' }}>
                {['Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myRequests.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374557' }}>{r.leaveType.name}</td>
                  <td style={{ padding: '10px 16px', color: '#374557' }}>{fmtDate(r.fromDate)}</td>
                  <td style={{ padding: '10px 16px', color: '#374557' }}>{fmtDate(r.toDate)}</td>
                  <td style={{ padding: '10px 16px', color: '#374557' }}>{r.totalDays}{r.sandwichDays > 0 ? ` (+${r.sandwichDays} sandwich)` : ''}</td>
                  <td style={{ padding: '10px 16px', color: '#B1B1BE', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[r.status]?.bg, color: statusStyle[r.status]?.color }}>{r.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {['Pending', 'Approved'].includes(r.status) && (
                      <button onClick={() => cancelLeave.mutateAsync(r.id)}
                        style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
              {myRequests.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#B1B1BE' }}>No leave requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Team Pending Approvals */}
      {tab === 'team' && isAdmin && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8F9FD' }}>
                {['Employee', 'Dept', 'Type', 'From', 'To', 'Days', 'Reason', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamRequests.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374557' }}>{r.user?.name}</td>
                  <td style={{ padding: '10px 16px', color: '#B1B1BE' }}>{r.user?.department?.name || '-'}</td>
                  <td style={{ padding: '10px 16px', color: '#374557' }}>{r.leaveType.name}</td>
                  <td style={{ padding: '10px 16px', color: '#374557' }}>{fmtDate(r.fromDate)}</td>
                  <td style={{ padding: '10px 16px', color: '#374557' }}>{fmtDate(r.toDate)}</td>
                  <td style={{ padding: '10px 16px', color: '#374557' }}>{r.totalDays}</td>
                  <td style={{ padding: '10px 16px', color: '#B1B1BE', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approveLeave.mutateAsync(r.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#2BC155', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        <Check size={12} /> Approve
                      </button>
                      <button onClick={() => { const reason = prompt('Rejection reason:'); if (reason) rejectLeave.mutateAsync({ id: r.id, reason }) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#FF5353', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {teamRequests.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#B1B1BE' }}>No pending leave requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Holidays */}
      {tab === 'holidays' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {holidays.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #F0F1F5' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: h.type === 'national' ? '#EDE9FE' : '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={18} style={{ color: h.type === 'national' ? '#7C3AED' : '#5D78FF' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{h.name}</p>
                <p style={{ fontSize: 11, color: '#B1B1BE' }}>{fmtDate(h.date)} {h.isOptional ? '(Optional)' : ''}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: h.type === 'national' ? '#EDE9FE' : '#F4F5F9', color: h.type === 'national' ? '#7C3AED' : '#6B7280', textTransform: 'uppercase' }}>{h.type}</span>
            </div>
          ))}
          {holidays.length === 0 && (
            <p style={{ fontSize: 13, color: '#B1B1BE', gridColumn: '1 / -1' }}>No holidays configured for {year}</p>
          )}
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApply && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowApply(false) }}>
          <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>Apply for Leave</p>
              <button onClick={() => setShowApply(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Leave Type *</p>
                <select value={form.leaveTypeId} onChange={e => {
                  const next = leaveTypes.find(lt => lt.id === e.target.value)
                  const nextIsHalfDay = next?.code === 'HD'
                  // Switching between a range type and the Half Day type changes
                  // which date fields apply, so clear the ones that no longer do.
                  setForm(f => ({
                    ...f,
                    leaveTypeId: e.target.value,
                    ...(nextIsHalfDay || next?.halfDayAllowed === false
                      ? { halfDayDate: '', halfDaySession: '', fromDate: '', toDate: '' }
                      : {}),
                  }))
                }} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select leave type...</option>
                  {leaveTypes.map(lt => {
                    const bal = balances.find(b => b.leaveTypeId === lt.id)
                    // Half Day has no quota — showing "0 available" would read
                    // as unavailable when it is actually unlimited.
                    const label = lt.code === 'HD'
                      ? 'unlimited'
                      : `${bal ? bal.balance : lt.annualQuota} available`
                    return <option key={lt.id} value={lt.id}>{lt.name} ({label})</option>
                  })}
                </select>
              </div>
              {isHalfDayType ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Date *</p>
                    {/* One date drives fromDate, toDate and halfDayDate together. */}
                    <input type="date" value={form.fromDate}
                      onChange={e => setForm(f => ({ ...f, fromDate: e.target.value, toDate: e.target.value, halfDayDate: e.target.value }))}
                      style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Session *</p>
                    <select value={form.halfDaySession} onChange={e => setForm(f => ({ ...f, halfDaySession: e.target.value }))}
                      style={{ ...inp(), cursor: 'pointer' }}>
                      <option value="">Select session...</option>
                      <option value="first">First Half</option>
                      <option value="second">Second Half</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>From Date *</p>
                    <input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>To Date *</p>
                    <input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} style={inp()} />
                  </div>
                </div>
              )}
              {/* Half-day needs a leave type first — whether it is even allowed
                  is a property of the type, and approval covers the pay. */}
              {selectedType && !isHalfDayType && !selectedType.halfDayAllowed && (
                <p style={{ fontSize: 11, color: '#B1B1BE' }}>
                  {selectedType.name} cannot include a half day.
                </p>
              )}
              {!isHalfDayType && selectedType?.halfDayAllowed === true && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Half Day Date</p>
                    <input type="date" value={form.halfDayDate}
                      min={form.fromDate || undefined} max={form.toDate || undefined}
                      onChange={e => setForm(f => ({ ...f, halfDayDate: e.target.value, halfDaySession: e.target.value ? f.halfDaySession : '' }))}
                      style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>
                      Half Day Session{form.halfDayDate ? ' *' : ''}
                    </p>
                    <select value={form.halfDaySession} disabled={!form.halfDayDate}
                      onChange={e => setForm(f => ({ ...f, halfDaySession: e.target.value }))}
                      style={{ ...inp(), cursor: form.halfDayDate ? 'pointer' : 'not-allowed', background: form.halfDayDate ? undefined : '#F4F5F9' }}>
                      <option value="">N/A</option>
                      <option value="first">First Half</option>
                      <option value="second">Second Half</option>
                    </select>
                  </div>
                </div>
              )}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Reason *</p>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Reason for leave..." style={{ ...inp(), resize: 'vertical' }} />
              </div>
              {formErr && <p style={{ fontSize: 11, color: '#FF5353' }}>{formErr}</p>}
              <button onClick={async () => {
                if (!form.leaveTypeId || !form.fromDate || !form.toDate || !form.reason.trim()) {
                  setFormErr(isHalfDayType ? 'Date and reason are required' : 'All fields required'); return
                }
                if (isHalfDayType && !form.halfDaySession) {
                  setFormErr('Select which half of the day'); return
                }
                if (form.toDate < form.fromDate) {
                  setFormErr('To Date cannot be before From Date'); return
                }
                if (form.halfDayDate) {
                  if (!form.halfDaySession) {
                    setFormErr('Select a Half Day Session'); return
                  }
                  if (form.halfDayDate < form.fromDate || form.halfDayDate > form.toDate) {
                    setFormErr('Half Day Date must fall within the leave dates'); return
                  }
                } else if (form.halfDaySession) {
                  setFormErr('Select a Half Day Date'); return
                }
                setFormErr('')
                try {
                  // Send undefined rather than '' so the backend's
                  // "is a half day requested?" check stays accurate.
                  await applyLeave.mutateAsync({
                    ...form,
                    halfDayDate: form.halfDayDate || undefined,
                    halfDaySession: form.halfDaySession || undefined,
                  })
                } catch (e: any) {
                  setFormErr(e?.response?.data?.error || 'Failed to apply')
                }
              }} disabled={applyLeave.isPending}
                style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {applyLeave.isPending ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
