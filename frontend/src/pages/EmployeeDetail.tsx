import { useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Plus, Check, AlertCircle } from 'lucide-react'
import {
  usePayrollCalculation,
  usePayrollHistory,
  usePayrollAdjustments,
  useCreateAdjustment,
  useApproveAdjustment,
  type PayrollCalculation,
} from '@/hooks/usePayroll'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/lib/authStore'
import { downloadFile } from '@/lib/download'
import { toast } from '@/lib/toast'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const now = new Date()

  const [month, setMonth] = useState(Number(params.get('month')) || now.getMonth() + 1)
  const [year, setYear] = useState(Number(params.get('year')) || now.getFullYear())

  const { data: users = [] } = useUsers()
  const employee = users.find((u: { id: string }) => u.id === id)

  const { data: calc, isLoading, error } = usePayrollCalculation(id ?? null, month, year)
  const { data: history = [] } = usePayrollHistory(id ?? null)
  const { data: adjustments = [] } = usePayrollAdjustments(id ?? null, month, year)
  const createAdjustment = useCreateAdjustment()
  const approveAdjustment = useApproveAdjustment()

  const [showAdjust, setShowAdjust] = useState(false)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')

  const canManage = authUser && ['SuperAdmin', 'HR'].includes(authUser.role)
  // The stored record for this period, if payroll has been run.
  const stored = history.find((h) => h.period?.month === month && h.period?.year === year && h.isCurrent)
  const isApproved = stored?.period?.status === 'Approved' || stored?.period?.status === 'Paid'

  async function downloadSlip() {
    if (!stored) return
    try {
      await downloadFile(`/payroll/records/${stored.id}/payslip`, `Payslip-${MONTHS[month - 1]}-${year}.pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download payslip')
    }
  }

  function submitAdjustment() {
    const amount = Number(adjAmount)
    if (!Number.isFinite(amount) || amount === 0) return toast.error('Enter a non-zero amount')
    if (adjReason.trim().length < 3) return toast.error('Enter a reason for this adjustment')
    createAdjustment.mutate(
      { userId: id!, month, year, amount, reason: adjReason.trim() },
      {
        onSuccess: () => {
          toast.success('Adjustment created — it applies once approved')
          setShowAdjust(false); setAdjAmount(''); setAdjReason('')
        },
        onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create adjustment'),
      }
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <button onClick={() => navigate('/employees')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#5D78FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={14} /> Employee Directory
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23' }}>{employee?.name ?? 'Employee'}</h1>
          <p style={{ fontSize: 12, color: '#8A8FA8', marginTop: 3 }}>
            {employee?.employeeCode ? `${employee.employeeCode} · ` : ''}{employee?.email}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E8E9F0', fontSize: 12 }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E8E9F0', fontSize: 12 }}>
            {[year - 2, year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {stored && isApproved && (
            <button onClick={downloadSlip}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Download size={13} />Payslip
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div style={{ display: 'flex', gap: 10, padding: 16, borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Payroll cannot be calculated for this period.</strong>
            <div style={{ marginTop: 3, fontSize: 12 }}>
              {(error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Calculation failed.'}
            </div>
          </div>
        </div>
      ) : isLoading || !calc ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#8A8FA8' }}>Loading calculation…</div>
      ) : (
        <>
          {/* Status banner: is this a live preview or the approved snapshot? */}
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 12, background: isApproved ? '#EFF6FF' : '#FFFBEB', color: isApproved ? '#1D4ED8' : '#92400E' }}>
            {isApproved
              ? `Approved snapshot (version ${stored?.version}) — these are the final figures, and the payslip prints exactly these values.`
              : stored
                ? `Draft calculation — figures may still change until the period is approved.`
                : `Live preview — payroll has not been run for this period yet, so nothing is stored.`}
          </div>

          <Breakdown calc={calc} />

          {/* Adjustments */}
          <Section title="Payroll Adjustments">
            <p style={{ fontSize: 11.5, color: '#8A8FA8', marginBottom: 10 }}>
              Calculated values are never edited directly. An adjustment is an auditable entry that affects net pay only after approval.
            </p>
            {adjustments.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8A8FA8', padding: '6px 0' }}>No adjustments for this period.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F0F1F5' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Reason</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Created by</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Amount</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                      <td style={{ padding: '7px 8px' }}>{a.reason}</td>
                      <td style={{ padding: '7px 8px', color: '#8A8FA8' }}>{a.createdBy?.name ?? '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: a.amount < 0 ? '#EF4444' : '#2BC155', fontWeight: 600 }}>
                        {a.amount > 0 ? '+' : ''}{money(a.amount)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                        {a.approvedAt ? (
                          <span style={{ color: '#065F46', fontSize: 11, fontWeight: 600 }}>Approved</span>
                        ) : canManage ? (
                          <button onClick={() => approveAdjustment.mutate(a.id, { onSuccess: () => toast.success('Adjustment approved') })}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#DBEAFE', color: '#1D4ED8', border: 'none', cursor: 'pointer' }}>
                            <Check size={11} />Approve
                          </button>
                        ) : (
                          <span style={{ color: '#92400E', fontSize: 11, fontWeight: 600 }}>Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {canManage && !isApproved && (
              showAdjust ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="Amount (− to deduct)"
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E8E9F0', fontSize: 12, width: 170 }} />
                  <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason"
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E8E9F0', fontSize: 12, flex: '1 1 220px' }} />
                  <button onClick={submitAdjustment} disabled={createAdjustment.isPending}
                    style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setShowAdjust(false)}
                    style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#6B7280', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowAdjust(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374151', border: 'none', cursor: 'pointer' }}>
                  <Plus size={13} />Add adjustment
                </button>
              )
            )}
          </Section>

          {/* Version history */}
          {history.length > 0 && (
            <Section title="Payroll History">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F0F1F5' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Period</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Version</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Gross</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: '#8A8FA8' }}>Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #F8F9FF', opacity: h.isCurrent ? 1 : 0.55 }}>
                      <td style={{ padding: '7px 8px' }}>{h.period ? `${MONTHS[h.period.month - 1]} ${h.period.year}` : '—'}</td>
                      <td style={{ padding: '7px 8px' }}>v{h.version}{!h.isCurrent && ' (superseded)'}</td>
                      <td style={{ padding: '7px 8px' }}>{h.period?.status ?? '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>{money(h.monthlyGross)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600 }}>{money(h.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The mandated breakdown order:
 * Master Salary -> Payroll Days -> Monthly Earnings -> Statutory Deductions ->
 * Other Deductions -> Total Deduction -> Net Pay -> Employer Contributions ->
 * Total Employer Cost.
 */
function Breakdown({ calc }: { calc: PayrollCalculation }) {
  return (
    <>
      <Section title="Master Salary">
        <Grid>
          <Item label="Master Basic (50%)" value={money(calc.masterBasic)} />
          <Item label="Master HRA (25%)" value={money(calc.masterHra)} />
          <Item label="Master Others (25%)" value={money(calc.masterOthers)} />
          <Item label="Special 1" value={money(calc.masterSpecial1)} />
          <Item label="Special 2" value={money(calc.masterSpecial2)} />
          <Item label="Master Gross" value={money(calc.masterGross)} strong />
        </Grid>
      </Section>

      <Section title="Statutory Salary (Master)">
        <Grid>
          <Item label="Master PF Basic" value={money(calc.masterPfBasic)} hint="min(Gross − HRA, 15,000)" />
          <Item label="Master Co PF" value={money(calc.masterCoPf)} hint="PF Basic × 12%" />
          <Item label="For ESI" value={calc.masterForEsi} hint="Gross > 21,000 ⇒ NO ESI" />
          <Item label="Master ESI Gross" value={money(calc.masterEsiGross)} />
          <Item label="Master Co ESI" value={money(calc.masterCoEsi)} hint="ESI Gross × 3.25%" />
          <Item label="Master CTC PM" value={money(calc.masterCtcPm)} hint="Gross + Co PF + Co ESI" strong />
          <Item label="Master CTC PA" value={money(calc.masterCtcPa)} />
          <Item label="Variable Pay PA" value={money(calc.variablePayPa)} />
          <Item label="CTC PA (Fix + Vari)" value={money(calc.masterCtcPaTotal)} strong />
        </Grid>
      </Section>

      <Section title="Attendance & Salary Days">
        <Grid>
          <Item label="Calendar Days" value={String(calc.calendarDays)} />
          <Item label="Days in Month" value={String(calc.daysInMonth)} />
          <Item label="Days Present" value={String(calc.daysPresent)} />
          <Item label="Approved Leave" value={String(calc.approvedLeaveDays)} />
          <Item label="Holidays" value={String(calc.holidayDays)} />
          <Item label="Weekly Offs" value={String(calc.weeklyOffDays)} />
          <Item label="Late Days" value={String(calc.lateDays)} hint={`${calc.lateLopDays} day LOP penalty`} />
          <Item label="Days Absent" value={String(calc.daysAbsent)} />
          <Item label="LOP" value={String(calc.lop)} danger={calc.lop > 0} />
          <Item label="Days for Salary" value={String(calc.daysForSalary)} strong />
        </Grid>
      </Section>

      <Section title="Monthly Earnings">
        <Grid>
          <Item label="Monthly Basic" value={money(calc.monthlyBasic)} hint="Master ÷ calendar days × payable days" />
          <Item label="Monthly HRA" value={money(calc.monthlyHra)} />
          <Item label="Monthly Others" value={money(calc.monthlyOthers)} />
          <Item label="Special 1" value={money(calc.monthlySpecial1)} />
          <Item label="Special 2" value={money(calc.monthlySpecial2)} />
          <Item label="Monthly Gross" value={money(calc.monthlyGross)} strong />
          <Item label="Gross − HRA" value={money(calc.grossHra)} hint="PF / admin / EDLI wage basis" />
        </Grid>
      </Section>

      <Section title="Statutory Deductions">
        <Grid>
          <Item label="Employee PF" value={money(calc.employeePf)} hint="12% of Gross−HRA, flat 1,800 above ceiling" />
          <Item label="Employee ESI" value={money(calc.employeeEsi)} hint="0.75% of monthly gross when eligible" />
          <Item label="Employee TDS" value={money(calc.employeeTds)} hint="New regime, s.115BAC" />
          <Item label="Professional Tax" value={money(calc.employeePt)} hint="Tamil Nadu" />
        </Grid>
      </Section>

      <Section title="Other Deductions">
        <Grid>
          <Item label="Deduction 1" value={money(calc.employeeDeduction1)} />
          <Item label="Deduction 2" value={money(calc.employeeDeduction2)} />
          <Item label="TDA" value={money(calc.tda)} />
          <Item label="Adjustments" value={money(calc.adjustmentTotal)} hint="approved adjustments only" />
        </Grid>
      </Section>

      <Section title="Net Pay">
        <Grid>
          <Item label="Monthly Gross" value={money(calc.monthlyGross)} />
          <Item label="Total Deduction" value={money(calc.totalDeduction)} danger />
          <Item label="TDA" value={money(calc.tda)} />
          <Item label="Net Pay" value={money(calc.netPay)} strong success />
        </Grid>
      </Section>

      <Section title="Employer Contributions">
        <Grid>
          <Item label="Employer PF" value={money(calc.employerPf)} />
          <Item label="Admin Charges" value={money(calc.adminCharges)} hint="0.5% of capped basis" />
          <Item label="EDLI Charges" value={money(calc.edliCharges)} hint="0.5% of capped basis" />
          <Item label="Employer ESI" value={money(calc.employerEsi)} hint="3.25% when gross < 21,000" />
          <Item label="Total Employer Cost" value={money(calc.totalEmployerCost)} strong />
        </Grid>
      </Section>

      <p style={{ fontSize: 11, color: '#8A8FA8', marginTop: -4 }}>
        Calculated by the backend payroll engine · statutory configuration <code>{calc.configVersion}</code>
      </p>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>{children}</div>
}

function Item({ label, value, hint, strong, danger, success }: {
  label: string; value: string; hint?: string; strong?: boolean; danger?: boolean; success?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: '#8A8FA8' }}>{label}</div>
      <div style={{
        fontSize: strong ? 15 : 13,
        fontWeight: strong ? 700 : 600,
        marginTop: 2,
        color: success ? '#2BC155' : danger ? '#EF4444' : '#1A1D23',
      }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: '#B1B1BE', marginTop: 1 }}>{hint}</div>}
    </div>
  )
}
