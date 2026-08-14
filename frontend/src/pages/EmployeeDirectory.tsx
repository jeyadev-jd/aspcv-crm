import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Users, Play, CheckCircle, RotateCcw, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useEmployeeDirectory,
  usePayrollPeriod,
  useRunPayroll,
  useApprovePeriod,
  useReopenPeriod,
  useMarkPeriodPaid,
  type DirectoryRow,
} from '@/hooks/usePayroll'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function years(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}m`
  return m === 0 ? `${y}y` : `${y}y ${m}m`
}

/**
 * Column groups. The directory deliberately shows one group at a time rather
 * than 50+ columns side by side - the full row is on the detail page.
 */
const GROUPS = [
  { key: 'info', label: 'Employee Information' },
  { key: 'lifecycle', label: 'Employment Lifecycle' },
  { key: 'master', label: 'Master Salary' },
  { key: 'statutory', label: 'Statutory Salary' },
  { key: 'days', label: 'Attendance & Salary Days' },
  { key: 'earnings', label: 'Monthly Earnings' },
  { key: 'deductions', label: 'Employee Deductions' },
  { key: 'net', label: 'Net Pay' },
  { key: 'employer', label: 'Employer Contributions' },
] as const

type GroupKey = (typeof GROUPS)[number]['key']

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Draft: { bg: '#FEF3C7', color: '#92400E' },
  Approved: { bg: '#DBEAFE', color: '#1D4ED8' },
  Reopened: { bg: '#FEE2E2', color: '#B91C1C' },
  Paid: { bg: '#D1FAE5', color: '#065F46' },
}

const LIFECYCLE_STYLE: Record<string, { bg: string; color: string }> = {
  Joiner: { bg: '#DBEAFE', color: '#1D4ED8' },
  Leaver: { bg: '#FEE2E2', color: '#B91C1C' },
  Stayer: { bg: '#F3F4F6', color: '#374151' },
}

export default function EmployeeDirectory() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const now = new Date()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [departmentId, setDepartmentId] = useState('')
  const [group, setGroup] = useState<GroupKey>('info')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const { data, isLoading } = useEmployeeDirectory({ search, status, departmentId, month, year, page, pageSize })
  const { data: departments = [] } = useDepartments()
  const { data: period } = usePayrollPeriod(month, year)

  const runPayroll = useRunPayroll()
  const approve = useApprovePeriod()
  const reopen = useReopenPeriod()
  const markPaid = useMarkPeriodPaid()

  const [confirmAction, setConfirmAction] = useState<'run' | 'approve' | 'reopen' | 'paid' | null>(null)

  const canRun = user && ['SuperAdmin', 'HR'].includes(user.role)
  const canApprove = user && ['SuperAdmin', 'HR'].includes(user.role)
  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // Salary columns only arrive when the caller is permitted to see them.
  const showSalary = rows.length > 0 && rows[0] !== undefined && 'masterGross' in rows[0]

  const periodStatus = period?.status ?? 'Draft'
  const ss = STATUS_STYLE[periodStatus] ?? STATUS_STYLE.Draft

  function runAction() {
    if (confirmAction === 'run') {
      runPayroll.mutate(
        { month, year },
        {
          onSuccess: (res: { calculated?: number; skipped?: unknown[] }) => {
            const skipped = res?.skipped?.length ?? 0
            toast.success(`Calculated ${res?.calculated ?? 0} employees${skipped ? `, ${skipped} skipped` : ''}`)
          },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Payroll run failed')
          },
        }
      )
    } else if (confirmAction === 'approve') {
      approve.mutate({ month, year }, {
        onSuccess: () => toast.success('Payroll approved — figures are now frozen'),
        onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Approval failed'),
      })
    } else if (confirmAction === 'reopen') {
      reopen.mutate({ month, year }, {
        onSuccess: () => toast.success('Payroll reopened — previous version kept for audit'),
        onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Reopen failed'),
      })
    } else if (confirmAction === 'paid') {
      markPaid.mutate({ month, year }, {
        onSuccess: () => toast.success('Payroll marked as paid'),
        onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to mark paid'),
      })
    }
    setConfirmAction(null)
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1D23', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} /> Employee Directory
          </h1>
          <p style={{ fontSize: 12, color: '#8A8FA8', marginTop: 3 }}>
            {total} employee{total === 1 ? '' : 's'} · payroll period {MONTHS[month - 1]} {year}
            {period && (
              <>
                {' · '}
                <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                  {periodStatus}
                </span>
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1) }}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E8E9F0', fontSize: 12 }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1) }}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E8E9F0', fontSize: 12 }}>
            {[year - 2, year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {canRun && periodStatus === 'Draft' && (
            <button onClick={() => setConfirmAction('run')} disabled={runPayroll.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', opacity: runPayroll.isPending ? 0.6 : 1 }}>
              <Play size={13} />{runPayroll.isPending ? 'Calculating…' : 'Run Payroll'}
            </button>
          )}
          {canApprove && periodStatus === 'Draft' && (period?._count?.records ?? period?.records?.length ?? 0) > 0 && (
            <button onClick={() => setConfirmAction('approve')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#DBEAFE', color: '#1D4ED8', border: 'none', cursor: 'pointer' }}>
              <CheckCircle size={13} />Approve
            </button>
          )}
          {canApprove && periodStatus === 'Approved' && (
            <>
              <button onClick={() => setConfirmAction('reopen')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#FEF3C7', color: '#92400E', border: 'none', cursor: 'pointer' }}>
                <RotateCcw size={13} />Reopen
              </button>
              <button onClick={() => setConfirmAction('paid')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#D1FAE5', color: '#065F46', border: 'none', cursor: 'pointer' }}>
                <DollarSign size={13} />Mark Paid
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 340 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, email, employee code…"
            style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8, border: '1px solid #E8E9F0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
              <X size={12} />
            </button>
          )}
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E8E9F0', fontSize: 12 }}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="">All</option>
        </select>
        <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1) }}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E8E9F0', fontSize: 12 }}>
          <option value="">All departments</option>
          {departments.map((d: { id: string; name: string }) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Group tabs — keeps the table narrow */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {GROUPS.filter((g) => showSalary || g.key === 'info' || g.key === 'lifecycle').map((g) => (
          <button key={g.key} onClick={() => setGroup(g.key)}
            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: group === g.key ? '#5D78FF' : '#F4F5F9', color: group === g.key ? '#fff' : '#8A8FA8' }}>
            {g.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
                <Th sticky>Employee</Th>
                {group === 'info' && <><Th>Designation</Th><Th>Department</Th><Th>DOB</Th><Th>Prior Exp.</Th><Th>Exp. in ASPCV</Th></>}
                {group === 'lifecycle' && <><Th>DOJ</Th><Th>Probation</Th><Th>DOC</Th><Th>DOR Letter</Th><Th>DOL</Th><Th>Status</Th></>}
                {group === 'master' && <><Th num>Master Basic</Th><Th num>Master HRA</Th><Th num>Master Others</Th><Th num>Special 1</Th><Th num>Special 2</Th><Th num>Master Gross</Th></>}
                {group === 'statutory' && <><Th num>PF Basic</Th><Th num>Co PF</Th><Th>For ESI</Th><Th num>ESI Gross</Th><Th num>Co ESI</Th><Th num>CTC PM</Th><Th num>CTC PA</Th></>}
                {group === 'days' && <><Th num>Calendar Days</Th><Th num>Present</Th><Th num>Leave</Th><Th num>Late</Th><Th num>LOP</Th><Th num>Days for Salary</Th></>}
                {group === 'earnings' && <><Th num>Basic</Th><Th num>HRA</Th><Th num>Others</Th><Th num>Special 1</Th><Th num>Special 2</Th><Th num>Gross</Th><Th num>Gross-HRA</Th></>}
                {group === 'deductions' && <><Th num>PF</Th><Th num>ESI</Th><Th num>TDS</Th><Th num>PT</Th><Th num>Ded 1</Th><Th num>Ded 2</Th><Th num>Total</Th></>}
                {group === 'net' && <><Th num>Gross</Th><Th num>Total Deduction</Th><Th num>TDA</Th><Th num>Adjustments</Th><Th num>Net Pay</Th></>}
                {group === 'employer' && <><Th num>Employer PF</Th><Th num>Admin</Th><Th num>EDLI</Th><Th num>Employer ESI</Th><Th num>Total Cost</Th></>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8' }}>No employees match these filters.</td></tr>
              ) : rows.map((r) => <Row key={r.id} row={r} group={group} onOpen={() => navigate(`/employees/${r.id}?month=${month}&year=${year}`)} />)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #F0F1F5' }}>
          <span style={{ fontSize: 11, color: '#8A8FA8' }}>Page {page} of {totalPages} · {total} total</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid #E8E9F0', background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1, display: 'flex' }}>
              <ChevronLeft size={13} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid #E8E9F0', background: '#fff', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, display: 'flex' }}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction === 'run' ? `Run payroll for ${MONTHS[month - 1]} ${year}?`
              : confirmAction === 'approve' ? 'Approve this payroll period?'
              : confirmAction === 'reopen' ? 'Reopen this approved period?'
              : 'Mark this payroll as paid?'
          }
          message={
            confirmAction === 'run' ? 'Calculates every active employee with a configured master salary. Existing draft figures for this period are replaced.'
              : confirmAction === 'approve' ? 'Approved figures are frozen — salary slips read from them, and later master-salary edits will not change them.'
              : confirmAction === 'reopen' ? 'The approved figures are retained as a previous version for audit, and a new version is created for correction.'
              : 'Marks the approved payroll as paid. A paid period can no longer be reopened.'
          }
          confirmLabel={confirmAction === 'run' ? 'Run' : confirmAction === 'approve' ? 'Approve' : confirmAction === 'reopen' ? 'Reopen' : 'Mark Paid'}
          danger={confirmAction === 'reopen'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={runAction}
        />
      )}
    </div>
  )
}

function Th({ children, num, sticky }: { children: React.ReactNode; num?: boolean; sticky?: boolean }) {
  return (
    <th style={{
      padding: '9px 12px', textAlign: num ? 'right' : 'left', fontSize: 11, fontWeight: 600,
      color: '#8A8FA8', whiteSpace: 'nowrap',
      ...(sticky ? { position: 'sticky', left: 0, background: '#FAFBFF', zIndex: 1 } : {}),
    }}>{children}</th>
  )
}

function Td({ children, num, style }: { children: React.ReactNode; num?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '9px 12px', textAlign: num ? 'right' : 'left', whiteSpace: 'nowrap', ...style }}>
      {children}
    </td>
  )
}

function d(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function Row({ row, group, onOpen }: { row: DirectoryRow; group: GroupKey; onOpen: () => void }) {
  const p = row.payroll
  const ls = row.lifecycle ? LIFECYCLE_STYLE[row.lifecycle] : null

  return (
    <tr onClick={onOpen} style={{ borderBottom: '1px solid #F8F9FF', cursor: 'pointer' }}>
      <td style={{ padding: '9px 12px', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
        <div style={{ fontWeight: 600, color: '#1A1D23' }}>{row.name}</div>
        <div style={{ fontSize: 10.5, color: '#8A8FA8', marginTop: 1 }}>{row.employeeCode ?? row.email}</div>
      </td>

      {group === 'info' && (
        <>
          <Td>{row.designation ?? '—'}</Td>
          <Td>{row.department ?? '—'}</Td>
          <Td>{d(row.dateOfBirth)}</Td>
          <Td>{years(row.priorExperienceMonths)}</Td>
          <Td>{years(row.experienceInAspcvMonths)}</Td>
        </>
      )}

      {group === 'lifecycle' && (
        <>
          <Td>{d(row.joiningDate)}</Td>
          <Td>{row.probationDays ? `${row.probationDays}d` : '—'}</Td>
          <Td>{d(row.confirmationDate)}</Td>
          <Td>{d(row.dorLetterDate)}</Td>
          <Td>{d(row.lastWorkingDate)}</Td>
          <Td>
            {ls ? (
              <span style={{ background: ls.bg, color: ls.color, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{row.lifecycle}</span>
            ) : row.isJoiner ? 'Joiner' : row.isLeaver ? 'Leaver' : 'Stayer'}
          </Td>
        </>
      )}

      {group === 'master' && (
        <>
          <Td num>{money(p?.masterBasic ?? row.masterBasic)}</Td>
          <Td num>{money(p?.masterHra ?? row.masterHra)}</Td>
          <Td num>{money(p?.masterOthers ?? row.masterOthers)}</Td>
          <Td num>{money(p?.masterSpecial1)}</Td>
          <Td num>{money(p?.masterSpecial2)}</Td>
          <Td num><strong>{money(p?.masterGross ?? row.masterGross)}</strong></Td>
        </>
      )}

      {group === 'statutory' && (
        <>
          <Td num>{money(p?.masterPfBasic)}</Td>
          <Td num>{money(p?.masterCoPf)}</Td>
          <Td>{p?.masterForEsi ?? '—'}</Td>
          <Td num>{money(p?.masterEsiGross)}</Td>
          <Td num>{money(p?.masterCoEsi)}</Td>
          <Td num>{money(p?.masterCtcPm)}</Td>
          <Td num>{money(p?.masterCtcPa)}</Td>
        </>
      )}

      {group === 'days' && (
        <>
          <Td num>{p?.period?.calendarDays ?? '—'}</Td>
          <Td num>{p?.daysPresent ?? '—'}</Td>
          <Td num>{p?.approvedLeaveDays ?? '—'}</Td>
          <Td num>{p?.lateDays ?? '—'}</Td>
          <Td num style={{ color: (p?.lop ?? 0) > 0 ? '#EF4444' : undefined }}>{p?.lop ?? '—'}</Td>
          <Td num><strong>{p?.daysForSalary ?? '—'}</strong></Td>
        </>
      )}

      {group === 'earnings' && (
        <>
          <Td num>{money(p?.monthlyBasic)}</Td>
          <Td num>{money(p?.monthlyHra)}</Td>
          <Td num>{money(p?.monthlyOthers)}</Td>
          <Td num>{money(p?.monthlySpecial1)}</Td>
          <Td num>{money(p?.monthlySpecial2)}</Td>
          <Td num><strong>{money(p?.monthlyGross)}</strong></Td>
          <Td num>{money(p?.grossHra)}</Td>
        </>
      )}

      {group === 'deductions' && (
        <>
          <Td num>{money(p?.employeePf)}</Td>
          <Td num>{money(p?.employeeEsi)}</Td>
          <Td num>{money(p?.employeeTds)}</Td>
          <Td num>{money(p?.employeePt)}</Td>
          <Td num>{money(p?.employeeDeduction1)}</Td>
          <Td num>{money(p?.employeeDeduction2)}</Td>
          <Td num><strong>{money(p?.totalDeduction)}</strong></Td>
        </>
      )}

      {group === 'net' && (
        <>
          <Td num>{money(p?.monthlyGross)}</Td>
          <Td num>{money(p?.totalDeduction)}</Td>
          <Td num>{money(p?.tda)}</Td>
          <Td num>{money(p?.adjustmentTotal)}</Td>
          <Td num><strong style={{ color: '#2BC155' }}>{money(p?.netPay)}</strong></Td>
        </>
      )}

      {group === 'employer' && (
        <>
          <Td num>{money(p?.employerPf)}</Td>
          <Td num>{money(p?.adminCharges)}</Td>
          <Td num>{money(p?.edliCharges)}</Td>
          <Td num>{money(p?.employerEsi)}</Td>
          <Td num><strong>{money(p?.totalEmployerCost)}</strong></Td>
        </>
      )}
    </tr>
  )
}
