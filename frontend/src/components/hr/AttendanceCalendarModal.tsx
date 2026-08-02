import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Clock, Plane, Zap, Coffee, Pencil } from 'lucide-react'
import { useAttendanceCalendar, useManualEditAttendance, type AttendanceRecord } from '@/hooks/useAttendance'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'

const EDIT_STATUSES = ['present', 'late', 'absent', 'half_day', 'leave']
// "2026-08-02T..." → "14:30" in local time, for prefilling the time inputs.
const toTimeInput = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_COLOR: Record<string, string> = {
  present: '#2BC155',
  late: '#F59E0B',
  absent: '#EF4444',
  half_day: '#3B82F6',
  leave: '#8B5CF6',
}

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

const hrs = (n: number) => `${Math.floor(n)}h ${Math.round((n % 1) * 60)}m`

/**
 * Month calendar for a single employee. Each day cell shows the status dot and
 * hours worked; selecting a day reveals that day's full punch trail.
 */
export default function AttendanceCalendarModal({
  userId,
  userName,
  onClose,
}: {
  userId: string
  userName: string
  onClose: () => void
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [selected, setSelected] = useState<AttendanceRecord | null>(null)

  const can = useAuthStore(s => s.can)
  const canEdit = can('attendance', 'edit')
  const manualEdit = useManualEditAttendance()
  // Open edit form for the selected day; holds the working draft.
  const [edit, setEdit] = useState<{ status: string; checkIn: string; checkOut: string; breakStart: string; breakEnd: string; travelHours: string } | null>(null)

  const { data, isLoading } = useAttendanceCalendar(userId, month, year)

  const records = data?.records ?? []
  const holidays = data?.holidays ?? []

  const byDay = new Map<number, AttendanceRecord>()
  records.forEach(r => byDay.set(new Date(r.date).getUTCDate(), r))

  const holidayByDay = new Map<number, string>()
  holidays.forEach(h => holidayByDay.set(new Date(h.date).getUTCDate(), h.name))

  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingBlanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1))
    setMonth(next.getUTCMonth() + 1)
    setYear(next.getUTCFullYear())
    setSelected(null)
  }

  return (
    <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F0F1F5' }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', margin: 0 }}>{userName}</p>
            <p style={{ fontSize: 11, color: '#8A8B9F', margin: '2px 0 0' }}>Attendance calendar</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => shiftMonth(-1)} style={{ background: 'none', border: '1px solid #F0F1F5', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#374557', display: 'flex' }}>
              <ChevronLeft size={14} />
            </button>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374557', margin: 0 }}>
              {new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <button onClick={() => shiftMonth(1)} style={{ background: 'none', border: '1px solid #F0F1F5', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#374557', display: 'flex' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Month totals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {[
              { label: 'Present', value: String(data?.summary.present ?? 0), color: '#2BC155', icon: Clock },
              { label: 'Working', value: hrs(data?.summary.workingHours ?? 0), color: '#5D78FF', icon: Clock },
              { label: 'Travel', value: hrs(data?.summary.travelHours ?? 0), color: '#8B5CF6', icon: Plane },
              { label: 'Overtime', value: hrs(data?.summary.overtimeHours ?? 0), color: '#F59E0B', icon: Zap },
              { label: 'Break', value: hrs(data?.summary.breakHours ?? 0), color: '#EA580C', icon: Coffee },
            ].map(s => (
              <div key={s.label} style={{ background: '#F8F9FD', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, color: '#8A8B9F', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <s.icon size={11} /> {s.label}
                </p>
                <p style={{ fontSize: 15, fontWeight: 700, color: s.color, margin: '2px 0 0' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {isLoading ? (
            <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 20 }}>Loading calendar…</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {DAY_LABELS.map(d => (
                <p key={d} style={{ fontSize: 10, fontWeight: 700, color: '#B1B1BE', textAlign: 'center', margin: 0 }}>{d}</p>
              ))}
              {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const rec = byDay.get(day)
                const holidayName = holidayByDay.get(day)
                const isSelected = selected && new Date(selected.date).getUTCDate() === day
                // Empty day → HR can still open it (to mark present / set details).
                // A synthetic 'absent' record backs the panel; saving upserts it.
                const openable = rec || canEdit
                const onOpen = () => {
                  setEdit(null)
                  if (rec) { setSelected(rec); return }
                  if (!canEdit) { setSelected(null); return }
                  setSelected({
                    id: '', userId, date: new Date(Date.UTC(year, month - 1, day)).toISOString(),
                    status: 'absent', checkIn: null, checkOut: null, breakMinutes: 0,
                    minutesLate: 0, isHoliday: false, totalWorkingHours: 0, totalTravelHours: 0,
                    overtimeHours: 0, logs: [],
                  } as unknown as AttendanceRecord)
                }
                return (
                  <button
                    key={day}
                    onClick={onOpen}
                    title={holidayName}
                    style={{
                      minHeight: 56, borderRadius: 8, cursor: openable ? 'pointer' : 'default',
                      border: `1px solid ${isSelected ? '#5D78FF' : '#F0F1F5'}`,
                      background: holidayName ? '#FFF7ED' : '#fff',
                      padding: 4, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{day}</span>
                    {rec ? (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[rec.status] ?? '#B1B1BE' }} />
                        <span style={{ fontSize: 9, color: '#8A8B9F' }}>{hrs(rec.totalWorkingHours)}</span>
                      </>
                    ) : canEdit && (
                      <span style={{ fontSize: 9, color: '#C4C4CF' }}>+ mark</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Selected day punch trail */}
          {selected && (
            <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', margin: 0 }}>
                  {new Date(selected.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}
                  {selected.isHoliday && <span style={{ fontSize: 10, color: '#EA580C', marginLeft: 8 }}>Worked on a holiday</span>}
                  {selected.isOvertime && <span style={{ fontSize: 10, color: '#F59E0B', marginLeft: 8 }}>Overtime {hrs(selected.overtimeHours)}</span>}
                </p>
                {canEdit && !edit && (
                  <button onClick={() => setEdit({
                    status: selected.status, checkIn: toTimeInput(selected.checkIn), checkOut: toTimeInput(selected.checkOut),
                    breakStart: toTimeInput(selected.breakStart), breakEnd: toTimeInput(selected.breakEnd),
                    travelHours: selected.totalTravelHours ? String(selected.totalTravelHours) : '',
                  })}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#5D78FF', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    <Pencil size={11} /> Edit
                  </button>
                )}
              </div>

              {/* HR inline edit — status + punch times, applied directly. */}
              {edit && (
                <div style={{ background: '#F8F9FF', border: '1px solid #E8EDFF', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8B9F', marginBottom: 3 }}>Status</div>
                      <select value={edit.status} onChange={e => setEdit(v => v && { ...v, status: e.target.value })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: 7, border: '1px solid #E0E0E0', fontSize: 12, background: '#fff' }}>
                        {EDIT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8B9F', marginBottom: 3 }}>Check In</div>
                      <input type="time" value={edit.checkIn} onChange={e => setEdit(v => v && { ...v, checkIn: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #E0E0E0', fontSize: 12 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8B9F', marginBottom: 3 }}>Check Out</div>
                      <input type="time" value={edit.checkOut} onChange={e => setEdit(v => v && { ...v, checkOut: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #E0E0E0', fontSize: 12 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8B9F', marginBottom: 3 }}>Break Start</div>
                      <input type="time" value={edit.breakStart} onChange={e => setEdit(v => v && { ...v, breakStart: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #E0E0E0', fontSize: 12 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8B9F', marginBottom: 3 }}>Break End</div>
                      <input type="time" value={edit.breakEnd} onChange={e => setEdit(v => v && { ...v, breakEnd: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #E0E0E0', fontSize: 12 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8B9F', marginBottom: 3 }}>Travel Hours</div>
                      <input type="number" min="0" step="0.25" value={edit.travelHours} onChange={e => setEdit(v => v && { ...v, travelHours: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #E0E0E0', fontSize: 12 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={manualEdit.isPending}
                      onClick={async () => {
                        const ymd = new Date(selected.date).toISOString().slice(0, 10)
                        const iso = (t: string) => t ? new Date(`${ymd}T${t}:00`).toISOString() : null
                        try {
                          await manualEdit.mutateAsync({
                            userId, date: ymd, status: edit.status,
                            checkIn: iso(edit.checkIn), checkOut: iso(edit.checkOut),
                            breakStart: iso(edit.breakStart), breakEnd: iso(edit.breakEnd),
                            totalTravelHours: edit.travelHours !== '' ? Number(edit.travelHours) : undefined,
                          })
                          toast.success('Attendance updated')
                          setEdit(null); setSelected(null)
                        } catch (e: any) {
                          toast.error(e?.response?.data?.error ?? 'Failed to update attendance')
                        }
                      }}
                      style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: manualEdit.isPending ? 0.6 : 1 }}>
                      {manualEdit.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEdit(null)} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Working', value: hrs(selected.totalWorkingHours), color: '#5D78FF', icon: Clock },
                  { label: 'Travel', value: hrs(selected.totalTravelHours), color: '#8B5CF6', icon: Plane },
                  { label: 'Overtime', value: hrs(selected.overtimeHours), color: '#F59E0B', icon: Zap },
                  { label: 'Break', value: `${Math.floor(selected.breakMinutes / 60)}h ${selected.breakMinutes % 60}m`, color: '#EA580C', icon: Coffee },
                ].map(s => (
                  <div key={s.label} style={{ background: '#F8F9FD', borderRadius: 8, padding: '7px 10px' }}>
                    <p style={{ fontSize: 10, color: '#8A8B9F', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <s.icon size={10} /> {s.label}
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: s.color, margin: '2px 0 0' }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(selected.logs ?? []).map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: 10, fontSize: 12, color: '#374557' }}>
                    <span style={{ fontWeight: 600, minWidth: 80 }}>{log.action}</span>
                    <span>{fmtTime(log.timestamp)}</span>
                    {log.locationName && (
                      <span style={{ color: '#8A8B9F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.locationName.split(',').slice(0, 2).join(',')}
                      </span>
                    )}
                  </div>
                ))}
                {(selected.logs ?? []).length === 0 && (
                  <p style={{ fontSize: 12, color: '#B1B1BE', margin: 0 }}>
                    No punch trail for this day (In {fmtTime(selected.checkIn)} · Out {fmtTime(selected.checkOut)})
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
