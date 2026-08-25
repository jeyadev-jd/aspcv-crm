import { useState } from 'react'
import { Download, Plus, Check, AlertCircle } from 'lucide-react'
import {
  usePayrollCalculation,
  usePayrollHistory,
  usePayrollAdjustments,
  useCreateAdjustment,
  useApproveAdjustment,
  type PayrollCalculation,
} from '@/hooks/usePayroll'
import type { CrmUser } from '@/hooks/useUsers'
import { usePermission } from '@/hooks/usePermission'
import { downloadFile } from '@/lib/download'
import { toast } from '@/lib/toast'
import SalaryModelEditor from './SalaryModelEditor'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function money(n: number | null | undefined): string {
  // NaN/Infinity would otherwise render as "₹NaN" next to real figures; an
  // unavailable amount reads the same as a missing one.
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Payroll view for one employee, shown inside the HR directory's detail panel.
 * Combines the live salary-model editor with the calculated breakdown for a
 * chosen period, so master salary and its payroll consequences sit together
 * rather than in two separate screens.
 */
export default function EmployeePayrollTab({ employee }: { employee: CrmUser }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data: calc, isLoading, error } = usePayrollCalculation(employee.id, month, year)
  const { data: history = [] } = usePayrollHistory(employee.id)
  const { data: adjustments = [] } = usePayrollAdjustments(employee.id, month, year)
  const createAdjustment = useCreateAdjustment()
  const approveAdjustment = useApproveAdjustment()

  const [showAdjust, setShowAdjust] = useState(false)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')

  // Mirror the exact permissions the API enforces rather than guessing from the
  // role name: creating and approving an adjustment are separate rights, and a
  // role check would both hide the panel from users who hold the permission and
  // show buttons that only fail with a 403 to users who don't.
  // The editor previews through /payroll/preview (salary:read_all) and saves
  // through PATCH /users/:id (hr_user:edit) - it needs both to be usable.
  const canReadAllSalary = usePermission('salary', 'read_all')
  const canEditEmployee = usePermission('hr_user', 'edit')
  const canEditSalary = canReadAllSalary && canEditEmployee
  const canCreateAdjustment = usePermission('salary', 'generate')
  const canApproveAdjustment = usePermission('salary', 'approve')
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
      { userId: employee.id, month, year, amount, reason: adjReason.trim() },
      {
        onSuccess: () => {
          toast.success('Adjustment created — it applies once approved')
          setShowAdjust(false); setAdjAmount(''); setAdjReason('')
        },
        onError: (e: unknown) =>
          toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create adjustment'),
      }
    )
  }

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Download size={13} />Payslip
          </button>
        )}
      </div>

      <div style={{ padding: '9px 12px', borderRadius: 8, marginBottom: 14, fontSize: 11.5, background: isApproved ? '#EFF6FF' : '#FFFBEB', color: isApproved ? '#1D4ED8' : '#92400E' }}>
        {isApproved
          ? `Approved snapshot (version ${stored?.version}) — final figures; the payslip prints exactly these values.`
          : stored
            ? 'Draft calculation — figures may still change until the period is approved.'
            : 'Live preview — payroll has not been run for this period yet.'}
      </div>

      {/* Salary model editor — frozen once approved */}
      {canEditSalary && !isApproved && (
        <SalaryModelEditor
          employeeId={employee.id}
          initial={{
            // Employees predating the master-salary fields still have the
            // legacy trio; seed the editor from it so the panel opens showing
            // the same figures the breakdown below is calculated from, rather
            // than an empty form beside populated results.
            masterGross:
              employee.masterGross ??
              ((employee.baseSalary ?? 0) + (employee.hra ?? 0) + (employee.allowances ?? 0) || null),
            masterBasic: employee.masterBasic ?? null,
            masterHra: employee.masterHra ?? null,
            masterOthers: employee.masterOthers ?? null,
            masterSpecial1: employee.masterSpecial1 ?? null,
            masterSpecial2: employee.masterSpecial2 ?? null,
            variablePayPa: employee.variablePayPa ?? null,
            pfApplicable: employee.pfApplicable ?? true,
            esiApplicable: employee.esiApplicable ?? true,
          }}
          // Seed the day counts from the real calculation so the editor's
          // monthly figures line up with the breakdown underneath.
          calendarDays={calc?.calendarDays}
          lop={calc?.lop}
        />
      )}

      {error ? (
        <div style={{ display: 'flex', gap: 9, padding: 14, borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 12.5 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Payroll cannot be calculated for this period.</strong>
            <div style={{ marginTop: 3, fontSize: 11.5 }}>
              {(error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Calculation failed.'}
            </div>
          </div>
        </div>
      ) : isLoading || !calc ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#8A8FA8', fontSize: 12 }}>Loading calculation…</div>
      ) : (
        <Breakdown calc={calc} />
      )}

      {/* Adjustments */}
      <Section title="Payroll Adjustments">
        <p style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 9 }}>
          Calculated values are never edited directly. An adjustment is an auditable entry that affects net pay only after approval.
        </p>
        {adjustments.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8A8FA8' }}>No adjustments for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 9 }}>
            <tbody>
              {adjustments.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                  <td style={{ padding: '6px 6px' }}>{a.reason}</td>
                  <td style={{ padding: '6px 6px', color: '#8A8FA8', fontSize: 11 }}>{a.createdBy?.name ?? '—'}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: a.amount < 0 ? '#EF4444' : '#2BC155', fontWeight: 600 }}>
                    {a.amount > 0 ? '+' : ''}{money(a.amount)}
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                    {a.approvedAt ? (
                      <span style={{ color: '#065F46', fontSize: 11, fontWeight: 600 }}>Approved</span>
                    ) : canApproveAdjustment && !isApproved ? (
                      <button onClick={() => approveAdjustment.mutate(a.id, {
                        onSuccess: () => toast.success('Adjustment approved'),
                        onError: (e: unknown) =>
                          toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to approve adjustment'),
                      })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, background: '#DBEAFE', color: '#1D4ED8', border: 'none', cursor: 'pointer' }}>
                        <Check size={10} />Approve
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

        {canCreateAdjustment && !isApproved && (
          showAdjust ? (
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginTop: 7 }}>
              <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="Amount (− to deduct)"
                style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid #E8E9F0', fontSize: 12, width: 150 }} />
              <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason"
                style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid #E8E9F0', fontSize: 12, flex: '1 1 180px' }} />
              <button onClick={submitAdjustment} disabled={createAdjustment.isPending}
                style={{ padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setShowAdjust(false)}
                style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#6B7280', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowAdjust(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374151', border: 'none', cursor: 'pointer' }}>
              <Plus size={12} />Add adjustment
            </button>
          )
        )}
      </Section>

      {history.length > 0 && (
        <Section title="Payroll History">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} style={{ borderBottom: '1px solid #F8F9FF', opacity: h.isCurrent ? 1 : 0.55 }}>
                  <td style={{ padding: '6px 6px' }}>{h.period ? `${MONTHS[h.period.month - 1]} ${h.period.year}` : '—'}</td>
                  <td style={{ padding: '6px 6px', fontSize: 11, color: '#8A8FA8' }}>v{h.version}{!h.isCurrent && ' (superseded)'}</td>
                  <td style={{ padding: '6px 6px', fontSize: 11 }}>{h.period?.status ?? '—'}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>{money(h.netPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}

/**
 * Master Salary → Payroll Days → Monthly Earnings → Statutory Deductions →
 * Other Deductions → Total Deduction → Net Pay → Employer Contributions →
 * Total Employer Cost.
 */
function Breakdown({ calc }: { calc: PayrollCalculation }) {
  return (
    <>
      <Section title="Master Salary">
        <Grid>
          <Item label="Basic (50%)" value={money(calc.masterBasic)} />
          <Item label="HRA (25%)" value={money(calc.masterHra)} />
          <Item label="Others (25%)" value={money(calc.masterOthers)} />
          <Item label="Special 1" value={money(calc.masterSpecial1)} />
          <Item label="Special 2" value={money(calc.masterSpecial2)} />
          <Item label="Master Gross" value={money(calc.masterGross)} strong />
        </Grid>
      </Section>

      <Section title="Statutory (Master)">
        <Grid>
          <Item label="PF Basic" value={money(calc.masterPfBasic)} hint="min(Gross − HRA, 15,000)" />
          <Item label="Co PF" value={money(calc.masterCoPf)} hint="× 12%" />
          <Item label="For ESI" value={calc.masterForEsi} />
          <Item label="ESI Gross" value={money(calc.masterEsiGross)} />
          <Item label="Co ESI" value={money(calc.masterCoEsi)} hint="× 3.25%" />
          <Item label="CTC PM" value={money(calc.masterCtcPm)} strong />
          <Item label="CTC PA" value={money(calc.masterCtcPa)} />
          <Item label="Variable Pay PA" value={money(calc.variablePayPa)} />
          <Item label="CTC PA Fix+Vari" value={money(calc.masterCtcPaTotal)} strong />
        </Grid>
      </Section>

      <Section title="Attendance & Salary Days">
        <Grid>
          <Item label="Calendar Days" value={String(calc.calendarDays)} />
          <Item label="Days in Month" value={String(calc.daysInMonth)} />
          <Item label="Present" value={String(calc.daysPresent)} />
          <Item label="Approved Leave" value={String(calc.approvedLeaveDays)} />
          <Item label="Holidays" value={String(calc.holidayDays)} />
          <Item label="Weekly Offs" value={String(calc.weeklyOffDays)} />
          <Item label="Late Days" value={String(calc.lateDays)} hint={`${calc.lateLopDays} day LOP`} />
          <Item label="Absent" value={String(calc.daysAbsent)} />
          <Item label="LOP" value={String(calc.lop)} danger={calc.lop > 0} />
          <Item label="Days for Salary" value={String(calc.daysForSalary)} strong />
        </Grid>
      </Section>

      <Section title="Monthly Earnings">
        <Grid>
          <Item label="Basic" value={money(calc.monthlyBasic)} hint="Master ÷ cal. days × payable" />
          <Item label="HRA" value={money(calc.monthlyHra)} />
          <Item label="Others" value={money(calc.monthlyOthers)} />
          <Item label="Special 1" value={money(calc.monthlySpecial1)} />
          <Item label="Special 2" value={money(calc.monthlySpecial2)} />
          <Item label="Monthly Gross" value={money(calc.monthlyGross)} strong />
          <Item label="Gross − HRA" value={money(calc.grossHra)} hint="PF wage basis" />
        </Grid>
      </Section>

      <Section title="Statutory Deductions">
        <Grid>
          <Item label="Employee PF" value={money(calc.employeePf)} hint="12%, flat 1,800 above ceiling" />
          <Item label="Employee ESI" value={money(calc.employeeEsi)} hint="0.75% when eligible" />
          <Item label="TDS" value={money(calc.employeeTds)} hint="new regime" />
          <Item label="Professional Tax" value={money(calc.employeePt)} hint="Tamil Nadu" />
        </Grid>
      </Section>

      <Section title="Other Deductions">
        <Grid>
          <Item label="Deduction 1" value={money(calc.employeeDeduction1)} />
          <Item label="Deduction 2" value={money(calc.employeeDeduction2)} />
          <Item label="TDA" value={money(calc.tda)} />
          <Item label="Adjustments" value={money(calc.adjustmentTotal)} hint="approved only" />
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
          <Item label="Admin Charges" value={money(calc.adminCharges)} hint="0.5%" />
          <Item label="EDLI Charges" value={money(calc.edliCharges)} hint="0.5%" />
          <Item label="Employer ESI" value={money(calc.employerEsi)} hint="3.25% below 21,000" />
          <Item label="Total Employer Cost" value={money(calc.totalEmployerCost)} strong />
        </Grid>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>{children}</div>
}

function Item({ label, value, hint, strong, danger, success }: {
  label: string; value: string; hint?: string; strong?: boolean; danger?: boolean; success?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#8A8FA8' }}>{label}</div>
      <div style={{
        fontSize: strong ? 14 : 12.5, fontWeight: strong ? 700 : 600, marginTop: 2,
        color: success ? '#2BC155' : danger ? '#EF4444' : '#1A1D23',
      }}>{value}</div>
      {hint && <div style={{ fontSize: 9.5, color: '#B1B1BE', marginTop: 1 }}>{hint}</div>}
    </div>
  )
}
