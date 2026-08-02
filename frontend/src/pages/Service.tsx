import { useState } from 'react'
import type React from 'react'
import { AlertTriangle, Shield, ShieldOff, Plus, CheckCircle2, Download, Search, X } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import EmptyState from '@/components/shared/EmptyState'
import { useServiceRecords, useCreateServiceRequest, useUpdateServiceRequest, useWarrantyExpiring, useWarrantyExpired } from '@/hooks/useERP'
import type { ServiceRecordAPI, ServiceRequestAPI } from '@/hooks/useERP'
import { useAuthStore } from '@/lib/authStore'
import { useUsers } from '@/hooks/useUsers'
import { WarrantyCertificatePDF } from '@/components/pdf/WarrantyCertificatePDF'
import { ServiceReportPDF } from '@/components/pdf/ServiceReportPDF'

type MainTab = 'records' | 'warrantyExpiring' | 'warrantyExpired'

const REQ_BADGE: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
}

const REQ_STATUS_STYLES: Record<ServiceRequestAPI['status'], React.CSSProperties> = {
  Open:       { ...REQ_BADGE, background: '#FEE2E2', color: '#B91C1C' },
  InProgress: { ...REQ_BADGE, background: '#FEF3C7', color: '#A16207' },
  Resolved:   { ...REQ_BADGE, background: '#DCFCE7', color: '#15803D' },
  Closed:     { ...REQ_BADGE, background: '#F4F5F9', color: '#6B7280' },
}

function warrantyDaysLeft(end?: string): number | null {
  if (!end) return null
  const ms = new Date(end).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function WarrantyBadge({ endDate }: { endDate?: string }) {
  const days = warrantyDaysLeft(endDate)
  if (days === null) return <span style={{ fontSize: 12, color: '#8A8B9F' }}>No warranty</span>
  if (days < 0) return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: '#F3F4F6', color: '#6B7280' }}>Expired</span>
  if (days <= 30) return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: '#FEE2E2', color: '#B91C1C' }}>{days}d left ⚠️</span>
  if (days <= 90) return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: '#FEF3C7', color: '#A16207' }}>{days}d left</span>
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: '#DCFCE7', color: '#15803D' }}>{days}d left</span>
}

/** One warranty row, shared by the expiring and expired sections. */
function WarrantyRow({ record, expired = false, onOpen }: {
  record: ServiceRecordAPI; expired?: boolean; onOpen: () => void
}) {
  const border = expired ? '#FECACA' : '#FDE68A'
  const hover = expired ? '#FEF2F2' : '#FFFBEB'
  return (
    <div
      onClick={onOpen}
      style={{ background: '#fff', borderRadius: 12, border: `1px solid ${border}`, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = hover)}
      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
    >
      <div>
        <h3 style={{ fontWeight: 600, color: '#23263B', margin: 0 }}>{record.project?.title}</h3>
        <p style={{ fontSize: 13, color: '#8A8B9F', margin: '2px 0 0' }}>{record.project?.company?.name}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <WarrantyBadge endDate={record.warrantyEnd} />
        <div style={{ fontSize: 12, color: '#8A8B9F', marginTop: 4 }}>
          {expired ? 'Expired' : 'Expires'}: {record.warrantyEnd ? new Date(record.warrantyEnd).toLocaleDateString() : '—'}
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const iconColors: Record<string, { bg: string; fg: string }> = {
    blue: { bg: '#EFF6FF', fg: '#3B82F6' },
    red: { bg: '#FEF2F2', fg: '#EF4444' },
    orange: { bg: '#FFF7ED', fg: '#F97316' },
    green: { bg: '#F0FDF4', fg: '#22C55E' },
  }
  const c = iconColors[color] || iconColors.blue
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, background: c.bg }}>
        <Icon style={{ width: 20, height: 20, color: c.fg }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#23263B' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8A8B9F', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function ServiceRecordCard({ record, onViewDetails, onAddRequest, onResolveRequest }: { record: ServiceRecordAPI; onViewDetails: () => void; onAddRequest: () => void; onResolveRequest: (req: ServiceRequestAPI) => void }) {
  const openReqs = record.serviceRequests.filter(r => r.status === 'Open' || r.status === 'InProgress')

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontWeight: 600, color: '#23263B', margin: 0 }}>{record.project?.title}</h3>
          <p style={{ fontSize: 13, color: '#8A8B9F', margin: '2px 0 0' }}>{record.project?.company?.name}</p>
          {record.productDescription && <p style={{ fontSize: 12, color: '#8A8B9F', margin: '2px 0 0' }}>{record.productDescription}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <WarrantyBadge endDate={record.warrantyEnd} />
          {record.warrantyEnd && <div style={{ fontSize: 12, color: '#8A8B9F', marginTop: 4 }}>{new Date(record.warrantyEnd).toLocaleDateString()}</div>}
        </div>
      </div>

      {record.installationDate && (
        <p style={{ fontSize: 12, color: '#8A8B9F', marginBottom: 8 }}>Installed: {new Date(record.installationDate).toLocaleDateString()}</p>
      )}

      {openReqs.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {openReqs.map(req => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={REQ_STATUS_STYLES[req.status]}>{req.status}</span>
                <span style={{ fontSize: 13, color: '#23263B' }}>{req.title}</span>
              </div>
              <button onClick={() => onResolveRequest(req)} style={{ fontSize: 12, color: '#15803D', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Resolve</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onViewDetails} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #F0F1F5', borderRadius: 8, color: '#8A8B9F', background: '#fff', cursor: 'pointer' }}>View History</button>
        <button onClick={onAddRequest} style={{ padding: '6px 12px', fontSize: 12, background: '#EFF6FF', color: '#3B82F6', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus style={{ width: 12, height: 12 }} />New Request</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8A8B9F' }}>{record.serviceRequests.length} total requests</span>
      </div>
    </div>
  )
}

function ServiceDetailModal({ record, onClose, onAddRequest, onUpdateRequest }: { record: ServiceRecordAPI; onClose: () => void; onAddRequest: () => void; onUpdateRequest: (req: ServiceRequestAPI, status: string) => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 672, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>{record.project?.title}</h2>
            <p style={{ fontSize: 13, color: '#8A8B9F', margin: '2px 0 0' }}>{record.project?.company?.name}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <WarrantyBadge endDate={record.warrantyEnd} />
            <PDFDownloadLink
              document={<WarrantyCertificatePDF
                certNumber={`WC-${record.id.slice(0, 8).toUpperCase()}`}
                customerName={record.project?.company?.name ?? 'Customer'}
                projectTitle={record.project?.title ?? '—'}
                warrantyStartDate={record.warrantyStart}
                warrantyEndDate={record.warrantyEnd}
                warrantyPeriodMonths={record.warrantyMonths}
                completionDate={record.installationDate}
              />}
              fileName={`warranty-${record.project?.title?.replace(/\s+/g, '-')}.pdf`}
            >
              {({ loading }) => (
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, background: '#F0FDF4', color: '#15803D', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                  <Download style={{ width: 12, height: 12 }} /> {loading ? 'Building…' : 'Warranty PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <PDFDownloadLink
              document={<ServiceReportPDF
                reportNumber={`SR-${record.id.slice(0, 8).toUpperCase()}`}
                generatedDate={new Date().toISOString()}
                customerName={record.project?.company?.name ?? 'Customer'}
                projectTitle={record.project?.title ?? '—'}
                warrantyStart={record.warrantyStart}
                warrantyEnd={record.warrantyEnd}
                totalServiceCost={record.serviceCost}
                openRequests={record.serviceRequests.filter((r: any) => r.status === 'Open' || r.status === 'InProgress').length}
                closedRequests={record.serviceRequests.filter((r: any) => r.status === 'Resolved' || r.status === 'Closed').length}
                serviceRequests={record.serviceRequests.map((r: any) => ({
                  type: r.type,
                  description: r.title + (r.description ? `\n${r.description}` : ''),
                  status: r.status,
                  priority: r.priority,
                  reportedDate: r.createdAt,
                  cost: r.cost,
                  resolutionNotes: r.resolutionNotes,
                }))}
              />}
              fileName={`service-report-${record.project?.title?.replace(/\s+/g, '-')}.pdf`}
            >
              {({ loading }) => (
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, background: '#EFF6FF', color: '#3B82F6', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                  <Download style={{ width: 12, height: 12 }} /> {loading ? 'Building…' : 'Report PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8B9F', fontSize: 20, padding: 0 }}>×</button>
          </div>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
            <div><span style={{ color: '#8A8B9F' }}>Installation:</span> <span style={{ color: '#23263B' }}>{record.installationDate ? new Date(record.installationDate).toLocaleDateString() : '—'}</span></div>
            <div><span style={{ color: '#8A8B9F' }}>Warranty Start:</span> <span style={{ color: '#23263B' }}>{record.warrantyStart ? new Date(record.warrantyStart).toLocaleDateString() : '—'}</span></div>
            <div><span style={{ color: '#8A8B9F' }}>Warranty End:</span> <span style={{ color: '#23263B' }}>{record.warrantyEnd ? new Date(record.warrantyEnd).toLocaleDateString() : '—'}</span></div>
            <div><span style={{ color: '#8A8B9F' }}>Service Cost:</span> <span style={{ color: '#23263B' }}>₹{record.serviceCost.toLocaleString()}</span></div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontWeight: 500, color: '#23263B', margin: 0 }}>Service Requests</h3>
              <button onClick={onAddRequest} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus style={{ width: 12, height: 12 }} />Add Request</button>
            </div>
            {record.serviceRequests.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8A8B9F' }}>No service requests yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {record.serviceRequests.map(req => (
                  <div key={req.id} style={{ border: '1px solid #F0F1F5', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={REQ_STATUS_STYLES[req.status]}>{req.status}</span>
                          <span style={{ fontSize: 12, color: '#8A8B9F', textTransform: 'capitalize' }}>{req.type}</span>
                          <span style={{ fontSize: 12, color: '#8A8B9F' }}>#{req.refNumber}</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#23263B', margin: 0 }}>{req.title}</p>
                        {req.description && <p style={{ fontSize: 12, color: '#8A8B9F', margin: '2px 0 0' }}>{req.description}</p>}
                        {(() => {
                          const crew = [...new Set([req.engineerName, ...(req.engineers ?? []).map(e => e.user.name)].filter(Boolean))]
                          return crew.length > 0 && <p style={{ fontSize: 12, color: '#8A8B9F', margin: '4px 0 0' }}>{crew.length > 1 ? 'Engineers' : 'Engineer'}: {crew.join(', ')}</p>
                        })()}
                        {req.cost > 0 && <p style={{ fontSize: 12, color: '#8A8B9F', margin: '2px 0 0' }}>Cost: ₹{req.cost.toLocaleString()}</p>}
                      </div>
                      {req.status === 'Open' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 12 }}>
                          <button onClick={() => onUpdateRequest(req, 'InProgress')} style={{ fontSize: 12, padding: '4px 8px', background: '#FEF3C7', color: '#A16207', borderRadius: 4, border: 'none', cursor: 'pointer' }}>Start</button>
                          <button onClick={() => onUpdateRequest(req, 'Resolved')} style={{ fontSize: 12, padding: '4px 8px', background: '#DCFCE7', color: '#15803D', borderRadius: 4, border: 'none', cursor: 'pointer' }}>Resolve</button>
                        </div>
                      )}
                      {req.status === 'InProgress' && (
                        <button onClick={() => onUpdateRequest(req, 'Resolved')} style={{ marginLeft: 12, fontSize: 12, padding: '4px 8px', background: '#DCFCE7', color: '#15803D', borderRadius: 4, border: 'none', cursor: 'pointer' }}>Resolve</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const ENGINEER_ROLES = new Set(['Engineer', 'SeniorEngineer', 'Technician'])

function NewRequestModal({ record, onClose, onSave }: any) {
  const [form, setForm] = useState({ type: 'complaint', title: '', description: '', priority: 'Medium', engineerId: '', engineerName: '', additionalEngineerIds: [] as string[], cost: 0 })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const can = useAuthStore(s => s.can)
  // GET /users needs hr_user:read_all, which most Service roles don't hold —
  // degrade to a free-text field rather than showing an empty/403'd dropdown.
  const { data: allUsers = [] } = useUsers(can('hr_user', 'read_all'))
  const engineers = allUsers.filter(u => ENGINEER_ROLES.has(u.role) && u.isActive !== false)
  // A job can need more than one hand — primary engineer drives the legacy
  // engineerId field (and its escalation logic), additional crew rides along.
  const crewOptions = engineers.filter(e => e.id !== form.engineerId)

  function pickEngineer(id: string) {
    const eng = engineers.find(e => e.id === id)
    setForm(f => ({ ...f, engineerId: id, engineerName: eng?.name ?? '', additionalEngineerIds: f.additionalEngineerIds.filter(x => x !== id) }))
  }
  function toggleCrew(id: string) {
    setForm(f => ({ ...f, additionalEngineerIds: f.additionalEngineerIds.includes(id) ? f.additionalEngineerIds.filter(x => x !== id) : [...f.additionalEngineerIds, id] }))
  }

  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #F0F1F5', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#23263B', outline: 'none' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 448 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>New Service Request</h2>
          <p style={{ fontSize: 13, color: '#8A8B9F', margin: '2px 0 0' }}>{record.project?.title}</p>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="complaint">Complaint</option>
                <option value="maintenance">Maintenance</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief description of the issue" />
          </div>
          <div>
            <label style={labelStyle}>Details</label>
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Assigned Engineer</label>
              {can('hr_user', 'read_all') ? (
                <select style={inputStyle} value={form.engineerId} onChange={e => pickEngineer(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {engineers.map(eng => <option key={eng.id} value={eng.id}>{eng.name}</option>)}
                </select>
              ) : (
                <input style={inputStyle} value={form.engineerName} onChange={e => set('engineerName', e.target.value)} placeholder="Engineer name" />
              )}
            </div>
            <div>
              <label style={labelStyle}>Estimated Cost</label>
              <input type="number" style={inputStyle} value={form.cost} onChange={e => set('cost', parseFloat(e.target.value))} />
            </div>
          </div>
          {can('hr_user', 'read_all') && crewOptions.length > 0 && (
            <div>
              <label style={labelStyle}>Additional Engineers (optional)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, border: '1px solid #F0F1F5', borderRadius: 8, padding: 10, maxHeight: 120, overflowY: 'auto' }}>
                {crewOptions.map(eng => (
                  <label key={eng.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#23263B', cursor: 'pointer', background: form.additionalEngineerIds.includes(eng.id) ? '#EFF6FF' : '#F9FAFB', padding: '4px 8px', borderRadius: 6 }}>
                    <input type="checkbox" checked={form.additionalEngineerIds.includes(eng.id)} onChange={() => toggleCrew(eng.id)} />
                    {eng.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: '#8A8B9F', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{ padding: '8px 16px', fontSize: 13, background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create Request</button>
        </div>
      </div>
    </div>
  )
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Service() {
  const can = useAuthStore(s => s.can)
  const canSeeService = can('service_record', 'read_all')

  const [search, setSearch] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecordAPI | null>(null)
  const [showRequestForm, setShowRequestForm] = useState(false)

  const { data: records = [], isLoading: recordsLoading, isError: recordsError, refetch: refetchRecords } = useServiceRecords(canSeeService)
  const { data: warrantyExpiring = [] } = useWarrantyExpiring(60, canSeeService)
  const { data: warrantyExpired = [] } = useWarrantyExpired(canSeeService)

  const createRequest = useCreateServiceRequest()
  const updateRequest = useUpdateServiceRequest()

  const openRequests = records.reduce((s, r) => s + r.serviceRequests.filter(req => req.status === 'Open').length, 0)
  const q = search.trim().toLowerCase()
  const filteredRecords = q ? records.filter(r => r.project.title.toLowerCase().includes(q) || r.project.company.name.toLowerCase().includes(q)) : records

  const TABS: [MainTab, string, number][] = [
    ['records', 'Service Records', records.length],
    ['warrantyExpiring', 'Warranty Expiring', warrantyExpiring.length],
    ['warrantyExpired', 'Warranty Expired', warrantyExpired.length],
  ]

  const [tab, setTab] = useState<MainTab>('records')

  if (!canSeeService) {
    return <div style={{ padding: 24 }}><p style={{ fontSize: 14, color: '#8A8B9F' }}>You don&apos;t have access to service records.</p></div>
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F0F1F5', marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(([t, label, count]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            color: tab === t ? '#5D78FF' : '#8A8B9F', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {label}
            {count > 0 && <span style={{ background: '#F4F5F9', color: '#8A8B9F', fontSize: 11, padding: '2px 6px', borderRadius: 999 }}>{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'records' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A8B9F' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project, customer…"
                style={{ width: '100%', paddingLeft: 32, paddingRight: 28, paddingTop: 6, paddingBottom: 6, fontSize: 12, borderRadius: 8, border: '1px solid #F0F1F5', outline: 'none', color: '#23263B', background: '#fff' }} />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A8B9F', padding: 0 }}><X style={{ width: 12, height: 12 }} /></button>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <KPICard icon={Shield} label="Service Records" value={records.length} color="blue" />
            <KPICard icon={AlertTriangle} label="Open Complaints" value={openRequests} color="red" />
            <KPICard icon={CheckCircle2} label="Resolved Requests" value={records.reduce((s, r) => s + r.serviceRequests.filter(req => req.status === 'Resolved' || req.status === 'Closed').length, 0)} color="green" />
          </div>

          {recordsLoading ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#8A8B9F' }}>Loading...</div>
          : recordsError ? (
            <EmptyState icon={AlertTriangle} title="Failed to load service records" subtitle="Something went wrong fetching this data."
              action={<button onClick={() => refetchRecords()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
          )
          : filteredRecords.length === 0 ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#8A8B9F' }}>{records.length === 0 ? 'No service records yet. Complete a project to automatically create one.' : 'No service records match your search.'}</div>
          : filteredRecords.map(record => (
            <ServiceRecordCard
              key={record.id}
              record={record}
              onViewDetails={() => setSelectedRecord(record)}
              onAddRequest={() => { setSelectedRecord(record); setShowRequestForm(true) }}
              onResolveRequest={(req) => updateRequest.mutate({ requestId: req.id, status: 'Resolved' })}
            />
          ))}
        </div>
      )}

      {tab === 'warrantyExpiring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {warrantyExpiring.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#8A8B9F' }}>No warranties expiring in the next 60 days.</div>
          ) : warrantyExpiring.map(record => (
            <WarrantyRow key={record.id} record={record} onOpen={() => setSelectedRecord(record)} />
          ))}
        </div>
      )}

      {tab === 'warrantyExpired' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {warrantyExpired.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#8A8B9F' }}>No expired warranties.</div>
          ) : warrantyExpired.map(record => (
            <WarrantyRow key={record.id} record={record} expired onOpen={() => setSelectedRecord(record)} />
          ))}
        </div>
      )}

      {selectedRecord && !showRequestForm && (
        <ServiceDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onAddRequest={() => setShowRequestForm(true)}
          onUpdateRequest={(req, status) => updateRequest.mutate({ requestId: req.id, status })}
        />
      )}

      {showRequestForm && selectedRecord && (
        <NewRequestModal
          record={selectedRecord}
          onClose={() => { setShowRequestForm(false); setSelectedRecord(null) }}
          onSave={(data: Record<string, unknown>) => { createRequest.mutate({ id: selectedRecord.id, ...data } as Parameters<typeof createRequest.mutate>[0]); setShowRequestForm(false); setSelectedRecord(null) }}
        />
      )}

    </div>
  )
}
