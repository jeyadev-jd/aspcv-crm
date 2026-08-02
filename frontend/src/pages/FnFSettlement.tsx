import { useState } from 'react'
import { UserMinus, IndianRupee, CheckCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const inp = (): React.CSSProperties => ({
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
  border: '1px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
})

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')

const statusColors: Record<string, { bg: string; color: string }> = {
  Initiated: { bg: '#FEF3C7', color: '#D97706' },
  InProgress: { bg: '#E8EDFF', color: '#5D78FF' },
  Completed: { bg: '#E7FAF0', color: '#2BC155' },
  Cancelled: { bg: '#FEE2E2', color: '#DC2626' },
}

export default function FnFSettlement({ employeeId }: { employeeId?: string }) {
  const qc = useQueryClient()
  const [showInit, setShowInit] = useState(false)
  const [form, setForm] = useState({ userId: employeeId || '', exitDate: '', lastWorkingDate: '', exitReason: '' })

  const { data: settlements = [] } = useQuery({ 
    queryKey: ['fnf-list', employeeId], 
    queryFn: () => api.get(employeeId ? `/fnf/${employeeId}` : '/fnf').then(r => {
      const data = r.data
      return Array.isArray(data) ? data : data ? [data] : []
    }) 
  })
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => api.get('/users').then(r => r.data?.data || r.data || []) })

  const initMut = useMutation({
    mutationFn: (data: any) => api.post('/fnf/initiate', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fnf-list'] }); setShowInit(false) },
  })

  const completeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/fnf/${id}/complete`, {}).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fnf-list'] }),
  })

  const [detail, setDetail] = useState<any>(null)
  // Completing a settlement closes out the employee record permanently.
  const [completeFor, setCompleteFor] = useState<any>(null)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Full & Final Settlement</h2>
        <button onClick={() => setShowInit(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <UserMinus size={13} /> Initiate F&F
        </button>
      </div>

      {showInit && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 16 }}>Initiate Settlement</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employee</p>
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">Select</option>
                {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name} — {(u.department as any)?.name || u.department || ''}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Exit Date</p>
              <input type="date" value={form.exitDate} onChange={e => setForm(f => ({ ...f, exitDate: e.target.value }))} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Last Working Date</p>
              <input type="date" value={form.lastWorkingDate} onChange={e => setForm(f => ({ ...f, lastWorkingDate: e.target.value }))} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Exit Reason</p>
              <input value={form.exitReason} onChange={e => setForm(f => ({ ...f, exitReason: e.target.value }))} placeholder="Resignation" style={inp()} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => initMut.mutateAsync(form)} disabled={initMut.isPending}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {initMut.isPending ? 'Processing...' : 'Calculate & Initiate'}
            </button>
            <button onClick={() => setShowInit(false)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8F9FD' }}>
              {['Employee', 'Department', 'Exit Date', 'Leave Encash', 'Gratuity', 'Notice Pay', 'Net Settlement', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settlements.map((s: any) => {
              const sc = statusColors[s.status] || { bg: '#F4F5F9', color: '#6B7280' }
              return (
                <tr key={s.id} style={{ borderTop: '1px solid #F0F1F5', cursor: 'pointer' }} onClick={() => setDetail(s)}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{s.user?.name || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{(s.user?.department as any)?.name || s.user?.department || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{new Date(s.exitDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{fmt(s.leaveEncashment || 0)}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{fmt(s.gratuity || 0)}</td>
                  <td style={{ padding: '10px 12px', color: '#DC2626' }}>{fmt(s.noticePay || 0)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#2BC155' }}>{fmt(s.netSettlement || 0)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.color }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                    {s.status === 'InProgress' && (
                      <button onClick={() => setCompleteFor(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#2BC155', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        <CheckCircle size={11} /> Complete
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {settlements.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE', fontSize: 13 }}>No F&F settlements</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 500, maxHeight: '80vh', overflow: 'auto' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#374557', marginBottom: 20 }}>
              <IndianRupee size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Settlement Details — {detail.user?.name}
            </p>
            {[
              { label: 'Exit Date', value: new Date(detail.exitDate).toLocaleDateString('en-IN') },
              { label: 'Last Working Date', value: new Date(detail.lastWorkingDate).toLocaleDateString('en-IN') },
              { label: 'Leave Encashment', value: fmt(detail.leaveEncashment || 0), color: '#2BC155' },
              { label: 'Gratuity', value: fmt(detail.gratuity || 0), color: '#2BC155' },
              { label: 'Pending Salary', value: fmt(detail.pendingSalary || 0), color: '#2BC155' },
              { label: 'Bonus', value: fmt(detail.bonusAmount || 0), color: '#2BC155' },
              { label: 'Notice Pay (Deduction)', value: fmt(detail.noticePay || 0), color: '#DC2626' },
              { label: 'Asset Recovery', value: fmt(detail.assetRecovery || 0), color: '#DC2626' },
              { label: 'Other Deductions', value: fmt(detail.otherDeductions || 0), color: '#DC2626' },
              { label: 'Total Payable', value: fmt(detail.totalPayable || 0), color: '#5D78FF' },
              { label: 'Total Deductions', value: fmt(detail.totalDeductions || 0), color: '#DC2626' },
              { label: 'Net Settlement', value: fmt(detail.netSettlement || 0), color: '#2BC155', bold: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F0F1F5' }}>
                <span style={{ fontSize: 12, color: '#374557' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: (r as any).bold ? 700 : 600, color: (r as any).color || '#374557' }}>{r.value}</span>
              </div>
            ))}
            <button onClick={() => setDetail(null)} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer', width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {completeFor && (
        <ConfirmDialog
          title="Complete this settlement?"
          message={`${completeFor.user?.name ?? 'This employee'} — net ${fmt(completeFor.netSettlement || 0)}. Completing finalises the employee's exit record and cannot be undone.`}
          confirmLabel="Complete settlement"
          countdownSeconds={3}
          isPending={completeMut.isPending}
          onCancel={() => setCompleteFor(null)}
          onConfirm={async () => {
            const target = completeFor
            setCompleteFor(null)
            await completeMut.mutateAsync(target.id)
          }}
        />
      )}
    </div>
  )
}
