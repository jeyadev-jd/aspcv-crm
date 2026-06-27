import { useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, getDay,
  startOfWeek, endOfWeek, addWeeks, subWeeks, addDays,
} from 'date-fns'
import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts'

interface CalEvent {
  id: string
  title: string
  date: Date
  startTime: string
  endTime: string
  bg: string
  text: string
}

const COLOR_OPTIONS = [
  { bg: '#E8EDFF', text: '#5D78FF', label: 'Blue' },
  { bg: '#E7FAF0', text: '#2BC155', label: 'Green' },
  { bg: '#FFF5EE', text: '#FF9B52', label: 'Orange' },
  { bg: '#FFF3F3', text: '#FF5353', label: 'Red' },
  { bg: '#F4F5F9', text: '#8C8C8C', label: 'Grey' },
]

const initEvents: CalEvent[] = [
  { id: '1', title: 'Team Meeting',              date: new Date(2026, 4, 4),  startTime: '10:00', endTime: '11:00', bg: '#E8EDFF', text: '#5D78FF' },
  { id: '2', title: 'Design new pages',           date: new Date(2026, 4, 7),  startTime: '10:00', endTime: '11:00', bg: '#E7FAF0', text: '#2BC155' },
  { id: '3', title: 'Client presentation',        date: new Date(2026, 4, 11), startTime: '14:00', endTime: '15:30', bg: '#F4F5F9', text: '#8C8C8C' },
  { id: '4', title: 'Design new UI & check sales',date: new Date(2026, 4, 19), startTime: '9:00',  endTime: '13:00', bg: '#FFF5EE', text: '#FF9B52' },
  { id: '5', title: 'Visit course',               date: new Date(2026, 4, 21), startTime: '10:00', endTime: '11:00', bg: '#FFF3F3', text: '#FF5353' },
  { id: '6', title: 'Team standup',               date: new Date(2026, 4, 25), startTime: '09:30', endTime: '10:00', bg: '#E8EDFF', text: '#5D78FF' },
]

const barData = [3, 5, 4, 7, 6, 9, 8, 5, 7, 6, 8, 5].map((v, i) => ({ v, i }))
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8am - 8pm

const blankForm = { title: '', date: '', startTime: '09:00', endTime: '10:00', colorIdx: 0 }

export default function CalendarPage() {
  const isMobile = useIsMobile()
  const [current, setCurrent]   = useState(new Date(2026, 4, 1))
  const [view, setView]         = useState<'Month' | 'Week' | 'Day'>('Month')
  const [events, setEvents]     = useState(initEvents)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(blankForm)
  const [formErr, setFormErr]   = useState('')

  // navigation
  const prev = () => {
    if (view === 'Month') setCurrent(subMonths(current, 1))
    else if (view === 'Week') setCurrent(subWeeks(current, 1))
    else setCurrent(addDays(current, -1))
  }
  const next = () => {
    if (view === 'Month') setCurrent(addMonths(current, 1))
    else if (view === 'Week') setCurrent(addWeeks(current, 1))
    else setCurrent(addDays(current, 1))
  }
  const today = () => setCurrent(new Date(2026, 4, 21))

  const getEventsForDay = (day: Date) => events.filter(e => isSameDay(e.date, day))

  // Month view
  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startPad = (getDay(days[0]) + 6) % 7

  // Week view
  const weekStart = startOfWeek(current, { weekStartsOn: 1 })
  const weekDays  = eachDayOfInterval({ start: weekStart, end: endOfWeek(current, { weekStartsOn: 1 }) })

  const openModal = (defaultDate?: string) => {
    setForm({ ...blankForm, date: defaultDate ?? format(current, 'yyyy-MM-dd') })
    setFormErr('')
    setShowModal(true)
  }

  const submitModal = () => {
    if (!form.title.trim()) { setFormErr('Title is required'); return }
    if (!form.date) { setFormErr('Date is required'); return }
    const color = COLOR_OPTIONS[form.colorIdx]
    const [y, m, d] = form.date.split('-').map(Number)
    setEvents(prev => [...prev, {
      id: Date.now().toString(),
      title: form.title.trim(),
      date: new Date(y, m - 1, d),
      startTime: form.startTime,
      endTime: form.endTime,
      bg: color.bg,
      text: color.text,
    }])
    setShowModal(false)
    setForm(blankForm)
  }

  const headerLabel = view === 'Month'
    ? format(current, 'MMMM yyyy')
    : view === 'Week'
    ? `${format(weekStart, 'd MMM')} – ${format(endOfWeek(current, { weekStartsOn: 1 }), 'd MMM yyyy')}`
    : format(current, 'EEEE, d MMMM yyyy')

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start', height: '100%' }}>
      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Upcoming events</p>
            <button
              onClick={() => openModal()}
              style={{ width: 24, height: 24, borderRadius: 6, background: '#5D78FF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={13} style={{ color: '#fff' }} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Don't miss scheduled events</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[...events]
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .slice(0, 5)
              .map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 3, borderRadius: 2, background: e.text, flexShrink: 0, alignSelf: 'stretch', minHeight: 40 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, color: e.text, fontWeight: 600, marginBottom: 2 }}>{e.startTime}–{e.endTime}</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 1 }}>{format(e.date, 'd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Conversion history</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 12 }}>Week to week performance</p>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={barData} barSize={7} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="i" hide />
              <Bar dataKey="v" fill="#5D78FF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>₹28,45,700</p>
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Total sales</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>₹16,70,000</p>
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Spendings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar main */}
      <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5' }}>
        {/* Header */}
        <div className="crm-cal-header">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['Month', 'Week', 'Day'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: view === v ? '#5D78FF' : 'transparent',
                color: view === v ? '#fff' : '#B1B1BE',
              }}>{v}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374557', margin: 0 }}>{headerLabel}</h3>
            <button onClick={prev} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F4F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374557' }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={next} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F4F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374557' }}>
              <ChevronRight size={14} />
            </button>
            <button onClick={today} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: 'none', background: '#F4F5F9', color: '#374557', cursor: 'pointer' }}>Today</button>
            <button onClick={() => openModal()} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={12} /> Add Event
            </button>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* ── MONTH VIEW ── */}
          {view === 'Month' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
                {WEEKDAYS.map(d => (
                  <div key={d} style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', border: '1px solid #F0F1F5', borderRadius: 8, overflow: 'hidden' }}>
                {Array.from({ length: startPad }).map((_, i) => (
                  <div key={`p${i}`} style={{ minHeight: 80, borderRight: '1px solid #F0F1F5', borderBottom: '1px solid #F0F1F5', background: '#FAFAFA' }} />
                ))}
                {days.map((day, idx) => {
                  const dayEvents = getEventsForDay(day)
                  const isToday = isSameDay(day, new Date())
                  const col = (startPad + idx) % 7
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => openModal(format(day, 'yyyy-MM-dd'))}
                      className="crm-cal-month-cell"
                      style={{
                        borderRight: col < 6 ? '1px solid #F0F1F5' : 'none',
                        borderBottom: '1px solid #F0F1F5',
                        background: isSameMonth(day, current) ? '#fff' : '#FAFAFA',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FF')}
                      onMouseLeave={e => (e.currentTarget.style.background = isSameMonth(day, current) ? '#fff' : '#FAFAFA')}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, marginLeft: 'auto', marginBottom: 3,
                        background: isToday ? '#5D78FF' : 'transparent',
                        color: isToday ? '#fff' : '#374557',
                        fontWeight: isToday ? 700 : 400,
                      }}>{format(day, 'd')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayEvents.slice(0, 2).map(e => (
                          <div key={e.id} onClick={ev => ev.stopPropagation()} style={{ borderRadius: 3, padding: '2px 5px', background: e.bg }}>
                            <p style={{ fontSize: 9, fontWeight: 600, color: e.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</p>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <p style={{ fontSize: 9, color: '#B1B1BE', paddingLeft: 4 }}>+{dayEvents.length - 2} more</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── WEEK VIEW ── */}
          {view === 'Week' && (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', border: '1px solid #F0F1F5', borderRadius: 8, overflow: 'hidden', minWidth: 600 }}>
                {/* Header row */}
                <div style={{ background: '#F4F5F9', borderBottom: '1px solid #F0F1F5', borderRight: '1px solid #F0F1F5' }} />
                {weekDays.map(day => (
                  <div key={day.toISOString()} style={{
                    background: '#F4F5F9', borderBottom: '1px solid #F0F1F5', borderRight: '1px solid #F0F1F5',
                    padding: '8px 4px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 500 }}>{format(day, 'EEE')}</p>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', margin: '2px auto 0',
                      background: isSameDay(day, new Date()) ? '#5D78FF' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: isSameDay(day, new Date()) ? '#fff' : '#374557' }}>{format(day, 'd')}</p>
                    </div>
                  </div>
                ))}
                {/* Hour rows */}
                {HOURS.map(hour => (
                  <>
                    <div key={`h${hour}`} style={{ borderBottom: '1px solid #F0F1F5', borderRight: '1px solid #F0F1F5', padding: '6px 4px', background: '#fff' }}>
                      <p style={{ fontSize: 9, color: '#B1B1BE', textAlign: 'right' }}>{hour}:00</p>
                    </div>
                    {weekDays.map(day => {
                      const hourEvents = getEventsForDay(day).filter(e => parseInt(e.startTime) === hour)
                      return (
                        <div key={`${day.toISOString()}-${hour}`} style={{
                          borderBottom: '1px solid #F0F1F5', borderRight: '1px solid #F0F1F5',
                          minHeight: 44, padding: 3, background: '#fff', cursor: 'pointer',
                        }}
                          onClick={() => openModal(format(day, 'yyyy-MM-dd'))}
                        >
                          {hourEvents.map(e => (
                            <div key={e.id} onClick={ev => ev.stopPropagation()} style={{ borderRadius: 4, padding: '3px 6px', background: e.bg, marginBottom: 2 }}>
                              <p style={{ fontSize: 9, fontWeight: 600, color: e.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</p>
                              <p style={{ fontSize: 8, color: e.text, opacity: 0.8 }}>{e.startTime}–{e.endTime}</p>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </>
                ))}
              </div>
            </div>
          )}

          {/* ── DAY VIEW ── */}
          {view === 'Day' && (
            <div>
              <div style={{ border: '1px solid #F0F1F5', borderRadius: 8, overflow: 'hidden' }}>
                {HOURS.map((hour, idx) => {
                  const hourEvents = getEventsForDay(current).filter(e => parseInt(e.startTime) === hour)
                  return (
                    <div key={hour} style={{
                      display: 'flex', borderBottom: idx < HOURS.length - 1 ? '1px solid #F0F1F5' : 'none',
                      minHeight: 56, cursor: 'pointer',
                    }}
                      onClick={() => openModal(format(current, 'yyyy-MM-dd'))}
                    >
                      <div style={{ width: 60, flexShrink: 0, padding: '8px 12px', borderRight: '1px solid #F0F1F5', background: '#F4F5F9' }}>
                        <p style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 500 }}>{hour}:00</p>
                      </div>
                      <div style={{ flex: 1, padding: 6, background: '#fff', display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' }}>
                        {hourEvents.map(e => (
                          <div key={e.id} onClick={ev => ev.stopPropagation()} style={{ borderRadius: 6, padding: '4px 10px', background: e.bg }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: e.text }}>{e.title}</p>
                            <p style={{ fontSize: 10, color: e.text, opacity: 0.8 }}>{e.startTime}–{e.endTime}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {getEventsForDay(current).length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#B1B1BE', fontSize: 12 }}>
                  No events — click any slot or &quot;Add Event&quot; to create one
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {showModal && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="crm-modal" style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Event</p>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}>
                <X size={18} />
              </button>
            </div>

            <div className="crm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Event Title *</p>
                <input
                  autoFocus
                  value={form.title}
                  onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setFormErr('') }}
                  onKeyDown={e => e.key === 'Enter' && submitModal()}
                  placeholder="Enter event title..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${formErr ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
                {formErr && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 4 }}>{formErr}</p>}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Date *</p>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Start Time</p>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>End Time</p>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Color</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {COLOR_OPTIONS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setForm(f => ({ ...f, colorIdx: i }))}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', background: c.bg, border: `2px solid ${form.colorIdx === i ? c.text : 'transparent'}`,
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="crm-modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitModal} style={{ padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
