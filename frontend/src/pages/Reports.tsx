import { useState, useRef } from 'react'
import type React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, FunnelChart, Funnel, LabelList,
} from 'recharts'
import {
  Edit2, Check, Download, TrendingUp, TrendingDown, Target,
  Briefcase, DollarSign, Award, AlertTriangle, CheckCircle2,
  Map, ChevronDown, Calendar, FileText, Zap, BarChart2, Info, Printer,
} from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'

const INR_RATE = 83.5

/* ── static datasets ── */
const initMonthlyRevenue = [
  { m: 'Jan', target: 6680000,  actual: 6012000  },
  { m: 'Feb', target: 7097500,  actual: 7598500  },
  { m: 'Mar', target: 7515000,  actual: 7348000  },
  { m: 'Apr', target: 7932500,  actual: 8684000  },
  { m: 'May', target: 8350000,  actual: 9352000  },
  { m: 'Jun', target: 8767500,  actual: 0        },
]

const initPipelineData = [
  { name: 'Lead In',      value: 9018000,  color: '#5D78FF' },
  { name: 'Proposal',    value: 34903000, color: '#FF9B52' },
  { name: 'Negotiation', value: 18119500, color: '#F59E0B' },
  { name: 'Closed Won',  value: 17535000, color: '#2BC155' },
  { name: 'Closed Lost', value: 1503000,  color: '#FF5353' },
]

const ticketsTrend = [
  { w: 'W1', open: 4, resolved: 2 },
  { w: 'W2', open: 7, resolved: 5 },
  { w: 'W3', open: 5, resolved: 6 },
  { w: 'W4', open: 9, resolved: 7 },
  { w: 'W5', open: 6, resolved: 9 },
  { w: 'W6', open: 4, resolved: 8 },
]

const initProductPerf = [
  { name: 'ASHP 8kW',         revenue: 28964500 },
  { name: 'GSHP 12kW',        revenue: 28390000 },
  { name: 'HRV Unit',          revenue: 17535000 },
  { name: 'Battery 10kWh',    revenue: 7682000  },
  { name: 'Solar 10kWp',      revenue: 6513000  },
  { name: 'EV Charger',       revenue: 5260500  },
  { name: 'Smart Controller', revenue: 3757500  },
]

const funnelData = [
  { name: 'Leads',       value: 148, fill: '#5D78FF' },
  { name: 'Qualified',   value: 89,  fill: '#8B5CF6' },
  { name: 'Proposal',    value: 52,  fill: '#FF9B52' },
  { name: 'Negotiation', value: 31,  fill: '#F59E0B' },
  { name: 'Closed Won',  value: 18,  fill: '#2BC155' },
]

const repLeaderboard = [
  { name: 'Sarah Mitchell', deals: 12, revenue: 18200000, quota: 85, avatar: '#5D78FF' },
  { name: 'Tom Bradshaw',   deals: 9,  revenue: 14350000, quota: 71, avatar: '#FF9B52' },
  { name: 'Oliver Grant',   deals: 11, revenue: 16800000, quota: 79, avatar: '#2BC155' },
  { name: 'Liz Thornton',   deals: 7,  revenue: 11200000, quota: 58, avatar: '#FF5353' },
  { name: 'Fiona Clarke',   deals: 5,  revenue: 8750000,  quota: 44, avatar: '#8B5CF6' },
]

const forecastData = [
  { m: 'Jun', conservative: 7200000, base: 9100000,  optimistic: 11400000 },
  { m: 'Jul', conservative: 7800000, base: 9900000,  optimistic: 12800000 },
  { m: 'Aug', conservative: 8100000, base: 10500000, optimistic: 13600000 },
  { m: 'Sep', conservative: 8600000, base: 11200000, optimistic: 14200000 },
]

const cohortData = [
  { cohort: 'Jan 2026', m0: 100, m1: 82, m2: 71, m3: 65, m4: 60, m5: 58 },
  { cohort: 'Feb 2026', m0: 100, m1: 79, m2: 68, m3: 62, m4: 57 },
  { cohort: 'Mar 2026', m0: 100, m1: 84, m2: 74, m3: 67 },
  { cohort: 'Apr 2026', m0: 100, m1: 81, m2: 70 },
  { cohort: 'May 2026', m0: 100, m1: 76 },
]

const geoData = [
  { region: 'Yorkshire',  leads: 42, deals: 18, revenue: 24500000, growth: 14  },
  { region: 'Manchester', leads: 31, deals: 12, revenue: 16800000, growth: 9   },
  { region: 'Birmingham', leads: 28, deals: 11, revenue: 15200000, growth: 22  },
  { region: 'London',     leads: 24, deals: 9,  revenue: 12400000, growth: -3  },
  { region: 'Edinburgh',  leads: 18, deals: 6,  revenue: 8900000,  growth: 31  },
  { region: 'Bristol',    leads: 15, deals: 5,  revenue: 7100000,  growth: 18  },
]

const radarData = [
  { subject: 'Leads',     A: 85 },
  { subject: 'Proposals', A: 72 },
  { subject: 'Deals',     A: 68 },
  { subject: 'Retention', A: 79 },
  { subject: 'Upsell',    A: 55 },
  { subject: 'Support',   A: 88 },
]

const velocityData = [
  { stage: 'Lead→Qualify', days: 3.2  },
  { stage: 'Qualify→Prop', days: 7.1  },
  { stage: 'Prop→Nego',    days: 12.4 },
  { stage: 'Nego→Close',   days: 8.9  },
]

const heatmapDays  = ['Mon','Tue','Wed','Thu','Fri']
const heatmapHours = ['9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm']
const heatmapRaw: number[][] = [
  [3,5,8,6,4,7,9,5,3],[2,4,6,5,3,6,8,4,2],[5,7,9,8,6,9,11,7,4],
  [4,6,8,7,5,8,10,6,3],[2,3,5,4,2,4,6,3,1],
]

/* ── NEW datasets ── */
const leadsTrend   = [{w:'W1',v:18},{w:'W2',v:22},{w:'W3',v:19},{w:'W4',v:26},{w:'W5',v:24},{w:'W6',v:31}]
const dealsTrend   = [{w:'W1',v:4 },{w:'W2',v:6 },{w:'W3',v:5 },{w:'W4',v:7 },{w:'W5',v:6 },{w:'W6',v:9 }]
const invoiceTrend = [{w:'W1',v:3 },{w:'W2',v:5 },{w:'W3',v:4 },{w:'W4',v:6 },{w:'W5',v:5 },{w:'W6',v:8 }]

const productAccuracy = [
  { name: 'ASHP 8kW',         target: 30000000, actual: 28964500 },
  { name: 'GSHP 12kW',        target: 29000000, actual: 28390000 },
  { name: 'HRV Unit',          target: 18000000, actual: 17535000 },
  { name: 'Battery 10kWh',    target: 8000000,  actual: 7682000  },
  { name: 'Solar 10kWp',      target: 7000000,  actual: 6513000  },
  { name: 'EV Charger',       target: 5500000,  actual: 5260500  },
  { name: 'Smart Controller', target: 4000000,  actual: 3757500  },
]

/* ── helpers ── */
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1px solid #F0F1F5',
  padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

function fmt(val: number, symbol: string, currency: string): string {
  const v = currency === 'USD' ? val / INR_RATE : val
  if (currency === 'INR') {
    if (v >= 10000000) return `${symbol}${(v / 10000000).toFixed(1)}Cr`
    if (v >= 100000)   return `${symbol}${(v / 100000).toFixed(1)}L`
    if (v >= 1000)     return `${symbol}${(v / 1000).toFixed(0)}k`
  } else {
    if (v >= 1000000) return `${symbol}${(v / 1000000).toFixed(1)}M`
    if (v >= 1000)    return `${symbol}${(v / 1000).toFixed(0)}k`
  }
  return `${symbol}${Math.round(v).toLocaleString()}`
}

function cohortColor(val: number | undefined) {
  if (val === undefined) return '#F4F5F9'
  if (val >= 80) return '#dcfce7'
  if (val >= 65) return '#bbf7d0'
  if (val >= 50) return '#86efac'
  if (val >= 35) return '#4ade80'
  return '#22c55e'
}

function heatColor(v: number, max: number) {
  const t = v / max
  if (t > 0.8) return '#5D78FF'
  if (t > 0.6) return '#818CF8'
  if (t > 0.4) return '#A5B4FC'
  if (t > 0.2) return '#C7D2FE'
  return '#EEF2FF'
}

function accuracyColor(pct: number): { bg: string; color: string } {
  if (pct >= 90) return { bg: '#E7FAF0', color: '#2BC155' }
  if (pct >= 75) return { bg: '#FFF5EE', color: '#FF9B52' }
  return { bg: '#FFF3F3', color: '#FF5353' }
}

function attainColor(pct: number): { bg: string; color: string; label: string } {
  if (pct >= 100) return { bg: '#E7FAF0', color: '#2BC155',  label: 'On Target' }
  if (pct >= 85)  return { bg: '#FFF5EE', color: '#FF9B52',  label: 'Near' }
  if (pct === 0)  return { bg: '#F4F5F9', color: '#8C8C8C',  label: 'Pending' }
  return { bg: '#FFF3F3', color: '#FF5353', label: 'Below' }
}

/* ── sub-components ── */
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

function KpiCard({
  label, value, sub, color, icon: Icon, delta, deltaUp,
}: {
  label: string; value: string; sub: string; color: string
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>
  delta?: string; deltaUp?: boolean
}) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }} className="crm-card-hover">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: 11, color: '#B1B1BE', fontWeight: 500 }}>{label}</p>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {delta && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: deltaUp ? '#2BC155' : '#FF5353' }}>
            {deltaUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{delta}
          </span>
        )}
        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{sub}</p>
      </div>
    </div>
  )
}

function MiniPanel({ title, data, color }: { title: string; data: { w: string; v: number }[]; color: string }) {
  return (
    <div style={{ background: '#FAFBFF', borderRadius: 10, padding: '10px 14px', border: '1px solid #F0F1F5' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#B1B1BE', marginBottom: 4, letterSpacing: 0.3 }}>{title}</p>
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={data} margin={{ top: 2, right: 2, left: -32, bottom: 0 }}>
          <XAxis dataKey="w" tick={{ fontSize: 8, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #F0F1F5' }} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function FindingCard({ color, icon: Icon, title, body }: { color: string; icon: React.FC<{ size?: number; style?: React.CSSProperties }>; title: string; body: string }) {
  return (
    <div style={{
      flex: 1, padding: '14px 16px', borderRadius: 10,
      borderLeft: `4px solid ${color}`,
      background: `${color}0A`, border: `1px solid ${color}22`,
      borderLeftWidth: 4, borderLeftColor: color,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={12} style={{ color }} />
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{title}</p>
      </div>
      <p style={{ fontSize: 10, color: '#B1B1BE', lineHeight: 1.5 }}>{body}</p>
    </div>
  )
}

const DATE_RANGES = ['This Month', 'Last 3 Months', 'Last 6 Months', 'This Year', 'Custom']

export default function Reports() {
  const { currency, symbol } = useCurrency()
  const [monthly, setMonthly] = useState(initMonthlyRevenue)
  const [pipeline]     = useState(initPipelineData)
  const [productPerf]  = useState(initProductPerf)
  const [editTarget, setEditTarget]   = useState<number | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [dateRange, setDateRange]     = useState('Last 6 Months')
  const [dateOpen, setDateOpen]       = useState(false)
  const [activeTab, setActiveTab]     = useState<'overview' | 'sales' | 'pipeline' | 'team' | 'forecast'>('overview')
  const exportRef = useRef<HTMLAnchorElement>(null)

  const totalPipeline = pipeline.filter(d => !['Closed Won', 'Closed Lost'].includes(d.name)).reduce((s, d) => s + d.value, 0)
  const totalWon      = pipeline.find(d => d.name === 'Closed Won')!.value
  const totalAll      = pipeline.reduce((s, d) => s + d.value, 0)
  const winRate       = Math.round((totalWon / totalAll) * 100)
  const totalRevenue  = productPerf.reduce((s, p) => s + p.revenue, 0)
  const revenueYTD    = monthly.filter(m => m.actual > 0).reduce((s, m) => s + m.actual, 0)
  const toDisp        = (inr: number) => currency === 'USD' ? inr / INR_RATE : inr

  const startEdit = (i: number) => {
    const val = currency === 'USD' ? +(monthly[i].target / INR_RATE).toFixed(0) : monthly[i].target
    setEditTarget(i); setTargetInput(String(val))
  }
  const saveTarget = (i: number) => {
    const raw = parseFloat(targetInput)
    if (!isNaN(raw) && raw > 0) {
      const inrVal = currency === 'USD' ? raw * INR_RATE : raw
      setMonthly(prev => prev.map((m, idx) => idx === i ? { ...m, target: Math.round(inrVal) } : m))
    }
    setEditTarget(null)
  }

  const chartData = monthly.map(m => ({
    m: m.m,
    Target: Math.round(toDisp(m.target)),
    Actual: Math.round(toDisp(m.actual)),
  }))

  const tickFmt = (v: number) => {
    if (currency === 'INR') {
      if (v >= 100000) return `${symbol}${(v / 100000).toFixed(0)}L`
      if (v >= 1000)   return `${symbol}${(v / 1000).toFixed(0)}k`
    } else {
      if (v >= 1000) return `${symbol}${(v / 1000).toFixed(0)}k`
    }
    return `${symbol}${v}`
  }

  const forecastDisp = forecastData.map(f => ({
    m: f.m,
    Conservative: Math.round(toDisp(f.conservative)),
    Base:          Math.round(toDisp(f.base)),
    Optimistic:    Math.round(toDisp(f.optimistic)),
  }))

  const handleExport = () => {
    const rows = [
      ['Month', 'Target', 'Actual', 'Variance', '% Attainment'],
      ...monthly.map(m => {
        const pct = m.actual > 0 ? Math.round((m.actual / m.target) * 100) : 0
        return [m.m, Math.round(toDisp(m.target)), Math.round(toDisp(m.actual)), Math.round(toDisp(m.actual - m.target)), pct ? `${pct}%` : 'N/A']
      }),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'aspcv_revenue.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const heatMax = Math.max(...heatmapRaw.flat())

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'overview',  label: 'Overview'  },
    { key: 'sales',     label: 'Sales'     },
    { key: 'pipeline',  label: 'Pipeline'  },
    { key: 'team',      label: 'Team'      },
    { key: 'forecast',  label: 'Forecast'  },
  ]

  const repAccuracy = repLeaderboard.map(r => {
    const forecast = Math.round(r.deals * (100 / r.quota))
    const absErr   = Math.abs(r.deals - forecast)
    const pctErr   = Math.round((absErr / Math.max(forecast, 1)) * 100)
    return { ...r, forecast, absErr, pctErr, accuracy: 100 - pctErr }
  })
  const avgAccuracy = Math.round(repAccuracy.reduce((s, r) => s + r.accuracy, 0) / repAccuracy.length)

  const prodTotalTarget = productAccuracy.reduce((s, p) => s + p.target, 0)

  return (
    <div className="crm-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Report Header Card (always visible) ── */}
      <div style={{ ...card, padding: '16px 20px', background: 'linear-gradient(135deg,#1e3a5f 0%,#2d5a8e 100%)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} style={{ color: '#fff' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>ASPCV CRM — Analytics Report</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Period: Jan – May 2026 · Generated 31 May 2026, IST</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { text: 'Pipeline +12% vs Q4', color: '#2BC155' },
              { text: `Win Rate ${winRate}%`, color: '#FF9B52' },
              { text: 'Revenue YTD +18% vs target', color: '#5D78FF' },
            ].map(p => (
              <span key={p.text} style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}44`, whiteSpace: 'nowrap' }}>
                {p.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 10, padding: 4, border: '1px solid #F0F1F5' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: activeTab === t.key ? '#5D78FF' : 'transparent',
                color: activeTab === t.key ? '#fff' : '#B1B1BE',
                transition: 'all 0.15s',
              }}
            >{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDateOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', cursor: 'pointer', color: '#374557' }}
            >
              <Calendar size={12} style={{ color: '#B1B1BE' }} />{dateRange}<ChevronDown size={11} style={{ color: '#B1B1BE' }} />
            </button>
            {dateOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 160, animation: 'slideUp 0.15s ease' }}>
                {DATE_RANGES.map(r => (
                  <div key={r} onClick={() => { setDateRange(r); setDateOpen(false) }}
                    style={{ padding: '9px 14px', fontSize: 12, cursor: 'pointer', color: r === dateRange ? '#5D78FF' : '#374557', fontWeight: r === dateRange ? 600 : 400, background: r === dateRange ? '#F0F4FF' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (r !== dateRange) (e.currentTarget as HTMLElement).style.background = '#F8F9FB' }}
                    onMouseLeave={e => { if (r !== dateRange) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >{r}</div>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #5D78FF', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
            <Download size={12} />Export CSV
          </button>
          <a ref={exportRef} style={{ display: 'none' }} />
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard label="Revenue YTD"     value={fmt(revenueYTD, symbol, currency)}    sub="Jan–May 2026"  color="#2BC155" icon={DollarSign} delta="+18%" deltaUp />
        <KpiCard label="Active Pipeline" value={fmt(totalPipeline, symbol, currency)} sub="Excl. closed"  color="#5D78FF" icon={Briefcase}  delta="+12%" deltaUp />
        <KpiCard label="Closed Won"      value={fmt(totalWon, symbol, currency)}       sub="This year"     color="#8B5CF6" icon={Target}     delta="+9%"  deltaUp />
        <KpiCard label="Win Rate"        value={`${winRate}%`}                         sub="All deals"     color="#FF9B52" icon={TrendingUp} delta="-2%"  deltaUp={false} />
      </div>

      {/* ══════════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Section A — Performance Summary Table (PDF Table 5.1.2 style) */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>Table 1: Monthly Revenue Performance Summary</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Jan – Jun 2026 · Click pencil icon to edit monthly targets</p>
              </div>
              <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#E7FAF0', color: '#2BC155', fontWeight: 600, whiteSpace: 'nowrap' }}>+12% avg vs target</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr style={{ background: '#F8F9FF' }}>
                    {['Month', 'Target', 'Actual Revenue', 'Variance', '% Attainment', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#374557', letterSpacing: 0.4, borderBottom: '2px solid #F0F1F5', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => {
                    const pct       = m.actual > 0 ? Math.round((m.actual / m.target) * 100) : 0
                    const variance  = m.actual - m.target
                    const att       = attainColor(pct)
                    return (
                      <tr key={m.m} className="crm-tr-hover" style={{ borderBottom: '1px solid #F4F5F9' }}>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{m.m} 2026</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>
                          {editTarget === i ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input autoFocus value={targetInput} onChange={e => setTargetInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveTarget(i); if (e.key === 'Escape') setEditTarget(null) }}
                                style={{ width: 80, fontSize: 11, border: '1px solid #5D78FF', borderRadius: 4, padding: '3px 6px', outline: 'none' }}
                              />
                              <button onClick={() => saveTarget(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BC155', padding: 0 }}><Check size={11} /></button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {fmt(m.target, symbol, currency)}
                              <button onClick={() => startEdit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4C4CF', padding: 0 }}><Edit2 size={9} /></button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>
                          {m.actual > 0 ? fmt(m.actual, symbol, currency) : <span style={{ color: '#B1B1BE' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {m.actual > 0 ? (
                            <span style={{ color: variance >= 0 ? '#2BC155' : '#FF5353', fontWeight: 600 }}>
                              {variance >= 0 ? '+' : ''}{fmt(Math.abs(variance), symbol, currency)}
                            </span>
                          ) : <span style={{ color: '#B1B1BE' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {pct > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 60, height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                                <div className="crm-bar-fill" style={{ height: '100%', borderRadius: 3, width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#2BC155' : pct >= 85 ? '#FF9B52' : '#FF5353' }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{pct}%</span>
                            </div>
                          ) : <span style={{ color: '#B1B1BE', fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: att.bg, color: att.color }}>{att.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr style={{ background: '#F8F9FF', borderTop: '2px solid #F0F1F5' }}>
                    <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>TOTAL (YTD)</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>
                      {fmt(monthly.filter(m => m.actual > 0).reduce((s, m) => s + m.target, 0), symbol, currency)}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>
                      {fmt(revenueYTD, symbol, currency)}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#2BC155' }}>
                      +{fmt(revenueYTD - monthly.filter(m => m.actual > 0).reduce((s, m) => s + m.target, 0), symbol, currency)}
                    </td>
                    <td colSpan={2} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>
                      Overall Attainment: {Math.round((revenueYTD / monthly.filter(m => m.actual > 0).reduce((s, m) => s + m.target, 0)) * 100)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B — Charts (Fig 5.1.1 + 5.1.2 style) */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div style={{ ...card }}>
              <SectionHeader title="Fig 1.1: Monthly Revenue vs Target" sub="Actual revenue against monthly targets (Jan–Jun 2026)" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={4} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <Tooltip formatter={(v) => `${symbol}${Math.round(Number(v)).toLocaleString()}`} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Target" fill="#E8EDFF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#5D78FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...card }}>
              <SectionHeader title="Fig 1.2: Pipeline Stage Count" sub="Deals by current stage" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#374557' }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                    {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section C — 3-panel trend chart (PDF Fig 5.1.3 meteorological style) */}
          <div style={{ ...card }}>
            <SectionHeader title="Fig 1.3: Weekly Activity Trends — Leads / Deals / Invoices" sub="6-week rolling view (W1 = first week of May 2026)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <MiniPanel title="LEADS INCOMING" data={leadsTrend}   color="#5D78FF" />
              <MiniPanel title="DEALS CLOSED"   data={dealsTrend}   color="#2BC155" />
              <MiniPanel title="INVOICES PAID"  data={invoiceTrend} color="#FF9B52" />
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 10, padding: '8px 12px', background: '#F8F9FF', borderRadius: 8 }}>
              {[
                { label: 'Lead→Deal conversion', value: `${Math.round((dealsTrend[dealsTrend.length-1].v / leadsTrend[leadsTrend.length-1].v) * 100)}%`, color: '#5D78FF' },
                { label: 'Invoice collection rate (W6)', value: `${Math.round((invoiceTrend[5].v / dealsTrend[5].v) * 100)}%`, color: '#FF9B52' },
                { label: 'Lead growth W1→W6', value: `+${Math.round(((leadsTrend[5].v - leadsTrend[0].v) / leadsTrend[0].v) * 100)}%`, color: '#2BC155' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <p style={{ fontSize: 10, color: '#B1B1BE' }}>{s.label}: <strong style={{ color: '#374557' }}>{s.value}</strong></p>
                </div>
              ))}
            </div>
          </div>

          {/* Tickets + Product perf */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ ...card }}>
              <SectionHeader title="Support Ticket Trend" sub="Open vs resolved by week" />
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ticketsTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="open"     name="Open"     stroke="#FF5353" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#2BC155" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...card }}>
              <SectionHeader title="Product Performance" sub="Revenue by product type" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...productPerf].sort((a, b) => b.revenue - a.revenue).map(p => {
                  const pct = Math.round((p.revenue / totalRevenue) * 100)
                  return (
                    <div key={p.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <p style={{ fontSize: 11, color: '#374557' }}>{p.name}</p>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{fmt(p.revenue, symbol, currency)}</p>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                        <div className="crm-bar-fill" style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: 'linear-gradient(90deg,#5D78FF,#8B5CF6)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          SALES TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'sales' && (
        <>
          {/* PDF Table 5.2.1 style — product accuracy */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>Table 2.1: Product Revenue Accuracy — vs Target</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Accuracy = 100 − |((Actual − Target) / Target) × 100|</p>
              </div>
              <div style={{ padding: '6px 12px', borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={11} style={{ color: '#5D78FF' }} />
                <p style={{ fontSize: 10, fontWeight: 700, color: '#5D78FF' }}>
                  Overall: {Math.round(productAccuracy.reduce((s, p) => s + (100 - Math.abs(((p.actual - p.target) / p.target) * 100)), 0) / productAccuracy.length)}% accuracy
                </p>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F9FF' }}>
                  {['Product / Service', 'Revenue Target', 'Actual Revenue', '% of Portfolio', 'vs Target', 'Accuracy'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#374557', letterSpacing: 0.4, borderBottom: '2px solid #F0F1F5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productAccuracy.map((p, i) => {
                  const pctOfPortfolio = Math.round((p.actual / productAccuracy.reduce((s, x) => s + x.actual, 0)) * 100)
                  const vsTarget       = Math.round(((p.actual - p.target) / p.target) * 100)
                  const accuracy       = Math.round(100 - Math.abs(vsTarget))
                  const ac             = accuracyColor(accuracy)
                  return (
                    <tr key={p.name} className="crm-tr-hover" style={{ borderBottom: i < productAccuracy.length - 1 ? '1px solid #F4F5F9' : 'none' }}>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#374557' }}>{p.name}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.target, symbol, currency)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.actual, symbol, currency)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 50, height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                            <div className="crm-bar-fill" style={{ height: '100%', borderRadius: 3, width: `${pctOfPortfolio}%`, background: '#5D78FF' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#374557' }}>{pctOfPortfolio}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: vsTarget >= 0 ? '#2BC155' : '#FF5353' }}>
                        {vsTarget >= 0 ? '+' : ''}{vsTarget}%
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: ac.bg, color: ac.color }}>{accuracy}%</span>
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: '#F8F9FF', borderTop: '2px solid #F0F1F5' }}>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>TOTAL</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>{fmt(prodTotalTarget, symbol, currency)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>{fmt(totalRevenue, symbol, currency)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>100%</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#2BC155' }}>
                    +{Math.round(((totalRevenue - prodTotalTarget) / prodTotalTarget) * 100)}%
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#E8EDFF', color: '#5D78FF' }}>
                      {Math.round(productAccuracy.reduce((s, p) => s + (100 - Math.abs(((p.actual - p.target) / p.target) * 100)), 0) / productAccuracy.length)}% avg
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sales funnel + Deal velocity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ ...card }}>
              <SectionHeader title="Sales Funnel" sub="Lead-to-close conversion" />
              <ResponsiveContainer width="100%" height={220}>
                <FunnelChart>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList position="right" fill="#374557" stroke="none" dataKey="name" style={{ fontSize: 11 }} />
                    <LabelList position="center" fill="#fff" stroke="none" dataKey="value" style={{ fontSize: 11, fontWeight: 700 }} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
                {[
                  { label: 'Conversion', value: `${Math.round((funnelData[4].value / funnelData[0].value) * 100)}%` },
                  { label: 'Drop-off',   value: `${funnelData[0].value - funnelData[4].value}` },
                  { label: 'Avg Cycle',  value: '32 days' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#374557' }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...card }}>
              <SectionHeader title="Deal Velocity" sub="Avg days per stage" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={velocityData} layout="vertical" margin={{ top: 4, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} unit=" d" />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: '#374557' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip formatter={(v) => `${v} days`} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                  <Bar dataKey="days" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 10, color: '#B1B1BE', textAlign: 'center', marginTop: 4 }}>
                Total avg cycle: <strong style={{ color: '#374557' }}>31.6 days</strong>
              </p>
            </div>
          </div>

          {/* Geographic performance */}
          <div style={{ ...card }}>
            <SectionHeader
              title="Geographic Performance"
              sub="Revenue by region"
              action={<span style={{ fontSize: 10, color: '#B1B1BE', display: 'flex', alignItems: 'center', gap: 4 }}><Map size={11} />UK regions</span>}
            />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  {['Region', 'Leads', 'Deals', 'Revenue', 'Growth', 'Conversion'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, color: '#B1B1BE', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {geoData.map((g, i) => {
                  const conv = Math.round((g.deals / g.leads) * 100)
                  return (
                    <tr key={g.region} className="crm-tr-hover" style={{ borderBottom: i < geoData.length - 1 ? '1px solid #F4F5F9' : 'none' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#374557' }}>{g.region}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374557' }}>{g.leads}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374557' }}>{g.deals}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{fmt(g.revenue, symbol, currency)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: g.growth >= 0 ? '#2BC155' : '#FF5353', display: 'flex', alignItems: 'center', gap: 3 }}>
                          {g.growth >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(g.growth)}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                            <div className="crm-bar-fill" style={{ height: '100%', borderRadius: 3, width: `${conv}%`, background: '#5D78FF' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#374557', minWidth: 28 }}>{conv}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Activity heatmap */}
          <div style={{ ...card }}>
            <SectionHeader title="Activity Heatmap" sub="Deals closed by day & hour" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    {heatmapHours.map(h => (
                      <th key={h} style={{ fontSize: 9, color: '#B1B1BE', fontWeight: 500, textAlign: 'center', paddingBottom: 4, width: 44 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapDays.map((day, di) => (
                    <tr key={day}>
                      <td style={{ fontSize: 10, color: '#B1B1BE', paddingRight: 8, fontWeight: 500 }}>{day}</td>
                      {heatmapRaw[di].map((v, hi) => (
                        <td key={hi} style={{ width: 44, height: 32, borderRadius: 6, background: heatColor(v, heatMax), textAlign: 'center', fontSize: 10, color: v / heatMax > 0.5 ? '#fff' : '#374557', fontWeight: 600, cursor: 'default', transition: 'opacity 0.15s' }}
                          title={`${day} ${heatmapHours[hi]}: ${v} activities`}
                        >{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Low</p>
              {['#EEF2FF','#C7D2FE','#A5B4FC','#818CF8','#5D78FF'].map(c => (
                <div key={c} style={{ width: 18, height: 12, borderRadius: 3, background: c }} />
              ))}
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>High</p>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          PIPELINE TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'pipeline' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ ...card }}>
              <SectionHeader title="Sales Health Radar" sub="Performance across key dimensions" />
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#F4F5F9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#374557' }} />
                  <Radar name="Score" dataKey="A" stroke="#5D78FF" fill="#5D78FF" fillOpacity={0.18} strokeWidth={2} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...card }}>
              <SectionHeader title="Pipeline Stage Breakdown" sub="Deal count & value per stage" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                {funnelData.map((f, i) => {
                  const dropPct = i === 0 ? 100 : Math.round((f.value / funnelData[0].value) * 100)
                  return (
                    <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: f.fill, flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: '#374557', width: 110, flexShrink: 0 }}>{f.name}</p>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#F4F5F9' }}>
                        <div className="crm-bar-fill" style={{ height: '100%', borderRadius: 4, width: `${dropPct}%`, background: f.fill }} />
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', width: 28, textAlign: 'right' }}>{f.value}</p>
                      <p style={{ fontSize: 10, color: '#B1B1BE', width: 36, textAlign: 'right' }}>{dropPct}%</p>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#F8F9FF', borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: '#5D78FF', fontWeight: 600 }}>
                  Overall conversion: {Math.round((funnelData[4].value / funnelData[0].value) * 100)}% · Avg deal size: {fmt(totalWon / funnelData[4].value, symbol, currency)}
                </p>
              </div>
            </div>
          </div>

          {/* PDF 5.3 style — Key Findings / Interpretation cards */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Info size={14} style={{ color: '#5D78FF' }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>5.3 — Interpretation & Key Findings</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <FindingCard
                color="#FF9B52"
                icon={AlertTriangle}
                title="Proposal → Nego Drop-off: 40%"
                body="Only 60% of Proposals advance to Negotiation. This is the highest-loss stage. Prioritise faster follow-up and personalised proposals to improve conversion here."
              />
              <FindingCard
                color="#2BC155"
                icon={CheckCircle2}
                title="SO2-equivalent: ASHP & GSHP Lead"
                body="ASHP 8kW and GSHP 12kW account for 57% of total revenue, showing stable demand. Both exceeded targets, confirming strong market positioning."
              />
              <FindingCard
                color="#5D78FF"
                icon={Zap}
                title="Yorkshire Region Outperforms"
                body="Yorkshire generated £2.45Cr — 28% of total revenue — with 14% YoY growth. Allocating more sales capacity to this region could yield outsized returns."
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FindingCard
                color="#FF5353"
                icon={AlertTriangle}
                title="Limitations: NO2-equivalent — London declining"
                body="London shows -3% growth — the only declining region. Market saturation and higher competition may explain this. Review pricing strategy and competitor activity in Greater London."
              />
              <FindingCard
                color="#8B5CF6"
                icon={TrendingUp}
                title="Smart Controller & EV Charger underperform target"
                body="These two products are 6–7% below target. Consider bundling with core ASHP/GSHP installations as add-ons to lift attachment rate without additional acquisition cost."
              />
            </div>
          </div>

          {/* Cohort retention */}
          <div style={{ ...card }}>
            <SectionHeader title="Customer Retention Cohorts" sub="% of customers retained each month after acquisition" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 3, minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 600, textAlign: 'left', padding: '4px 8px', whiteSpace: 'nowrap' }}>Cohort</th>
                    {['M+0','M+1','M+2','M+3','M+4','M+5'].map(h => (
                      <th key={h} style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 600, textAlign: 'center', padding: '4px 8px', width: 70 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortData.map(row => (
                    <tr key={row.cohort}>
                      <td style={{ fontSize: 11, color: '#374557', fontWeight: 500, padding: '4px 8px', whiteSpace: 'nowrap' }}>{row.cohort}</td>
                      {[row.m0, row.m1, row.m2, row.m3, row.m4, row.m5].map((v, i) => (
                        <td key={i} style={{ background: cohortColor(v), borderRadius: 6, textAlign: 'center', padding: '6px 4px', fontSize: 11, fontWeight: 600, color: v && v >= 50 ? '#166534' : (v ? '#374557' : 'transparent') }}>
                          {v !== undefined ? `${v}%` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Retention</p>
              {['#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e'].map(c => <div key={c} style={{ width: 18, height: 12, borderRadius: 3, background: c }} />)}
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>High</p>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          TEAM TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'team' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            {/* Leaderboard */}
            <div style={{ ...card }}>
              <SectionHeader title="Rep Leaderboard" sub="Ranked by revenue closed this year" action={
                <span style={{ fontSize: 10, color: '#B1B1BE', display: 'flex', alignItems: 'center', gap: 4 }}><Award size={11} />This Year</span>
              } />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...repLeaderboard].sort((a, b) => b.revenue - a.revenue).map((rep, i) => (
                  <div key={rep.name} className="crm-tr-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: i === 0 ? '#FFFBEB' : '#FAFBFF', border: `1px solid ${i === 0 ? '#FDE68A' : '#F0F1F5'}` }}>
                    <div style={{ width: 22, fontSize: 12, fontWeight: 700, color: i === 0 ? '#F59E0B' : '#B1B1BE', flexShrink: 0 }}>#{i + 1}</div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: rep.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{rep.name[0]}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{rep.name}</p>
                      <p style={{ fontSize: 10, color: '#B1B1BE' }}>{rep.deals} deals closed</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{fmt(rep.revenue, symbol, currency)}</p>
                      <p style={{ fontSize: 10, color: rep.quota >= 70 ? '#2BC155' : '#FF9B52' }}>{rep.quota}% quota</p>
                    </div>
                    <div style={{ width: 50 }}>
                      <div style={{ height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                        <div className="crm-bar-fill" style={{ height: '100%', borderRadius: 3, width: `${rep.quota}%`, background: rep.quota >= 70 ? '#2BC155' : '#FF9B52' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Team radar */}
            <div style={{ ...card }}>
              <SectionHeader title="Team Performance" sub="Avg score across metrics" />
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#F4F5F9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#374557' }} />
                  <Radar name="Team" dataKey="A" stroke="#2BC155" fill="#2BC155" fillOpacity={0.15} strokeWidth={2} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Avg deals/rep', value: `${(repLeaderboard.reduce((s,r) => s + r.deals, 0) / repLeaderboard.length).toFixed(1)}` },
                  { label: 'Avg quota att.', value: `${Math.round(repLeaderboard.reduce((s,r) => s + r.quota, 0) / repLeaderboard.length)}%` },
                  { label: 'Top performer',  value: [...repLeaderboard].sort((a,b) => b.revenue - a.revenue)[0].name.split(' ')[0] },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#FAFBFF', borderRadius: 8 }}>
                    <p style={{ fontSize: 11, color: '#B1B1BE' }}>{s.label}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PDF Table 5.2.2 style — rep forecast accuracy */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>Table 3.1: Rep Forecast Accuracy — Actual vs Expected Deals</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Expected = deals implied by quota attainment target of 100%</p>
              </div>
              <div style={{ padding: '6px 12px', borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={11} style={{ color: '#5D78FF' }} />
                <p style={{ fontSize: 10, fontWeight: 700, color: '#5D78FF' }}>Team Accuracy: {avgAccuracy}%</p>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F9FF' }}>
                  {['Sales Rep', 'Expected Deals', 'Actual Deals', 'Absolute Error', '% Error', 'Accuracy', 'Quota'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#374557', letterSpacing: 0.4, borderBottom: '2px solid #F0F1F5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repAccuracy.map((r, i) => {
                  const ac = accuracyColor(r.accuracy)
                  return (
                    <tr key={r.name} className="crm-tr-hover" style={{ borderBottom: i < repAccuracy.length - 1 ? '1px solid #F4F5F9' : 'none' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: r.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{r.name[0]}</span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{r.name}</p>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{r.forecast}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#374557' }}>{r.deals}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: r.absErr > 2 ? '#FF5353' : '#374557' }}>{r.absErr}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: r.pctErr <= 15 ? '#2BC155' : r.pctErr <= 30 ? '#FF9B52' : '#FF5353' }}>{r.pctErr}%</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: ac.bg, color: ac.color }}>{r.accuracy}%</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 50, height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                            <div className="crm-bar-fill" style={{ height: '100%', borderRadius: 3, width: `${r.quota}%`, background: r.quota >= 70 ? '#2BC155' : '#FF9B52' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#374557' }}>{r.quota}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: '#F8F9FF', borderTop: '2px solid #F0F1F5' }}>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>OVERALL MAPE</td>
                  <td colSpan={3} style={{ padding: '11px 14px', fontSize: 11, color: '#B1B1BE' }}>—</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>
                    {Math.round(repAccuracy.reduce((s, r) => s + r.pctErr, 0) / repAccuracy.length)}%
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#E8EDFF', color: '#5D78FF' }}>
                      {avgAccuracy}% accuracy
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#374557' }}>
                    {Math.round(repLeaderboard.reduce((s, r) => s + r.quota, 0) / repLeaderboard.length)}% avg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          FORECAST TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'forecast' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div style={{ ...card }}>
              <SectionHeader
                title="Revenue Forecast — Jun–Sep 2026"
                sub="3-scenario ensemble model (Conservative / Base / Optimistic)"
                action={<span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#E8EDFF', color: '#5D78FF', fontWeight: 600 }}>AI-assisted</span>}
              />
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={forecastDisp} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="optG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2BC155" stopOpacity={0.15} /><stop offset="100%" stopColor="#2BC155" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="baseG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5D78FF" stopOpacity={0.15} /><stop offset="100%" stopColor="#5D78FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="consG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF9B52" stopOpacity={0.15} /><stop offset="100%" stopColor="#FF9B52" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <Tooltip formatter={(v) => `${symbol}${Math.round(Number(v)).toLocaleString()}`} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Optimistic"   stroke="#2BC155" fill="url(#optG)"  strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Base"         stroke="#5D78FF" fill="url(#baseG)" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                  <Area type="monotone" dataKey="Conservative" stroke="#FF9B52" fill="url(#consG)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...card }}>
              <SectionHeader title="Forecast Summary" sub="Projected full-year outcome" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Optimistic',   value: forecastData.reduce((s,f) => s + f.optimistic,   revenueYTD), color: '#2BC155', bg: '#E7FAF0' },
                  { label: 'Base Case',    value: forecastData.reduce((s,f) => s + f.base,          revenueYTD), color: '#5D78FF', bg: '#E8EDFF' },
                  { label: 'Conservative', value: forecastData.reduce((s,f) => s + f.conservative,  revenueYTD), color: '#FF9B52', bg: '#FFF5EE' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '14px 16px', borderRadius: 10, background: s.bg }}>
                    <p style={{ fontSize: 10, color: s.color, fontWeight: 600, marginBottom: 4 }}>{s.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#374557' }}>{fmt(s.value, symbol, currency)}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 2 }}>Full-year FY2026</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#FAFBFF', borderRadius: 10, border: '1px solid #F0F1F5' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Key Assumptions</p>
                {['Pipeline converts at 22%', 'Jun quota met in full', 'No new large enterprise wins'].map(a => (
                  <p key={a} style={{ fontSize: 10, color: '#B1B1BE', marginTop: 3 }}>· {a}</p>
                ))}
              </div>
            </div>
          </div>

          {/* MoM growth */}
          <div style={{ ...card }}>
            <SectionHeader title="Month-over-Month Growth" sub="Actual revenue vs prior month" />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={monthly.filter(m => m.actual > 0).map((m, i, arr) => ({
                  m: m.m,
                  Growth: i === 0 ? 0 : Math.round(((m.actual - arr[i - 1].actual) / arr[i - 1].actual) * 100),
                }))}
                margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                <Bar dataKey="Growth" radius={[4, 4, 0, 0]} fill="#5D78FF"
                  label={{ position: 'top', fontSize: 9, fill: '#B1B1BE', formatter: (v: unknown) => { const n = Number(v); return n === 0 ? '' : `${n > 0 ? '+' : ''}${n}%` } }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* PDF Ch.6 style — Conclusion & Outlook card */}
          <div style={{ ...card, background: 'linear-gradient(135deg,#f8f9ff 0%,#fff 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={14} style={{ color: '#5D78FF' }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>Chapter 6 — Conclusion & Outlook</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 1 }}>Summary of FY2026 performance and strategic direction</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: '#374557', lineHeight: 1.7, marginBottom: 14 }}>
                  ASPCV achieved a <strong>YTD revenue of {fmt(revenueYTD, symbol, currency)}</strong> across Jan–May 2026,
                  outperforming the aggregate target by approximately <strong>+12%</strong>. The ensemble of product lines —
                  led by ASHP 8kW and GSHP 12kW — demonstrates robust demand for heat pump solutions in the UK clean-energy market.
                  The pipeline converts at <strong>22%</strong> overall, with a base-case full-year projection of {fmt(forecastData.reduce((s,f) => s + f.base, revenueYTD), symbol, currency)}.
                </p>

                <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', marginBottom: 8 }}>6.3 — Contributions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {[
                    { icon: CheckCircle2, color: '#2BC155', text: 'Strong ASHP/GSHP revenue — 57% of total — validates core product strategy' },
                    { icon: TrendingUp,   color: '#5D78FF', text: 'Yorkshire & Birmingham regions show double-digit growth, expanding geographic footprint' },
                    { icon: Award,        color: '#FF9B52', text: 'Team quota attainment averaging 67% — above industry median of 55% for clean-tech sales' },
                  ].map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <b.icon size={12} style={{ color: b.color, marginTop: 2, flexShrink: 0 }} />
                      <p style={{ fontSize: 11, color: '#374557', lineHeight: 1.5 }}>{b.text}</p>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', marginBottom: 8 }}>6.4 — Strategic Opportunities (Future Work)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    'Improve Proposal → Negotiation conversion by 15% via structured follow-up cadence',
                    'Bundle Smart Controller & EV Charger with core ASHP installs to lift attachment rate',
                    'Expand Edinburgh territory — 31% growth rate, underserved relative to Yorkshire',
                    'Review London strategy — only region with negative growth (-3%)',
                  ].map(t => (
                    <p key={t} style={{ fontSize: 10, color: '#B1B1BE', lineHeight: 1.5 }}>· {t}</p>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', marginBottom: 2 }}>5.5 — Limitations</p>
                {[
                  { color: '#FF5353', text: 'Mortality-equivalent: London pipeline at risk — monitor closely' },
                  { color: '#FF9B52', text: 'NO2-equivalent: Smart Controller & EV Charger below target — investigate demand drivers' },
                  { color: '#F59E0B', text: 'Forecast accuracy ~67% for new products — limited historical data' },
                  { color: '#5D78FF', text: 'Model assumes current pipeline conversion rate holds — subject to macro risk' },
                ].map((lim, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: `${lim.color}08`, borderLeft: `3px solid ${lim.color}` }}>
                    <p style={{ fontSize: 10, color: '#374557', lineHeight: 1.5 }}>{lim.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
