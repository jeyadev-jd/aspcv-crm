import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { MoreHorizontal, TrendingUp, TrendingDown, UserPlus, LifeBuoy, CheckCircle2, FolderOpen, CreditCard, ArrowLeftRight, Clock, Zap, Bell, CalendarDays, Inbox } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type React from 'react'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'
import { useAuthStore } from '@/lib/authStore'
import { useNotifications } from '@/hooks/useNotifications'

const INR_RATE = 83.5

const statusStyle: Record<string, { bg: string; color: string }> = {
  OrderWon:    { bg: '#E7FAF0', color: '#2BC155' },
  OrderLost:   { bg: '#FFEEEE', color: '#FF5353' },
  Negotiation: { bg: '#FFF5EE', color: '#FF9B52' },
  Proposal:    { bg: '#E8EDFF', color: '#5D78FF' },
  LeadIn:      { bg: '#F4F5F9', color: '#8C8C8C' },
}

// Last 6 calendar months, oldest first — used to bucket real deal/project rows by month.
function lastSixMonths(): { key: string; label: string }[] {
  const out = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }) })
  }
  return out
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr${hr > 1 ? 's' : ''} ago`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5',
}

function MiniSpark({ color, data }: { color: string; data: { v: number }[] }) {
  const id = `spark${color.replace('#', '')}`
  if (data.every(d => d.v === 0)) return <p style={{ fontSize: 9, color: '#D5D5D5', textAlign: 'center', padding: '10px 0' }}>No history yet</p>
  return (
    <ResponsiveContainer width="100%" height={38}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#${id})`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function fmtInr(inr: number, symbol: string, currency: string): string {
  const v = currency === 'USD' ? inr / INR_RATE : inr
  if (currency === 'INR') {
    if (v >= 10000000) return `${symbol}${(v / 10000000).toFixed(1)}Cr`
    if (v >= 100000)   return `${symbol}${(v / 100000).toFixed(1)}L`
    if (v >= 1000)     return `${symbol}${(v / 1000).toFixed(0)}k`
  } else {
    if (v >= 1000000) return `${symbol}${(v / 1000000).toFixed(2)}M`
    if (v >= 1000)    return `${symbol}${(v / 1000).toFixed(1)}k`
  }
  return `${symbol}${Math.round(v).toLocaleString()}`
}

function ISTClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))
  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDate(new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))
    }, 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d5a8e)', borderRadius: 12, padding: '14px 16px', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Clock size={11} style={{ color: 'rgba(255,255,255,0.6)' }} />
        <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 }}>IST — INDIA</p>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, fontVariantNumeric: 'tabular-nums' }}>{time}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{date}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { currency, setCurrency, symbol } = useCurrency()
  const isMobile = useIsMobile()
  const authUser = useAuthStore(s => s.user)
  const fmt = (v: number) => fmtInr(v, symbol, currency)
  const userInitials = authUser?.name ? authUser.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() : 'U'

  const { data: deals = [] }    = useQuery<any[]>({ queryKey: ['deals'],    queryFn: () => import('@/lib/api').then(m => m.api.get('/deals', { params: { pageSize: 1000 } }).then(r => r.data.data)) })
  const { data: leads = [] }    = useQuery<any[]>({ queryKey: ['leads'],    queryFn: () => import('@/lib/api').then(m => m.api.get('/leads', { params: { pageSize: 1000 } }).then(r => r.data.data)) })
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ['projects'], queryFn: () => import('@/lib/api').then(m => m.api.get('/projects', { params: { pageSize: 1000 } }).then(r => r.data.data)) })
  const { data: tickets = [] }  = useQuery<any[]>({ queryKey: ['support'],  queryFn: () => import('@/lib/api').then(m => m.api.get('/support', { params: { pageSize: 1000 } }).then(r => r.data.data)) })
  const { data: calendarEvents = [] } = useQuery<any[]>({ queryKey: ['calendar'], queryFn: () => import('@/lib/api').then(m => m.api.get('/calendar').then(r => r.data)) })
  const { data: notifData } = useNotifications()

  const can = useAuthStore(s => s.can)
  const isHR = can('hr_user', 'read_all')
  const isYearEnd = new Date().getMonth() >= 10 // Nov = 10, Dec = 11
  const nextYear = new Date().getFullYear() + 1
  const { data: nextYearHolidays } = useQuery<any[]>({
    queryKey: ['holidays-settings', nextYear],
    queryFn: () => import('@/lib/api').then(m => m.api.get(`/leave/holidays?year=${nextYear}`).then(r => r.data)),
    enabled: isHR && isYearEnd
  })
  const showHolidayAlert = isHR && isYearEnd && nextYearHolidays && nextYearHolidays.length === 0

  const activeDeals    = deals.filter((d: any) => !['OrderLost', 'OrderWon'].includes(d.stage))
  const pipelineInr    = activeDeals.reduce((s: number, d: any) => s + (d.value ?? 0), 0)
  const openLeads      = leads.filter((l: any) => !['OrderWon', 'OrderLost'].includes(l.status)).length
  const activeProjects = projects.filter((p: any) => !['Completed', 'Cancelled'].includes(p.status)).length
  const openTickets    = tickets.filter((t: any) => t.status !== 'Closed').length
  const highPriTickets = tickets.filter((t: any) => t.priority === 'High' && t.status !== 'Closed').length

  // Real 6-month trend buckets, computed from actual records (no fabricated series).
  const months = lastSixMonths()
  const monthKey = (iso?: string) => { if (!iso) return null; const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}` }
  const pipelineData = months.map(({ key, label }) => ({
    m: label,
    v: Math.round(deals.filter((d: any) => monthKey(d.createdAt) === key).reduce((s: number, d: any) => s + (d.value ?? 0), 0) / (currency === 'INR' ? 100000 : 1000)),
  }))
  const installData = months.map(({ key, label }) => ({
    m: label,
    v: projects.filter((p: any) => p.status === 'Completed' && monthKey(p.completedAt) === key).length,
  }))
  const dealsSparkData = months.map(({ key }) => ({ v: deals.filter((d: any) => monthKey(d.createdAt) === key).length }))
  const leadsSparkData = months.map(({ key }) => ({ v: leads.filter((l: any) => monthKey(l.createdAt) === key).length }))
  const projectsSparkData = months.map(({ key }) => ({ v: projects.filter((p: any) => monthKey(p.createdAt) === key).length }))
  const ticketsSparkData = months.map(({ key }) => ({ v: tickets.filter((t: any) => monthKey(t.createdAt) === key).length }))

  const recentDeals = [...deals]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const todayStr = new Date().toISOString().slice(0, 10)
  const todaysEvents = calendarEvents
    .filter((e: any) => e.date?.slice(0, 10) === todayStr)
    .sort((a: any, b: any) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const recentNotifications = (notifData?.notifications ?? []).slice(0, 5)
  const notifIcon = (type: string) => type.includes('lead') ? UserPlus : type.includes('ticket') || type.includes('support') ? LifeBuoy
    : type.includes('deal') ? CheckCircle2 : type.includes('project') ? FolderOpen : type.includes('invoice') || type.includes('payment') ? CreditCard : Bell
  const notifColor = (severity: string) => severity === 'critical' ? { bg: '#FFF3F3', color: '#FF5353' } : severity === 'warning' ? { bg: '#FFF5EE', color: '#FF9B52' } : { bg: '#E7FAF0', color: '#2BC155' }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'stretch', width: '100%', boxSizing: 'border-box', minWidth: 0, flex: 1, minHeight: 0 }}>

      {/* ── LEFT PANEL ── hidden on mobile */}
      {!isMobile && <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

        {/* Unified: logo + user + clock */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #F0F1F5',
          padding: '18px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/aspcv-logo1.png" alt="ASPCV" style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#374557', letterSpacing: -0.3, lineHeight: 1.2 }}>ASPCV</p>
              <p style={{ fontSize: 9, color: '#22C55E', fontWeight: 600, lineHeight: 1.4 }}>Aspiration Cleantech Ventures</p>
            </div>
          </div>
          <div style={{ height: 1, background: '#F0F1F5' }} />
          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#5D78FF,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{userInitials}</span>
              </div>
              <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', lineHeight: 1.3 }}>{authUser?.name ?? 'User'}</p>
              <p style={{ fontSize: 10, color: '#B1B1BE', lineHeight: 1.3 }}>{authUser?.roleName ?? authUser?.role ?? 'Member'} · Online</p>
            </div>
          </div>
          <div style={{ height: 1, background: '#F0F1F5' }} />
          {/* Clock */}
          <ISTClock />
        </div>

        {/* Latest updates — real notifications */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F1F5', padding: '18px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>Latest updates</p>
            <span onClick={() => navigate('/notifications')} style={{ fontSize: 10, color: '#5D78FF', cursor: 'pointer', fontWeight: 600 }}>View all →</span>
          </div>
          {recentNotifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <Inbox size={20} style={{ color: '#D5D5D5', margin: '0 auto 6px' }} />
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>No notifications yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentNotifications.map((n) => {
                const Icon = notifIcon(n.type)
                const { bg, color } = notifColor(n.severity)
                return (
                  <div key={n.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '8px 10px', borderRadius: 10,
                    background: n.read ? '#FAFBFF' : '#F5F7FF', border: '1px solid #F0F1F5',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#D0D8FF')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#F0F1F5')}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Icon size={12} style={{ color }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#374557', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</p>
                      <p style={{ fontSize: 9, color: '#B1B1BE', marginTop: 2 }}>{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's schedule — real calendar events */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F1F5', padding: '18px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>Today's schedule</p>
            <span onClick={() => navigate('/calendar')} style={{ fontSize: 10, color: '#5D78FF', cursor: 'pointer', fontWeight: 600 }}>View all →</span>
          </div>
          {todaysEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <CalendarDays size={20} style={{ color: '#D5D5D5', margin: '0 auto 6px' }} />
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Nothing scheduled today</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {todaysEvents.map((e: any, i: number) => {
                const dot = e.color === 'green' ? '#22C55E' : e.color === 'orange' ? '#FF9B52' : e.color === 'red' ? '#FF5353' : '#5D78FF'
                return (
                  <div key={e.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 3 }} />
                      {i < todaysEvents.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 20, background: '#F0F1F5' }} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, paddingBottom: i < todaysEvents.length - 1 ? 4 : 0 }}>
                      <p style={{ fontSize: 9, color: dot, fontWeight: 700, marginBottom: 1 }}>{e.startTime ?? 'All day'}</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', lineHeight: 1.3 }}>{e.title}</p>
                      {e.description && <p style={{ fontSize: 9, color: '#B1B1BE', marginTop: 1, lineHeight: 1.3 }}>{e.description}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Currency switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <ArrowLeftRight size={12} style={{ color: '#B1B1BE' }} />
          <p style={{ fontSize: 11, color: '#B1B1BE' }}>Currency:</p>
          {(['INR', 'USD'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: currency === c ? '#5D78FF' : '#F4F5F9',
                color: currency === c ? '#fff' : '#B1B1BE',
              }}
            >
              {c === 'INR' ? '₹ INR' : '$ USD'}
            </button>
          ))}
        </div>

        {/* Stat cards — trend arrow reflects real last-two-months change in the underlying spark series */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          {[
            { label: 'Pipeline',        sub: `${activeDeals.length} active deal${activeDeals.length !== 1 ? 's' : ''}`, value: fmt(pipelineInr),       color: '#5D78FF', spark: dealsSparkData },
            { label: 'Open Leads',      sub: `${openLeads} not yet won`,                                               value: String(openLeads),      color: '#FF9B52', spark: leadsSparkData },
            { label: 'Active Projects', sub: `${activeProjects} in progress`,                                          value: String(activeProjects), color: '#22C55E', spark: projectsSparkData },
            { label: 'Support Tickets', sub: `${highPriTickets} high priority`,                                        value: String(openTickets),    color: '#FF5353', spark: ticketsSparkData },
          ].map(s => {
            const last = s.spark[s.spark.length - 1]?.v ?? 0
            const prev = s.spark[s.spark.length - 2]?.v ?? 0
            const up = last >= prev
            return (
            <div key={s.label} style={{ ...card, padding: '18px 20px 12px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{s.label}</p>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 2 }}>{s.sub}</p>
                </div>
                <MoreHorizontal size={14} style={{ color: '#D5D5D5' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '12px 0 6px' }}>
                <p style={{ fontSize: 'clamp(16px, 2vw, 22px)', fontWeight: 700, color: '#374557' }}>{s.value}</p>
                {prev !== last && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: up ? '#2BC155' : '#FF5353' }}>
                    {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  </span>
                )}
              </div>
              <MiniSpark color={s.color} data={s.spark} />
            </div>
            )
          })}
        </div>

        {/* ERP KPI Row */}
        {showHolidayAlert && (
          <div style={{ background: '#FFF5EE', border: '1px solid #FF9B52', padding: '14px 18px', borderRadius: 12, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <CalendarDays size={20} style={{ color: '#FF9B52' }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>Action Required: Configure Holidays for {nextYear}</p>
                <p style={{ fontSize: 11, color: '#92400E', margin: '2px 0 0 0' }}>The holiday calendar for {nextYear} is empty. Please set it up before the year ends.</p>
              </div>
            </div>
            <button onClick={() => navigate('/hr')} style={{ background: '#FF9B52', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Go to HR Settings</button>
          </div>
        )}
        <ERPKPIRow fmt={fmt} isMobile={isMobile} />

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <div style={{ ...card, padding: '20px 20px 12px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>Pipeline Value</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Monthly ({currency === 'INR' ? '₹L' : '$k'})</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={pipelineData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="pipG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5D78FF" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#5D78FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={v => `${currency === 'INR' ? '₹' : '$'}${v}`} />
                <Tooltip formatter={(v) => [`${currency === 'INR' ? '₹' : '$'}${Number(v)}${currency === 'INR' ? 'L' : 'k'}`, 'Pipeline']} contentStyle={{ fontSize: 11, border: '1px solid #F0F1F5', borderRadius: 8 }} />
                <Area type="monotone" dataKey="v" stroke="#5D78FF" fill="url(#pipG)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...card, padding: '20px 20px 12px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>Installations</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Projects completed monthly</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={installData} barSize={20} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #F0F1F5', borderRadius: 8 }} />
                <Bar dataKey="v" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Deals */}
        <div style={{ ...card, overflow: 'hidden', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #F4F5F9' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>Recent Deals</p>
            <span onClick={() => navigate('/deals')} style={{ fontSize: 12, color: '#5D78FF', cursor: 'pointer', fontWeight: 600 }}>View all →</span>
          </div>
          {recentDeals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <Zap size={22} style={{ color: '#D5D5D5', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 12, color: '#B1B1BE' }}>No deals yet — create one to start tracking pipeline.</p>
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {recentDeals.map((d: any) => (
                <div key={d.id} onClick={() => navigate('/deals')} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8EDFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={14} style={{ color: '#5D78FF' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{d.company?.name ?? '—'}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[d.stage]?.bg ?? '#F4F5F9', color: statusStyle[d.stage]?.color ?? '#8C8C8C', whiteSpace: 'nowrap' }}>{d.stage}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Owner</p>
                      <p style={{ fontSize: 11, color: '#374557' }}>{d.owners?.[0]?.user?.name ?? '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Value</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{d.value ? fmt(d.value) : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <colgroup>
              <col style={{ width: '32%' }} /><col style={{ width: '24%' }} />
              <col style={{ width: '20%' }} /><col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                {['Deal', 'Company', 'Owner', `Value (${currency})`, 'Stage'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: '#B1B1BE', letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentDeals.map((d: any) => (
                <tr key={d.id} onClick={() => navigate('/deals')} style={{ borderBottom: '1px solid #F4F5F9', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8EDFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={14} style={{ color: '#5D78FF' }} />
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</p>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#374557' }}>{d.company?.name ?? '—'}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#374557' }}>{d.owners?.[0]?.user?.name ?? '—'}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#374557' }}>
                    {d.value ? fmt(d.value) : '—'}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                      background: statusStyle[d.stage]?.bg ?? '#F4F5F9',
                      color: statusStyle[d.stage]?.color ?? '#8C8C8C',
                      whiteSpace: 'nowrap', display: 'inline-block',
                    }}>{d.stage}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ERPKPIRow({ fmt, isMobile }: { fmt: (v: number) => string; isMobile: boolean }) {
  const { data: deals } = useQuery<any[]>({ queryKey: ['deals', 'all'], queryFn: () => import('@/lib/api').then(m => m.api.get('/deals', { params: { pageSize: 1000 } }).then(r => r.data.data)) })
  const { data: projects } = useQuery<any[]>({ queryKey: ['projects'], queryFn: () => import('@/lib/api').then(m => m.api.get('/projects', { params: { pageSize: 1000 } }).then(r => r.data.data)) })
  const { data: purchaseOrders } = useQuery<any[]>({ queryKey: ['purchase-orders'], queryFn: () => import('@/lib/api').then(m => m.api.get('/purchase-orders', { params: { pageSize: 1000 } }).then(r => r.data.data)) })
  const { data: warrantyExpiring } = useQuery<any[]>({ queryKey: ['warranty-expiring', 30], queryFn: () => import('@/lib/api').then(m => m.api.get('/service-records/warranty-expiring', { params: { days: 30 } }).then(r => r.data)) })
  const { data: components } = useQuery<any[]>({ queryKey: ['components'], queryFn: () => import('@/lib/api').then(m => m.api.get('/components', { params: { pageSize: 1000 } }).then(r => r.data.data)) })

  const activeProjects = projects?.filter((p: any) => !['Completed', 'Cancelled'].includes(p.status)).length || 0
  const completedProjects = projects?.filter((p: any) => p.status === 'Completed').length || 0
  const manufacturingProjects = projects?.filter((p: any) => p.status === 'Manufacturing').length || 0
  const pendingPOs = purchaseOrders?.filter((p: any) => ['Draft', 'Sent'].includes(p.status)).length || 0
  const wonValue = deals?.filter((d: any) => d.stage === 'OrderWon').reduce((s: number, d: any) => s + (d.value || 0), 0) || 0
  const warrantyCount = warrantyExpiring?.length || 0
  const inventoryValue = components?.reduce((s: number, c: any) => s + (c.price || 0) * (c.quantity || 0), 0) || 0
  const lowStock = components?.filter((c: any) => (c.quantity || 0) < 5).length || 0

  const kpis = [
    { label: 'Active Projects', value: String(activeProjects), color: '#5D78FF', sub: `${manufacturingProjects} in mfg` },
    { label: 'Completed', value: String(completedProjects), color: '#2BC155', sub: 'all time' },
    { label: 'Pending POs', value: String(pendingPOs), color: '#FF9B52', sub: 'awaiting delivery' },
    { label: 'Won Value', value: fmt(wonValue), color: '#22C55E', sub: 'deals won' },
    { label: 'Inventory Value', value: fmt(inventoryValue), color: '#8B5CF6', sub: `${lowStock} low stock` },
    { label: 'Warranty Expiring', value: String(warrantyCount), color: '#EF4444', sub: 'next 30 days' },
  ]

  return (
    <div style={{ paddingBottom: 40 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#B1B1BE', letterSpacing: 1, marginBottom: 10 }}>ERP OVERVIEW</p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: '14px 16px 10px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#B1B1BE', marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 'clamp(14px, 1.8vw, 20px)', fontWeight: 700, color: k.color }}>{k.value}</p>
            <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 3 }}>{k.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
