import { useState } from 'react'
import { useMyAttendance, useTodayAttendance, useAllAttendance, useCheckIn, useCheckOut, useAttendanceLocations, useCreateAttendanceLocation } from '../hooks/useAttendance'
import { useAuthStore } from '../lib/authStore'
import { MapPin, Clock, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  present:   { bg: '#D1FAE5', color: '#065F46', label: 'Present' },
  late:      { bg: '#FEF3C7', color: '#92400E', label: 'Late' },
  absent:    { bg: '#FEE2E2', color: '#B91C1C', label: 'Absent' },
  half_day:  { bg: '#DBEAFE', color: '#1D4ED8', label: 'Half Day' },
  leave:     { bg: '#EDE9FE', color: '#7C3AED', label: 'Leave' },
}

function fmtTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function workHours(checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return '—'
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export default function Attendance() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user && ['SuperAdmin', 'HR', 'BusinessHead'].includes(user.role)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [tab, setTab] = useState<'my' | 'all'>('my')
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [locationForm, setLocationForm] = useState({ name: '', lat: '', lng: '', radiusM: '100' })
  const [gpsError, setGpsError] = useState<string | null>(null)

  const { data: today } = useTodayAttendance()
  const { data: myRecords = [] } = useMyAttendance(month, year)
  const { data: allRecords = [] } = useAllAttendance(month, year)
  const { data: locations = [] } = useAttendanceLocations()

  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const createLocation = useCreateAttendanceLocation()

  function handleCheckIn() {
    setGpsError(null)
    if (!navigator.geolocation) { setGpsError('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => checkIn.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Still check in without GPS
        checkIn.mutate({ lat: 0, lng: 0 })
      }
    )
  }

  const records = tab === 'my' ? myRecords : allRecords

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: 0 }}>Attendance</h1>
      </div>

      {/* Today card */}
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
              {today.locationName && <span style={{ fontSize: 12, color: '#6B7280' }}><MapPin size={10} style={{ display: 'inline' }} /> {today.locationName.slice(0, 40)}...</span>}
              {today.minutesLate > 0 && <span style={{ fontSize: 12, color: '#D97706' }}>Late by {today.minutesLate}m</span>}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#8A8FA8', marginTop: 6 }}>Not checked in yet</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!today?.checkIn && (
            <button
              onClick={handleCheckIn}
              disabled={checkIn.isPending}
              style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}
            >
              <CheckCircle size={15} />
              {checkIn.isPending ? 'Checking in...' : 'Check In'}
            </button>
          )}
          {today?.checkIn && !today?.checkOut && (
            <button
              onClick={() => checkOut.mutate()}
              disabled={checkOut.isPending}
              style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {checkOut.isPending ? 'Checking out...' : 'Check Out'}
            </button>
          )}
          {today?.checkIn && today?.checkOut && (
            <div style={{ padding: '10px 16px', background: '#D1FAE5', borderRadius: 8, fontSize: 13, color: '#065F46', fontWeight: 600 }}>Done for today</div>
          )}
        </div>
        {gpsError && <div style={{ width: '100%', fontSize: 12, color: '#EF4444' }}>{gpsError}</div>}
        {checkIn.isError && <div style={{ width: '100%', fontSize: 12, color: '#EF4444' }}>{(checkIn.error as any)?.response?.data?.error ?? 'Check-in failed'}</div>}
      </div>

      {/* Monthly stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {(() => {
          const src = tab === 'my' ? myRecords : allRecords
          const present = src.filter(r => ['present', 'late', 'half_day'].includes(r.status)).length
          const late = src.filter(r => r.minutesLate > 0).length
          const absent = src.filter(r => r.status === 'absent').length
          const totalLateMin = src.reduce((a, r) => a + r.minutesLate, 0)
          return [
            { label: 'Present Days', value: present, color: '#2BC155' },
            { label: 'Late Arrivals', value: late, color: '#F59E0B' },
            { label: 'Absent', value: absent, color: '#EF4444' },
            { label: 'Total Late (mins)', value: totalLateMin, color: '#8B5CF6' },
          ].map(s => (
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
        <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {isAdmin && (
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
            {(['my', 'all'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#1A1D23' : '#6B7280', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {t === 'my' ? 'My Records' : 'All Staff'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Records table */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
              {tab === 'all' && <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>Employee</th>}
              <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>Date</th>
              <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>Status</th>
              <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>Check In</th>
              <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>Check Out</th>
              <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>Hours</th>
              <th style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>Location</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8', fontSize: 13 }}>No records for this period</td></tr>
            ) : records.map(r => {
              const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.present
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                  {tab === 'all' && <td style={{ padding: '10px 16px', fontSize: 13 }}>{r.user?.name ?? '—'}</td>}
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{fmtDate(r.date)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{s.label}</span>
                    {r.minutesLate > 0 && <span style={{ fontSize: 11, color: '#D97706', marginLeft: 6 }}>+{r.minutesLate}m</span>}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{fmtTime(r.checkIn)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{fmtTime(r.checkOut)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#5D78FF' }}>{workHours(r.checkIn, r.checkOut)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.locationName ? r.locationName.split(',').slice(0, 2).join(',') : r.lat ? `${r.lat.toFixed(4)}, ${r.lng?.toFixed(4)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Admin: locations */}
      {isAdmin && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Office / Site Locations</div>
            <button onClick={() => setShowAddLocation(v => !v)} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Plus size={13} /> Add Location
            </button>
          </div>
          {showAddLocation && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: 14, background: '#F8F9FF', borderRadius: 10 }}>
              {[
                { key: 'name', label: 'Name', placeholder: 'HQ / Site A' },
                { key: 'lat', label: 'Latitude', placeholder: '13.0827' },
                { key: 'lng', label: 'Longitude', placeholder: '80.2707' },
                { key: 'radiusM', label: 'Radius (m)', placeholder: '100' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 4 }}>{f.label}</div>
                  <input
                    value={(locationForm as any)[f.key]}
                    onChange={e => setLocationForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 140 }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  createLocation.mutate({ name: locationForm.name, lat: Number(locationForm.lat), lng: Number(locationForm.lng), radiusM: Number(locationForm.radiusM), isDefault: false })
                  setShowAddLocation(false)
                  setLocationForm({ name: '', lat: '', lng: '', radiusM: '100' })
                }}
                style={{ alignSelf: 'flex-end', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {locations.map(l => (
              <div key={l.id} style={{ background: '#F8F9FF', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#374151', display: 'flex', gap: 8, alignItems: 'center' }}>
                <MapPin size={12} color="#5D78FF" />
                <strong>{l.name}</strong>
                <span style={{ color: '#8A8FA8' }}>{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</span>
                <span style={{ color: '#8A8FA8' }}>±{l.radiusM}m</span>
              </div>
            ))}
            {locations.length === 0 && <div style={{ fontSize: 13, color: '#8A8FA8' }}>No locations configured yet</div>}
          </div>
        </div>
      )}
    </div>
  )
}
