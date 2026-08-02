import { useEffect, useState } from 'react'
import { Plus, Trash2, Package, Check, X, Link2, ArrowRightLeft, Unlink, Layers } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { useUnallocateComponent } from '@/hooks/useScopeItems'
import type { ScopeItemAPI } from '@/hooks/useScopeItems'
import InventoryAssignModal from '@/components/shared/InventoryAssignModal'
import BulkInventoryAssignModal from '@/components/shared/BulkInventoryAssignModal'
import type React from 'react'

/** One user-defined specification field on a scope line. */
export interface CustomField {
  label: string
  value: string
}

export interface ScopeItem {
  id?: string
  name: string
  quantity: number
  unit?: string | null
  customFields: CustomField[]
  notes?: string | null
}

type EntityType = 'Lead' | 'Deal' | 'Project'

// Offered as one-click presets so the common case (capacity + temperature) is
// fast, while any other label can still be typed by hand.
const SUGGESTED_FIELDS = ['Capacity', 'Capacity Unit', 'Temp Min', 'Temp Max']

// `unit` is no longer entered in the UI — record it as a custom field if needed.
// Kept on the type so existing rows keep their value.
const blankRow = (): ScopeItem => ({ name: '', quantity: 1, customFields: [], notes: '' })

/** Strips incomplete rows/fields and numbers the rows for the bulk endpoint. */
function toPayload(items: ScopeItem[]) {
  return items
    .filter(r => r.name.trim())
    .map((r, idx) => ({
      id: (r as ScopeItemAPI).id,
      name: r.name.trim(),
      quantity: Number(r.quantity) || 1,
      unit: r.unit || null,
      customFields: (r.customFields ?? [])
        .filter(f => f.label.trim())
        .map(f => ({ label: f.label.trim(), value: f.value?.trim() ?? '' })),
      notes: r.notes || null,
      sortOrder: idx,
    }))
}

/**
 * Persists rows collected in draft mode, once the parent record exists. An empty
 * list is still sent when the record already had rows, so clearing the scope in
 * an edit form actually deletes them.
 */
export async function saveDraftScopeItems(
  entityType: EntityType,
  entityId: string,
  items: ScopeItem[],
  { hadExisting = false }: { hadExisting?: boolean } = {}
): Promise<void> {
  const payload = toPayload(items)
  if (payload.length === 0 && !hadExisting) return
  await api.put('/scope-items/bulk', { entityType, entityId, items: payload })
}

// ─── Fulfillment status badge ─────────────────────────────────────────────────
const FULFILLMENT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  unallocated:  { bg: '#F4F5F9', color: '#8C8C8C', label: 'Unallocated' },
  allocated:    { bg: '#E8EDFF', color: '#5D78FF', label: 'Allocated' },
  semi_finished:{ bg: '#FFFBEB', color: '#F59E0B', label: 'Semi-Finished' },
  completed:    { bg: '#E7FAF0', color: '#2BC155', label: 'Completed' },
  returned:     { bg: '#FFF0F0', color: '#FF5353', label: 'Returned' },
}

function FulfillmentBadge({ status, refNumber }: { status: string; refNumber?: string | null }) {
  const s = FULFILLMENT_STYLE[status] ?? FULFILLMENT_STYLE.unallocated
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}{refNumber ? ` · ${refNumber}` : ''}
    </span>
  )
}

/**
 * Editable bill of materials for a Lead, Deal or Project. Each line carries a
 * product name and quantity plus any number of user-defined specification
 * fields. For Project scope lines an inventory fulfillment column is shown,
 * letting managers assign, reassign or return physical stock to each line.
 */
export default function ScopeItemsPanel({
  entityType,
  entityId,
  readOnly,
  value,
  onChange,
}: {
  entityType: EntityType
  /** Omit while the parent record doesn't exist yet (draft mode). */
  entityId?: string
  readOnly?: boolean
  /** Draft mode: the parent owns the rows and persists them after it has an id. */
  value?: ScopeItem[]
  onChange?: (rows: ScopeItem[]) => void
}) {
  const qc = useQueryClient()
  // Draft mode is for create forms — there is no record to attach rows to yet,
  // so the parent holds them and saves once the record has been created.
  const draft = Boolean(onChange)
  const isProject = entityType === 'Project'
  const queryKey = ['scope-items', entityType, entityId]

  const { data: saved = [], isLoading } = useQuery<ScopeItemAPI[]>({
    queryKey,
    queryFn: () => api.get('/scope-items', { params: { entityType, entityId } }).then(r => r.data),
    enabled: !draft && Boolean(entityId),
  })

  const [localRows, setLocalRows] = useState<ScopeItem[]>([])
  const [dirty, setDirty] = useState(false)

  // Inventory assign modal state — which scope item is currently being assigned
  const [assignTarget, setAssignTarget] = useState<ScopeItemAPI | null>(null)
  // Bulk-assign modal — fills multiple unallocated lines in one pass.
  const [bulkOpen, setBulkOpen] = useState(false)

  const unallocate = useUnallocateComponent()

  const rows = draft ? (value ?? []) : localRows
  const setRows = (updater: ScopeItem[] | ((prev: ScopeItem[]) => ScopeItem[])) => {
    const next = typeof updater === 'function' ? (updater as (p: ScopeItem[]) => ScopeItem[])(rows) : updater
    if (draft) onChange!(next)
    else setLocalRows(next)
  }

  // Server state is the source of truth until the user starts editing; once they
  // do, local edits win so a background refetch can't wipe unsaved rows.
  useEffect(() => {
    if (!draft && !dirty) {
      setLocalRows(saved.map(r => ({ ...r, customFields: Array.isArray(r.customFields) ? r.customFields : [] })))
    }
  }, [saved, dirty, draft])

  const save = useMutation({
    // Half-filled rows and fields are dropped rather than persisted.
    mutationFn: (items: ScopeItem[]) =>
      api.put('/scope-items/bulk', { entityType, entityId, items: toPayload(items) }).then(r => r.data),
    onSuccess: data => {
      qc.setQueryData(queryKey, data)
      setDirty(false)
      toast.success('Scope saved')
    },
  })

  function updateRow(idx: number, patch: Partial<ScopeItem>) {
    setDirty(true)
    setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function updateField(rowIdx: number, fieldIdx: number, patch: Partial<CustomField>) {
    setDirty(true)
    setRows(rs => rs.map((r, i) => i === rowIdx
      ? { ...r, customFields: r.customFields.map((f, j) => (j === fieldIdx ? { ...f, ...patch } : f)) }
      : r))
  }

  function addField(rowIdx: number, label = '') {
    setDirty(true)
    setRows(rs => rs.map((r, i) => i === rowIdx
      ? { ...r, customFields: [...r.customFields, { label, value: '' }] }
      : r))
  }

  function removeField(rowIdx: number, fieldIdx: number) {
    setDirty(true)
    setRows(rs => rs.map((r, i) => i === rowIdx
      ? { ...r, customFields: r.customFields.filter((_, j) => j !== fieldIdx) }
      : r))
  }

  async function handleUnallocate(scopeItem: ScopeItemAPI) {
    try {
      await unallocate.mutateAsync({ scopeItemId: scopeItem.id! })
      toast.success('Component returned to inventory')
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to unallocate')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #F0F1F5',
    fontSize: 12, color: '#374557', outline: 'none', boxSizing: 'border-box', background: '#fff',
  }

  if (!draft && isLoading) return <p style={{ fontSize: 12, color: '#B1B1BE' }}>Loading scope…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#374557', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Package size={13} style={{ color: '#5D78FF' }} />
          Scope of Supply
          <span style={{ color: '#B1B1BE', fontWeight: 500 }}>({rows.length})</span>
        </p>
        {isProject && !readOnly && (() => {
          const unallocatedLines = (rows as ScopeItemAPI[]).filter(
            r => r.id && (!r.fulfillmentStatus || r.fulfillmentStatus === 'unallocated' || r.fulfillmentStatus === 'returned'),
          )
          return unallocatedLines.length > 1 ? (
            <button onClick={() => setBulkOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: 'none', background: '#E8EDFF', color: '#5D78FF', cursor: 'pointer' }}>
              <Layers size={12} /> Bulk Assign ({unallocatedLines.length})
            </button>
          ) : (
            <span style={{ fontSize: 10, color: '#B1B1BE' }}>Click Assign to link inventory to each line</span>
          )
        })()}
      </div>

      {rows.length === 0 && (
        <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 12 }}>
          No scope items yet.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row, idx) => {
          // Cast to ScopeItemAPI to access fulfillment fields (available when not in draft mode)
          const apiRow = row as ScopeItemAPI
          const fulfillment = apiRow.fulfillmentStatus ?? 'unallocated'
          const isAllocated = fulfillment !== 'unallocated' && fulfillment !== 'returned'

          return (
            <div key={apiRow.id ?? idx} style={{
              border: `1.5px solid ${isAllocated ? '#E8EDFF' : '#F0F1F5'}`,
              borderRadius: 10, padding: 12, background: isAllocated ? '#FAFBFF' : '#fff',
            }}>
              {/* Product name + quantity + delete */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 3 }}>Product</p>
                  {readOnly
                    ? <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{row.name}</p>
                    : <input value={row.name} onChange={e => updateRow(idx, { name: e.target.value })} placeholder="e.g. Heat Pump Unit" style={inp} />}
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 3 }}>Qty</p>
                  {readOnly
                    ? <p style={{ fontSize: 13, color: '#374557' }}>{row.quantity}</p>
                    : <input type="number" min="1" value={row.quantity} onChange={e => updateRow(idx, { quantity: Number(e.target.value) })} style={inp} />}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                  {!readOnly && (
                    <button onClick={() => { setDirty(true); setRows(rs => rs.filter((_, i) => i !== idx)) }}
                      title="Remove item"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* User-defined specification fields */}
              {row.customFields.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 10 }}>
                  {row.customFields.map((f, fi) => (
                    <div key={fi}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        {readOnly ? (
                          <span style={{ fontSize: 10, color: '#B1B1BE' }}>{f.label}</span>
                        ) : (
                          <>
                            <input value={f.label} onChange={e => updateField(idx, fi, { label: e.target.value })}
                              placeholder="Field name"
                              style={{ ...inp, padding: '3px 6px', fontSize: 10, color: '#8A8B9F', border: 'none', background: 'transparent', fontWeight: 600 }} />
                            <button onClick={() => removeField(idx, fi)} title="Remove field"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4C4CF', padding: 0, display: 'flex' }}>
                              <X size={11} />
                            </button>
                          </>
                        )}
                      </div>
                      {readOnly
                        ? <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{f.value || '—'}</p>
                        : <input value={f.value} onChange={e => updateField(idx, fi, { value: e.target.value })} placeholder="Value" style={inp} />}
                    </div>
                  ))}
                </div>
              )}

              {!readOnly && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                  <button onClick={() => addField(idx)}
                    style={{ fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    + Add Custom Field
                  </button>
                  {SUGGESTED_FIELDS
                    .filter(s => !row.customFields.some(f => f.label.toLowerCase() === s.toLowerCase()))
                    .map(s => (
                      <button key={s} onClick={() => addField(idx, s)}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: '1px solid #E0E0E0', background: '#fff', color: '#8A8B9F', cursor: 'pointer' }}>
                        + {s}
                      </button>
                    ))}
                </div>
              )}

              {/* ── Inventory fulfillment row (Project scope only) ── */}
              {isProject && apiRow.id && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
                  paddingTop: 10, borderTop: '1px dashed #F0F1F5', flexWrap: 'wrap',
                }}>
                  <FulfillmentBadge
                    status={fulfillment}
                    refNumber={apiRow.inventoryComponent?.refNumber}
                  />

                  {/* Component name when allocated */}
                  {apiRow.inventoryComponent && (
                    <span style={{ fontSize: 11, color: '#374557', fontWeight: 600 }}>
                      {apiRow.inventoryComponent.name}
                    </span>
                  )}

                  {/* Action buttons */}
                  {!readOnly && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {!isAllocated && (
                        <button
                          onClick={() => setAssignTarget(apiRow)}
                          title="Assign inventory component to this scope line"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            border: 'none', background: '#E8EDFF', color: '#5D78FF', cursor: 'pointer',
                          }}
                        >
                          <Link2 size={11} /> Assign
                        </button>
                      )}
                      {isAllocated && (
                        <>
                          <button
                            onClick={() => setAssignTarget(apiRow)}
                            title="Swap to a different component"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              border: 'none', background: '#FFF5EE', color: '#FF9B52', cursor: 'pointer',
                            }}
                          >
                            <ArrowRightLeft size={11} /> Move
                          </button>
                          <button
                            onClick={() => handleUnallocate(apiRow)}
                            disabled={unallocate.isPending}
                            title="Return this component to stock"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              border: 'none', background: '#FFF0F0', color: '#FF5353',
                              cursor: unallocate.isPending ? 'default' : 'pointer',
                              opacity: unallocate.isPending ? 0.6 : 1,
                            }}
                          >
                            <Unlink size={11} /> Unassign
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setDirty(true); setRows(rs => [...rs, blankRow()]) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#5D78FF', cursor: 'pointer' }}>
            <Plus size={13} /> Add Item
          </button>
          {/* In draft mode the parent form's own submit persists these rows. */}
          {!draft && dirty && (
            <button onClick={() => save.mutate(rows)} disabled={save.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
              <Check size={13} /> {save.isPending ? 'Saving…' : 'Save Scope'}
            </button>
          )}
        </div>
      )}

      {/* Inventory assign / reassign modal */}
      {assignTarget && (
        <InventoryAssignModal
          scopeItem={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {/* Bulk assign across all unallocated lines */}
      {bulkOpen && (
        <BulkInventoryAssignModal
          scopeItems={(rows as ScopeItemAPI[]).filter(
            r => r.id && (!r.fulfillmentStatus || r.fulfillmentStatus === 'unallocated' || r.fulfillmentStatus === 'returned'),
          )}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </div>
  )
}
