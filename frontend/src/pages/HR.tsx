import { useState } from 'react'
import { useUsers, useCreateUser, useUpdateUser, useDeactivateUser, CRM_ROLES, type CrmUser } from '../hooks/useUsers'
import { useDepartments } from '../hooks/useDepartments'
import { useAuthStore } from '../lib/authStore'
import { X, Cake, Mail, Building, Plus, Edit2, Trash2, Phone, CreditCard, Calendar, Wallet, AlertTriangle } from 'lucide-react'
import EmptyState from '../components/shared/EmptyState'
import { CsvImportExport } from '../components/shared/CsvImportExport'
import type { CsvColDef } from '../components/shared/CsvImportExport'

const HR_CSV_COLS: CsvColDef<CrmUser>[] = [
  { header: 'Name',            accessor: r => r.name },
  { header: 'Email',           accessor: r => r.email },
  { header: 'Role',            accessor: r => r.role },
  { header: 'Department',      accessor: r => r.department?.name ?? '' },
  { header: 'DateOfBirth',     accessor: r => r.dateOfBirth ?? '' },
  { header: 'JoiningDate',     accessor: r => r.joiningDate ?? '' },
  { header: 'BaseSalary',      accessor: r => r.baseSalary != null ? String(r.baseSalary) : '' },
  { header: 'HRA',             accessor: r => r.hra != null ? String(r.hra) : '' },
  { header: 'Allowances',      accessor: r => r.allowances != null ? String(r.allowances) : '' },
  { header: 'PF',              accessor: r => r.pfApplicable ? 'true' : 'false' },
  { header: 'ESI',             accessor: r => r.esiApplicable ? 'true' : 'false' },
  { header: 'PAN',             accessor: r => r.pan ?? '' },
  { header: 'BankAccount',     accessor: r => r.bankAccount ?? '' },
  { header: 'IFSC',            accessor: r => r.ifsc ?? '' },
  { header: 'BankName',        accessor: r => r.bankName ?? '' },
  { header: 'EmergencyContact',accessor: r => r.emergencyContact ?? '' },
]
const HR_CSV_TEMPLATE = { Name: 'Raj Kumar', Email: 'raj@company.com', Role: 'Engineer', Department: 'Operations', DateOfBirth: '1995-06-15', JoiningDate: '2024-01-01', BaseSalary: '35000', HRA: '5000', Allowances: '2000', PF: 'true', ESI: 'true', PAN: 'ABCDE1234F', BankAccount: '1234567890', IFSC: 'SBIN0001234', BankName: 'SBI', EmergencyContact: '9876543210', Password: 'TempPass@123' }

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  SuperAdmin:    { bg: '#EDE9FE', color: '#7C3AED' },
  BusinessHead:  { bg: '#DBEAFE', color: '#1D4ED8' },
  ProjectHead:   { bg: '#D1FAE5', color: '#065F46' },
  SalesHead:     { bg: '#FEF3C7', color: '#92400E' },
  Manager:       { bg: '#FEE2E2', color: '#B91C1C' },
  SeniorEngineer:{ bg: '#E0F2FE', color: '#0369A1' },
  Engineer:      { bg: '#F0FDF4', color: '#166534' },
  Technician:    { bg: '#FFF7ED', color: '#C2410C' },
  Accountant:    { bg: '#FDF4FF', color: '#86198F' },
  HR:            { bg: '#ECFDF5', color: '#059669' },
  Viewer:        { bg: '#F3F4F6', color: '#374151' },
}

function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  const colors = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6']
  return colors[Math.abs(h) % colors.length]
}

function isBirthdayThisWeek(dob?: string | null): boolean {
  if (!dob) return false
  const today = new Date()
  const bday = new Date(dob)
  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
  const diff = (thisYear.getTime() - today.getTime()) / 86400000
  return diff >= 0 && diff <= 7
}

function isBirthdayThisMonth(dob?: string | null): boolean {
  if (!dob) return false
  return new Date(dob).getMonth() === new Date().getMonth()
}

function tenure(joiningDate?: string | null): string {
  if (!joiningDate) return '—'
  const ms = Date.now() - new Date(joiningDate).getTime()
  const years = Math.floor(ms / (365.25 * 86400000))
  const months = Math.floor((ms % (365.25 * 86400000)) / (30.44 * 86400000))
  if (years > 0) return `${years}y ${months}m`
  return `${months}m`
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const blankForm = () => ({
  name: '', email: '', password: '', role: 'Engineer', departmentId: '',
  dateOfBirth: '', joiningDate: '', baseSalary: '', hra: '', allowances: '',
  pfApplicable: true, esiApplicable: true, pan: '', bankAccount: '', ifsc: '', bankName: '',
  emergencyContact: '',
})

type FormState = ReturnType<typeof blankForm>

export default function HR() {
  const me = useAuthStore(s => s.user)
  const canManage = me && ['SuperAdmin', 'HR'].includes(me.role)

  const { data: users = [], isLoading, isError, refetch } = useUsers()
  const { data: departments = [] } = useDepartments()
  const createUser = useCreateUser()

  async function importEmployees(rows: Record<string, string>[]) {
    let success = 0; const errors: string[] = []
    for (const row of rows) {
      if (!row.Name || !row.Email) { errors.push(`"${row.Name || row.Email}": Name and Email required`); continue }
      const validRole = CRM_ROLES.includes(row.Role as never) ? row.Role : 'Engineer'
      const matchedDept = departments.find(d => d.name.toLowerCase() === (row.Department ?? '').toLowerCase())
      try {
        await createUser.mutateAsync({ name: row.Name, email: row.Email, password: row.Password || 'TempPass@123', role: validRole, departmentId: matchedDept?.id, dateOfBirth: row.DateOfBirth || undefined, joiningDate: row.JoiningDate || undefined, baseSalary: row.BaseSalary ? Number(row.BaseSalary) : undefined, hra: row.HRA ? Number(row.HRA) : undefined, allowances: row.Allowances ? Number(row.Allowances) : undefined, pfApplicable: row.PF !== 'false', esiApplicable: row.ESI !== 'false', pan: row.PAN || undefined, bankAccount: row.BankAccount || undefined, ifsc: row.IFSC || undefined, bankName: row.BankName || undefined, emergencyContact: row.EmergencyContact || undefined })
        success++
      } catch (e: unknown) { errors.push(`"${row.Name}": ${e instanceof Error ? e.message : 'Error'}`) }
    }
    return { total: rows.length, success, errors }
  }
  const updateUser = useUpdateUser()
  const deactivateUser = useDeactivateUser()

  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [detail, setDetail] = useState<CrmUser | null>(null)
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<FormState>(blankForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
    if (filterDept && u.department?.id !== filterDept) return false
    if (filterRole && u.role !== filterRole) return false
    return true
  })

  const birthdayThisWeek = users.filter(u => isBirthdayThisWeek(u.dateOfBirth))
  const totalMonthlySalary = users.reduce((a, u) => a + (u.baseSalary ?? 0) + (u.hra ?? 0) + (u.allowances ?? 0), 0)

  function openAdd() {
    setForm(blankForm()); setEditId(null); setModalMode('add'); setError('')
  }

  function openEdit(u: CrmUser) {
    setForm({
      name: u.name, email: u.email, password: '', role: u.role, departmentId: u.departmentId ?? u.department?.id ?? '',
      dateOfBirth: u.dateOfBirth ? u.dateOfBirth.slice(0, 10) : '',
      joiningDate: u.joiningDate ? u.joiningDate.slice(0, 10) : '',
      baseSalary: u.baseSalary != null ? String(u.baseSalary) : '',
      hra: u.hra != null ? String(u.hra) : '',
      allowances: u.allowances != null ? String(u.allowances) : '',
      pfApplicable: u.pfApplicable ?? true,
      esiApplicable: u.esiApplicable ?? true,
      pan: u.pan ?? '', bankAccount: u.bankAccount ?? '', ifsc: u.ifsc ?? '', bankName: u.bankName ?? '',
      emergencyContact: u.emergencyContact ?? '',
    })
    setEditId(u.id); setModalMode('edit'); setError('')
  }

  async function handleSave() {
    setError('')
    const payload = {
      name: form.name, email: form.email, role: form.role,
      departmentId: form.departmentId || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      joiningDate: form.joiningDate || undefined,
      baseSalary: form.baseSalary !== '' ? Number(form.baseSalary) : undefined,
      hra: form.hra !== '' ? Number(form.hra) : undefined,
      allowances: form.allowances !== '' ? Number(form.allowances) : undefined,
      pfApplicable: form.pfApplicable,
      esiApplicable: form.esiApplicable,
      pan: form.pan || undefined,
      bankAccount: form.bankAccount || undefined,
      ifsc: form.ifsc || undefined,
      bankName: form.bankName || undefined,
      emergencyContact: form.emergencyContact || undefined,
    }
    try {
      if (modalMode === 'add') {
        if (!form.password || form.password.length < 8) { setError('Password min 8 characters'); return }
        await createUser.mutateAsync({ ...payload, password: form.password })
      } else if (editId) {
        await updateUser.mutateAsync({ id: editId, ...payload, ...(form.password ? { password: form.password } : {}) })
        if (detail?.id === editId) setDetail(d => d ? { ...d, ...payload } as CrmUser : d)
      }
      setModalMode(null)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Save failed')
    }
  }

  if (isLoading) return <div style={{ padding: 32, fontSize: 13, color: '#8A8FA8' }}>Loading employees...</div>
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load employees" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
  )

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: 0 }}>Employees</h1>
          <p style={{ fontSize: 13, color: '#8A8FA8', marginTop: 4 }}>{users.length} team members</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CsvImportExport data={users} columns={HR_CSV_COLS} filename="employees.csv" templateRow={HR_CSV_TEMPLATE} onImport={importEmployees} />
          {canManage && (
            <button onClick={openAdd} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Plus size={14} />Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Birthday alert */}
      {birthdayThisWeek.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Cake size={18} color="#F59E0B" />
          <span style={{ fontSize: 13, color: '#92400E' }}>
            <strong>Birthday this week:</strong> {birthdayThisWeek.map(u => u.name).join(', ')} 🎉
          </span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Employees', value: users.length, color: '#5D78FF' },
          { label: 'Departments', value: departments.length, color: '#8B5CF6' },
          { label: 'Birthdays this month', value: users.filter(u => isBirthdayThisMonth(u.dateOfBirth)).length, color: '#F59E0B' },
          ...(canManage ? [{ label: 'Monthly Salary Bill', value: `₹${Math.round(totalMonthlySalary).toLocaleString('en-IN')}`, color: '#2BC155' }] : []),
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8A8FA8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', minWidth: 200 }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#fff' }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#fff' }}>
          <option value="">All Roles</option>
          {CRM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Employee grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {filtered.map(u => {
          const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.Viewer
          const isBday = isBirthdayThisWeek(u.dateOfBirth)
          return (
            <div key={u.id} onClick={() => setDetail(u)} style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: isBday ? '1.5px solid #FDE68A' : '1.5px solid transparent', position: 'relative', cursor: 'pointer' }}>
              {isBday && <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 18 }}>🎂</div>}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(u.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1D23' }}>{u.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: rc.bg, color: rc.color }}>{u.role}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {u.department && <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#6B7280' }}><Building size={12} />{u.department.name}</div>}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#6B7280' }}><Mail size={12} />{u.email}</div>
                {u.joiningDate && <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#6B7280' }}><Calendar size={12} />Tenure: {tenure(u.joiningDate)}</div>}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ fontSize: 13, color: '#8A8FA8', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>No employees match filters</div>}
      </div>

      {/* Detail panel */}
      {detail && (
        <>
          <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)', background: '#fff', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarColor(detail.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
                  {detail.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1D23' }}>{detail.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: (ROLE_COLORS[detail.role] ?? ROLE_COLORS.Viewer).bg, color: (ROLE_COLORS[detail.role] ?? ROLE_COLORS.Viewer).color }}>{detail.role}</span>
                </div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8FA8' }}><X size={18} /></button>
            </div>

            {/* Personal */}
            <Section title="Personal">
              <InfoRow icon={<Mail size={13} />} label="Email" value={detail.email} />
              <InfoRow icon={<Cake size={13} />} label="Date of Birth" value={fmtDate(detail.dateOfBirth)} />
              <InfoRow icon={<Phone size={13} />} label="Emergency Contact" value={detail.emergencyContact ?? '—'} />
            </Section>

            {/* Employment */}
            <Section title="Employment">
              <InfoRow icon={<Building size={13} />} label="Department" value={detail.department?.name ?? '—'} />
              <InfoRow icon={<Calendar size={13} />} label="Joining Date" value={fmtDate(detail.joiningDate)} />
              <InfoRow icon={<Calendar size={13} />} label="Tenure" value={tenure(detail.joiningDate)} />
            </Section>

            {/* Salary — HR/admin only */}
            {canManage && (
              <Section title="Salary & Statutory">
                <InfoRow icon={<Wallet size={13} />} label="Base Salary" value={detail.baseSalary != null ? `₹${detail.baseSalary.toLocaleString('en-IN')}` : '—'} />
                <InfoRow icon={<Wallet size={13} />} label="HRA" value={detail.hra != null ? `₹${detail.hra.toLocaleString('en-IN')}` : '—'} />
                <InfoRow icon={<Wallet size={13} />} label="Allowances" value={detail.allowances != null ? `₹${detail.allowances.toLocaleString('en-IN')}` : '—'} />
                <InfoRow icon={<CreditCard size={13} />} label="PF / ESI" value={`${detail.pfApplicable ? 'PF ✓' : 'PF ✗'}  ${detail.esiApplicable ? 'ESI ✓' : 'ESI ✗'}`} />
                <InfoRow icon={<CreditCard size={13} />} label="PAN" value={detail.pan ?? '—'} />
              </Section>
            )}

            {/* Bank — HR/admin only */}
            {canManage && (detail.bankAccount || detail.bankName) && (
              <Section title="Bank Details">
                <InfoRow icon={<CreditCard size={13} />} label="Bank" value={detail.bankName ?? '—'} />
                <InfoRow icon={<CreditCard size={13} />} label="Account" value={detail.bankAccount ?? '—'} />
                <InfoRow icon={<CreditCard size={13} />} label="IFSC" value={detail.ifsc ?? '—'} />
              </Section>
            )}

            {canManage && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
                <button onClick={() => openEdit(detail)} style={{ flex: 1, background: '#EEF2FF', color: '#5D78FF', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={12} />Edit
                </button>
                <button onClick={() => setDeleteConfirm(detail.id)} style={{ background: '#FFF5F5', color: '#FF5353', border: '1px solid #FFD5D5', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add/Edit modal */}
      {modalMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{modalMode === 'add' ? 'Add Employee' : 'Edit Employee'}</h2>
              <button onClick={() => setModalMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8FA8' }}><X size={18} /></button>
            </div>

            {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <GroupLabel>Account</GroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
              <Field label="Name *"><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={fInp} /></Field>
              <Field label="Email *"><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={fInp} /></Field>
              <Field label={modalMode === 'add' ? 'Password * (min 8)' : 'New Password (optional)'}>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} style={fInp} />
              </Field>
              <Field label="Role">
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ ...fInp, background: '#fff' }}>
                  {CRM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))} style={{ ...fInp, background: '#fff' }}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Emergency Contact"><input value={form.emergencyContact} onChange={e => setForm(p => ({ ...p, emergencyContact: e.target.value }))} placeholder="+91..." style={fInp} /></Field>
            </div>

            <GroupLabel>Dates</GroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
              <Field label="Date of Birth"><input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} style={fInp} /></Field>
              <Field label="Joining Date"><input type="date" value={form.joiningDate} onChange={e => setForm(p => ({ ...p, joiningDate: e.target.value }))} style={fInp} /></Field>
            </div>

            <GroupLabel>Salary</GroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
              <Field label="Base Salary ₹"><input type="number" value={form.baseSalary} onChange={e => setForm(p => ({ ...p, baseSalary: e.target.value }))} style={fInp} /></Field>
              <Field label="HRA ₹"><input type="number" value={form.hra} onChange={e => setForm(p => ({ ...p, hra: e.target.value }))} style={fInp} /></Field>
              <Field label="Allowances ₹"><input type="number" value={form.allowances} onChange={e => setForm(p => ({ ...p, allowances: e.target.value }))} style={fInp} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.pfApplicable} onChange={e => setForm(p => ({ ...p, pfApplicable: e.target.checked }))} />PF Applicable
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.esiApplicable} onChange={e => setForm(p => ({ ...p, esiApplicable: e.target.checked }))} />ESI Applicable
              </label>
            </div>

            <GroupLabel>Bank & Statutory</GroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
              <Field label="PAN"><input value={form.pan} onChange={e => setForm(p => ({ ...p, pan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" style={fInp} /></Field>
              <Field label="Bank Name"><input value={form.bankName} onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))} style={fInp} /></Field>
              <Field label="Account Number"><input value={form.bankAccount} onChange={e => setForm(p => ({ ...p, bankAccount: e.target.value }))} style={fInp} /></Field>
              <Field label="IFSC"><input value={form.ifsc} onChange={e => setForm(p => ({ ...p, ifsc: e.target.value.toUpperCase() }))} style={fInp} /></Field>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={createUser.isPending || updateUser.isPending || !form.name || !form.email}
                style={{ flex: 1, background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!form.name || !form.email) ? 0.5 : 1 }}>
                {createUser.isPending || updateUser.isPending ? 'Saving...' : modalMode === 'add' ? 'Add Employee' : 'Save Changes'}
              </button>
              <button onClick={() => setModalMode(null)} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 22, width: 'min(360px, 100%)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Deactivate Employee?</p>
            <p style={{ fontSize: 12, color: '#8A8FA8', marginBottom: 16 }}>Account will be disabled. Records stay intact.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { deactivateUser.mutate(deleteConfirm); setDeleteConfirm(null); setDetail(null) }} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const fInp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E8E9F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: '#8A8FA8' }}>{icon}{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374557', textAlign: 'right' }}>{value}</div>
    </div>
  )
}
