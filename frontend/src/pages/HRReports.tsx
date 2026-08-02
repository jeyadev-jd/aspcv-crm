import { useState } from 'react'
import { Download, Users, Calendar, Wallet, Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/authStore'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface LeaveBalanceRow {
  userId: string
  userName: string
  isActive?: boolean
  department: string | null
  leaveTypeName: string
  entitled: number
  taken: number
  encashed: number
  remaining: number
  year: number
}

// SalaryRecord has no totalDeductions column — it is derived from the parts,
// the same way the Payroll page does it.
const deductionsOf = (r: any) =>
  (r.pfEmployee || 0) + (r.esiEmployee || 0) + (r.tds || 0) +
  (r.lateDeduction || 0) + (r.absentDeduction || 0) + (r.otherDeduction || 0)

export default function HRReports() {
  const can = useAuthStore(s => s.can)
  // GET /users is gated on hr_user:read_all, so mirror that exactly.
  const canReadUsers = can('hr_user', 'read_all')
  const canReadAttendance = can('attendance', 'read_all')
  const canReadSalary = can('salary', 'read_all')
  // GET /leave/types is authenticated-only, no permission required.
  const canReadLeave = true

  const tabs = ([
    { key: 'employee', label: 'Employee Report', icon: Users, allowed: canReadUsers },
    { key: 'attendance', label: 'Attendance', icon: Calendar, allowed: canReadAttendance },
    { key: 'leave', label: 'Leave Summary', icon: Calendar, allowed: canReadLeave },
    { key: 'payroll', label: 'Payroll', icon: Wallet, allowed: canReadSalary },
  ] as const).filter(t => t.allowed)

  const [tab, setTab] = useState<'employee' | 'attendance' | 'leave' | 'payroll'>(
    (tabs[0]?.key as any) ?? 'employee'
  )
  const now = new Date()
  const [attMonth, setAttMonth] = useState(now.getMonth() + 1)
  const [attYear, setAttYear] = useState(now.getFullYear())
  const [payMonth, setPayMonth] = useState(now.getMonth() + 1)
  const [payYear, setPayYear] = useState(now.getFullYear())

  const { data: users = [] } = useQuery({
    queryKey: ['users-list', 'report'],
    // includePending → inactive employees show too (report has a Status column);
    // pageSize high → the default page cap can't silently truncate the roster.
    queryFn: () => api.get('/users', { params: { includePending: 'true', pageSize: 1000 } }).then(r => r.data?.data || r.data || []),
    enabled: tab === 'employee' && canReadUsers,
  })
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/leave/types').then(r => r.data),
    enabled: tab === 'leave' && canReadLeave,
  })

  // Per-employee balances — the config table alone never answered "who has
  // leave left", which is what this tab is actually for.
  const [leaveView, setLeaveView] = useState<'balances' | 'types'>('balances')
  const [leaveYear, setLeaveYear] = useState(now.getFullYear())
  const [leaveDept, setLeaveDept] = useState('')

  const { data: leaveBalances = [], isLoading: balancesLoading, error: balancesError } = useQuery<LeaveBalanceRow[]>({
    queryKey: ['leave-balances-summary', leaveYear],
    queryFn: () => api.get(`/leave/balances/summary?year=${leaveYear}`).then(r => r.data),
    enabled: tab === 'leave' && leaveView === 'balances' && canReadLeave,
    retry: false,
  })
  // Backend restricts the summary to HR-ish roles; surface that instead of an
  // empty table when the caller lacks access.
  const balancesForbidden = (balancesError as any)?.response?.status === 403

  // Ex-employees keep leave-balance rows; a current report should only show
  // active staff so terminated people don't inflate the roster.
  const activeBalances = leaveBalances.filter(b => b.isActive !== false)
  const leaveDepartments = Array.from(
    new Set(activeBalances.map(b => b.department).filter(Boolean) as string[])
  ).sort()
  const filteredBalances = leaveDept ? activeBalances.filter(b => b.department === leaveDept) : activeBalances

  const leaveReport = filteredBalances.map(b => ({
    Employee: b.userName,
    Department: b.department ?? '-',
    'Leave Type': b.leaveTypeName,
    Entitled: b.entitled,
    Taken: b.taken,
    Encashed: b.encashed || 0,
    Remaining: b.remaining,
    Year: b.year,
  }))
  const { data: attRecords = [] } = useQuery({
    queryKey: ['attendance-all', attMonth, attYear],
    queryFn: () => api.get(`/attendance/all?month=${attMonth}&year=${attYear}`).then(r => r.data),
    enabled: tab === 'attendance' && canReadAttendance,
  })
  const { data: payRecords = [] } = useQuery({
    queryKey: ['salary-all', payMonth, payYear],
    // all=true — a paginated page would silently under-report company totals.
    queryFn: () => api.get(`/salary/all?month=${payMonth}&year=${payYear}&all=true`).then(r => r.data?.data || r.data || []),
    enabled: tab === 'payroll' && canReadSalary,
  })

  // Aggregate attendance per employee
  const attByUser = new Map<string, { name: string; dept: string; present: number; absent: number; late: number; halfDay: number; leave: number; total: number }>()
  ;(Array.isArray(attRecords) ? attRecords : []).forEach((r: any) => {
    const uid = r.userId
    if (!attByUser.has(uid)) {
      attByUser.set(uid, { name: r.user?.name || uid, dept: r.user?.department?.name || '-', present: 0, absent: 0, late: 0, halfDay: 0, leave: 0, total: 0 })
    }
    const entry = attByUser.get(uid)!
    entry.total++
    const status = (r.status || '').toLowerCase()
    if (status === 'present') entry.present++
    else if (status === 'absent') entry.absent++
    else if (status === 'late') { entry.late++; entry.present++ }
    else if (status === 'half_day' || status === 'halfday') entry.halfDay++
    else if (status === 'leave') entry.leave++
  })

  // Attendance % credits half-days at 50% and excludes approved leave from the
  // denominator, so taking sanctioned leave cannot drag the number down.
  const attendancePct = (u: { present: number; halfDay: number; leave: number; total: number }) => {
    const considered = u.total - u.leave
    if (considered <= 0) return 100
    return Math.round(((u.present + u.halfDay * 0.5) / considered) * 100)
  }

  const attendanceReport = Array.from(attByUser.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(u => ({
      Employee: u.name,
      Department: u.dept,
      'Days Tracked': u.total,
      Present: u.present,
      Absent: u.absent,
      Late: u.late,
      'Half Day': u.halfDay,
      Leave: u.leave,
      'Attendance %': `${attendancePct(u)}%`,
    }))
  const attSummary = Array.from(attByUser.values()).sort((a, b) => a.name.localeCompare(b.name))

  const payrollReport = (Array.isArray(payRecords) ? payRecords : []).map((r: any) => ({
    Employee: r.user?.name || r.userId,
    Department: r.user?.department?.name || '-',
    Month: `${MONTHS[r.month - 1]} ${r.year}`,
    Basic: r.baseSalary,
    HRA: r.hra,
    Allowances: r.allowances,
    GrossSalary: r.grossSalary,
    PF: r.pfEmployee,
    ESI: r.esiEmployee,
    TDS: r.tds,
    LateDeduction: r.lateDeduction,
    AbsentDeduction: r.absentDeduction ?? 0,
    TotalDeductions: deductionsOf(r),
    NetPay: r.netSalary,
    Status: r.status,
  }))

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return
    const headers = Object.keys(data[0])
    const csv = [headers.join(','), ...data.map(row => headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const employeeReport = (Array.isArray(users) ? users : []).map((u: any) => ({
    Name: u.name,
    Email: u.email,
    Department: typeof u.department === 'object' ? (u.department?.name || '-') : (u.department || '-'),
    Designation: typeof u.designation === 'object' ? (u.designation?.title || u.designation?.name || '-') : (u.designation || '-'),
    Role: u.roleName || '-',
    Status: u.isActive ? 'Active' : 'Inactive',
    JoinDate: u.joiningDate ? new Date(u.joiningDate).toLocaleDateString('en-IN') : '-',
  }))

  if (tabs.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: '0 0 16px' }}>HR Reports</h2>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 48, textAlign: 'center' }}>
          <Shield size={28} style={{ color: '#B1B1BE' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', margin: '12px 0 4px' }}>No access</p>
          <p style={{ fontSize: 12, color: '#B1B1BE', margin: 0 }}>You don't have permission to view any HR reports. Contact your administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>HR Reports</h2>
        {tab === 'employee' && (
          <button onClick={() => exportCSV(employeeReport, 'employee_report.csv')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t.key ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t.key ? '#5D78FF' : '#B1B1BE', display: 'flex', alignItems: 'center', gap: 6,
          }}><t.icon size={13} /> {t.label}</button>
        ))}
      </div>

      {tab === 'employee' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>Employee Directory — {employeeReport.length} employees</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead><tr style={{ background: '#F8F9FD' }}>
                {['Name', 'Email', 'Department', 'Designation', 'Role', 'Status', 'Join Date'].map(h =>
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {employeeReport.map((u, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{u.Name}</td>
                    <td style={{ padding: '10px 12px', color: '#5D78FF' }}>{u.Email}</td>
                    <td style={{ padding: '10px 12px', color: '#374557' }}>{u.Department}</td>
                    <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{u.Designation}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#E8EDFF', color: '#5D78FF' }}>{u.Role}</span></td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: u.Status === 'Active' ? '#E7FAF0' : '#FEE2E2', color: u.Status === 'Active' ? '#2BC155' : '#DC2626' }}>{u.Status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374557' }}>{u.JoinDate}</td>
                  </tr>
                ))}
                {employeeReport.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No employees</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374557', margin: 0, flex: 1 }}>Attendance Summary</p>
            <select value={attMonth} onChange={e => setAttMonth(+e.target.value)} style={{ border: '1px solid #E0E0E0', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={attYear} onChange={e => setAttYear(+e.target.value)} style={{ border: '1px solid #E0E0E0', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 72 }} />
            <button onClick={() => exportCSV(attendanceReport, `attendance_${attYear}_${attMonth}.csv`)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Download size={11} /> Export
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
              <thead><tr style={{ background: '#F8F9FD' }}>
                {['Employee', 'Department', 'Days Tracked', 'Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Attendance %'].map(h =>
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {attSummary.map((u, i) => {
                  const pct = attendancePct(u)
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #F0F1F5' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{u.name}</td>
                      <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{u.dept}</td>
                      <td style={{ padding: '10px 12px', color: '#374557' }}>{u.total}</td>
                      <td style={{ padding: '10px 12px', color: '#2BC155', fontWeight: 600 }}>{u.present}</td>
                      <td style={{ padding: '10px 12px', color: '#DC2626', fontWeight: 600 }}>{u.absent}</td>
                      <td style={{ padding: '10px 12px', color: '#F59E0B' }}>{u.late}</td>
                      <td style={{ padding: '10px 12px', color: '#6366F1' }}>{u.halfDay}</td>
                      <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{u.leave}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: pct >= 85 ? '#E7FAF0' : pct >= 70 ? '#FFF7E6' : '#FEE2E2', color: pct >= 85 ? '#2BC155' : pct >= 70 ? '#F59E0B' : '#DC2626' }}>{pct}%</span>
                      </td>
                    </tr>
                  )
                })}
                {attSummary.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No attendance records for {MONTHS[attMonth-1]} {attYear}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'leave' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {([['balances', 'Employee Balances'], ['types', 'Leave Types']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setLeaveView(k)} style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderRadius: 6, border: 'none',
                  background: leaveView === k ? '#E8EDFF' : 'transparent',
                  color: leaveView === k ? '#5D78FF' : '#B1B1BE',
                }}>{label}</button>
              ))}
            </div>
            {leaveView === 'balances' && (
              <>
                <select value={leaveDept} onChange={e => setLeaveDept(e.target.value)}
                  style={{ border: '1px solid #E0E0E0', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                  <option value="">All departments</option>
                  {leaveDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="number" value={leaveYear} onChange={e => setLeaveYear(+e.target.value)}
                  style={{ border: '1px solid #E0E0E0', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 72 }} />
                <button onClick={() => exportCSV(leaveReport, `leave_balances_${leaveYear}.csv`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  <Download size={11} /> Export
                </button>
              </>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            {leaveView === 'balances' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
                <thead><tr style={{ background: '#F8F9FD' }}>
                  {['Employee', 'Department', 'Leave Type', 'Entitled', 'Taken', 'Encashed', 'Remaining'].map(h =>
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredBalances.map((b, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F0F1F5' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{b.userName}</td>
                      <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{b.department ?? '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#374557' }}>{b.leaveTypeName}</td>
                      <td style={{ padding: '10px 12px', color: '#374557' }}>{b.entitled}</td>
                      <td style={{ padding: '10px 12px', color: '#F59E0B', fontWeight: 600 }}>{b.taken}</td>
                      <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{b.encashed || 0}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: b.remaining > 0 ? '#E7FAF0' : '#FEE2E2', color: b.remaining > 0 ? '#2BC155' : '#DC2626' }}>{b.remaining}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredBalances.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>
                      {balancesLoading ? 'Loading balances…'
                        : balancesForbidden ? "You don't have permission to view leave balances. Contact HR or an administrator."
                        : `No leave balances for ${leaveYear}. Initialise balances from the Leave page.`}
                    </td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: '#F8F9FD' }}>
                  {['Leave Type', 'Days/Year', 'Carry Forward', 'Encashable', 'Paid'].map(h =>
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(Array.isArray(leaveTypes) ? leaveTypes : []).map((lt: any, i: number) => (
                    <tr key={i} style={{ borderTop: '1px solid #F0F1F5' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{lt.name}</td>
                      <td style={{ padding: '10px 12px', color: '#374557' }}>{lt.annualQuota ?? lt.daysPerYear ?? '-'}</td>
                      <td style={{ padding: '10px 12px' }}>{lt.maxCarryForward > 0 ? <span style={{ color: '#2BC155', fontWeight: 600 }}>Yes</span> : <span style={{ color: '#DC2626' }}>No</span>}</td>
                      <td style={{ padding: '10px 12px' }}>{lt.isEncashable ? <span style={{ color: '#2BC155', fontWeight: 600 }}>Yes</span> : <span style={{ color: '#DC2626' }}>No</span>}</td>
                      <td style={{ padding: '10px 12px' }}>{lt.isPaidLeave !== false ? <span style={{ color: '#2BC155', fontWeight: 600 }}>Yes</span> : <span style={{ color: '#DC2626' }}>No</span>}</td>
                    </tr>
                  ))}
                  {leaveTypes.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No leave types configured</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'payroll' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374557', margin: 0, flex: 1 }}>Payroll Summary</p>
            <select value={payMonth} onChange={e => setPayMonth(+e.target.value)} style={{ border: '1px solid #E0E0E0', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={payYear} onChange={e => setPayYear(+e.target.value)} style={{ border: '1px solid #E0E0E0', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 72 }} />
            <button onClick={() => exportCSV(
              payrollReport.length
                ? [...payrollReport, {
                    ...Object.fromEntries(Object.keys(payrollReport[0]).map(k => [k, ''])),
                    Employee: 'TOTAL',
                    GrossSalary: payrollReport.reduce((s, r) => s + (r.GrossSalary || 0), 0),
                    TotalDeductions: payrollReport.reduce((s, r) => s + (r.TotalDeductions || 0), 0),
                    NetPay: payrollReport.reduce((s, r) => s + (r.NetPay || 0), 0),
                  }]
                : [],
              `payroll_${payYear}_${payMonth}.csv`
            )} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Download size={11} /> Export
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
              <thead><tr style={{ background: '#F8F9FD' }}>
                {['Employee', 'Dept', 'Gross Salary', 'PF', 'ESI', 'TDS', 'Total Deductions', 'Net Pay', 'Status'].map(h =>
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {(Array.isArray(payRecords) ? payRecords : []).map((r: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374557' }}>{r.user?.name || r.userId}</td>
                    <td style={{ padding: '10px 12px', color: '#B1B1BE' }}>{r.user?.department?.name || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#374557' }}>₹{(r.grossSalary || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px', color: '#374557' }}>₹{(r.pfEmployee || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px', color: '#374557' }}>₹{(r.esiEmployee || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px', color: '#374557' }}>₹{(r.tds || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px', color: '#DC2626' }}>₹{deductionsOf(r).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#2BC155' }}>₹{(r.netSalary || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: r.status === 'approved' ? '#E7FAF0' : '#FFF7E6', color: r.status === 'approved' ? '#2BC155' : '#F59E0B' }}>{r.status || 'draft'}</span>
                    </td>
                  </tr>
                ))}
                {(Array.isArray(payRecords) ? payRecords : []).length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#B1B1BE' }}>No payroll records for {MONTHS[payMonth-1]} {payYear}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Totals footer */}
          {(Array.isArray(payRecords) ? payRecords : []).length > 0 && (() => {
            const rows = Array.isArray(payRecords) ? payRecords : []
            const totalGross = rows.reduce((s: number, r: any) => s + (r.grossSalary || 0), 0)
            const totalNet = rows.reduce((s: number, r: any) => s + (r.netSalary || 0), 0)
            const totalDed = rows.reduce((s: number, r: any) => s + deductionsOf(r), 0)
            return (
              <div style={{ borderTop: '2px solid #F0F1F5', padding: '12px 16px', display: 'flex', gap: 32 }}>
                <span style={{ fontSize: 12 }}><span style={{ color: '#B1B1BE' }}>Total Gross: </span><span style={{ fontWeight: 700, color: '#374557' }}>₹{totalGross.toLocaleString('en-IN')}</span></span>
                <span style={{ fontSize: 12 }}><span style={{ color: '#B1B1BE' }}>Total Deductions: </span><span style={{ fontWeight: 700, color: '#DC2626' }}>₹{totalDed.toLocaleString('en-IN')}</span></span>
                <span style={{ fontSize: 12 }}><span style={{ color: '#B1B1BE' }}>Total Net Pay: </span><span style={{ fontWeight: 700, color: '#2BC155' }}>₹{totalNet.toLocaleString('en-IN')}</span></span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
