import { useState, useRef } from 'react'
import { useMaterialRequests, useCreateMaterialRequest, useApproveMaterialRequest, useRejectMaterialRequest } from '../hooks/useMaterialRequests'
import { useProjects } from '../hooks/useProjects'
import { useItems } from '../hooks/useItems'
import type { ItemAPI } from '../hooks/useItems'
import { useDealers } from '../hooks/useDealers'
import { useAuthStore } from '../lib/authStore'
import { Plus, Check, X, ChevronDown, ChevronUp, Trash2, Download } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { MaterialRequestPDF } from '../components/pdf/MaterialRequestPDF'
import { CsvImportExport } from '../components/shared/CsvImportExport'
import type { CsvColDef } from '../components/shared/CsvImportExport'
import type { MaterialRequest } from '../hooks/useMaterialRequests'

// Items serialised as "name|qty|unit|price;name2|qty2|unit2|price2"
const MR_CSV_COLS: CsvColDef<MaterialRequest>[] = [
  { header: 'RefNumber',      accessor: r => r.refNumber ?? '' },
  { header: 'Status',         accessor: r => r.status },
  { header: 'Project',        accessor: r => r.project?.title ?? '' },
  { header: 'TotalEstimated', accessor: r => r.totalEstimated != null ? String(r.totalEstimated) : '' },
  { header: 'Notes',          accessor: r => r.notes ?? '' },
  { header: 'Items',          accessor: r => r.items.map(i => [i.name, i.quantity, i.unit ?? '', i.estimatedPrice ?? ''].join('|')).join(';') },
]
const MR_CSV_TEMPLATE = { RefNumber: '', Status: 'pending', Project: '', TotalEstimated: '', Notes: 'Monthly site materials', Items: 'Copper wire|10|kg|500;PVC conduit|5|m|120' }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:           { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  partial_approved:  { bg: '#DBEAFE', color: '#1D4ED8', label: 'Partially Approved' },
  payment_pending:   { bg: '#EDE9FE', color: '#7C3AED', label: 'Payment Pending' },
  paid:              { bg: '#D1FAE5', color: '#065F46', label: 'Paid' },
  rejected:          { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
}

const MANAGER_ROLES = ['Manager', 'SuperAdmin']
const BIZHEAD_ROLES = ['BusinessHead', 'SuperAdmin']
const ACCOUNTANT_ROLES = ['Accountant', 'SuperAdmin']

function ApprovalBadge({ label, approvedAt, approvedBy }: { label: string; approvedAt?: string; approvedBy?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontSize: 10, color: '#8A8FA8', fontWeight: 600 }}>{label}</div>
      {approvedAt ? (
        <div style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}>
          <Check size={10} />Done
        </div>
      ) : (
        <div style={{ background: '#F3F4F6', color: '#6B7280', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Pending</div>
      )}
    </div>
  )
}

const blankItem = () => ({
  name: '', quantity: 1, unit: '', estimatedPrice: '', description: '', componentRefNo: '',
  // Sourcing: which dealer supplies this line, at what price, against which quote.
  vendorId: '', unitPrice: '', referenceNumber: '',
})

export default function MaterialRequests() {
  const user = useAuthStore(s => s.user)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [showMine, setShowMine] = useState(false)
  const [items, setItems] = useState([blankItem()])
  const [notes, setNotes] = useState('')
  const [projectId, setProjectId] = useState('')

  const { data: requests = [], isLoading } = useMaterialRequests({ status: filterStatus || undefined, mine: showMine || undefined })
  const { data: projects = [] } = useProjects()
  const { data: dealerItems = [] } = useItems()
  const { data: dealers = [] } = useDealers()
  const create = useCreateMaterialRequest()
  const [dropdownIdx, setDropdownIdx] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function importMRs(rows: Record<string, string>[]) {
    let success = 0; const errors: string[] = []
    for (const [i, row] of rows.entries()) {
      const rawItems = (row.Items ?? '').split(';').map(s => s.trim()).filter(Boolean).map(seg => {
        const [name, qty, unit, price] = seg.split('|')
        return { name: name?.trim() ?? '', quantity: Number(qty) || 1, unit: unit?.trim() || undefined, estimatedPrice: price ? Number(price) : undefined }
      }).filter(it => it.name)
      if (!rawItems.length) { errors.push(`Row ${i + 1}: no valid items`); continue }
      const proj = projects.find(p => p.title.toLowerCase() === (row.Project ?? '').toLowerCase())
      try {
        await create.mutateAsync({ projectId: proj?.id, items: rawItems, notes: row.Notes || undefined, totalEstimated: row.TotalEstimated ? Number(row.TotalEstimated) : undefined })
        success++
      } catch (e: unknown) { errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Error'}`) }
    }
    return { total: rows.length, success, errors }
  }
  const approve = useApproveMaterialRequest()
  const reject = useRejectMaterialRequest()

  const itemsTotal = items.reduce((a, i) => a + (Number(i.estimatedPrice) || 0) * (Number(i.quantity) || 0), 0)

  const canCreate = user && ['Manager', 'SeniorEngineer', 'Engineer', 'Technician', 'SuperAdmin'].includes(user.role)
  const canApproveManager = user && MANAGER_ROLES.includes(user.role)
  const canApproveBizHead = user && BIZHEAD_ROLES.includes(user.role)
  const canApproveAccountant = user && ACCOUNTANT_ROLES.includes(user.role)

  function handleCreate() {
    const validItems = items.filter(i => i.name.trim())
    if (!validItems.length) return
    create.mutate({
      projectId: projectId || undefined,
      items: validItems.map(i => ({
        name: i.name,
        quantity: Number(i.quantity),
        unit: i.unit || undefined,
        estimatedPrice: i.estimatedPrice ? Number(i.estimatedPrice) : undefined,
        description: i.description || undefined,
        componentRefNo: i.componentRefNo || undefined,
        vendorId: i.vendorId || undefined,
        unitPrice: i.unitPrice ? Number(i.unitPrice) : undefined,
        referenceNumber: i.referenceNumber || undefined,
      })),
      notes: notes || undefined,
      totalEstimated: itemsTotal > 0 ? itemsTotal : undefined,
    }, {
      onSuccess: () => { setShowCreate(false); setItems([blankItem()]); setNotes(''); setProjectId('') }
    })
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CsvImportExport data={requests} columns={MR_CSV_COLS} filename="material-requests.csv" templateRow={MR_CSV_TEMPLATE} onImport={importMRs} />
          {canCreate && (
            <button onClick={() => setShowCreate(v => !v)} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Plus size={14} />New Request
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pending Approval', value: requests.filter(r => ['pending', 'partial_approved'].includes(r.status)).length, color: '#F59E0B' },
          { label: 'Awaiting Payment', value: requests.filter(r => r.status === 'payment_pending').length, color: '#7C3AED' },
          { label: 'Paid', value: requests.filter(r => r.status === 'paid').length, color: '#2BC155' },
          { label: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, color: '#EF4444' },
          { label: 'Est. Value (open)', value: `₹${requests.filter(r => !['paid', 'rejected'].includes(r.status)).reduce((a, r) => a + (r.totalEstimated ?? 0), 0).toLocaleString('en-IN')}`, color: '#5D78FF' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8A8FA8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>New Material Request</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 4 }}>Project (optional)</div>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff', minWidth: 240, marginBottom: 10 }}>
              <option value="">No project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {items.map((item, idx) => {
              const query = item.name.toLowerCase()
              // Sourced from the dealer Item catalog only - a request is for
              // something to procure from a dealer, not a lookup of existing
              // warehouse stock (that's RawComponent, used elsewhere).
              const dealerSuggestions: (ItemAPI & { _kind: 'dealer' })[] = query.length >= 1
                ? (() => {
                    const seen = new Set<string>()
                    const out: (ItemAPI & { _kind: 'dealer' })[] = []
                    for (const it of dealerItems) {
                      if (seen.has(it.id)) continue // guards against a duplicate id ever slipping into the cache
                      const hit =
                        it.name.toLowerCase().includes(query) ||
                        (it.category ?? '').toLowerCase().includes(query) ||
                        (it.brand ?? '').toLowerCase().includes(query) ||
                        (it.dealer?.name ?? '').toLowerCase().includes(query)
                      if (!hit) continue
                      seen.add(it.id)
                      out.push({ ...it, _kind: 'dealer' as const })
                      if (out.length >= 6) break
                    }
                    return out
                  })()
                : []
              const suggestions = dealerSuggestions
              function pickDealerItem(it: ItemAPI) {
                setItems(prev => prev.map((x, i) => i === idx ? {
                  ...x,
                  name: it.name,
                  unit: it.unit ?? x.unit,
                  estimatedPrice: it.price != null ? String(it.price) : x.estimatedPrice,
                  componentRefNo: it.partNumber ?? `Dealer: ${it.dealer?.name ?? ''}`,
                  // Carry the dealer and their price straight onto the line so the
                  // approved request raises a PO against the right vendor.
                  vendorId: it.dealerId ?? x.vendorId,
                  unitPrice: it.price != null ? String(it.price) : x.unitPrice,
                  referenceNumber: it.partNumber ?? x.referenceNumber,
                } : x))
                setDropdownIdx(null)
              }
              return (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: '2 1 140px' }}>
                    <input
                      value={item.name}
                      onChange={e => { setItems(p => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x)); setDropdownIdx(idx) }}
                      onFocus={() => setDropdownIdx(idx)}
                      onBlur={() => setTimeout(() => setDropdownIdx(null), 150)}
                      placeholder="Item name * (search dealer items)"
                      style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }}
                    />
                    {dropdownIdx === idx && suggestions.length > 0 && (
                      <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E8E9F0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 999, maxHeight: 280, overflowY: 'auto' }}>
                        {suggestions.map(s => (
                          <div key={`${s._kind}-${s.id}`} onMouseDown={() => pickDealerItem(s)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F4F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F4F5FF')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#374557', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {s.name}
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#E8EDFF', color: '#5D78FF' }}>
                                  Dealer
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: '#8A8FA8' }}>
                                {s.dealer?.name ?? ''} · {s.category ?? ''} · {s.unit ?? ''}
                              </div>
                            </div>
                            {s.price != null && (
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#5D78FF', whiteSpace: 'nowrap', marginLeft: 8 }}>₹{s.price.toLocaleString('en-IN')}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input value={item.quantity} type="number" min={1} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))} placeholder="Qty" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 70 }} />
                  <input value={item.unit} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} placeholder="Unit" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 80 }} />
                  <input value={item.estimatedPrice} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, estimatedPrice: e.target.value } : x))} placeholder="Est. Price" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 100 }} />
                  <input value={item.componentRefNo} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, componentRefNo: e.target.value } : x))} placeholder="RC Ref#" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 120 }} />
                  {/* Sourcing — dealer and quote reference */}
                  <select value={item.vendorId} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, vendorId: e.target.value } : x))}
                    style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 150 }}>
                    <option value="">Dealer…</option>
                    {dealers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <input value={item.referenceNumber} onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, referenceNumber: e.target.value } : x))} placeholder="Ref#" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 110 }} />
                  {items.length > 1 && <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={14} /></button>}
                </div>
              )
            })}
            <button onClick={() => setItems(p => [...p, blankItem()])} style={{ fontSize: 12, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>+ Add item</button>
            {itemsTotal > 0 && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', marginTop: 8, padding: '8px 12px', background: '#F8F9FF', borderRadius: 8, display: 'inline-block' }}>
                Estimated total: <span style={{ color: '#5D78FF' }}>₹{itemsTotal.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical', height: 60, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleCreate} disabled={create.isPending} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {create.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showMine} onChange={e => setShowMine(e.target.checked)} />
          My requests only
        </label>
      </div>

      {/* Request list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isLoading ? <div style={{ fontSize: 13, color: '#8A8FA8' }}>Loading...</div> :
          requests.length === 0 ? <div style={{ fontSize: 13, color: '#8A8FA8', textAlign: 'center', padding: 40 }}>No requests found</div> :
          requests.map(r => {
            const ss = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
            const expanded = expandedId === r.id
            const canApprove = (canApproveManager && !r.managerApprovedAt) || (canApproveBizHead && !r.bizHeadApprovedAt) || (canApproveAccountant && r.managerApprovedAt && r.bizHeadApprovedAt && !r.accountantApprovedAt)

            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : r.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: '#5D78FF' }}>{r.refNumber}</span>
                      <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{ss.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                      By {r.requestedBy?.name} · {r.items.length} item{r.items.length !== 1 ? 's' : ''}
                      {r.project ? ` · ${r.project.title}` : ''}
                      {r.totalEstimated ? ` · Est. ₹${r.totalEstimated.toLocaleString('en-IN')}` : ''}
                      · {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <ApprovalBadge label="Manager" approvedAt={r.managerApprovedAt} />
                    <ApprovalBadge label="Biz Head" approvedAt={r.bizHeadApprovedAt} />
                    <ApprovalBadge label="Accountant" approvedAt={r.accountantApprovedAt} />
                    {expanded ? <ChevronUp size={16} color="#8A8FA8" /> : <ChevronDown size={16} color="#8A8FA8" />}
                  </div>
                </div>

                {expanded && (
                  <div style={{ borderTop: '1px solid #F0F1F5', padding: '14px 18px' }}>
                    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                    <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#FAFBFF' }}>
                          {['Item', 'Qty', 'Unit', 'Est. Price', 'Ref#'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.items.map(item => (
                          <tr key={item.id} style={{ borderTop: '1px solid #F8F9FF' }}>
                            <td style={{ padding: '7px 10px', fontSize: 13 }}>{item.name}</td>
                            <td style={{ padding: '7px 10px', fontSize: 13 }}>{item.quantity}</td>
                            <td style={{ padding: '7px 10px', fontSize: 13 }}>{item.unit ?? '—'}</td>
                            <td style={{ padding: '7px 10px', fontSize: 13 }}>{item.estimatedPrice ? `₹${item.estimatedPrice.toLocaleString('en-IN')}` : '—'}</td>
                            <td style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'monospace', color: '#5D78FF' }}>{item.componentRefNo ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {r.notes && <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>Notes: {r.notes}</div>}
                    {r.rejectionReason && <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 12 }}>Rejection: {r.rejectionReason}</div>}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {r.status !== 'rejected' && r.status !== 'paid' && canApprove && (
                        <button
                          onClick={() => approve.mutate(r.id)}
                          disabled={approve.isPending}
                          style={{ background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: approve.isPending ? 'not-allowed' : 'pointer', opacity: approve.isPending ? 0.6 : 1, display: 'flex', gap: 5, alignItems: 'center' }}>
                          <Check size={12} />{approve.isPending ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                      {r.status !== 'rejected' && r.status !== 'paid' && (canApproveManager || canApproveBizHead) && (
                        <button
                          onClick={() => reject.mutate({ id: r.id, reason: prompt('Rejection reason?') ?? undefined })}
                          disabled={reject.isPending}
                          style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: reject.isPending ? 'not-allowed' : 'pointer', opacity: reject.isPending ? 0.6 : 1, display: 'flex', gap: 5, alignItems: 'center' }}>
                          <X size={12} />{reject.isPending ? 'Rejecting…' : 'Reject'}
                        </button>
                      )}
                      {['payment_pending', 'paid'].includes(r.status) && (
                        <PDFDownloadLink
                          document={<MaterialRequestPDF
                            refNumber={r.refNumber}
                            createdAt={r.createdAt}
                            status={r.status}
                            projectTitle={r.project?.title}
                            requestedBy={r.requestedBy?.name}
                            managerApprovedAt={r.managerApprovedAt}
                            bizHeadApprovedAt={r.bizHeadApprovedAt}
                            accountantApprovedAt={r.accountantApprovedAt}
                            totalEstimated={r.totalEstimated}
                            notes={r.notes}
                            items={r.items}
                          />}
                          fileName={`MR-${r.refNumber}.pdf`}
                          style={{ textDecoration: 'none' }}
                        >
                          {({ loading, error }: { loading: boolean; error: Error | null }) => (
                            <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: 'none', background: error ? '#FEE2E2' : '#E8EDFF', color: error ? '#B91C1C' : '#5D78FF', cursor: 'pointer' }}>
                              <Download size={12} /> {error ? 'PDF Error' : loading ? '…' : 'Download PDF'}
                            </button>
                          )}
                        </PDFDownloadLink>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
