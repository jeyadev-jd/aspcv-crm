import { useState } from 'react'
import { useAuthStore } from '../lib/authStore'
import { useMySalary } from '../hooks/useSalary'
import { useMyAttendance } from '../hooks/useAttendance'
import { useUsers } from '../hooks/useUsers'
import { PDFDownloadLink } from '@react-pdf/renderer'
import SalarySlipPDF from '../components/pdf/SalarySlipPDF'
import { Download, Cake, Calendar, Building, CreditCard, Phone, Wallet } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}` }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#FEF3C7', color: '#92400E' },
  approved: { bg: '#DBEAFE', color: '#1D4ED8' },
  paid:     { bg: '#D1FAE5', color: '#065F46' },
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: '#8A8FA8' }}>{icon}{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374557', textAlign: 'right' }}>{value}</div>
    </div>
  )
}

export default function MyProfile() {
  const user = useAuthStore(s => s.user)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { data: salaryRecords = [] } = useMySalary()
  const { data: attendance = [] } = useMyAttendance(month, year)
  const { data: users = [] } = useUsers()

  if (!user) return null

  const myDetails = users.find(u => u.id === user.id || u.email === user.email)

  const presentCount = attendance.filter(r => ['present', 'late', 'half_day'].includes(r.status)).length
  const lateCount = attendance.filter(r => r.minutesLate > 0).length
  const absentCount = attendance.filter(r => r.status === 'absent').length

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' as const }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: '0 0 24px' }}>My Profile</h1>

      {/* Profile card */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#5D78FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1D23' }}>{user.name}</div>
          <div style={{ fontSize: 13, color: '#8A8FA8', marginTop: 2 }}>{user.email}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{user.role}</span>
            {user.designation && <span style={{ background: '#F3F4F6', color: '#374151', fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>{user.designation}</span>}
          </div>
        </div>
      </div>

      {/* Personal details */}
      {myDetails && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Personal Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DetailRow icon={<Cake size={13} />} label="Date of Birth" value={myDetails.dateOfBirth ? new Date(myDetails.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
              <DetailRow icon={<Calendar size={13} />} label="Joining Date" value={myDetails.joiningDate ? new Date(myDetails.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
              <DetailRow icon={<Building size={13} />} label="Department" value={myDetails.department?.name ?? '—'} />
              <DetailRow icon={<Phone size={13} />} label="Emergency Contact" value={myDetails.emergencyContact ?? '—'} />
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Salary & Bank</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DetailRow icon={<Wallet size={13} />} label="Base Salary" value={myDetails.baseSalary != null ? fmt(myDetails.baseSalary) : '—'} />
              <DetailRow icon={<Wallet size={13} />} label="HRA + Allowances" value={fmt((myDetails.hra ?? 0) + (myDetails.allowances ?? 0))} />
              <DetailRow icon={<CreditCard size={13} />} label="PAN" value={myDetails.pan ?? '—'} />
              <DetailRow icon={<CreditCard size={13} />} label="Bank" value={myDetails.bankName ? `${myDetails.bankName} ····${(myDetails.bankAccount ?? '').slice(-4)}` : '—'} />
              <DetailRow icon={<CreditCard size={13} />} label="PF / ESI" value={`${myDetails.pfApplicable ? 'PF ✓' : 'PF ✗'}  ·  ${myDetails.esiApplicable ? 'ESI ✓' : 'ESI ✗'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Attendance this month */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Attendance</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '5px 8px', fontSize: 12, background: '#fff' }}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '5px 8px', fontSize: 12, background: '#fff' }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Present', value: presentCount, color: '#2BC155' },
            { label: 'Absent', value: absentCount, color: '#EF4444' },
            { label: 'Late', value: lateCount, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{ background: '#F8F9FF', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8A8FA8' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Mini calendar dots */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {attendance.map(r => {
            const colors: Record<string, string> = { present: '#2BC155', late: '#F59E0B', absent: '#EF4444', half_day: '#3B82F6', leave: '#8B5CF6' }
            const d = new Date(r.date).getDate()
            return (
              <div key={r.id} title={`${d} — ${r.status}${r.minutesLate > 0 ? ` (+${r.minutesLate}m late)` : ''}`}
                style={{ width: 28, height: 28, borderRadius: 6, background: colors[r.status] ?? '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'default' }}>
                {d}
              </div>
            )
          })}
        </div>
      </div>

      {/* Salary slips */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Salary Slips</div>
        {salaryRecords.length === 0 ? (
          <div style={{ fontSize: 13, color: '#8A8FA8' }}>No salary records yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {salaryRecords.map(r => {
              const ss = STATUS_STYLE[r.status] ?? STATUS_STYLE.draft
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8F9FF', borderRadius: 10, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[r.month - 1]} {r.year}</div>
                    <div style={{ fontSize: 12, color: '#8A8FA8', marginTop: 2 }}>
                      Gross: {fmt(r.grossSalary)} | Net: <strong style={{ color: '#2BC155' }}>{fmt(r.netSalary)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{r.status}</span>
                    {r.status !== 'draft' && (
                      <PDFDownloadLink
                        document={<SalarySlipPDF record={r} employeeName={user.name} designation={user.designation} />}
                        fileName={`salary-${MONTHS[r.month - 1]}-${r.year}-${user.name.replace(/\s+/g, '_')}.pdf`}
                      >
                        {({ loading }) => (
                          <button style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
                            <Download size={12} />{loading ? 'Preparing...' : 'Download PDF'}
                          </button>
                        )}
                      </PDFDownloadLink>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
