import { useState, useMemo } from 'react'
import { X, Package, Search, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useComponents } from '@/hooks/useComponents'
import type { ScopeItemAPI } from '@/hooks/useScopeItems'
import { useAllocateComponent } from '@/hooks/useScopeItems'
import { toast } from '@/lib/toast'

// Only these states can be allocated to a scope line.
const ASSIGNABLE_STATUSES = ['in_stock', 'semi_finished', 'finished_goods']

/**
 * Bulk assign: pick several inventory components at once; each selected component
 * is allocated to the next unallocated scope line, in selection order. Lets a
 * manager fill a whole project's scope in one pass instead of one modal per line.
 */
export default function BulkInventoryAssignModal({
  scopeItems,
  onClose,
}: {
  /** The unallocated scope lines, in display order. */
  scopeItems: ScopeItemAPI[]
  onClose: () => void
}) {
  const { data: allComponents = [], isLoading, isError } = useComponents({ all: true })
  const allocate = useAllocateComponent()

  const [search, setSearch] = useState('')
  // Ordered selection — index i maps to scopeItems[i].
  const [selected, setSelected] = useState<string[]>([])

  const available = useMemo(
    () => allComponents.filter(c => ASSIGNABLE_STATUSES.includes(c.status)),
    [allComponents],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return available
    return available.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.refNumber.toLowerCase().includes(q) ||
      (c.category ?? '').toLowerCase().includes(q))
  }, [available, search])

  const maxSelectable = scopeItems.length

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= maxSelectable) {
        toast.error(`Only ${maxSelectable} unallocated line${maxSelectable === 1 ? '' : 's'} to fill`)
        return prev
      }
      return [...prev, id]
    })
  }

  const isPending = allocate.isPending

  async function handleAssign() {
    if (selected.length === 0) { toast.error('Select at least one component'); return }
    try {
      // Allocate sequentially so a mid-batch failure surfaces with the line it hit.
      for (let i = 0; i < selected.length; i++) {
        const line = scopeItems[i]
        await allocate.mutateAsync({
          scopeItemId: line.id,
          componentId: selected[i],
          quantity: line.quantity || 1,
        })
      }
      toast.success(`Allocated ${selected.length} component${selected.length === 1 ? '' : 's'}`)
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed during bulk allocation')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10,
    border: '1.5px solid #E8EDFF', fontSize: 13, color: '#374557',
    outline: 'none', boxSizing: 'border-box', background: '#fff',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, width: 'min(560px, 100%)', height: 'min(600px, 90vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #F4F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#374557', margin: 0 }}>Bulk Assign Inventory</p>
              <p style={{ fontSize: 12, color: '#8A8FA8', margin: '3px 0 0' }}>
                {maxSelectable} unallocated line{maxSelectable === 1 ? '' : 's'} · pick up to {maxSelectable} component{maxSelectable === 1 ? '' : 's'} (in order)
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', padding: 2, flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ position: 'relative', marginTop: 14 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE', pointerEvents: 'none' }} />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ref#" style={inp} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isLoading && <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 32 }}>Loading inventory…</p>}
          {isError && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: '#FF5353', fontSize: 12 }}><AlertTriangle size={14} /> Failed to load inventory</div>}
          {!isLoading && !isError && filtered.length === 0 && (
            <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 32 }}>{search ? 'No items match your search.' : 'No assignable inventory.'}</p>
          )}
          {!isLoading && !isError && filtered.map(comp => {
            const order = selected.indexOf(comp.id)
            const isSel = order !== -1
            const targetLine = isSel ? scopeItems[order] : null
            return (
              <div key={comp.id} role="button" tabIndex={0}
                onClick={() => toggle(comp.id)}
                onKeyDown={e => e.key === 'Enter' && toggle(comp.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer',
                  background: isSel ? '#F0F5FF' : '#fff',
                  borderLeft: isSel ? '3px solid #5D78FF' : '3px solid transparent',
                  borderBottom: '1px solid #F4F5F9',
                }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={16} style={{ color: '#3B82F6' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374557', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.name}</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE', margin: 0, fontFamily: 'monospace' }}>{comp.refNumber}</p>
                </div>
                {isSel && targetLine && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#E8EDFF', color: '#5D78FF', flexShrink: 0, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    #{order + 1} · {targetLine.name}
                  </span>
                )}
                {isSel && <CheckCircle2 size={18} style={{ color: '#5D78FF', flexShrink: 0 }} />}
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #F4F5F9', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: '#5D78FF', marginBottom: 10, fontWeight: 600 }}>
            {selected.length} of {maxSelectable} selected
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAssign} disabled={selected.length === 0 || isPending}
              style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: selected.length && !isPending ? '#5D78FF' : '#D1D5DB', color: '#fff', cursor: selected.length && !isPending ? 'pointer' : 'default', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Assigning…' : `Assign ${selected.length || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
