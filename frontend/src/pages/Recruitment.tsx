import { useState } from 'react'
import { Plus, X, Briefcase, User, Calendar, Star, Send, Eye } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const inp = (): React.CSSProperties => ({
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
  border: '1px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
})
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')
const fdate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

const jobStatusColors: Record<string, { bg: string; color: string }> = {
  Draft: { bg: '#F4F5F9', color: '#6B7280' }, Open: { bg: '#E7FAF0', color: '#2BC155' },
  OnHold: { bg: '#FEF3C7', color: '#D97706' }, Closed: { bg: '#E8EDFF', color: '#5D78FF' },
  Cancelled: { bg: '#FEE2E2', color: '#DC2626' },
}
const candStatusColors: Record<string, { bg: string; color: string }> = {
  New: { bg: '#E8EDFF', color: '#5D78FF' }, Screening: { bg: '#FEF3C7', color: '#D97706' },
  Interview: { bg: '#EDE9FE', color: '#7C3AED' }, Offered: { bg: '#DBEAFE', color: '#2563EB' },
  Hired: { bg: '#E7FAF0', color: '#2BC155' }, Rejected: { bg: '#FEE2E2', color: '#DC2626' },
  Withdrawn: { bg: '#F4F5F9', color: '#6B7280' },
}

function Badge({ status, colors }: { status: string; colors: Record<string, { bg: string; color: string }> }) {
  const c = colors[status] || { bg: '#F4F5F9', color: '#6B7280' }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color }}>{status}</span>
}

export default function Recruitment() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'jobs' | 'candidates' | 'interviews' | 'offers'>('jobs')
  const [showModal, setShowModal] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)

  const { data: jobs = [] } = useQuery({ queryKey: ['recruit-jobs'], queryFn: () => api.get('/recruitment/jobs').then(r => r.data) })
  const { data: candidates = [] } = useQuery({ queryKey: ['recruit-candidates'], queryFn: () => api.get('/recruitment/candidates').then(r => r.data) })
  const { data: stats } = useQuery({ queryKey: ['recruit-stats'], queryFn: () => api.get('/recruitment/stats').then(r => r.data) })

  // Job form
  const [jobForm, setJobForm] = useState({ title: '', departmentId: '', location: '', employmentType: 'FullTime', vacancies: '1', experience: '', skills: '', description: '' })
  const createJob = useMutation({
    mutationFn: (d: any) => api.post('/recruitment/jobs', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruit-jobs'] }); setShowModal(null) },
  })
  const updateJob = useMutation({
    mutationFn: ({ id, ...d }: any) => api.patch(`/recruitment/jobs/${id}`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruit-jobs'] }),
  })

  // Candidate form
  const [candForm, setCandForm] = useState({ name: '', email: '', phone: '', jobId: '', currentCTC: '', expectedCTC: '', noticePeriod: '', experience: '', skills: '', source: '' })
  const createCandidate = useMutation({
    mutationFn: (d: any) => api.post('/recruitment/candidates', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruit-candidates'] }); setShowModal(null) },
  })
  const updateCandidate = useMutation({
    mutationFn: ({ id, ...d }: any) => api.patch(`/recruitment/candidates/${id}`, d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruit-candidates'] }),
  })

  // Interview form
  const [intForm, setIntForm] = useState({ candidateId: '', round: '1', scheduledAt: '', duration: '60', mode: 'Online' })
  const createInterview = useMutation({
    mutationFn: (d: any) => api.post('/recruitment/interviews', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruit-candidates'] }); setShowModal(null) },
  })

  // Offer form
  const [offerForm, setOfferForm] = useState({ candidateId: '', designation: '', department: '', offeredCTC: '', joiningDate: '' })
  const createOffer = useMutation({
    mutationFn: (d: any) => api.post('/recruitment/offers', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruit-candidates'] }); setShowModal(null) },
  })

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then(r => r.data) })

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Recruitment</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'jobs' && <button onClick={() => setShowModal('job')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}><Plus size={13} /> New Job</button>}
          {tab === 'candidates' && <button onClick={() => setShowModal('candidate')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}><Plus size={13} /> New Candidate</button>}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Open Jobs', value: stats.openJobs || 0, color: '#2BC155' },
            { label: 'Total Candidates', value: stats.totalCandidates || 0, color: '#5D78FF' },
            { label: 'In Interview', value: stats.inInterview || 0, color: '#7C3AED' },
            { label: 'Offers Pending', value: stats.pendingOffers || 0, color: '#D97706' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16, borderLeft: `4px solid ${s.color}` }}>
              <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {(['jobs', 'candidates', 'interviews', 'offers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE', textTransform: 'capitalize',
          }}>{t === 'jobs' ? 'Job Openings' : t}</button>
        ))}
      </div>

      {/* Jobs Table */}
      {tab === 'jobs' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['Title', 'Department', 'Type', 'Vacancies', 'Candidates', 'Status', 'Actions'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {jobs.map((j: any) => (
                <tr key={j.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{j.title}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{j.department?.name || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{j.employmentType}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{j.vacancies}</td>
                  <td style={{ padding: '10px 12px', color: '#5D78FF', fontWeight: 600 }}>{j._count?.candidates || 0}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={j.status} colors={jobStatusColors} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <select value={j.status} onChange={e => updateJob.mutateAsync({ id: j.id, status: e.target.value })}
                      style={{ fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}>
                      {['Draft', 'Open', 'OnHold', 'Closed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No job openings</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Candidates Table */}
      {tab === 'candidates' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F8F9FD' }}>
              {['Name', 'Email', 'Job', 'Experience', 'Expected CTC', 'Source', 'Status', 'Actions'].map(h =>
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {candidates.map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5', cursor: 'pointer' }}
                  onClick={() => api.get(`/recruitment/candidates/${c.id}`).then(r => setDetail(r.data))}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{c.name}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{c.email}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{c.job?.title || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{c.experience ? `${c.experience} yrs` : '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#374557' }}>{c.expectedCTC ? fmt(c.expectedCTC) : '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{c.source || '-'}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={c.status} colors={candStatusColors} /></td>
                  <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                    <select value={c.status} onChange={e => updateCandidate.mutateAsync({ id: c.id, status: e.target.value })}
                      style={{ fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}>
                      {['New', 'Screening', 'Interview', 'Offered', 'Hired', 'Rejected', 'Withdrawn'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No candidates</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Interviews — show from candidate detail */}
      {tab === 'interviews' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Schedule Interview</p>
            <button onClick={() => setShowModal('interview')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}><Plus size={13} /> Schedule</button>
          </div>
          <p style={{ fontSize: 12, color: '#B1B1BE' }}>Select a candidate from Candidates tab to view their interview history, or schedule a new interview above.</p>
        </div>
      )}

      {/* Offers */}
      {tab === 'offers' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Create Offer</p>
            <button onClick={() => setShowModal('offer')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}><Plus size={13} /> New Offer</button>
          </div>
          <p style={{ fontSize: 12, color: '#B1B1BE' }}>Select a candidate from Candidates tab to view their offer history, or create a new offer above.</p>
        </div>
      )}

      {/* Candidate Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 600, maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#374557' }}>{detail.name}</p>
                <p style={{ fontSize: 12, color: '#B1B1BE' }}>{detail.email} | {detail.phone || 'No phone'}</p>
              </div>
              <Badge status={detail.status} colors={candStatusColors} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Current CTC', value: detail.currentCTC ? fmt(detail.currentCTC) : '-' },
                { label: 'Expected CTC', value: detail.expectedCTC ? fmt(detail.expectedCTC) : '-' },
                { label: 'Notice Period', value: detail.noticePeriod ? `${detail.noticePeriod} days` : '-' },
                { label: 'Experience', value: detail.experience ? `${detail.experience} yrs` : '-' },
                { label: 'Source', value: detail.source || '-' },
                { label: 'Applied For', value: detail.job?.title || '-' },
              ].map(r => (
                <div key={r.label} style={{ background: '#F8F9FD', borderRadius: 8, padding: 10 }}>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>{r.label}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{r.value}</p>
                </div>
              ))}
            </div>
            {/* Interviews */}
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374557', marginBottom: 8 }}>Interviews ({detail.interviews?.length || 0})</p>
            {(detail.interviews || []).map((i: any) => (
              <div key={i.id} style={{ background: '#F8F9FD', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Round {i.round} — {i.mode}</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE' }}>{fdate(i.scheduledAt)} | {i.duration}min</p>
                  {i.feedback && <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{i.feedback}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge status={i.result} colors={{ Pending: { bg: '#FEF3C7', color: '#D97706' }, Selected: { bg: '#E7FAF0', color: '#2BC155' }, Rejected: { bg: '#FEE2E2', color: '#DC2626' }, OnHold: { bg: '#E8EDFF', color: '#5D78FF' } }} />
                  {i.rating && <p style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>{'★'.repeat(i.rating)}{'☆'.repeat(5 - i.rating)}</p>}
                </div>
              </div>
            ))}
            {/* Offers */}
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374557', marginTop: 16, marginBottom: 8 }}>Offers ({detail.offers?.length || 0})</p>
            {(detail.offers || []).map((o: any) => (
              <div key={o.id} style={{ background: '#F8F9FD', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{o.designation || 'N/A'} — {o.department || ''}</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE' }}>CTC: {fmt(o.offeredCTC)} | Joining: {fdate(o.joiningDate)}</p>
                </div>
                <Badge status={o.status} colors={{ Draft: { bg: '#F4F5F9', color: '#6B7280' }, Sent: { bg: '#FEF3C7', color: '#D97706' }, Accepted: { bg: '#E7FAF0', color: '#2BC155' }, Declined: { bg: '#FEE2E2', color: '#DC2626' }, Expired: { bg: '#F4F5F9', color: '#6B7280' } }} />
              </div>
            ))}
            <button onClick={() => setDetail(null)} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer', width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* New Job Modal */}
      {showModal === 'job' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Job Opening</p>
              <button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/3' }}><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Title *</p><input value={jobForm.title} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Department</p>
                <select value={jobForm.departmentId} onChange={e => setJobForm(f => ({ ...f, departmentId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Location</p><input value={jobForm.location} onChange={e => setJobForm(f => ({ ...f, location: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employment Type</p>
                <select value={jobForm.employmentType} onChange={e => setJobForm(f => ({ ...f, employmentType: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  {['FullTime', 'PartTime', 'Contract', 'Intern'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Vacancies</p><input type="number" value={jobForm.vacancies} onChange={e => setJobForm(f => ({ ...f, vacancies: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Experience</p><input value={jobForm.experience} onChange={e => setJobForm(f => ({ ...f, experience: e.target.value }))} placeholder="2-5 years" style={inp()} /></div>
              <div style={{ gridColumn: '1/3' }}><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Skills</p><input value={jobForm.skills} onChange={e => setJobForm(f => ({ ...f, skills: e.target.value }))} placeholder="React, Node.js, ..." style={inp()} /></div>
              <div style={{ gridColumn: '1/3' }}><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Description</p><textarea value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp(), resize: 'vertical' }} /></div>
            </div>
            <button onClick={() => createJob.mutateAsync({ ...jobForm, vacancies: parseInt(jobForm.vacancies) || 1, departmentId: jobForm.departmentId || undefined })} disabled={createJob.isPending}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>
              {createJob.isPending ? 'Creating...' : 'Create Job Opening'}
            </button>
          </div>
        </div>
      )}

      {/* New Candidate Modal */}
      {showModal === 'candidate' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Candidate</p>
              <button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Name *</p><input value={candForm.name} onChange={e => setCandForm(f => ({ ...f, name: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Email *</p><input value={candForm.email} onChange={e => setCandForm(f => ({ ...f, email: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Phone</p><input value={candForm.phone} onChange={e => setCandForm(f => ({ ...f, phone: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Job Opening</p>
                <select value={candForm.jobId} onChange={e => setCandForm(f => ({ ...f, jobId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {jobs.filter((j: any) => j.status === 'Open').map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Current CTC</p><input type="number" value={candForm.currentCTC} onChange={e => setCandForm(f => ({ ...f, currentCTC: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Expected CTC</p><input type="number" value={candForm.expectedCTC} onChange={e => setCandForm(f => ({ ...f, expectedCTC: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Experience (yrs)</p><input type="number" value={candForm.experience} onChange={e => setCandForm(f => ({ ...f, experience: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Source</p>
                <select value={candForm.source} onChange={e => setCandForm(f => ({ ...f, source: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {['LinkedIn', 'Naukri', 'Referral', 'Walk-in', 'Campus', 'Website', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => createCandidate.mutateAsync({
              ...candForm,
              currentCTC: candForm.currentCTC ? parseFloat(candForm.currentCTC) : undefined,
              expectedCTC: candForm.expectedCTC ? parseFloat(candForm.expectedCTC) : undefined,
              experience: candForm.experience ? parseFloat(candForm.experience) : undefined,
              jobId: candForm.jobId || undefined,
            })} disabled={createCandidate.isPending}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>
              {createCandidate.isPending ? 'Adding...' : 'Add Candidate'}
            </button>
          </div>
        </div>
      )}

      {/* Interview Modal */}
      {showModal === 'interview' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', marginBottom: 16 }}>Schedule Interview</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Candidate</p>
                <select value={intForm.candidateId} onChange={e => setIntForm(f => ({ ...f, candidateId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {candidates.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Round</p><input type="number" value={intForm.round} onChange={e => setIntForm(f => ({ ...f, round: e.target.value }))} style={inp()} /></div>
                <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Duration</p><input type="number" value={intForm.duration} onChange={e => setIntForm(f => ({ ...f, duration: e.target.value }))} style={inp()} /></div>
                <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Mode</p>
                  <select value={intForm.mode} onChange={e => setIntForm(f => ({ ...f, mode: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                    {['Online', 'InPerson', 'Phone'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Scheduled At</p><input type="datetime-local" value={intForm.scheduledAt} onChange={e => setIntForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inp()} /></div>
            </div>
            <button onClick={() => createInterview.mutateAsync({ ...intForm, round: parseInt(intForm.round), duration: parseInt(intForm.duration), scheduledAt: new Date(intForm.scheduledAt).toISOString() })}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>Schedule</button>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showModal === 'offer' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', marginBottom: 16 }}>Create Offer</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Candidate</p>
                <select value={offerForm.candidateId} onChange={e => setOfferForm(f => ({ ...f, candidateId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {candidates.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Designation</p><input value={offerForm.designation} onChange={e => setOfferForm(f => ({ ...f, designation: e.target.value }))} style={inp()} /></div>
                <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Department</p><input value={offerForm.department} onChange={e => setOfferForm(f => ({ ...f, department: e.target.value }))} style={inp()} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Offered CTC</p><input type="number" value={offerForm.offeredCTC} onChange={e => setOfferForm(f => ({ ...f, offeredCTC: e.target.value }))} style={inp()} /></div>
                <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Joining Date</p><input type="date" value={offerForm.joiningDate} onChange={e => setOfferForm(f => ({ ...f, joiningDate: e.target.value }))} style={inp()} /></div>
              </div>
            </div>
            <button onClick={() => createOffer.mutateAsync({ ...offerForm, offeredCTC: parseFloat(offerForm.offeredCTC) })}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>Create Offer</button>
          </div>
        </div>
      )}
    </div>
  )
}
