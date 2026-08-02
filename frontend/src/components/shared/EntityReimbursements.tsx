import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Wallet } from 'lucide-react'

interface EntityClaim {
  id: string
  typeCode: string
  title: string
  amount: number
  expenseDate: string
  status: string
  receiptUrl?: string
  receiptUrls?: string[]
  user?: { id: string; name: string }
}

const statusStyle: Record<string, { bg: string; color: string }> = {
  Draft:                     { bg: '#F4F5F9', color: '#6B7280' },
  Submitted:                 { bg: '#FEF3C7', color: '#D97706' },
  PendingManagementApproval: { bg: '#FFEDD5', color: '#EA580C' },
  Approved:                  { bg: '#E7FAF0', color: '#2BC155' },
  Rejected:                  { bg: '#FEE2E2', color: '#DC2626' },
  Paid:                      { bg: '#E8EDFF', color: '#5D78FF' },
}

const fmtAmt = (n: number) => '₹' + (n ?? 0).toLocaleString('en-IN')
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

/**
 * Reimbursement claims booked against one Lead / Deal / Project, with the total
 * budget claimed. Rendered as a tab inside those records' detail panels.
 */
export default function EntityReimbursements({
  entityType,
  entityId,
}: {
  entityType: 'Lead' | 'Deal' | 'Project'
  entityId: string
}) {
  const { data, isLoading } = useQuery<{ records: EntityClaim[]; totalClaimed: number }>({
    queryKey: ['entity-reimbursements', entityType, entityId],
    queryFn: () => api.get(`/reimbursement/entity/${entityType}/${entityId}`).then(r => r.data),
    enabled: Boolean(entityId),
  })

  const records = data?.records ?? []

  if (isLoading) {
    return <p style={{ fontSize: 12, color: '#B1B1BE', padding: 16 }}>Loading reimbursements…</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: '#F8F9FD', borderRadius: 10,
      }}>
        <Wallet size={16} style={{ color: '#5D78FF' }} />
        <div>
          <p style={{ fontSize: 11, color: '#8A8B9F', margin: 0 }}>Total claimed against this {entityType.toLowerCase()}</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#23263B', margin: 0 }}>{fmtAmt(data?.totalClaimed ?? 0)}</p>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8F9FD' }}>
              {['Employee', 'Type', 'Title', 'Amount', 'Date', 'Receipts', 'Status'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map(c => {
              const receipts = c.receiptUrls?.length ? c.receiptUrls : c.receiptUrl ? [c.receiptUrl] : []
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                  <td style={{ padding: '9px 14px', color: '#374557', fontWeight: 600 }}>{c.user?.name ?? '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#374557' }}>{c.typeCode}</td>
                  <td style={{ padding: '9px 14px', color: '#374557' }}>{c.title}</td>
                  <td style={{ padding: '9px 14px', color: '#374557', fontWeight: 600 }}>{fmtAmt(c.amount)}</td>
                  <td style={{ padding: '9px 14px', color: '#374557' }}>{fmtDate(c.expenseDate)}</td>
                  <td style={{ padding: '9px 14px' }}>
                    {receipts.length === 0 ? <span style={{ color: '#C4C4CF' }}>—</span> : receipts.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer" style={{ color: '#5D78FF', marginRight: 6 }}>#{i + 1}</a>
                    ))}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: statusStyle[c.status]?.bg ?? '#F4F5F9',
                      color: statusStyle[c.status]?.color ?? '#6B7280',
                    }}>
                      {c.status === 'PendingManagementApproval' ? 'Mgmt Approval' : c.status}
                    </span>
                  </td>
                </tr>
              )
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#B1B1BE' }}>
                  No reimbursements booked against this {entityType.toLowerCase()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
