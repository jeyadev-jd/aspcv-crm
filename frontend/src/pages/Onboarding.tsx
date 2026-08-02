import { useState } from 'react'
import { Plus, X, UserPlus, FileCheck, Shield, LogOut } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const inp = (): React.CSSProperties => ({
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
  border: '1px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
})

export default function Onboarding() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'onboarding' | 'documents' | 'offboarding' | 'clearance'>('onboarding')
  const [showModal, setShowModal] = useState<string | null>(null)

  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => api.get('/users').then(r => r.data?.data || r.data || []) })

  // Onboarding
  const { data: checklists = [] } = useQuery({ queryKey: ['onboarding-checklists'], queryFn: () => api.get('/onboarding/checklists').then(r => r.data) })
  const [checklistForm, setChecklistForm] = useState({ userId: '', templateName: '' })
  const createChecklist = useMutation({
    mutationFn: (d: any) => api.post('/onboarding/checklists', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding-checklists'] }); setShowModal(null) },
  })
  const initTasks = useMutation({
    mutationFn: (checklistId: string) => api.post(`/onboarding/checklists/${checklistId}/initialize`, {}).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-checklists'] }),
  })

  // Documents
  const { data: documents = [] } = useQuery({ queryKey: ['onboarding-docs'], queryFn: () => api.get('/onboarding/documents').then(r => r.data) })
  const [docForm, setDocForm] = useState({ userId: '', documentType: '', documentUrl: '' })
  const upsertDoc = useMutation({
    mutationFn: (d: any) => api.post('/onboarding/documents', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding-docs'] }); setShowModal(null) },
  })
  const verifyDoc = useMutation({
    mutationFn: (id: string) => api.patch(`/onboarding/documents/${id}/verify`, {}).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-docs'] }),
  })

  // Exit Interview
  const [exitForm, setExitForm] = useState({ userId: '', reason: '', feedback: '', wouldRecommend: false })
  const upsertExit = useMutation({
    mutationFn: (d: any) => api.post('/onboarding/offboarding/exit-interview', d).then(r => r.data),
    onSuccess: () => { setShowModal(null) },
  })

  // Clearance
  const [clearanceUserId, setClearanceUserId] = useState('')
  const { data: clearanceSummary } = useQuery({
    queryKey: ['clearance', clearanceUserId],
    queryFn: () => api.get(`/onboarding/offboarding/clearance/${clearanceUserId}`).then(r => r.data),
    enabled: !!clearanceUserId,
  })
  const initClearance = useMutation({
    mutationFn: (userId: string) => api.post('/onboarding/offboarding/clearance/initialize', { userId }).then(r => r.data),
    onSuccess: () => { if (clearanceUserId) qc.invalidateQueries({ queryKey: ['clearance', clearanceUserId] }) },
  })
  const updateClearance = useMutation({
    mutationFn: ({ id, ...d }: any) => api.patch(`/onboarding/offboarding/clearance/${id}`, d).then(r => r.data),
    onSuccess: () => { if (clearanceUserId) qc.invalidateQueries({ queryKey: ['clearance', clearanceUserId] }) },
  })

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      Pending: { bg: '#FEF3C7', color: '#D97706' }, InProgress: { bg: '#E8EDFF', color: '#5D78FF' },
      Completed: { bg: '#E7FAF0', color: '#2BC155' }, Verified: { bg: '#E7FAF0', color: '#2BC155' },
      Rejected: { bg: '#FEE2E2', color: '#DC2626' }, Cleared: { bg: '#E7FAF0', color: '#2BC155' },
      NotCleared: { bg: '#FEE2E2', color: '#DC2626' },
    }
    const c = colors[status] || colors.Pending
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color }}>{status}</span>
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Onboarding & Offboarding</h2>
        <button onClick={() => setShowModal(tab === 'onboarding' ? 'checklist' : tab === 'documents' ? 'doc' : tab === 'offboarding' ? 'exit' : null)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={13} /> {tab === 'onboarding' ? 'New Checklist' : tab === 'documents' ? 'Upload Document' : tab === 'offboarding' ? 'Exit Interview' : 'Add'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {([
          { key: 'onboarding', label: 'Onboarding', icon: UserPlus },
          { key: 'documents', label: 'Documents', icon: FileCheck },
          { key: 'offboarding', label: 'Exit Interview', icon: LogOut },
          { key: 'clearance', label: 'Clearance', icon: Shield },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t.key ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t.key ? '#5D78FF' : '#B1B1BE', display: 'flex', alignItems: 'center', gap: 6,
          }}><t.icon size={13} /> {t.label}</button>
        ))}
      </div>

      {/* Onboarding Checklists */}
      {tab === 'onboarding' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['Template', 'User ID', 'Status', 'Progress', 'Created', 'Actions'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {checklists.map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{c.templateName || 'Default'}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE', fontFamily: 'monospace', fontSize: 11 }}>{c.userId?.substring(0, 8)}...</td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(c.status)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F0F1F5', maxWidth: 100 }}>
                        <div style={{ width: `${c.completionPct || 0}%`, height: '100%', borderRadius: 3, background: '#2BC155' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#374557' }}>{c.completionPct || 0}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {c.status === 'Pending' && (
                      <button onClick={() => initTasks.mutateAsync(c.id)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#E8EDFF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}>Initialize</button>
                    )}
                  </td>
                </tr>
              ))}
              {checklists.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No checklists</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Documents */}
      {tab === 'documents' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['Document Type', 'User ID', 'URL', 'Status', 'Verified By', 'Actions'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {documents.map((d: any) => (
                <tr key={d.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{d.documentType}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE', fontFamily: 'monospace', fontSize: 11 }}>{d.userId?.substring(0, 8)}...</td>
                  <td style={{ padding: '10px 12px', color: '#5D78FF', fontSize: 11 }}>{d.documentUrl ? 'Uploaded' : '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(d.status)}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{d.verifiedById?.substring(0, 8) || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {d.status === 'Pending' && (
                      <button onClick={() => verifyDoc.mutateAsync(d.id)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#E7FAF0', color: '#2BC155', border: 'none', cursor: 'pointer' }}>Verify</button>
                    )}
                  </td>
                </tr>
              ))}
              {documents.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No documents</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Offboarding - Exit Interview */}
      {tab === 'offboarding' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 16 }}>Record Exit Interview</p>
          <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>Select employee and fill exit interview details. Use "Exit Interview" button above to submit.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
            <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employee</p>
              <select value={exitForm.userId} onChange={e => setExitForm(f => ({ ...f, userId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">Select</option>
                {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Reason for Leaving</p>
              <select value={exitForm.reason} onChange={e => setExitForm(f => ({ ...f, reason: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">Select</option>
                {['Better Opportunity', 'Personal Reasons', 'Relocation', 'Higher Studies', 'Health', 'Compensation', 'Work-Life Balance', 'Management', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/3' }}><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Feedback</p><textarea value={exitForm.feedback} onChange={e => setExitForm(f => ({ ...f, feedback: e.target.value }))} rows={3} style={{ ...inp(), resize: 'vertical' }} /></div>
            <div><label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={exitForm.wouldRecommend} onChange={e => setExitForm(f => ({ ...f, wouldRecommend: e.target.checked }))} /> Would recommend company
            </label></div>
          </div>
          <button onClick={() => upsertExit.mutateAsync(exitForm)} disabled={!exitForm.userId}
            style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: exitForm.userId ? '#5D78FF' : '#B1B1BE', color: '#fff', border: 'none', cursor: exitForm.userId ? 'pointer' : 'default' }}>Save Exit Interview</button>
        </div>
      )}

      {/* Clearance */}
      {tab === 'clearance' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 24 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 300 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employee</p>
              <select value={clearanceUserId} onChange={e => setClearanceUserId(e.target.value)} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">Select employee</option>
                {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {clearanceUserId && (
              <button onClick={() => initClearance.mutateAsync(clearanceUserId)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#E8EDFF', color: '#5D78FF', border: 'none', cursor: 'pointer', height: 36 }}>Initialize Clearance</button>
            )}
          </div>

          {clearanceSummary && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Cleared: {clearanceSummary.cleared}/{clearanceSummary.total}</span>
                <span style={{ fontSize: 12, color: clearanceSummary.allCleared ? '#2BC155' : '#D97706' }}>{clearanceSummary.allCleared ? 'All Cleared' : 'Pending'}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: '#F8F9FD' }}>
                  {['Department', 'Status', 'Remarks', 'Actions'].map(h =>
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(clearanceSummary.clearances || []).map((c: any) => (
                    <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{c.clearanceItem?.department || c.department || '-'}</td>
                      <td style={{ padding: '10px 12px' }}>{statusBadge(c.status)}</td>
                      <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{c.remarks || '-'}</td>
                      <td style={{ padding: '10px 12px', display: 'flex', gap: 4 }}>
                        {c.status === 'Pending' && (
                          <>
                            <button onClick={() => updateClearance.mutateAsync({ id: c.id, status: 'Cleared' })} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#E7FAF0', color: '#2BC155', border: 'none', cursor: 'pointer' }}>Clear</button>
                            <button onClick={() => updateClearance.mutateAsync({ id: c.id, status: 'NotCleared' })} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: '#DC2626', border: 'none', cursor: 'pointer' }}>Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {!clearanceUserId && <p style={{ color: '#B1B1BE', fontSize: 12, textAlign: 'center', padding: 40 }}>Select employee to view clearance status</p>}
        </div>
      )}

      {/* New Checklist Modal */}
      {showModal === 'checklist' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', marginBottom: 16 }}>New Onboarding Checklist</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employee *</p>
                <select value={checklistForm.userId} onChange={e => setChecklistForm(f => ({ ...f, userId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Template Name</p><input value={checklistForm.templateName} onChange={e => setChecklistForm(f => ({ ...f, templateName: e.target.value }))} placeholder="e.g. Standard, Engineering" style={inp()} /></div>
            </div>
            <button onClick={() => createChecklist.mutateAsync(checklistForm)}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>Create Checklist</button>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showModal === 'doc' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', marginBottom: 16 }}>Upload Document</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employee *</p>
                <select value={docForm.userId} onChange={e => setDocForm(f => ({ ...f, userId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Document Type *</p>
                <select value={docForm.documentType} onChange={e => setDocForm(f => ({ ...f, documentType: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {['Aadhar Card', 'PAN Card', 'Passport', '10th Certificate', '12th Certificate', 'Degree Certificate', 'Experience Letter', 'Relieving Letter', 'Offer Letter', 'Bank Passbook', 'Photos'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Document URL</p><input value={docForm.documentUrl} onChange={e => setDocForm(f => ({ ...f, documentUrl: e.target.value }))} placeholder="Link to uploaded document" style={inp()} /></div>
            </div>
            <button onClick={() => upsertDoc.mutateAsync(docForm)}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>Submit Document</button>
          </div>
        </div>
      )}
    </div>
  )
}
