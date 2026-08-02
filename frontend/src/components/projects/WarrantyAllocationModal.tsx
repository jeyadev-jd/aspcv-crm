import { useState } from 'react'
import { Shield, X } from 'lucide-react'

export interface WarrantyAllocation {
  warrantyStartDate: string
  warrantyEndDate: string
  warrantyBudgetAllocated: number
}

/**
 * Collects the warranty terms a project must carry before it can be closed:
 * the cover window and the slice of remaining budget set aside to fund
 * in-warranty service work. The server rejects a completion without these.
 */
export default function WarrantyAllocationModal({
  projectTitle,
  remainingBudget,
  symbol = '₹',
  saving,
  onCancel,
  onConfirm,
}: {
  projectTitle: string
  remainingBudget?: number
  symbol?: string
  saving?: boolean
  onCancel: () => void
  onConfirm: (data: WarrantyAllocation) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const oneYearOut = new Date()
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1)

  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(oneYearOut.toISOString().slice(0, 10))
  const [budget, setBudget] = useState('')
  const [err, setErr] = useState('')

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
    border: '1px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
  }

  function submit() {
    const amount = parseFloat(budget || '0')
    if (!start || !end) { setErr('Warranty start and end dates are required'); return }
    if (new Date(end) <= new Date(start)) { setErr('Warranty end must be after the start date'); return }
    if (!Number.isFinite(amount) || amount < 0) { setErr('Warranty budget must be zero or more'); return }
    if (remainingBudget != null && remainingBudget > 0 && amount > remainingBudget) {
      setErr(`Warranty budget cannot exceed the remaining project budget (${symbol}${remainingBudget.toLocaleString('en-IN')})`)
      return
    }
    setErr('')
    onConfirm({ warrantyStartDate: start, warrantyEndDate: end, warrantyBudgetAllocated: amount })
  }

  return (
    <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F0F1F5' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={15} style={{ color: '#2BC155' }} /> Complete Project
          </p>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: '#374557' }}>{projectTitle}</strong> will be locked and moved to the Completed
            archive, and a service &amp; warranty record will be created. Set the warranty terms below.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Warranty start *</p>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inp} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Warranty end *</p>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inp} />
            </div>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>
              Warranty budget to allocate *
              {remainingBudget != null && (
                <span style={{ color: '#B1B1BE', fontWeight: 500 }}>
                  {' '}(remaining: {symbol}{remainingBudget.toLocaleString('en-IN')})
                </span>
              )}
            </p>
            <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" style={inp} />
            <p style={{ fontSize: 11, color: '#8A8B9F', marginTop: 5 }}>
              Transferred out of the remaining project budget to fund in-warranty service.
            </p>
          </div>

          {err && <p style={{ fontSize: 11, color: '#FF5353', margin: 0 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel}
              style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={saving}
              style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#2BC155', color: '#fff', cursor: 'pointer' }}>
              {saving ? 'Completing…' : 'Complete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
