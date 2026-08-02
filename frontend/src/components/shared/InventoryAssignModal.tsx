import { useState, useMemo } from 'react'
import { X, Package, Search, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useComponents } from '@/hooks/useComponents'
import type { RawComponent } from '@/hooks/useComponents'
import type { ScopeItemAPI } from '@/hooks/useScopeItems'
import { useAllocateComponent, useReallocateComponent } from '@/hooks/useScopeItems'
import { toast } from '@/lib/toast'

// ─── Category display config ─────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  Raw:          { label: 'Raw Material',   color: '#3B82F6', bg: '#EFF6FF' },
  SemiFinished: { label: 'Semi-Finished',  color: '#F59E0B', bg: '#FFFBEB' },
  FinishedGoods:{ label: 'Finished Goods', color: '#10B981', bg: '#ECFDF5' },
}
const DEFAULT_CAT = { label: 'Raw Material', color: '#3B82F6', bg: '#EFF6FF' }

function getCat(c: RawComponent) {
  return CATEGORY_LABEL[c.category ?? 'Raw'] ?? DEFAULT_CAT
}

// ─── Single selectable row ────────────────────────────────────────────────────
// Human label for the non-assignable states, shown as a badge on greyed rows.
const STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned', used: 'Used', returned: 'Returned', disposed: 'Disposed',
}

function ComponentRow({
  comp,
  selected,
  disabled,
  onClick,
}: {
  comp: RawComponent
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  const cat = getCat(comp)
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) onClick() }}
      onKeyDown={e => { if (!disabled && e.key === 'Enter') onClick() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: selected ? '#F0F5FF' : '#fff',
        borderLeft: selected ? '3px solid #5D78FF' : '3px solid transparent',
        borderBottom: '1px solid #F4F5F9',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected && !disabled) (e.currentTarget as HTMLDivElement).style.background = '#FAFBFF' }}
      onMouseLeave={e => { if (!selected && !disabled) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
    >
      {/* Icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Package size={16} style={{ color: cat.color }} />
      </div>

      {/* Name + ref */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374557', margin: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {comp.name}
        </p>
        <p style={{ fontSize: 11, color: '#B1B1BE', margin: 0, fontFamily: 'monospace' }}>{comp.refNumber}</p>
      </div>

      {/* Unavailable badge */}
      {disabled && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F4F5F9', color: '#8C8C8C', flexShrink: 0 }}>
          {STATUS_LABEL[comp.status] ?? 'Unavailable'}
        </span>
      )}

      {/* Checkmark when selected */}
      {selected && <CheckCircle2 size={18} style={{ color: '#5D78FF', flexShrink: 0 }} />}
    </div>
  )
}

// ─── Category group header ────────────────────────────────────────────────────
function GroupHeader({ category, count }: { category: string; count: number }) {
  const cfg = CATEGORY_LABEL[category] ?? DEFAULT_CAT
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', background: cfg.bg,
      borderBottom: '1px solid #F4F5F9',
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: cfg.color, textTransform: 'uppercase' }}>
        {cfg.label} ({count})
      </span>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export interface InventoryAssignModalProps {
  /** The scope line being assigned to. */
  scopeItem: ScopeItemAPI
  /** Called when the modal should close (cancel or success). */
  onClose: () => void
}

export default function InventoryAssignModal({ scopeItem, onClose }: InventoryAssignModalProps) {
  const isReassign = Boolean(scopeItem.inventoryComponentId)

  // Needs the complete inventory to search/select from, not one paginated page.
  const { data: allComponents = [], isLoading, isError } = useComponents({ all: true })
  const allocate   = useAllocateComponent()
  const reallocate = useReallocateComponent()

  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<string | null>(
    // Pre-select the current component when reassigning.
    scopeItem.inventoryComponentId ?? null
  )
  const [notes, setNotes]         = useState('')
  // Defaults to the scope line's own quantity; operator can override for partial
  // fulfilment or to allocate more/less than the line originally asked for.
  const [qty, setQty]             = useState(String(scopeItem.quantity || 1))

  // Pushed SemiFinished/FinishedGoods stock carries its own status
  // ('semi_finished' / 'finished_goods') instead of 'in_stock' — both are
  // assignable, only 'assigned'/'used'/'returned'/'disposed' are not.
  const ASSIGNABLE_STATUSES = ['in_stock', 'semi_finished', 'finished_goods']
  // Whether a component can be selected for allocation. Non-assignable stock is
  // still shown (greyed) so the operator sees the full inventory picture.
  const isAssignable = (c: RawComponent) =>
    ASSIGNABLE_STATUSES.includes(c.status) ||
    (isReassign && c.id === scopeItem.inventoryComponentId)

  // Show every component; assignable ones sort first within each category group.
  const available = allComponents

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return available
    return available.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.refNumber.toLowerCase().includes(q) ||
      (c.category ?? '').toLowerCase().includes(q)
    )
  }, [available, search])

  // Group by category order: Raw → SemiFinished → FinishedGoods
  const grouped = useMemo(() => {
    const order = ['Raw', 'SemiFinished', 'FinishedGoods']
    const map: Record<string, RawComponent[]> = {}
    for (const c of filtered) {
      const key = c.category || 'Raw'
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
    // Assignable stock floats to the top of each group; greyed rows sink.
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => Number(isAssignable(b)) - Number(isAssignable(a)))
    }
    return order.filter(k => map[k]?.length).map(k => ({ key: k, items: map[k] }))
  }, [filtered, isReassign, scopeItem.inventoryComponentId])

  const isPending = allocate.isPending || reallocate.isPending

  async function handleAllocate() {
    if (!selected) { toast.error('Select a component first'); return }
    const quantity = Number(qty)
    if (!quantity || quantity <= 0) { toast.error('Enter a valid quantity'); return }
    try {
      if (isReassign && selected !== scopeItem.inventoryComponentId) {
        await reallocate.mutateAsync({ scopeItemId: scopeItem.id, componentId: selected, notes: notes || undefined, quantity })
        toast.success('Component reassigned')
      } else if (!isReassign) {
        await allocate.mutateAsync({ scopeItemId: scopeItem.id, componentId: selected, notes: notes || undefined, quantity })
        toast.success('Inventory allocated to scope line')
      }
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to allocate component')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10,
    border: '1.5px solid #E8EDFF', fontSize: 13, color: '#374557',
    outline: 'none', boxSizing: 'border-box', background: '#fff',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 80, padding: 16,
    }}>
      <div role="dialog" aria-modal="true" style={{
        background: '#fff', borderRadius: 16, width: 'min(560px, 100%)',
        height: 'min(600px, 90vh)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
      }}>
        {/* ── Header ── */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #F4F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#374557', margin: 0 }}>
                {isReassign ? 'Reassign Inventory' : 'Assign Inventory'}
              </p>
              <p style={{ fontSize: 12, color: '#8A8FA8', margin: '3px 0 0' }}>
                Scope line:{' '}
                <span style={{ fontWeight: 600, color: '#5D78FF' }}>{scopeItem.name}</span>
                {scopeItem.quantity > 1 && (
                  <span style={{ color: '#B1B1BE' }}> · needs {scopeItem.quantity} {scopeItem.unit || 'units'}</span>
                )}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', padding: 2, flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginTop: 14 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE', pointerEvents: 'none' }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or ref#"
              style={inp}
            />
          </div>
        </div>

        {/* ── Component list ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isLoading && (
            <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 32 }}>Loading inventory…</p>
          )}
          {isError && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: '#FF5353', fontSize: 12 }}>
              <AlertTriangle size={14} /> Failed to load inventory
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 32 }}>
              {search ? 'No items match your search.' : 'No inventory items yet.'}
            </p>
          )}
          {!isLoading && !isError && grouped.map(({ key, items }) => (
            <div key={key}>
              <GroupHeader category={key} count={items.length} />
              {items.map(comp => (
                <ComponentRow
                  key={comp.id}
                  comp={comp}
                  selected={selected === comp.id}
                  disabled={!isAssignable(comp)}
                  onClick={() => setSelected(prev => prev === comp.id ? null : comp.id)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* ── Notes + actions ── */}
        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #F4F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: '#B1B1BE', display: 'block', marginBottom: 3 }}>
                Quantity to allocate
              </label>
              <input
                type="number" min="1" step="1"
                value={qty}
                onChange={e => setQty(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1px solid #F0F1F5', fontSize: 13, fontWeight: 600, color: '#374557',
                  outline: 'none', boxSizing: 'border-box', background: '#FAFBFF',
                }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 10, color: '#B1B1BE', display: 'block', marginBottom: 3 }}>
                Notes (optional)
              </label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notes"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1px solid #F0F1F5', fontSize: 12, color: '#374557',
                  outline: 'none', boxSizing: 'border-box', background: '#FAFBFF',
                }}
              />
            </div>
          </div>

          {/* Count + selected hint */}
          {selected && (() => {
            const comp = available.find(c => c.id === selected)
            const stock = comp?.quantity ?? 1
            const over = Number(qty) > stock
            return (
              <p style={{ fontSize: 11, color: over ? '#FF5353' : '#5D78FF', marginBottom: 10, fontWeight: 600 }}>
                {over ? `⚠ Only ${stock} in stock` : `✓ ${comp?.name ?? 'Component'} selected`}
              </p>
            )
          })()}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, fontSize: 13,
                fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557',
                background: '#fff', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAllocate}
              disabled={!selected || isPending || (isReassign && selected === scopeItem.inventoryComponentId)}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, fontSize: 13,
                fontWeight: 600, border: 'none',
                background: selected && !isPending ? '#5D78FF' : '#D1D5DB',
                color: '#fff',
                cursor: selected && !isPending ? 'pointer' : 'default',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Allocating…' : isReassign ? 'Reassign' : 'Allocate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
