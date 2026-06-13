import { useState, Fragment } from 'react'
import { useComponents, useCreateComponent, useUpdateComponent, useAssignComponent, useReturnComponent } from '../hooks/useComponents'
import { useAuthStore } from '../lib/authStore'
import { Plus, ChevronDown, ChevronUp, Package, ArrowRight, RotateCcw, Clock, Trash2 } from 'lucide-react'
import type { RawComponent } from '../hooks/useComponents'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  in_stock:  { bg: '#D1FAE5', color: '#065F46', label: 'In Stock' },
  assigned:  { bg: '#DBEAFE', color: '#1D4ED8', label: 'Assigned' },
  used:      { bg: '#FEE2E2', color: '#B91C1C', label: 'Used' },
  returned:  { bg: '#EDE9FE', color: '#7C3AED', label: 'Returned' },
  disposed:  { bg: '#F3F4F6', color: '#374151', label: 'Disposed' },
}

function daysInWarehouse(receivedAt: string) {
  return Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86400000)
}

function warrantyStatus(receivedAt: string, warrantyMonths?: number | null): { label: string; color: string } | null {
  if (!warrantyMonths) return null
  const expiry = new Date(receivedAt)
  expiry.setMonth(expiry.getMonth() + warrantyMonths)
  const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86400000)
  if (daysLeft < 0) return { label: 'Expired', color: '#EF4444' }
  if (daysLeft < 60) return { label: `${daysLeft}d left`, color: '#F59E0B' }
  return { label: `${warrantyMonths}mo`, color: '#6B7280' }
}

const blankForm = () => ({
  name: '', category: '', warrantyMonths: '', receivedAt: new Date().toISOString().slice(0, 10),
  notes: '', customFields: [] as { key: string; value: string }[],
})

export default function Inventory() {
  const user = useAuthStore(s => s.user)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(blankForm())
  const [assignForm, setAssignForm] = useState<{ id: string; type: string; id2: string; name: string } | null>(null)

  const { data: components = [], isLoading } = useComponents({ status: filterStatus || undefined })
  const createComp = useCreateComponent()
  const updateComp = useUpdateComponent()
  const assignComp = useAssignComponent()
  const returnComp = useReturnComponent()

  const canManage = user && ['Manager', 'ProjectHead', 'SuperAdmin', 'BusinessHead'].includes(user.role)

  const [filterCategory, setFilterCategory] = useState('')
  const categories = [...new Set(components.map(c => c.category).filter(Boolean))] as string[]

  const filtered = components.filter(c => {
    if (filterCategory && c.category !== filterCategory) return false
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.refNumber.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q)
  })

  const agingCount = components.filter(c => c.status === 'in_stock' && daysInWarehouse(c.receivedAt) > 90).length

  function handleCreate() {
    if (!form.name.trim()) return
    const cf: Record<string, string> = {}
    form.customFields.forEach(f => { if (f.key.trim()) cf[f.key] = f.value })
    createComp.mutate({
      name: form.name,
      category: form.category || undefined,
      warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
      receivedAt: form.receivedAt,
      customFields: Object.keys(cf).length > 0 ? cf : undefined,
      notes: form.notes || undefined,
    }, {
      onSuccess: () => { setShowCreate(false); setForm(blankForm()) }
    })
  }

  function handleCustomFieldUpdate(comp: RawComponent, key: string, value: string, remove?: boolean) {
    const existing = (comp.customFields as Record<string, string>) ?? {}
    const updated = { ...existing }
    if (remove) delete updated[key]
    else updated[key] = value
    updateComp.mutate({ id: comp.id, customFields: updated })
  }

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px) clamp(12px, 3.5vw, 28px)', minHeight: '100vh', background: '#F8F9FF', maxWidth: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: 0 }}>Raw Components</h1>
          <p style={{ fontSize: 13, color: '#8A8FA8', marginTop: 4 }}>Sorted oldest first — assign longest-stored components first</p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(v => !v)} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
            <Plus size={14} />Add Component
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Components', value: components.length, color: '#5D78FF' },
          { label: 'In Stock', value: components.filter(c => c.status === 'in_stock').length, color: '#2BC155' },
          { label: 'Assigned', value: components.filter(c => c.status === 'assigned').length, color: '#1D4ED8' },
          { label: 'Aging > 90 days', value: agingCount, color: agingCount > 0 ? '#EF4444' : '#8A8FA8' },
          { label: 'Categories', value: categories.length, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8A8FA8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {agingCount > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#B91C1C', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Clock size={14} />
          {agingCount} component{agingCount !== 1 ? 's' : ''} in warehouse over 90 days — prioritize for assignment
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>New Component</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { key: 'name', label: 'Name *', placeholder: 'Motor 5HP', flex: '2 1 180px' },
              { key: 'category', label: 'Category', placeholder: 'Electrical', flex: '1 1 140px' },
              { key: 'warrantyMonths', label: 'Warranty (months)', placeholder: '24', flex: '0 0 140px' },
              { key: 'receivedAt', label: 'Received Date', placeholder: '', flex: '0 0 150px', type: 'date' },
            ].map(f => (
              <div key={f.key} style={{ flex: f.flex }}>
                <div style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 4 }}>{f.label}</div>
                <input
                  type={f.type ?? 'text'}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>

          {/* Custom fields */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 6 }}>Custom Fields</div>
            {form.customFields.map((cf, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input value={cf.key} onChange={e => setForm(p => ({ ...p, customFields: p.customFields.map((x, i) => i === idx ? { ...x, key: e.target.value } : x) }))} placeholder="Field name" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '6px 10px', fontSize: 13, flex: 1 }} />
                <input value={cf.value} onChange={e => setForm(p => ({ ...p, customFields: p.customFields.map((x, i) => i === idx ? { ...x, value: e.target.value } : x) }))} placeholder="Value" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '6px 10px', fontSize: 13, flex: 1 }} />
                <button onClick={() => setForm(p => ({ ...p, customFields: p.customFields.filter((_, i) => i !== idx) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => setForm(p => ({ ...p, customFields: [...p.customFields, { key: '', value: '' }] }))} style={{ fontSize: 12, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add Field</button>
          </div>

          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical', height: 56, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleCreate} disabled={createComp.isPending} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {createComp.isPending ? 'Adding...' : 'Add Component'}
            </button>
            <button onClick={() => { setShowCreate(false); setForm(blankForm()) }} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search components..." style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', minWidth: 200 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          <option value="">All Status</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#8A8FA8' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#8A8FA8' }}>No components found</div>
        ) : (
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
                {['Ref #', 'Name', 'Category', 'Age (days)', 'Warranty', 'Status', 'Assigned To', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const days = daysInWarehouse(c.receivedAt)
                const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.in_stock
                const expanded = expandedId === c.id
                const cf = (c.customFields as Record<string, string>) ?? {}

                return (
                  <Fragment key={c.id}>
                    <tr style={{ borderBottom: '1px solid #F8F9FF', cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : c.id)}>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: '#5D78FF', fontWeight: 700 }}>{c.refNumber}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#6B7280' }}>{c.category ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <Clock size={12} color={days > 90 ? '#EF4444' : '#8A8FA8'} />
                          <span style={{ fontSize: 13, fontWeight: days > 90 ? 700 : 400, color: days > 90 ? '#EF4444' : '#1A1D23' }}>{days}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>
                        {(() => {
                          const w = warrantyStatus(c.receivedAt, c.warrantyMonths)
                          return w ? <span style={{ color: w.color, fontWeight: w.color !== '#6B7280' ? 600 : 400 }}>{w.label}</span> : <span style={{ color: '#6B7280' }}>—</span>
                        })()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{ss.label}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{c.assignedToType ? `${c.assignedToType}${c.assignedToId ? ` · ${c.assignedToId.slice(0, 8)}` : ''}` : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {expanded ? <ChevronUp size={14} color="#8A8FA8" /> : <ChevronDown size={14} color="#8A8FA8" />}
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${c.id}-exp`}>
                        <td colSpan={8} style={{ padding: '12px 20px', background: '#F8F9FF', borderBottom: '1px solid #F0F1F5' }}>
                          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                            {/* Custom fields editor */}
                            <div style={{ flex: 1, minWidth: 220 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Custom Fields</div>
                              {Object.entries(cf).map(([key, val]) => (
                                <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, color: '#8A8FA8', minWidth: 80 }}>{key}</span>
                                  <input
                                    defaultValue={val}
                                    onBlur={e => handleCustomFieldUpdate(c, key, e.target.value)}
                                    style={{ border: '1.5px solid #E8E9F0', borderRadius: 6, padding: '4px 8px', fontSize: 12, flex: 1 }}
                                  />
                                  <button onClick={() => handleCustomFieldUpdate(c, key, '', true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={12} /></button>
                                </div>
                              ))}
                              <AddCustomField onAdd={(k, v) => handleCustomFieldUpdate(c, k, v)} />
                            </div>

                            {/* Actions */}
                            {canManage && c.status === 'in_stock' && (
                              <div style={{ minWidth: 220 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Assign</div>
                                {assignForm?.id === c.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <input value={assignForm.type} onChange={e => setAssignForm(p => p ? { ...p, type: e.target.value } : null)} placeholder="Entity type (project/lead)" style={{ border: '1.5px solid #E8E9F0', borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
                                    <input value={assignForm.name} onChange={e => setAssignForm(p => p ? { ...p, name: e.target.value } : null)} placeholder="Entity name" style={{ border: '1.5px solid #E8E9F0', borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button onClick={() => { assignComp.mutate({ id: c.id, toEntityType: assignForm.type, toEntityId: '', toEntityName: assignForm.name }); setAssignForm(null) }} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Assign</button>
                                      <button onClick={() => setAssignForm(null)} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => setAssignForm({ id: c.id, type: 'project', id2: '', name: '' })} style={{ background: '#DBEAFE', color: '#1D4ED8', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
                                    <ArrowRight size={12} />Assign to project
                                  </button>
                                )}
                              </div>
                            )}
                            {canManage && c.status === 'assigned' && (
                              <button onClick={() => returnComp.mutate({ id: c.id })} style={{ alignSelf: 'flex-start', background: '#EDE9FE', color: '#7C3AED', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
                                <RotateCcw size={12} />Return to stock
                              </button>
                            )}

                            {/* Notes */}
                            {c.notes && <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes</div><div style={{ fontSize: 12, color: '#6B7280' }}>{c.notes}</div></div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function AddCustomField({ onAdd }: { onAdd: (k: string, v: string) => void }) {
  const [k, setK] = useState('')
  const [v, setV] = useState('')
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <input value={k} onChange={e => setK(e.target.value)} placeholder="Field" style={{ border: '1.5px solid #E8E9F0', borderRadius: 6, padding: '4px 8px', fontSize: 12, flex: 1 }} />
      <input value={v} onChange={e => setV(e.target.value)} placeholder="Value" style={{ border: '1.5px solid #E8E9F0', borderRadius: 6, padding: '4px 8px', fontSize: 12, flex: 1 }} />
      <button onClick={() => { if (k.trim()) { onAdd(k, v); setK(''); setV('') } }} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>+</button>
    </div>
  )
}
