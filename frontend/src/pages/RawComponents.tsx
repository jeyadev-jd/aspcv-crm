import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import { useState, Fragment } from 'react'
import type React from 'react'
import { Plus, X, Edit2, Boxes, Search, Package, Clock, ArrowRight, RotateCcw, AlertTriangle } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCurrency } from '@/lib/currencyContext'
import { useComponents, useCreateComponent, useUpdateComponent, useAssignComponent, useReturnComponent, useBulkDeleteComponents } from '@/hooks/useComponents'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import BulkActionBar from '@/components/shared/BulkActionBar'
import BulkDeleteDialog from '@/components/shared/BulkDeleteDialog'
import type { RawComponent } from '@/hooks/useComponents'
import { useDealers } from '@/hooks/useDealers'
import { useCreateAllocation, useDeleteAllocation, useInventoryAllocations } from '@/hooks/useERP'
import { useProjects } from '@/hooks/useProjects'
import { useScopeItems, useAllocateComponent } from '@/hooks/useScopeItems'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/shared/useConfirm'
import SearchableSelect from '@/components/shared/SearchableSelect'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  in_stock: { bg: '#E7FAF0', color: '#2BC155', label: 'In Stock' },
  assigned: { bg: '#E8EDFF', color: '#5D78FF', label: 'Assigned' },
  used:     { bg: '#F4F5F9', color: '#8C8C8C', label: 'Used' },
  returned: { bg: '#FFF5EE', color: '#FF9B52', label: 'Returned' },
  disposed: { bg: '#FFF0F0', color: '#FF5353', label: 'Disposed' },
}

const blankForm = {
  name: '', category: '', dealerName: '', dealerId: '',
  price: '', gstPercent: '18', hsnCode: '', unit: 'pcs', quantity: '1',
  warrantyMonths: '', notes: '',
}

function ageDays(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) }
function warrantyStatus(receivedAt: string, warrantyMonths?: number | null): { label: string; color: string } | null {
  if (!warrantyMonths) return null
  const expiry = new Date(receivedAt); expiry.setMonth(expiry.getMonth() + warrantyMonths)
  const d = Math.floor((expiry.getTime() - Date.now()) / 86400000)
  if (d < 0) return { label: 'Expired', color: '#EF4444' }
  if (d < 60) return { label: `${d}d left`, color: '#F59E0B' }
  return { label: `${warrantyMonths}mo`, color: '#6B7280' }
}

export default function RawComponents() {
  const { confirm, confirmDialog } = useConfirm()
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const user = useAuthStore(s => s.user)
  const canManage = user && ['Manager', 'ProjectHead', 'SuperAdmin', 'BusinessHead'].includes(user.role ?? '')
  const { data: components = [], isLoading, isError, refetch } = useComponents()
  const bulkDeleteComponents = useBulkDeleteComponents()
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const { data: dealers = [] } = useDealers()
  const create = useCreateComponent()
  const update = useUpdateComponent()
  const assignComp = useAssignComponent()
  const returnComp = useReturnComponent()

  const { data: projects = [] } = useProjects()
  const createAllocation = useCreateAllocation()

  const [viewTab, setViewTab] = useState<'inventory' | 'assignments'>('inventory')
  const deleteAllocation = useDeleteAllocation()
  const { data: allAllocations = [] } = useInventoryAllocations()
  const [assignInlineId, setAssignInlineId] = useState<string | null>(null)
  const [assignInlineForm, setAssignInlineForm] = useState({ type: 'project', name: '' })
  const [changeAllocId, setChangeAllocId] = useState<string | null>(null)
  const [changeProjectId, setChangeProjectId] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [categoryTab, setCategoryTab] = useState<'Raw' | 'SemiFinished' | 'FinishedGoods' | 'All'>('All')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [assignModalComp, setAssignModalComp] = useState<RawComponent | null>(null)
  const [assignProjectId, setAssignProjectId] = useState('')
  const [assignQty, setAssignQty] = useState('1')
  const [assignNotes, setAssignNotes] = useState('')
  const [assignScopeItemId, setAssignScopeItemId] = useState('')

  // Scope lines of the project chosen in the assign modal, so the operator can
  // say which line this component fulfils rather than just naming the project.
  const { data: projectScope = [] } = useScopeItems('Project', assignProjectId || undefined)
  const allocateToScope = useAllocateComponent()
  const unallocatedScopeLines = projectScope.filter(s => !s.inventoryComponentId)

  const filtered = components.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false
    if (categoryTab === 'Raw' && !['Raw', undefined, null, ''].includes(c.category as any) && c.category !== 'Raw') return false
    if (categoryTab === 'SemiFinished' && c.category !== 'SemiFinished') return false
    if (categoryTab === 'FinishedGoods' && c.category !== 'FinishedGoods') return false
    if (search && !`${c.name} ${c.refNumber} ${c.dealerName ?? ''} ${c.category ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // This table is not paginated, so selection spans the whole filtered set.
  const bulk = useBulkSelect(filtered.map(c => c.id))

  async function handleBulkDelete() {
    try {
      const res = await bulkDeleteComponents.mutateAsync(bulk.selectedIds)
      if (res.blocked?.length) {
        toast.error(`${res.deleted} deleted · ${res.blocked.length} still in use`)
      } else {
        toast.success(`Deleted ${res.deleted} component${res.deleted === 1 ? '' : 's'}`)
      }
      bulk.clear()
    } catch {
      toast.error('Bulk delete failed')
    }
    setShowBulkDelete(false)
  }

  const rawCount = components.filter(c => !c.category || c.category === 'Raw').length
  const semiCount = components.filter(c => c.category === 'SemiFinished').length
  const finishedCount = components.filter(c => c.category === 'FinishedGoods').length

  const totalValue = components.reduce((s, c) => s + (c.price ?? 0) * (c.quantity ?? 1), 0)
  const inStock = components.filter(c => c.status === 'in_stock').length

  function openCreate() { setEditId(null); setForm(blankForm); setErrors({}); setShowModal(true) }
  function openEdit(c: RawComponent) {
    setEditId(c.id)
    setForm({
      name: c.name, category: c.category ?? '', dealerName: c.dealerName ?? '', dealerId: c.dealerId ?? '',
      price: c.price != null ? String(c.price) : '', gstPercent: c.gstPercent != null ? String(c.gstPercent) : '18',
      hsnCode: c.hsnCode ?? '', unit: c.unit ?? 'pcs', quantity: c.quantity != null ? String(c.quantity) : '1',
      warrantyMonths: c.warrantyMonths != null ? String(c.warrantyMonths) : '', notes: c.notes ?? '',
    })
    setErrors({}); setShowModal(true)
  }
  function close() { setShowModal(false); setEditId(null); setForm(blankForm); setErrors({}) }

  async function save() {
    if (!form.name.trim()) { setErrors({ name: 'Name required' }); return }
    const payload = {
      name: form.name, category: form.category || undefined,
      dealerName: form.dealerName || undefined, dealerId: form.dealerId || undefined,
      price: form.price ? Number(form.price) : undefined,
      gstPercent: form.gstPercent ? Number(form.gstPercent) : undefined,
      hsnCode: form.hsnCode || undefined, unit: form.unit || undefined,
      quantity: form.quantity ? Number(form.quantity) : 1,
      warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
      notes: form.notes || undefined,
    }
    if (editId) await update.mutateAsync({ id: editId, ...payload })
    else await create.mutateAsync(payload)
    close()
  }

  if (isLoading) return <Spinner />
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load components" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
  )

  const agingCount = components.filter(c => c.status === 'in_stock' && ageDays(c.receivedAt) > 90).length
  const assigned = components.filter(c => c.status === 'assigned')

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)' }}>
{confirmDialog}

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #F0F1F5', paddingBottom: 0 }}>
        {([['inventory', 'Inventory'], ['assignments', `Assigned (${assigned.length})`]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setViewTab(t)} style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: viewTab === t ? '#5D78FF' : '#B1B1BE', borderBottom: `2px solid ${viewTab === t ? '#5D78FF' : 'transparent'}`, marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      {/* Assignments view */}
      {viewTab === 'assignments' && (
        <div>
          {agingCount > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#B91C1C', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Clock size={14} /> {agingCount} component{agingCount !== 1 ? 's' : ''} in stock over 90 days — assign soon
            </div>
          )}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  {['Ref #', 'Name', 'Category', 'Age', 'Warranty', 'Status', 'Assigned To', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: '#B1B1BE', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {components.map((c, i) => {
                  const days = ageDays(c.receivedAt)
                  const w = warrantyStatus(c.receivedAt, c.warrantyMonths)
                  const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.in_stock
                  return (
                    <Fragment key={c.id}>
                      <tr style={{ borderBottom: i < components.length - 1 ? '1px solid #F4F5F9' : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: '#5D78FF' }}>{c.refNumber}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.name}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{c.category ?? '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 12, fontWeight: days > 90 ? 700 : 400, color: days > 90 ? '#EF4444' : '#374557', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {days > 90 && <Clock size={11} />}{days}d
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>{w ? <span style={{ color: w.color, fontWeight: 600 }}>{w.label}</span> : '—'}</td>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: ss.bg, color: ss.color }}>{ss.label}</span></td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{c.assignedToType ? `${c.assignedToType}` : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {canManage && c.status === 'in_stock' && (
                              assignInlineId === c.id ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <input value={assignInlineForm.name} onChange={e => setAssignInlineForm(p => ({ ...p, name: e.target.value }))} placeholder="Entity name" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #F0F1F5', fontSize: 11, width: 120 }} />
                                  <button onClick={() => { assignComp.mutate({ id: c.id, toEntityType: assignInlineForm.type, toEntityId: '', toEntityName: assignInlineForm.name }); setAssignInlineId(null) }} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>OK</button>
                                  <button onClick={() => setAssignInlineId(null)} style={{ background: '#F4F5F9', color: '#374557', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                                </div>
                              ) : (
                                <button onClick={() => { setAssignInlineId(c.id); setAssignInlineForm({ type: 'project', name: '' }) }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#1D4ED8', background: '#DBEAFE', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                                  <ArrowRight size={11} /> Assign
                                </button>
                              )
                            )}
                            {canManage && c.status === 'assigned' && (() => {
                              const alloc = allAllocations.find((a: any) => a.rawComponentId === c.id)
                              return changeAllocId === c.id ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <select value={changeProjectId} onChange={e => setChangeProjectId(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #F0F1F5', fontSize: 11 }}>
                                    <option value="">— Select project —</option>
                                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                                  </select>
                                  <button onClick={async () => {
                                    if (!changeProjectId) return
                                    if (alloc) await deleteAllocation.mutateAsync(alloc.id)
                                    await createAllocation.mutateAsync({ rawComponentId: c.id, projectId: changeProjectId, quantity: c.quantity ?? 1 })
                                    setChangeAllocId(null)
                                  }} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>OK</button>
                                  <button onClick={() => setChangeAllocId(null)} style={{ background: '#F4F5F9', color: '#374557', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => returnComp.mutate({ id: c.id })} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#EDE9FE', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                                    <RotateCcw size={11} /> Return
                                  </button>
                                  <button onClick={() => { setChangeAllocId(c.id); setChangeProjectId('') }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#FF9B52', background: '#FFF5EE', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                                    <ArrowRight size={11} /> Change
                                  </button>
                                  {alloc && (
                                    <button onClick={() => { confirm({ title: 'Return this allocation to raw materials stock?', onConfirm: () => deleteAllocation.mutate(alloc.id) }) }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#FF5353', background: '#FFF0F0', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                                      <X size={11} /> Unassign
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
                {components.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center' }}>
                    <Boxes size={26} style={{ color: '#D5D5D5', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, color: '#B1B1BE' }}>No components.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory view */}
      {viewTab === 'inventory' && <>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(150px, 220px))', gap: 12, marginBottom: 16 }}>
        <Stat label="Total Items" value={String(components.length)} />
        <Stat label="In Stock" value={String(inStock)} />
        <Stat label="Inventory Value" value={`${symbol}${totalValue.toLocaleString()}`} />
      </div>

      {/* Inventory Category Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['All', components.length], ['Raw', rawCount], ['SemiFinished', semiCount], ['FinishedGoods', finishedCount]] as [string, number][]).map(([tab, count]) => (
          <button key={tab} onClick={() => setCategoryTab(tab as any)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: categoryTab === tab ? (tab === 'SemiFinished' ? '#F59E0B' : tab === 'FinishedGoods' ? '#10B981' : tab === 'Raw' ? '#3B82F6' : '#5D78FF') : '#F4F5F9',
            color: categoryTab === tab ? '#fff' : '#6B7280',
          }}>
            {tab === 'All' ? 'All Inventory' : tab === 'SemiFinished' ? 'Semi-Finished' : tab === 'FinishedGoods' ? 'Finished Goods' : 'Raw Materials'} ({count})
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search components…"
              style={{ paddingLeft: 34, paddingRight: 14, height: 38, borderRadius: 10, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', width: isMobile ? 180 : 240, boxSizing: 'border-box' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 38, padding: '0 12px', borderRadius: 10, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', background: '#fff' }}>
            <option value="All">All status</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> New Component
        </button>
      </div>

      <BulkActionBar count={bulk.count} entityLabel="components" onDelete={() => setShowBulkDelete(true)} onClear={bulk.clear} />
      {showBulkDelete && (
        <BulkDeleteDialog
          count={bulk.count}
          entityLabel="components"
          isPending={bulkDeleteComponents.isPending}
          onCancel={() => setShowBulkDelete(false)}
          onConfirm={handleBulkDelete}
        />
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
              <th style={{ padding: '10px 0 10px 14px', width: 32 }}>
                <input type="checkbox" checked={bulk.allSelected}
                  ref={el => { if (el) el.indeterminate = bulk.someSelected }}
                  onChange={bulk.toggleAll} style={{ cursor: 'pointer' }} />
              </th>
              {['Ref #', 'Name', 'Dealer', 'Price', 'GST', 'Qty', 'Warranty', 'Age', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: '#B1B1BE', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.in_stock
              const age = ageDays(c.receivedAt)
              return (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F4F5F9' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '11px 0 11px 14px' }}>
                    <input type="checkbox" checked={bulk.isSelected(c.id)} onChange={() => bulk.toggle(c.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: '#5D78FF', whiteSpace: 'nowrap' }}>{c.refNumber}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {c.category && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                          background: c.category === 'SemiFinished' ? '#FEF3C7' : c.category === 'FinishedGoods' ? '#D1FAE5' : '#DBEAFE',
                          color: c.category === 'SemiFinished' ? '#92400E' : c.category === 'FinishedGoods' ? '#065F46' : '#1E40AF',
                        }}>
                          {c.category === 'SemiFinished' ? 'SEMI-FINISHED' : c.category === 'FinishedGoods' ? 'FINISHED GOODS' : 'RAW'}
                        </span>
                      )}
                      {c.hsnCode && <span style={{ fontSize: 10, color: '#B1B1BE' }}>HSN {c.hsnCode}</span>}
                    </div>
                    {/* Salvaged stock records its origin project in the notes. */}
                    {c.notes?.startsWith('Pushed from project') && (
                      <p style={{ fontSize: 10, color: '#B26A00', marginTop: 2 }}>{c.notes}</p>
                    )}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.dealerName || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557', whiteSpace: 'nowrap' }}>{c.price != null ? `${symbol}${c.price.toLocaleString()}` : '—'}{c.unit ? <span style={{ fontSize: 10, color: '#B1B1BE' }}>/{c.unit}</span> : ''}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.gstPercent != null ? `${c.gstPercent}%` : '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.quantity ?? 1}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.warrantyMonths != null ? `${c.warrantyMonths} mo` : '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: age > 90 ? '#FF5353' : '#374557', fontWeight: age > 90 ? 700 : 400, whiteSpace: 'nowrap' }}>{age}d</td>
                  <td style={{ padding: '11px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: ss.bg, color: ss.color, whiteSpace: 'nowrap' }}>{ss.label}</span></td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(c)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={14} /></button>
                      <button onClick={() => { setAssignModalComp(c); setAssignProjectId(''); setAssignScopeItemId(''); setAssignQty('1'); setAssignNotes('') }} title="Assign to project" style={{ color: '#5D78FF', background: '#E8EDFF', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600 }}><Package size={12} /> Assign</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center' }}>
                <Boxes size={26} style={{ color: '#D5D5D5', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: '#B1B1BE' }}>No components found.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      </> /* end inventory view */}

      {/* Assign to Project modal */}
      {assignModalComp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 'min(440px, 96vw)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>Assign to Project</p>
                <p style={{ fontSize: 11, color: '#B1B1BE' }}>{assignModalComp.name} · {assignModalComp.refNumber}</p>
              </div>
              <button onClick={() => setAssignModalComp(null)} style={{ color: '#B1B1BE', background: '#F4F5F9', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8 }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <F label="Project *">
                <SearchableSelect
                  value={assignProjectId}
                  onChange={v => { setAssignProjectId(v); setAssignScopeItemId('') }}
                  placeholder="— Select project —"
                  options={projects.map((p: any) => ({ value: p.id, label: p.title }))}
                />
              </F>
              {/* Optional: tie this component to the specific scope line it fulfils. */}
              {assignProjectId && (
                <F label="Scope of Supply line">
                  <select value={assignScopeItemId} onChange={e => setAssignScopeItemId(e.target.value)} style={inp(false)}>
                    <option value="">— Not linked to a scope line —</option>
                    {unallocatedScopeLines.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ×{s.quantity}</option>
                    ))}
                  </select>
                  {unallocatedScopeLines.length === 0 && (
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4 }}>
                      No unallocated scope lines on this project.
                    </p>
                  )}
                </F>
              )}
              {/* A scope line consumes its own quantity, so this input only applies
                  to a plain project-level allocation. */}
              {!assignScopeItemId && (
                <F label={`Quantity (available: ${assignModalComp.quantity ?? 1})`}>
                  <input type="number" min="1" max={assignModalComp.quantity ?? 1} value={assignQty} onChange={e => setAssignQty(e.target.value)} style={inp(false)} />
                </F>
              )}
              <F label="Notes">
                <input value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="Optional notes" style={inp(false)} />
              </F>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={() => setAssignModalComp(null)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                disabled={!assignProjectId || createAllocation.isPending || allocateToScope.isPending}
                onClick={async () => {
                  if (!assignProjectId) return
                  try {
                    // The scope-line endpoint books its own InventoryAllocation, so
                    // only one of these two paths may run.
                    if (assignScopeItemId) {
                      await allocateToScope.mutateAsync({ scopeItemId: assignScopeItemId, componentId: assignModalComp.id, notes: assignNotes || undefined })
                    } else {
                      await createAllocation.mutateAsync({ rawComponentId: assignModalComp.id, projectId: assignProjectId, quantity: Number(assignQty) || 1, notes: assignNotes || undefined })
                    }
                    setAssignModalComp(null)
                  } catch (e: any) {
                    toast.error(e?.response?.data?.error || 'Failed to assign component')
                  }
                }}
                style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer', opacity: !assignProjectId ? 0.5 : 1 }}
              >{createAllocation.isPending || allocateToScope.isPending ? 'Assigning…' : 'Assign to Project'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 'min(560px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Component' : 'New Raw Component'}</p>
              <button onClick={close} style={{ color: '#B1B1BE', background: '#F4F5F9', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8 }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <F label="Component Name *" error={errors.name}><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Scroll Compressor 5HP" style={inp(!!errors.name)} /></F>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Category"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Compressors" style={inp(false)} /></F>
                <F label="Dealer">
                  <input list="dealer-list" value={form.dealerName} onChange={e => {
                    const d = dealers.find(x => x.name === e.target.value)
                    setForm({ ...form, dealerName: e.target.value, dealerId: d?.id ?? '' })
                  }} placeholder="Dealer name" style={inp(false)} />
                  <datalist id="dealer-list">{dealers.map(d => <option key={d.id} value={d.name} />)}</datalist>
                </F>
                <F label={`Price (${symbol})`}><input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inp(false)} /></F>
                <F label="GST %"><input type="number" min="0" value={form.gstPercent} onChange={e => setForm({ ...form, gstPercent: e.target.value })} style={inp(false)} /></F>
                <F label="HSN Code"><input value={form.hsnCode} onChange={e => setForm({ ...form, hsnCode: e.target.value })} placeholder="8414" style={inp(false)} /></F>
                <F label="Unit"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs / kg / m" style={inp(false)} /></F>
                <F label="Quantity"><input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={inp(false)} /></F>
                <F label="Warranty (months)"><input type="number" min="0" value={form.warrantyMonths} onChange={e => setForm({ ...form, warrantyMonths: e.target.value })} style={inp(false)} /></F>
              </div>
              {form.price && (
                <div style={{ background: '#F8F9FF', borderRadius: 10, padding: 12, fontSize: 12, color: '#374557', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Price incl. GST: <strong>{symbol}{(Number(form.price) * (1 + Number(form.gstPercent || 0) / 100)).toLocaleString()}</strong></span>
                  <span>Line total: <strong>{symbol}{(Number(form.price) * (1 + Number(form.gstPercent || 0) / 100) * Number(form.quantity || 1)).toLocaleString()}</strong></span>
                </div>
              )}
              <F label="Notes"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inp(false), resize: 'vertical' }} /></F>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={create.isPending || update.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {(create.isPending || update.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Add Component'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
      <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#374557' }}>{value}</p>
    </div>
  )
}
function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>{label}</label>{children}{error && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{error}</p>}</div>
}
function inp(err: boolean): React.CSSProperties {
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${err ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
