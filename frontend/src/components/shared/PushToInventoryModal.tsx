import { useMemo, useState } from 'react'
import { PackagePlus, X } from 'lucide-react'
import { useScopeItems, type ScopeItemAPI } from '@/hooks/useScopeItems'
import { usePushToInventory, type PushItem } from '@/hooks/useComponents'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'

/** Above this completion %, work in progress is treated as a finished good. */
const FINISHED_THRESHOLD = 80

type Category = 'SemiFinished' | 'FinishedGoods'

interface RowState {
  checked: boolean
  category: Category
  notes: string
}

/** A line can only be pushed once, and not while it still holds allocated stock. */
function blockReason(item: ScopeItemAPI): string | null {
  if (item.inventoryComponentId) return 'Component still allocated'
  if (item.fulfillmentStatus === 'semi_finished' || item.fulfillmentStatus === 'completed') return 'Already pushed'
  return null
}

/**
 * Shown when a project is cancelled or completed: the Project Head reviews the
 * scope lines and picks which represent goods that physically exist, so they
 * re-enter inventory as sellable stock instead of being written off.
 */
export default function PushToInventoryModal({
  projectId,
  projectTitle,
  progress = 0,
  onClose,
  onPushed,
}: {
  projectId: string
  projectTitle: string
  progress?: number
  onClose: () => void
  /** Called after a successful push — used to continue the cancel/complete flow. */
  onPushed?: () => void
}) {
  const { data: items = [], isLoading } = useScopeItems('Project', projectId)
  const push = usePushToInventory()

  const defaultCategory: Category = progress >= FINISHED_THRESHOLD ? 'FinishedGoods' : 'SemiFinished'
  const [overrides, setOverrides] = useState<Record<string, Partial<RowState>>>({})

  const rows = useMemo(
    () => items.map(item => ({
      item,
      blocked: blockReason(item),
      state: {
        checked: false,
        category: defaultCategory,
        notes: '',
        ...overrides[item.id],
      } as RowState,
    })),
    [items, overrides, defaultCategory],
  )

  const selected = rows.filter(r => !r.blocked && r.state.checked)
  const patch = (id: string, p: Partial<RowState>) =>
    setOverrides(o => ({ ...o, [id]: { ...o[id], ...p } }))

  async function submit() {
    const payload: PushItem[] = selected.map(({ item, state }) => ({
      scopeItemId: item.id,
      category: state.category,
      quantity: item.quantity,
      notes: state.notes.trim() || undefined,
    }))
    try {
      const res = await push.mutateAsync({ projectId, items: payload })
      toast.success(`${res.pushed} item(s) pushed to inventory`)
      onPushed?.()
      onClose()
    } catch (e: any) {
      // Non-admins need sign-off before stock can be created — file the request
      // rather than showing them the raw approval_required error.
      if (e?.response?.status === 403 && e.response.data?.error === 'approval_required') {
        await api.post('/approval-requests', {
          entityType: 'project', entityId: projectId, action: 'push_to_inventory',
          payload: { items: payload }, reason: `Push ${payload.length} scope item(s) to inventory from ${projectTitle}`,
        })
        toast.success('Sent to admin for approval — re-run this once approved')
        onClose()
        return
      }
      toast.error(e?.response?.data?.error || 'Failed to push to inventory')
    }
  }

  const selectStyle = {
    padding: '5px 7px', borderRadius: 7, border: '1px solid #F0F1F5',
    fontSize: 11, color: '#374557', outline: 'none', background: '#fff',
  } as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, width: 600, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F1F5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <PackagePlus size={15} style={{ color: '#5D78FF' }} /> Push to Inventory
            </p>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#B1B1BE', marginTop: 5 }}>
            <span style={{ color: '#374557', fontWeight: 600 }}>{projectTitle}</span> · {progress}% complete ·
            {' '}defaulting to {defaultCategory === 'FinishedGoods' ? 'Finished Goods' : 'Semi-Finished'}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {isLoading && <p style={{ fontSize: 12, color: '#B1B1BE' }}>Loading scope…</p>}
          {!isLoading && rows.length === 0 && (
            <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 20 }}>
              This project has no scope items to push.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(({ item, state, blocked }) => (
              <div key={item.id} style={{
                border: '1px solid #F0F1F5', borderRadius: 10, padding: 11,
                background: blocked ? '#FAFAFC' : state.checked ? '#F3F6FF' : '#fff',
                opacity: blocked ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={state.checked}
                    disabled={Boolean(blocked)}
                    onChange={e => patch(item.id, { checked: e.target.checked })}
                    style={{ cursor: blocked ? 'not-allowed' : 'pointer', accentColor: '#5D78FF' }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374557' }}>{item.name}</span>
                    <span style={{ display: 'block', fontSize: 10, color: '#B1B1BE' }}>
                      Qty {item.quantity}{blocked ? ` · ${blocked}` : ''}
                    </span>
                  </span>
                  <select
                    value={state.category}
                    disabled={Boolean(blocked) || !state.checked}
                    onChange={e => patch(item.id, { category: e.target.value as Category })}
                    style={{ ...selectStyle, cursor: blocked || !state.checked ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="SemiFinished">Semi-Finished</option>
                    <option value="FinishedGoods">Finished Goods</option>
                  </select>
                </div>
                {state.checked && !blocked && (
                  <input
                    value={state.notes}
                    onChange={e => patch(item.id, { notes: e.target.value })}
                    placeholder="Notes (optional)"
                    style={{ width: '100%', marginTop: 8, padding: '6px 8px', borderRadius: 7, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #F0F1F5', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#374557', cursor: 'pointer' }}>
            Skip
          </button>
          <button
            onClick={submit}
            disabled={selected.length === 0 || push.isPending}
            style={{ flex: 2, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: selected.length && !push.isPending ? 'pointer' : 'not-allowed', opacity: selected.length === 0 || push.isPending ? 0.6 : 1 }}
          >
            {push.isPending ? 'Pushing…' : `Push ${selected.length || ''} Selected to Inventory`}
          </button>
        </div>
      </div>
    </div>
  )
}
