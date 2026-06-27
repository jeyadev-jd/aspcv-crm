import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { MoreHorizontal, TrendingUp, TrendingDown, UserPlus, LifeBuoy, CheckCircle2, FolderOpen, CreditCard, ArrowLeftRight, Clock, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type React from 'react'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'

const INR_RATE = 83.5

const pipelineData = [
  { m: 'Jan', v: 42 }, { m: 'Feb', v: 68 }, { m: 'Mar', v: 55 },
  { m: 'Apr', v: 87 }, { m: 'May', v: 112 }, { m: 'Jun', v: 94 },
]
const installData = [
  { m: 'Jan', v: 3 }, { m: 'Feb', v: 5 }, { m: 'Mar', v: 4 },
  { m: 'Apr', v: 8 }, { m: 'May', v: 6 }, { m: 'Jun', v: 9 },
]
const miniData = [{ v: 3 }, { v: 5 }, { v: 4 }, { v: 7 }, { v: 5 }, { v: 8 }, { v: 6 }]

// Deal values stored in INR
const recentDeals = [
  { product: 'ASHP 8kW – Phase 1',     client: 'Yorkshire Housing Trust',  location: 'Leeds',      qty: 45, valueInr: 10437500, status: 'Negotiation' },
  { product: 'Solar Array 10kWp',      client: 'GreenBuild Developers',    location: 'Manchester', qty: 3,  valueInr: 6513000,  status: 'Proposal' },
  { product: 'HRV Retrofit Programme', client: 'BioWarm Engineering',       location: 'Birmingham', qty: 12, valueInr: 17535000, status: 'Closed Won' },
]

const updates = [
  { text: 'New lead: Apex Sustainability', time: '5 min ago',  valueInr: null,      Icon: UserPlus,     iconBg: '#E7FAF0', iconColor: '#2BC155' },
  { text: 'Ticket TKT-003 opened',         time: '1 hr ago',   valueInr: null,      Icon: LifeBuoy,     iconBg: '#FFF3F3', iconColor: '#FF5353' },
  { text: 'Deal closed: BioWarm HRV',      time: '2 hrs ago',  valueInr: 17535000,  Icon: CheckCircle2, iconBg: '#E7FAF0', iconColor: '#2BC155' },
  { text: 'Project: YHT Phase 1 Active',   time: '3 hrs ago',  valueInr: null,      Icon: FolderOpen,   iconBg: '#E8EDFF', iconColor: '#5D78FF' },
  { text: 'Invoice AA-04-19-1890 paid',    time: 'Yesterday',  valueInr: 157805,    Icon: CreditCard,   iconBg: '#E8EDFF', iconColor: '#5D78FF' },
]

const events = [
  { dot: '#5D78FF', time: '09:00 AM', title: 'Site visit – YHT Leeds',        sub: 'Block A ASHP commissioning' },
  { dot: '#22C55E', time: '02:00 PM', title: 'Call with Apex Sustainability', sub: 'GSHP proposal discussion' },
  { dot: '#FF9B52', time: '04:30 PM', title: 'Team standup',                  sub: 'Project status & tickets' },
]

const statusStyle: Record<string, { bg: string; color: string }> = {
  'Closed Won':  { bg: '#E7FAF0', color: '#2BC155' },
  Negotiation:   { bg: '#FFF5EE', color: '#FF9B52' },
  Proposal:      { bg: '#E8EDFF', color: '#5D78FF' },
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5',
}

function MiniSpark({ color }: { color: string }) {
  const id = `spark${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height={38}>
      <AreaChart data={miniData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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

  const pipelineInr = 62005000
  const openLeads = 48
  const activeProjects = 5
  const support = 9

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
            <img src="/aspcv-logo.png" alt="ASPCV" style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
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
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>J</span>
              </div>
              <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', lineHeight: 1.3 }}>Jeyadev</p>
              <p style={{ fontSize: 10, color: '#B1B1BE', lineHeight: 1.3 }}>Admin · Online</p>
            </div>
          </div>
          <div style={{ height: 1, background: '#F0F1F5' }} />
          {/* Clock */}
          <ISTClock />
        </div>

        {/* Latest updates */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F1F5', padding: '18px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 12 }}>Latest updates</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {updates.map((u, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 10px', borderRadius: 10,
                background: '#FAFBFF', border: '1px solid #F0F1F5',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#D0D8FF')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#F0F1F5')}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: u.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><u.Icon size={12} style={{ color: u.iconColor }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#374557', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.text}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <p style={{ fontSize: 9, color: '#B1B1BE' }}>{u.time}</p>
                    {u.valueInr != null && (
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#2BC155' }}>+{fmtInr(u.valueInr, symbol, currency)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's schedule */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F1F5', padding: '18px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 14 }}>Today's schedule</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.dot, flexShrink: 0, marginTop: 3 }} />
                  {i < events.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 20, background: '#F0F1F5' }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1, paddingBottom: i < events.length - 1 ? 4 : 0 }}>
                  <p style={{ fontSize: 9, color: e.dot, fontWeight: 700, marginBottom: 1 }}>{e.time} IST</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', lineHeight: 1.3 }}>{e.title}</p>
                  <p style={{ fontSize: 9, color: '#B1B1BE', marginTop: 1, lineHeight: 1.3 }}>{e.sub}</p>
                </div>
              </div>
            ))}
          </div>
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

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          {[
            { label: 'Pipeline',        sub: '8 active deals',        value: fmtInr(pipelineInr, symbol, currency), color: '#5D78FF', up: true,  pct: '+18%' },
            { label: 'Open Leads',      sub: '4 new this week',       value: String(openLeads),                      color: '#FF9B52', up: true,  pct: '+12%' },
            { label: 'Active Projects', sub: '3 on site this week',   value: String(activeProjects),                 color: '#22C55E', up: false, pct: '-1' },
            { label: 'Support',         sub: '3 high priority open',  value: String(support),                        color: '#FF5353', up: false, pct: '+4' },
          ].map(s => (
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: s.up ? '#2BC155' : '#FF5353' }}>
                  {s.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {s.pct}
                </span>
              </div>
              <MiniSpark color={s.color} />
            </div>
          ))}
        </div>

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
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {recentDeals.map((d, i) => (
                <div key={i} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8EDFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={14} style={{ color: '#5D78FF' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{d.product}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{d.client}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[d.status]?.bg ?? '#F4F5F9', color: statusStyle[d.status]?.color ?? '#8C8C8C', whiteSpace: 'nowrap' }}>{d.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Location</p>
                      <p style={{ fontSize: 11, color: '#374557' }}>{d.location}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Qty</p>
                      <p style={{ fontSize: 11, color: '#374557' }}>{d.qty}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Value</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{fmtInr(d.valueInr, symbol, currency)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <colgroup>
              <col style={{ width: '28%' }} /><col style={{ width: '24%' }} />
              <col style={{ width: '14%' }} /><col style={{ width: '8%' }} />
              <col style={{ width: '13%' }} /><col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                {['Product / Service', 'Client', 'Location', 'Qty', `Value (${currency})`, 'Stage'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: '#B1B1BE', letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentDeals.map((d, i) => (
                <tr key={i} style={{ borderBottom: i < recentDeals.length - 1 ? '1px solid #F4F5F9' : 'none' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8EDFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={14} style={{ color: '#5D78FF' }} />
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.product}</p>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#374557' }}>{d.client}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#374557' }}>{d.location}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#374557' }}>{d.qty}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#374557' }}>
                    {fmtInr(d.valueInr, symbol, currency)}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                      background: statusStyle[d.status]?.bg ?? '#F4F5F9',
                      color: statusStyle[d.status]?.color ?? '#8C8C8C',
                      whiteSpace: 'nowrap', display: 'inline-block',
                    }}>{d.status}</span>
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
