import { useState } from 'react'
import { useAllSalary, useGenerateSalary, useApproveSalary, useMarkSalaryPaid, useManualEditSalary } from '../hooks/useSalary'
import { useUsers } from '../hooks/useUsers'
import { useAuthStore } from '../lib/authStore'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { toast } from '@/lib/toast'
import { Play, CheckCircle, DollarSign, Pencil, Download, Mail } from 'lucide-react'
import type { SalaryRecord } from '../hooks/useSalary'
import SalaryEditModal from '@/components/hr/SalaryEditModal'
import { downloadFile } from '@/lib/download'
import { api } from '@/lib/api'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}` }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#FEF3C7', color: '#92400E' },
  approved: { bg: '#DBEAFE', color: '#1D4ED8' },
  paid:     { bg: '#D1FAE5', color: '#065F46' },
  pending:  { bg: '#FEE2E2', color: '#B91C1C' },
}

export default function Payroll() {
  const user = useAuthStore(s => s.user)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [genUserId, setGenUserId] = useState('')

  const { data: records = [], isLoading } = useAllSalary(month, year)
  const { data: users = [] } = useUsers()

  const generate = useGenerateSalary()
  const approve = useApproveSalary()
  const markPaid = useMarkSalaryPaid()
  const manualEdit = useManualEditSalary()
  const [editFor, setEditFor] = useState<SalaryRecord | null>(null)

  const canGenerate = user && ['SuperAdmin', 'HR'].includes(user.role)
  const canPay = user && ['SuperAdmin', 'HR', 'Accountant'].includes(user.role)

  // Approving and paying payroll are one-way doors — an approved record feeds
  // the NEFT export, so both ask before firing.
  const [approveFor, setApproveFor] = useState<SalaryRecord | null>(null)
  const [payFor, setPayFor] = useState<SalaryRecord | null>(null)

  // Tracks the row whose slip is downloading/sending so only that button shows
  // a busy state rather than the whole table.
  const [busyId, setBusyId] = useState<string | null>(null)

  async function downloadSlip(r: SalaryRecord) {
    setBusyId(r.id)
    try {
      await downloadFile(`/salary/${r.id}/pdf`, `Payslip-${r.user?.name ?? 'employee'}.pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download payslip')
    } finally {
      setBusyId(null)
    }
  }

  async function resendSlip(r: SalaryRecord) {
    setBusyId(r.id)
    try {
      await api.post(`/salary/${r.id}/email`)
      toast.success(`Payslip emailed to ${r.user?.name ?? 'employee'}`)
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      toast.error(msg ?? 'Could not send payslip email')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: 0 }}>Payroll</h1>
          <p style={{ fontSize: 13, color: '#8A8FA8', marginTop: 4 }}>{records.length} records for {MONTHS[month - 1]} {year}</p>
        </div>
        {canGenerate && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={genUserId} onChange={e => setGenUserId(e.target.value)} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#fff' }}>
              <option value="">Select employee...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button
              onClick={() => { if (genUserId) generate.mutate({ userId: genUserId, month, year }) }}
              disabled={!genUserId || generate.isPending}
              style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', opacity: !genUserId ? 0.5 : 1 }}
            >
              <Play size={13} />Generate Slip
            </button>
            <button
              onClick={async () => {
                const eligible = users.filter(u => (u as any).baseSalary)
                for (const u of eligible) {
                  try { await generate.mutateAsync({ userId: u.id, month, year }) } catch { /* skip users without salary config */ }
                }
              }}
              disabled={generate.isPending}
              style={{ background: '#EDE9FE', color: '#7C3AED', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}
            >
              <Play size={13} />{generate.isPending ? 'Generating...' : 'Generate All'}
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {(() => {
          const totalGross = records.reduce((a, r) => a + r.grossSalary, 0)
          const totalNet = records.reduce((a, r) => a + r.netSalary, 0)
          const totalDeductions = records.reduce((a, r) => a + r.pfEmployee + r.esiEmployee + r.tds + r.lateDeduction + (r.absentDeduction ?? 0) + r.otherDeduction, 0)
          const paidCount = records.filter(r => r.status === 'paid').length
          const employerCost = records.reduce((a, r) => a + r.grossSalary + r.pfEmployer + r.esiEmployer, 0)
          return [
            { label: 'Total Gross', value: fmt(totalGross), color: '#5D78FF' },
            { label: 'Total Deductions', value: fmt(totalDeductions), color: '#EF4444' },
            { label: 'Total Net Payout', value: fmt(totalNet), color: '#2BC155' },
            { label: 'Employer Cost (CTC)', value: fmt(employerCost), color: '#8B5CF6' },
            { label: 'Paid / Total', value: `${paidCount}/${records.length}`, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8A8FA8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))
        })()}
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div style={{ fontSize: 13, color: '#8A8FA8' }}>Loading...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
                {['Employee', 'Gross', 'PF', 'ESI', 'TDS', 'Late Deduction', 'Net', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8', fontSize: 13 }}>No records. Generate salary slips first.</td></tr>
              ) : records.map(r => {
                const ss = STATUS_STYLE[r.status] ?? STATUS_STYLE.draft
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.user?.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#8A8FA8', marginTop: 2 }}>
                        {r.daysPresent}d present · {r.lateDays} late{r.fullDayCuts > 0 ? ` · ${r.fullDayCuts} full cut` : ''}{r.halfDayCuts > 0 ? ` · ${r.halfDayCuts} half cut` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmt(r.grossSalary)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmt(r.pfEmployee)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmt(r.esiEmployee)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmt(r.tds)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: r.lateDeduction > 0 ? '#EF4444' : '#6B7280' }}>{fmt(r.lateDeduction)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#2BC155' }}>{fmt(r.netSalary)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canGenerate && r.status !== 'paid' && r.status !== 'pending' && (
                          <button onClick={() => setEditFor(r)} title="Correct a wrong calculation (needs admin approval)" style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Pencil size={11} />Edit
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <span style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>Awaiting admin approval</span>
                        )}
                        {r.status === 'draft' && canGenerate && (
                          <button onClick={() => setApproveFor(r)} style={{ background: '#DBEAFE', color: '#1D4ED8', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}>
                            <CheckCircle size={11} />Approve
                          </button>
                        )}
                        {r.status === 'approved' && canPay && (
                          <button onClick={() => setPayFor(r)} style={{ background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}>
                            <DollarSign size={11} />Mark Paid
                          </button>
                        )}
                        <button onClick={() => downloadSlip(r)} disabled={busyId === r.id} title="Download payslip PDF"
                          style={{ background: '#EEF2FF', color: '#4338CA', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: busyId === r.id ? 'default' : 'pointer', opacity: busyId === r.id ? 0.6 : 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Download size={11} />PDF
                        </button>
                        {canGenerate && r.status !== 'draft' && (
                          <button onClick={() => resendSlip(r)} disabled={busyId === r.id} title="Email this payslip to the employee again"
                            style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: busyId === r.id ? 'default' : 'pointer', opacity: busyId === r.id ? 0.6 : 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Mail size={11} />Resend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {approveFor && (
        <ConfirmDialog
          title="Approve this salary record?"
          message={`${approveFor.user?.name ?? 'This employee'} — net ${fmt(approveFor.netSalary)} for ${MONTHS[approveFor.month - 1]} ${approveFor.year}. Approved records are included in the NEFT export, and the payslip is emailed to the employee.`}
          confirmLabel="Approve"
          danger={false}
          isPending={approve.isPending}
          onCancel={() => setApproveFor(null)}
          onConfirm={() => {
            const name = approveFor.user?.name ?? 'employee'
            approve.mutate(approveFor.id, {
              // Approval succeeds even if SMTP is down, so report delivery separately.
              onSuccess: (res: { emailSent?: boolean; emailError?: string }) => {
                if (res?.emailSent) toast.success(`Approved — payslip emailed to ${name}`)
                else toast.error(`Approved, but the payslip email failed: ${res?.emailError ?? 'unknown error'}`)
              },
            })
            setApproveFor(null)
          }}
        />
      )}

      {editFor && (
        <SalaryEditModal
          record={editFor}
          isPending={manualEdit.isPending}
          onClose={() => setEditFor(null)}
          onSubmit={async (fields, reason) => {
            try {
              await manualEdit.mutateAsync({ id: editFor.id, ...fields, reason })
              toast.success('Correction sent for admin approval')
              setEditFor(null)
            } catch (e: any) {
              toast.error(e?.response?.data?.error ?? 'Failed to submit correction')
            }
          }}
        />
      )}

      {payFor && (
        <ConfirmDialog
          title="Mark this salary as paid?"
          message={`${payFor.user?.name ?? 'This employee'} — ${fmt(payFor.netSalary)} for ${MONTHS[payFor.month - 1]} ${payFor.year}. This records the payment permanently and cannot be undone.`}
          confirmLabel="Mark paid"
          countdownSeconds={3}
          isPending={markPaid.isPending}
          onCancel={() => setPayFor(null)}
          onConfirm={() => { markPaid.mutate(payFor.id); setPayFor(null) }}
        />
      )}
    </div>
  )
}
