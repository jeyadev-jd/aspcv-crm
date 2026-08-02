import { useState } from 'react'
import { Plus, X, Target, TrendingUp, Star, Award } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const inp = (): React.CSSProperties => ({
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
  border: '1px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
})

const goalStatusColors: Record<string, { bg: string; color: string }> = {
  Draft: { bg: '#F4F5F9', color: '#6B7280' }, Active: { bg: '#E8EDFF', color: '#5D78FF' },
  Completed: { bg: '#E7FAF0', color: '#2BC155' }, Cancelled: { bg: '#FEE2E2', color: '#DC2626' },
}
const appraisalStatusColors: Record<string, { bg: string; color: string }> = {
  Draft: { bg: '#F4F5F9', color: '#6B7280' }, SelfReview: { bg: '#FEF3C7', color: '#D97706' },
  ManagerReview: { bg: '#E8EDFF', color: '#5D78FF' }, HRReview: { bg: '#EDE9FE', color: '#7C3AED' },
  Completed: { bg: '#E7FAF0', color: '#2BC155' },
}

function Badge({ status, colors }: { status: string; colors: Record<string, { bg: string; color: string }> }) {
  const c = colors[status] || { bg: '#F4F5F9', color: '#6B7280' }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color }}>{status}</span>
}

export default function Performance({ employeeId }: { employeeId?: string }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'goals' | 'kpis' | 'appraisals' | 'promotions'>('goals')
  const [showModal, setShowModal] = useState<string | null>(null)

  const querySuffix = employeeId ? `?userId=${employeeId}` : ''
  const { data: goals = [] } = useQuery({ queryKey: ['perf-goals', employeeId], queryFn: () => api.get(`/performance/goals${querySuffix}`).then(r => r.data) })
  const { data: kpis = [] } = useQuery({ queryKey: ['perf-kpis', employeeId], queryFn: () => api.get(`/performance/kpis${querySuffix}`).then(r => r.data) })
  const { data: appraisals = [] } = useQuery({ queryKey: ['perf-appraisals', employeeId], queryFn: () => api.get(`/performance/appraisals${querySuffix}`).then(r => r.data) })
  const { data: promotions = [] } = useQuery({ queryKey: ['perf-promotions', employeeId], queryFn: () => api.get(`/performance/promotions${querySuffix}`).then(r => r.data) })
  const { data: stats } = useQuery({ queryKey: ['perf-stats', employeeId], queryFn: () => api.get(`/performance/stats${querySuffix}`).then(r => r.data) })

  // Goal form
  const [goalForm, setGoalForm] = useState({ title: '', description: '', category: 'Business', weightage: '', targetValue: '', unit: '', dueDate: '' })
  const createGoal = useMutation({
    mutationFn: (d: any) => api.post('/performance/goals', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['perf-goals'] }); setShowModal(null) },
  })
  const updateGoal = useMutation({
    mutationFn: ({ id, ...d }: any) => api.patch(`/performance/goals/${id}`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perf-goals'] }),
  })

  // Appraisal form — defaults to the employee whose panel this is embedded in.
  const [apprForm, setApprForm] = useState({ userId: employeeId || '', period: '', reviewerId: '' })
  const createAppraisal = useMutation({
    mutationFn: (d: any) => api.post('/performance/appraisals', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['perf-appraisals'] }); setShowModal(null) },
  })

  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => api.get('/users').then(r => r.data?.data || r.data || []) })

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Performance Management</h2>
        <button onClick={() => setShowModal(tab === 'goals' ? 'goal' : tab === 'appraisals' ? 'appraisal' : null)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={13} /> {tab === 'goals' ? 'New Goal' : tab === 'appraisals' ? 'New Appraisal' : 'Add'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Goals Completion', value: `${Math.round(stats.goalsCompletionPct || 0)}%`, color: '#2BC155', icon: Target },
            { label: 'Avg Progress', value: `${Math.round(stats.avgProgress || 0)}%`, color: '#5D78FF', icon: TrendingUp },
            { label: 'Active Appraisals', value: stats.activeAppraisals || 0, color: '#7C3AED', icon: Star },
            { label: 'Avg Rating', value: (stats.avgFinalRating || 0).toFixed(1), color: '#D97706', icon: Award },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16, borderLeft: `4px solid ${s.color}` }}>
              <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {(['goals', 'kpis', 'appraisals', 'promotions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE', textTransform: 'capitalize',
          }}>{t === 'kpis' ? 'KPIs' : t}</button>
        ))}
      </div>

      {/* Goals */}
      {tab === 'goals' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['Title', 'Category', 'Target', 'Progress', 'Due Date', 'Status', 'Actions'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {goals.map((g: any) => (
                <tr key={g.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{g.title}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{g.category || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{g.targetValue ? `${g.targetValue} ${g.unit || ''}` : '-'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F0F1F5' }}>
                        <div style={{ width: `${g.progress}%`, height: '100%', borderRadius: 3, background: g.progress >= 100 ? '#2BC155' : '#5D78FF' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{g.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{g.dueDate ? new Date(g.dueDate).toLocaleDateString('en-IN') : '-'}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={g.status} colors={goalStatusColors} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    {g.status === 'Active' && (
                      <input type="range" min="0" max="100" value={g.progress} style={{ width: 80 }}
                        onChange={e => updateGoal.mutateAsync({ id: g.id, progress: parseInt(e.target.value) })} />
                    )}
                  </td>
                </tr>
              ))}
              {goals.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No goals</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* KPIs */}
      {tab === 'kpis' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['Name', 'Department', 'Target', 'Unit', 'Frequency'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {kpis.map((k: any) => (
                <tr key={k.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{k.name}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{k.department || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{k.target || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{k.unit || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{k.frequency}</td>
                </tr>
              ))}
              {kpis.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No KPIs configured</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Appraisals */}
      {tab === 'appraisals' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['Period', 'Self Rating', 'Manager Rating', 'Final Rating', 'Status', 'Promotion'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {appraisals.map((a: any) => (
                <tr key={a.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{a.period}</td>
                  <td style={{ padding: '10px 12px', color: '#D97706' }}>{a.selfRating ? `${a.selfRating}/5` : '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#5D78FF' }}>{a.managerRating ? `${a.managerRating}/5` : '-'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#2BC155' }}>{a.finalRating ? `${a.finalRating}/5` : '-'}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={a.status} colors={appraisalStatusColors} /></td>
                  <td style={{ padding: '10px 12px' }}>{a.promotionRecommended ? <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#E7FAF0', color: '#2BC155' }}>Recommended</span> : '-'}</td>
                </tr>
              ))}
              {appraisals.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No appraisals</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Promotions */}
      {tab === 'promotions' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['From Designation', 'To Designation', 'From Dept', 'To Dept', 'Effective Date', 'New CTC'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {promotions.map((p: any) => (
                <tr key={p.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{p.fromDesignation || '-'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#2BC155' }}>{p.toDesignation || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{p.fromDepartment || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{p.toDepartment || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{new Date(p.effectiveDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{p.newCTC ? `₹${p.newCTC.toLocaleString('en-IN')}` : '-'}</td>
                </tr>
              ))}
              {promotions.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No promotions</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* New Goal Modal */}
      {showModal === 'goal' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Goal</p>
              <button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/3' }}><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Title *</p><input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Category</p>
                <select value={goalForm.category} onChange={e => setGoalForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  {['Business', 'Development', 'Leadership'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Weightage (%)</p><input type="number" value={goalForm.weightage} onChange={e => setGoalForm(f => ({ ...f, weightage: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Target Value</p><input type="number" value={goalForm.targetValue} onChange={e => setGoalForm(f => ({ ...f, targetValue: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Unit</p><input value={goalForm.unit} onChange={e => setGoalForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. ₹, %, units" style={inp()} /></div>
              <div style={{ gridColumn: '1/3' }}><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Due Date</p><input type="date" value={goalForm.dueDate} onChange={e => setGoalForm(f => ({ ...f, dueDate: e.target.value }))} style={inp()} /></div>
              <div style={{ gridColumn: '1/3' }}><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Description</p><textarea value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp(), resize: 'vertical' }} /></div>
            </div>
            <button onClick={() => createGoal.mutateAsync({ ...goalForm, userId: employeeId || undefined, weightage: goalForm.weightage ? parseFloat(goalForm.weightage) : undefined, targetValue: goalForm.targetValue ? parseFloat(goalForm.targetValue) : undefined, dueDate: goalForm.dueDate || undefined })}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>Create Goal</button>
          </div>
        </div>
      )}

      {/* New Appraisal Modal */}
      {showModal === 'appraisal' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', marginBottom: 16 }}>New Appraisal Cycle</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employee</p>
                <select value={apprForm.userId} onChange={e => setApprForm(f => ({ ...f, userId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Period</p><input value={apprForm.period} onChange={e => setApprForm(f => ({ ...f, period: e.target.value }))} placeholder="FY2025-26" style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Reviewer</p>
                <select value={apprForm.reviewerId} onChange={e => setApprForm(f => ({ ...f, reviewerId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => createAppraisal.mutateAsync(apprForm)}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>Start Appraisal</button>
          </div>
        </div>
      )}
    </div>
  )
}
