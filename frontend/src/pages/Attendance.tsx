import { useState } from 'react'
import {
  useMyAttendance, useTodayAttendance, useAllAttendance, usePunch,
  type PunchAction, type AttendanceRecord,
} from '../hooks/useAttendance'
import { useAuthStore } from '../lib/authStore'
import AttendanceCalendarModal from '@/components/hr/AttendanceCalendarModal'
import Pagination from '@/components/shared/Pagination'
import { MapPin, AlertCircle, LogIn, LogOut, Coffee, CupSoda, Plane, PlaneLanding } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  present:   { bg: '#D1FAE5', color: '#065F46', label: 'Present' },
  late:      { bg: '#FEF3C7', color: '#92400E', label: 'Late' },
  absent:    { bg: '#FEE2E2', color: '#B91C1C', label: 'Absent' },
  half_day:  { bg: '#DBEAFE', color: '#1D4ED8', label: 'Half Day' },
  leave:     { bg: '#EDE9FE', color: '#7C3AED', label: 'Leave' },
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const hrs = (n: number) => `${Math.floor(n)}h ${Math.round((n % 1) * 60)}m`

// Which punches make sense right now, derived from the day's log trail. Mirrors
// the server's validatePunch() so buttons never offer an action that will 400.
function availableActions(today: AttendanceRecord | null | undefined): PunchAction[] {
  const logs = today?.logs ?? []
  const count = (a: PunchAction) => logs.filter(l => l.action === a).length
  const checkedIn = count('CheckIn') > count('CheckOut')
  const onBreak = count('BreakIn') > count('BreakOut')
  const travelling = count('TravelIn') > count('TravelOut')

  if (!checkedIn) {
    // Already closed the day — don't offer Check In again, which would silently
    // reopen it. The card shows "Done for today" instead.
    return count('CheckOut') > 0 ? [] : ['CheckIn']
  }

  // While on a break or travelling the only sensible next punch is the one that
  // closes that interval, so we don't offer Check Out (the server rejects it).
  if (onBreak) return ['BreakOut']
  if (travelling) return ['TravelOut']
  return ['BreakIn', 'TravelIn', 'CheckOut']
}

const ACTION_UI: Record<PunchAction, { label: string; bg: string; icon: typeof LogIn }> = {
  CheckIn:   { label: 'Check In',   bg: '#5D78FF', icon: LogIn },
  CheckOut:  { label: 'Check Out',  bg: '#EF4444', icon: LogOut },
  BreakIn:   { label: 'Break In',   bg: '#F59E0B', icon: Coffee },
  BreakOut:  { label: 'Break Out',  bg: '#8B5CF6', icon: CupSoda },
  TravelIn:  { label: 'Travel In',  bg: '#0EA5E9', icon: Plane },
  TravelOut: { label: 'Travel Out', bg: '#0F766E', icon: PlaneLanding },
}

export default function Attendance() {
  const user = useAuthStore(s => s.user)
  const can = useAuthStore(s => s.can)
  const isAdmin = can('attendance', 'read_all') || (user && ['SuperAdmin', 'HR', 'BusinessHead'].includes(user.role))

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [tab, setTab] = useState<'my' | 'all'>('my')
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [calendarFor, setCalendarFor] = useState<{ id: string; name: string } | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  const { data: today } = useTodayAttendance()
  const { data: myRecords = [] } = useMyAttendance(month, year)
  const { data: allRecords = [] } = useAllAttendance(month, year)

  const punch = usePunch()

  // Geolocation is best-effort: a punch still records without it, except CheckIn
  // where the server may enforce a geofence.
  function doPunch(action: PunchAction) {
    setGpsError(null)
    if (!navigator.geolocation) {
      if (action === 'CheckIn') { setGpsError('Geolocation not supported — cannot record location'); return }
      punch.mutate({ action })
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => punch.mutate({ action, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        if (action === 'CheckIn') setGpsError('Location permission denied — enable GPS to check in')
        else punch.mutate({ action })
      }
    )
  }

  const records = tab === 'my' ? myRecords : allRecords
  const actions = availableActions(today)

  // "All Staff" is one row per employee for the selected month, so the dashboard
  // reads as a directory rather than a flat log.
  const byEmployee = new Map<string, { user: AttendanceRecord['user']; rows: AttendanceRecord[] }>()
  allRecords.forEach(r => {
    const key = r.userId
    if (!byEmployee.has(key)) byEmployee.set(key, { user: r.user, rows: [] })
    byEmployee.get(key)!.rows.push(r)
  })

  const th: React.CSSProperties = {
    padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8',
    textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left',
  }

  const todayPresent = allRecords.filter(r =>
    new Date(r.date).toDateString() === new Date().toDateString() && ['present', 'late'].includes(r.status)
  ).length
  const todayLeave = allRecords.filter(r =>
    new Date(r.date).toDateString() === new Date().toDateString() && r.status === 'leave'
  ).length
  const todayAbsent = allRecords.filter(r =>
    new Date(r.date).toDateString() === new Date().toDateString() && r.status === 'absent'
  ).length

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: 0 }}>Attendance</h1>
      </div>

      {/* Today card + punch buttons */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 24, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13, color: '#8A8FA8', marginBottom: 4 }}>Today</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1D23' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
          {today ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>In: <strong>{fmtTime(today.checkIn)}</strong></span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Out: <strong>{fmtTime(today.checkOut)}</strong></span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Worked: <strong>{hrs(today.totalWorkingHours ?? 0)}</strong></span>
              {today.totalTravelHours > 0 && <span style={{ fontSize: 12, color: '#6B7280' }}>Travel: <strong>{hrs(today.totalTravelHours)}</strong></span>}
              {today.overtimeHours > 0 && <span style={{ fontSize: 12, color: '#F59E0B' }}>Overtime: <strong>{hrs(today.overtimeHours)}</strong></span>}
              {today.breakMinutes > 0 && <span style={{ fontSize: 12, color: '#6B7280' }}>Break: <strong>{today.breakMinutes}m</strong></span>}
              {today.isHoliday && <span style={{ fontSize: 12, color: '#EA580C' }}>Holiday — comp-off credited</span>}
              {today.locationName && <span style={{ fontSize: 12, color: '#6B7280' }}><MapPin size={10} style={{ display: 'inline' }} /> {today.locationName.slice(0, 40)}…</span>}
              {today.minutesLate > 0 && <span style={{ fontSize: 12, color: '#D97706' }}>Late by {today.minutesLate}m</span>}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#8A8FA8', marginTop: 6 }}>Not checked in yet</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {actions.map(action => {
            const ui = ACTION_UI[action]
            return (
              <button
                key={action}
                onClick={() => doPunch(action)}
                disabled={punch.isPending}
                style={{ background: ui.bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <ui.icon size={15} />
                {punch.isPending ? 'Working…' : ui.label}
              </button>
            )
          })}
          {actions.length === 0 && (
            <div style={{ padding: '10px 16px', background: '#D1FAE5', borderRadius: 8, fontSize: 13, color: '#065F46', fontWeight: 600 }}>Done for today</div>
          )}
        </div>

        {gpsError && <div style={{ width: '100%', fontSize: 12, color: '#EF4444' }}>{gpsError}</div>}
        {punch.isError && <div style={{ width: '100%', fontSize: 12, color: '#EF4444' }}>{(punch.error as any)?.response?.data?.error ?? 'Punch failed'}</div>}
      </div>

      {/* Summary widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {(() => {
          const src = tab === 'my' ? myRecords : allRecords
          const stats = tab === 'all'
            ? [
                { label: 'Present Today', value: todayPresent, color: '#2BC155' },
                { label: 'On Leave Today', value: todayLeave, color: '#8B5CF6' },
                { label: 'Absent Today', value: todayAbsent, color: '#EF4444' },
                { label: 'Employees', value: byEmployee.size, color: '#5D78FF' },
              ]
            : [
                { label: 'Present Days', value: src.filter(r => ['present', 'late', 'half_day'].includes(r.status)).length, color: '#2BC155' },
                { label: 'Late Arrivals', value: src.filter(r => r.minutesLate > 0).length, color: '#F59E0B' },
                { label: 'Overtime (hrs)', value: Math.round(src.reduce((a, r) => a + (r.overtimeHours ?? 0), 0)), color: '#EA580C' },
                { label: 'Travel (hrs)', value: Math.round(src.reduce((a, r) => a + (r.totalTravelHours ?? 0), 0)), color: '#8B5CF6' },
              ]
          return stats.map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8A8FA8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))
        })()}
      </div>

      {/* Late policy notice */}
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#9A3412', display: 'flex', gap: 8, alignItems: 'center' }}>
        <AlertCircle size={14} />
        Late policy: 2 late days in a month → half-day salary cut · 3+ late days → full-day salary cut
      </div>

      {/* Month selector + tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={month} onChange={e => { setMonth(Number(e.target.value)); setPage(1) }} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
          ))}
        </select>
        <select value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1) }} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {isAdmin && (
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
            {(['my', 'all'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1) }} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#1A1D23' : '#6B7280', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {t === 'my' ? 'My Records' : 'All Staff'}
              </button>
            ))}
          </div>
        )}
        {tab === 'my' && user && (
          <button onClick={() => setCalendarFor({ id: user.id, name: user.name })}
            style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, background: '#fff', color: '#374557', cursor: 'pointer' }}>
            View my calendar
          </button>
        )}
      </div>

      {/* All Staff: one row per employee, click to open their calendar */}
      {tab === 'all' && isAdmin ? (() => {
        const allEmployees = [...byEmployee.entries()]
        const totalPages = Math.max(1, Math.ceil(allEmployees.length / PAGE_SIZE))
        const pageEmployees = allEmployees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        return (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
                {['Employee', 'Role', 'Present Days', 'Late', 'Worked', 'Overtime', 'Travel'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageEmployees.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8', fontSize: 13 }}>No records for this period</td></tr>
              ) : pageEmployees.map(([userId, entry]) => {
                const present = entry.rows.filter(r => ['present', 'late', 'half_day'].includes(r.status)).length
                const late = entry.rows.filter(r => r.minutesLate > 0).length
                const worked = entry.rows.reduce((a, r) => a + (r.totalWorkingHours ?? 0), 0)
                const overtime = entry.rows.reduce((a, r) => a + (r.overtimeHours ?? 0), 0)
                const travel = entry.rows.reduce((a, r) => a + (r.totalTravelHours ?? 0), 0)
                return (
                  <tr key={userId} style={{ borderBottom: '1px solid #F8F9FF' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>
                      <button onClick={() => setCalendarFor({ id: userId, name: entry.user?.name ?? 'Employee' })}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: '#5D78FF', cursor: 'pointer' }}>
                        {entry.user?.name ?? '—'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#6B7280' }}>{entry.user?.role ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{present}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: late > 0 ? '#D97706' : '#6B7280' }}>{late}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#5D78FF' }}>{hrs(worked)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: overtime > 0 ? '#EA580C' : '#6B7280' }}>{hrs(overtime)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#8B5CF6' }}>{hrs(travel)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
        )
      })() : (() => {
        const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
        const pageRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        return (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
                {['Date', 'Status', 'Check In', 'Check Out', 'Break', 'Worked', 'Overtime', 'Travel', 'Location'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRecords.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8', fontSize: 13 }}>No records for this period</td></tr>
              ) : pageRecords.map(r => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.present
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{fmtDate(r.date)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{s.label}</span>
                      {r.minutesLate > 0 && <span style={{ fontSize: 11, color: '#D97706', marginLeft: 6 }}>+{r.minutesLate}m</span>}
                      {r.isHoliday && <span style={{ fontSize: 11, color: '#EA580C', marginLeft: 6 }}>Holiday</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{fmtTime(r.checkIn)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{fmtTime(r.checkOut)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{r.breakMinutes > 0 ? `${r.breakMinutes}m` : '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#5D78FF' }}>{hrs(r.totalWorkingHours ?? 0)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: (r.overtimeHours ?? 0) > 0 ? '#EA580C' : '#6B7280' }}>{hrs(r.overtimeHours ?? 0)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#8B5CF6' }}>{hrs(r.totalTravelHours ?? 0)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.locationName ? r.locationName.split(',').slice(0, 2).join(',') : r.lat ? `${r.lat.toFixed(4)}, ${r.lng?.toFixed(4)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
        )
      })()}

      {calendarFor && (
        <AttendanceCalendarModal
          userId={calendarFor.id}
          userName={calendarFor.name}
          onClose={() => setCalendarFor(null)}
        />
      )}
    </div>
  )
}
