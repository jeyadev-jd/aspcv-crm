import { useMemo, useState } from 'react'
import { Plus, X, Check, XCircle, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface ReimbursementType {
  id: string; code: string; name: string; maxLimit: number; requiresReceipt: boolean
}
interface ReimbursementClaim {
  id: string; typeCode: string; title: string; amount: number; expenseDate: string
  status: string; receiptUrl?: string; receiptUrls?: string[]
  entityType?: string; entityId?: string
  fuelVehicleType?: string; distanceKm?: number; isOutOfStation?: boolean
}
interface ReimbursementAllItem extends ReimbursementClaim {
  user: { id: string; name: string; department?: string }
}

// Mirrors the server-side policy in services/reimbursementRules.ts so the form can
// show the payable amount before submitting. The server remains authoritative.
const FUEL_RATE_PER_KM: Record<string, number> = { '2-wheeler': 4, '4-wheeler': 8 }
const FOOD_DAILY_CAP = 500

const ENTITY_TYPES = ['Lead', 'Deal', 'Project', 'Other'] as const

const statusStyle: Record<string, { bg: string; color: string }> = {
  Draft:                     { bg: '#F4F5F9', color: '#6B7280' },
  Submitted:                 { bg: '#FEF3C7', color: '#D97706' },
  PendingManagementApproval: { bg: '#FFEDD5', color: '#EA580C' },
  ManagerApproval:           { bg: '#FEF3C7', color: '#D97706' },
  HRApproval:                { bg: '#FEF3C7', color: '#D97706' },
  FinanceApproval:           { bg: '#FEF3C7', color: '#D97706' },
  Approved:                  { bg: '#E7FAF0', color: '#2BC155' },
  Rejected:                  { bg: '#FEE2E2', color: '#DC2626' },
  Returned:                  { bg: '#FEE2E2', color: '#DC2626' },
  Paid:                      { bg: '#E8EDFF', color: '#5D78FF' },
}

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtAmt(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN')
}

// A claim's category drives which extra fields the form shows. Matches the
// server's normalizeType() so both sides agree on what counts as fuel/food/medical.
function kindOf(typeCode: string): 'fuel' | 'food' | 'medical' | 'other' {
  const t = (typeCode || '').toLowerCase()
  if (t.includes('fuel') || t.includes('travel') || t.includes('mileage')) return 'fuel'
  if (t.includes('food') || t.includes('meal')) return 'food'
  if (t.includes('medical') || t.includes('health')) return 'medical'
  return 'other'
}

const emptyForm = {
  typeCode: '', title: '', amount: '', expenseDate: '', description: '',
  entityType: '', entityId: '',
  fuelVehicleType: '2-wheeler', distanceKm: '', isOutOfStation: false,
}

export default function Reimbursements() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'my' | 'pending' | 'all'>('my')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [links, setLinks] = useState<string[]>([''])
  const [formErr, setFormErr] = useState('')
  const [filters, setFilters] = useState({ status: '', typeCode: '', entityType: '', from: '', to: '' })

  const user = JSON.parse(localStorage.getItem('crm_user') || '{}')
  const isAdmin = ['SuperAdmin', 'HR', 'Manager', 'BusinessHead', 'Accountant'].includes(user.roleName)

  const { data: types = [] } = useQuery<ReimbursementType[]>({
    queryKey: ['reimbursement-types'],
    queryFn: () => api.get('/reimbursement/types').then(r => r.data),
  })

  const { data: myClaims = [] } = useQuery<ReimbursementClaim[]>({
    queryKey: ['reimbursement-my'],
    queryFn: () => api.get('/reimbursement/my').then(r => r.data),
  })

  const { data: pendingClaims = [] } = useQuery<ReimbursementAllItem[]>({
    queryKey: ['reimbursement-pending'],
    queryFn: () => api.get('/reimbursement/all?status=Submitted').then(r => r.data?.data || r.data),
    enabled: isAdmin,
  })

  const { data: managementClaims = [] } = useQuery<ReimbursementAllItem[]>({
    queryKey: ['reimbursement-management'],
    queryFn: () => api.get('/reimbursement/all?status=PendingManagementApproval').then(r => r.data?.data || r.data),
    enabled: isAdmin,
  })

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    return params.toString()
  }, [filters])

  const { data: allClaims = [] } = useQuery<ReimbursementAllItem[]>({
    queryKey: ['reimbursement-all', filterQuery],
    queryFn: () => api.get(`/reimbursement/all${filterQuery ? `?${filterQuery}` : ''}`).then(r => r.data?.data || r.data),
    enabled: isAdmin && tab === 'all',
  })

  const awaitingReview = [...pendingClaims, ...managementClaims]

  const submitClaim = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/reimbursement', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursement-my'] })
      setShowNew(false); setForm({ ...emptyForm }); setLinks([''])
    },
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['reimbursement-my'] })
    qc.invalidateQueries({ queryKey: ['reimbursement-pending'] })
    qc.invalidateQueries({ queryKey: ['reimbursement-management'] })
    qc.invalidateQueries({ queryKey: ['reimbursement-all'] })
  }

  const approveClaim = useMutation({
    mutationFn: (id: string) => api.patch(`/reimbursement/${id}/approve`).then(r => r.data),
    onSuccess: invalidateAll,
  })

  const rejectClaim = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/reimbursement/${id}/reject`, { reason }).then(r => r.data),
    onSuccess: invalidateAll,
  })

  const cancelClaim = useMutation({
    mutationFn: (id: string) => api.patch(`/reimbursement/${id}/cancel`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reimbursement-my'] }),
  })

  const inp = (err?: boolean): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
    border: `1px solid ${err ? '#FF5353' : '#E5E7EB'}`, outline: 'none', boxSizing: 'border-box',
  })

  const kind = kindOf(form.typeCode)
  // Fuel is paid on distance, so the amount field becomes read-only and derived.
  const fuelAmount = kind === 'fuel'
    ? (parseFloat(form.distanceKm || '0') || 0) * (FUEL_RATE_PER_KM[form.fuelVehicleType] ?? 0)
    : 0
  const effectiveAmount = kind === 'fuel' ? fuelAmount : parseFloat(form.amount || '0') || 0

  const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }
  const td: React.CSSProperties = { padding: '10px 16px', color: '#374557' }

  const renderStatus = (s: string) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[s]?.bg ?? '#F4F5F9', color: statusStyle[s]?.color ?? '#6B7280' }}>
      {s === 'PendingManagementApproval' ? 'Mgmt Approval' : s}
    </span>
  )

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Reimbursements</h2>
        <button onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={13} /> New Claim
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {(['my', ...(isAdmin ? ['pending', 'all'] as const : [])] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE',
          }}>
            {t === 'my' ? 'My Claims' : t === 'pending' ? `Pending Approval (${awaitingReview.length})` : 'All Claims'}
          </button>
        ))}
      </div>

      {/* My Claims */}
      {tab === 'my' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8F9FD' }}>
                {['Type', 'Title', 'Linked To', 'Amount', 'Date', 'Receipts', 'Status', 'Actions'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myClaims.map(c => {
                const receipts = c.receiptUrls?.length ? c.receiptUrls : c.receiptUrl ? [c.receiptUrl] : []
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.typeCode}</td>
                    <td style={td}>
                      {c.title}
                      {c.distanceKm ? <span style={{ color: '#B1B1BE' }}> · {c.distanceKm} km ({c.fuelVehicleType})</span> : null}
                    </td>
                    <td style={td}>{c.entityType ? c.entityType : <span style={{ color: '#C4C4CF' }}>—</span>}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmtAmt(c.amount)}</td>
                    <td style={td}>{fmtDate(c.expenseDate)}</td>
                    <td style={td}>
                      {receipts.length === 0 ? <span style={{ color: '#C4C4CF' }}>—</span> : receipts.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer" style={{ color: '#5D78FF', marginRight: 6 }}>#{i + 1}</a>
                      ))}
                    </td>
                    <td style={{ padding: '10px 16px' }}>{renderStatus(c.status)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {['Draft', 'Submitted', 'PendingManagementApproval'].includes(c.status) && (
                        <button onClick={() => cancelClaim.mutateAsync(c.id)}
                          style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {myClaims.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#B1B1BE' }}>No reimbursement claims</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Approval */}
      {tab === 'pending' && isAdmin && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8F9FD' }}>
                {['Employee', 'Type', 'Title', 'Linked To', 'Amount', 'Date', 'Status', 'Actions'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {awaitingReview.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.user?.name}</td>
                  <td style={td}>{c.typeCode}</td>
                  <td style={td}>{c.title}</td>
                  <td style={td}>{c.entityType ?? <span style={{ color: '#C4C4CF' }}>—</span>}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{fmtAmt(c.amount)}</td>
                  <td style={td}>{fmtDate(c.expenseDate)}</td>
                  <td style={{ padding: '10px 16px' }}>{renderStatus(c.status)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approveClaim.mutateAsync(c.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#2BC155', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        <Check size={12} /> Approve
                      </button>
                      <button onClick={() => { const reason = prompt('Rejection reason:'); if (reason) rejectClaim.mutateAsync({ id: c.id, reason }) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#FF5353', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {awaitingReview.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#B1B1BE' }}>No pending claims</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* All Claims + filters */}
      {tab === 'all' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Status</p>
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">All statuses</option>
                {Object.keys(statusStyle).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Type</p>
              <select value={filters.typeCode} onChange={e => setFilters(f => ({ ...f, typeCode: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">All types</option>
                {types.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Linked entity</p>
              <select value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">All entities</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>From</p>
              <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>To</p>
              <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} style={inp()} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={() => setFilters({ status: '', typeCode: '', entityType: '', from: '', to: '' })}
                style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>
                Clear
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0F1F5', fontSize: 12, color: '#374557' }}>
              <strong>{allClaims.length}</strong> claims · total{' '}
              <strong>{fmtAmt(allClaims.filter(c => c.status !== 'Rejected').reduce((s, c) => s + c.amount, 0))}</strong>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F9FD' }}>
                  {['Employee', 'Type', 'Title', 'Linked To', 'Amount', 'Date', 'Status'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allClaims.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.user?.name}</td>
                    <td style={td}>{c.typeCode}</td>
                    <td style={td}>{c.title}</td>
                    <td style={td}>{c.entityType ?? <span style={{ color: '#C4C4CF' }}>—</span>}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmtAmt(c.amount)}</td>
                    <td style={td}>{fmtDate(c.expenseDate)}</td>
                    <td style={{ padding: '10px 16px' }}>{renderStatus(c.status)}</td>
                  </tr>
                ))}
                {allClaims.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#B1B1BE' }}>No claims match these filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Claim Modal */}
      {showNew && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Reimbursement Claim</p>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Type *</p>
                <select value={form.typeCode} onChange={e => setForm(f => ({ ...f, typeCode: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">Select type...</option>
                  {types.map(t => (
                    <option key={t.id} value={t.code}>{t.name}{t.maxLimit ? ` (max ${fmtAmt(t.maxLimit)})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Title *</p>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Claim title..." style={inp()} />
              </div>

              {/* Fuel: distance × rate replaces the free-typed amount */}
              {kind === 'fuel' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Vehicle *</p>
                    <select value={form.fuelVehicleType} onChange={e => setForm(f => ({ ...f, fuelVehicleType: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                      <option value="2-wheeler">2-wheeler (₹4/km)</option>
                      <option value="4-wheeler">4-wheeler (₹8/km)</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Distance (km) *</p>
                    <input type="number" min="0" value={form.distanceKm}
                      onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))} placeholder="0" style={inp()} />
                  </div>
                </div>
              )}

              {/* Food: only out-of-station is reimbursable, capped per day */}
              {kind === 'food' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374557' }}>
                  <input type="checkbox" checked={form.isOutOfStation}
                    onChange={e => setForm(f => ({ ...f, isOutOfStation: e.target.checked }))} />
                  Out-of-station travel (required — capped at {fmtAmt(FOOD_DAILY_CAP)}/day)
                </label>
              )}

              {kind === 'medical' && (
                <p style={{ fontSize: 11, color: '#EA580C', background: '#FFF7ED', padding: '8px 12px', borderRadius: 8 }}>
                  Medical claims go straight to management for approval.
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>
                    Amount * {kind === 'fuel' && <span style={{ color: '#B1B1BE', fontWeight: 500 }}>(auto)</span>}
                  </p>
                  <input type="number" readOnly={kind === 'fuel'}
                    value={kind === 'fuel' ? (fuelAmount || '') : form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0" style={{ ...inp(), background: kind === 'fuel' ? '#F8F9FD' : '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Expense Date *</p>
                  <input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} style={inp()} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Linked to</p>
                  <select value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value, entityId: '' }))} style={{ ...inp(), cursor: 'pointer' }}>
                    <option value="">Not linked</option>
                    {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {form.entityType && form.entityType !== 'Other' && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>{form.entityType} ID *</p>
                    <input value={form.entityId} onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))}
                      placeholder={`Paste ${form.entityType.toLowerCase()} id`} style={inp()} />
                  </div>
                )}
              </div>

              {/* Multiple OneDrive proof links */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Receipt links (OneDrive / SharePoint)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {links.map((link, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}>
                      <input value={link} placeholder="https://....sharepoint.com/..."
                        onChange={e => setLinks(ls => ls.map((l, j) => (j === i ? e.target.value : l)))} style={inp()} />
                      {links.length > 1 && (
                        <button onClick={() => setLinks(ls => ls.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setLinks(ls => [...ls, ''])}
                    style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                    + Add another link
                  </button>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Description</p>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="Description..." style={{ ...inp(), resize: 'vertical' }} />
              </div>

              {formErr && <p style={{ fontSize: 11, color: '#FF5353' }}>{formErr}</p>}

              <button onClick={async () => {
                if (!form.typeCode || !form.title.trim() || !form.expenseDate) {
                  setFormErr('Type, title and expense date are required'); return
                }
                if (kind === 'fuel' && !(parseFloat(form.distanceKm) > 0)) {
                  setFormErr('Distance in km is required for fuel claims'); return
                }
                if (kind !== 'fuel' && !(effectiveAmount > 0)) {
                  setFormErr('Amount must be greater than zero'); return
                }
                if (form.entityType && form.entityType !== 'Other' && !form.entityId.trim()) {
                  setFormErr(`${form.entityType} ID is required when linking to a ${form.entityType}`); return
                }
                setFormErr('')
                const receiptUrls = links.map(l => l.trim()).filter(Boolean)
                try {
                  await submitClaim.mutateAsync({
                    typeCode: form.typeCode,
                    title: form.title,
                    description: form.description || undefined,
                    amount: effectiveAmount,
                    expenseDate: form.expenseDate,
                    receiptUrls,
                    entityType: form.entityType || undefined,
                    entityId: form.entityId || undefined,
                    ...(kind === 'fuel' && { fuelVehicleType: form.fuelVehicleType, distanceKm: parseFloat(form.distanceKm) }),
                    ...(kind === 'food' && { isOutOfStation: form.isOutOfStation }),
                  })
                } catch (e: any) {
                  setFormErr(e?.response?.data?.error || 'Failed to submit claim')
                }
              }} disabled={submitClaim.isPending}
                style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {submitClaim.isPending ? 'Submitting...' : `Submit Claim${effectiveAmount > 0 ? ` · ${fmtAmt(effectiveAmount)}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
