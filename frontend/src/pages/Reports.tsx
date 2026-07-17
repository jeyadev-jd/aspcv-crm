import { useState } from 'react'
import type React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  Edit2, Check, Download, TrendingUp, TrendingDown, Target,
  Briefcase, DollarSign, Award, Building2, FileText, BarChart2,
} from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import { useAuthStore } from '@/lib/authStore'
import {
  useRevenueReport, useSetRevenueTarget, usePipelineReport, useFunnelReport,
  useLeaderboardReport, useProductPerformanceReport, useTicketsTrendReport,
  useDepartmentsReport, useReportsSummary,
} from '@/hooks/useReports'

const INR_RATE = 83.5

const STAGE_COLOR: Record<string, string> = {
  LeadIn: '#5D78FF', Proposal: '#FF9B52', Negotiation: '#F59E0B', OrderWon: '#2BC155', OrderLost: '#FF5353',
}
const STAGE_LABEL: Record<string, string> = {
  LeadIn: 'Lead In', Proposal: 'Proposal', Negotiation: 'Negotiation', OrderWon: 'Closed Won', OrderLost: 'Closed Lost',
}
const FUNNEL_LABEL: Record<string, string> = {
  Enquiry: 'Enquiry', ProspectiveLead: 'Prospective Lead', ProjectHold: 'Project Hold',
  Hibernated: 'Hibernated', OrderWon: 'Order Won', OrderLost: 'Order Lost',
}

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

function attainColor(pct: number): { bg: string; color: string; label: string } {
  if (pct >= 100) return { bg: '#E7FAF0', color: '#2BC155', label: 'On Target' }
  if (pct >= 85)  return { bg: '#FFF5EE', color: '#FF9B52', label: 'Near' }
  if (pct === 0)  return { bg: '#F4F5F9', color: '#8C8C8C', label: 'No Target Set' }
  return { bg: '#FFF3F3', color: '#FF5353', label: 'Below' }
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{title}</p>
      {sub && <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub: string; color: string
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>
}) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: 11, color: '#B1B1BE', fontWeight: 500 }}>{label}</p>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ fontSize: 10, color: '#B1B1BE' }}>{sub}</p>
    </div>
  )
}

const DATE_RANGE_OPTIONS = [3, 6, 12]

export default function Reports() {
  const { currency, symbol } = useCurrency()
  const can = useAuthStore(s => s.can)
  const canEditTargets = can('financial', 'edit')

  const [months, setMonths] = useState(6)
  const [editTarget, setEditTarget] = useState<{ month: number; year: number } | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'team' | 'departments'>('overview')

  const { data: summary, isLoading: loadingSummary } = useReportsSummary()
  const { data: revenue = [], isLoading: loadingRevenue } = useRevenueReport(months)
  const { data: pipeline = [], isLoading: loadingPipeline } = usePipelineReport()
  const { data: funnel = [], isLoading: loadingFunnel } = useFunnelReport()
  const { data: leaderboard = [], isLoading: loadingLeaderboard } = useLeaderboardReport()
  const { data: productPerf = [], isLoading: loadingProducts } = useProductPerformanceReport()
  const { data: ticketsTrend = [], isLoading: loadingTickets } = useTicketsTrendReport(months)
  const { data: departments = [], isLoading: loadingDepartments } = useDepartmentsReport()
  const setTarget = useSetRevenueTarget()

  const isLoading = loadingSummary || loadingRevenue || loadingPipeline || loadingFunnel || loadingLeaderboard || loadingProducts || loadingTickets || loadingDepartments

  if (isLoading) return <Spinner label="Loading analytics…" />

  const toDisp = (inr: number) => currency === 'USD' ? inr / INR_RATE : inr
  const revenueTotal = summary?.revenueTotal ?? 0
  const pipelineValue = summary?.pipelineValue ?? 0
  const wonValue = summary?.wonValue ?? 0
  const winRate = summary?.winRate ?? 0

  const chartData = revenue.map(m => ({
    m: m.label,
    Target: m.target != null ? Math.round(toDisp(m.target)) : null,
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

  function startEdit(m: { month: number; year: number; target: number | null }) {
    const val = m.target != null ? (currency === 'USD' ? +(m.target / INR_RATE).toFixed(0) : m.target) : ''
    setEditTarget({ month: m.month, year: m.year })
    setTargetInput(String(val))
  }

  async function saveTarget() {
    if (!editTarget) return
    const raw = parseFloat(targetInput)
    if (!isNaN(raw) && raw > 0) {
      const inrVal = currency === 'USD' ? raw * INR_RATE : raw
      await setTarget.mutateAsync({ month: editTarget.month, year: editTarget.year, targetAmount: Math.round(inrVal) })
    }
    setEditTarget(null)
  }

  function handleExport() {
    const rows = [
      ['Month', 'Target', 'Actual', 'Variance', '% Attainment'],
      ...revenue.map(m => {
        const pct = m.target ? Math.round((m.actual / m.target) * 100) : 0
        return [m.label, m.target != null ? Math.round(toDisp(m.target)) : '', Math.round(toDisp(m.actual)), m.target != null ? Math.round(toDisp(m.actual - m.target)) : '', pct ? `${pct}%` : 'N/A']
      }),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'aspcv_revenue.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'overview',    label: 'Overview' },
    { key: 'pipeline',    label: 'Pipeline & Funnel' },
    { key: 'team',        label: 'Team & Products' },
    { key: 'departments', label: 'Departments' },
  ]

  const funnelPieData = funnel.map(f => ({ name: FUNNEL_LABEL[f.status] ?? f.status, value: f.count }))
  const pipelineTotal = pipeline.reduce((s, p) => s + p.value, 0)

  return (
    <div className="crm-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...card, padding: '16px 20px', background: 'linear-gradient(135deg,#1e3a5f 0%,#2d5a8e 100%)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={16} style={{ color: '#fff' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>ASPCV CRM — Analytics Report</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Live data · Last {months} months</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 10, padding: 4, border: '1px solid #F0F1F5' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: activeTab === t.key ? '#5D78FF' : 'transparent', color: activeTab === t.key ? '#fff' : '#B1B1BE' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {DATE_RANGE_OPTIONS.map(m => (
              <button key={m} onClick={() => setMonths(m)}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #F0F1F5', background: months === m ? '#EEF2FF' : '#fff', color: months === m ? '#5D78FF' : '#374557', cursor: 'pointer' }}>
                {m}mo
              </button>
            ))}
          </div>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #5D78FF', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
            <Download size={12} />Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
        <KpiCard label="Revenue (Paid)" value={fmt(revenueTotal, symbol, currency)} sub="All time, paid invoices" color="#2BC155" icon={DollarSign} />
        <KpiCard label="Active Pipeline" value={fmt(pipelineValue, symbol, currency)} sub="Excl. closed deals" color="#5D78FF" icon={Briefcase} />
        <KpiCard label="Closed Won" value={fmt(wonValue, symbol, currency)} sub="All time" color="#8B5CF6" icon={Target} />
        <KpiCard label="Win Rate" value={`${winRate}%`} sub="Won / total deals" color="#FF9B52" icon={TrendingUp} />
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>Monthly Revenue vs Target</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{canEditTargets ? 'Click pencil icon to set monthly targets' : 'Revenue from paid invoices'}</p>
              </div>
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
                  {revenue.map(m => {
                    const pct = m.target ? Math.round((m.actual / m.target) * 100) : 0
                    const variance = m.target != null ? m.actual - m.target : null
                    const att = attainColor(pct)
                    const isEditing = editTarget?.month === m.month && editTarget?.year === m.year
                    return (
                      <tr key={`${m.year}-${m.month}`} style={{ borderBottom: '1px solid #F4F5F9' }}>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{m.label} {m.year}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input autoFocus value={targetInput} onChange={e => setTargetInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditTarget(null) }}
                                style={{ width: 80, fontSize: 11, border: '1px solid #5D78FF', borderRadius: 4, padding: '3px 6px', outline: 'none' }} />
                              <button onClick={saveTarget} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BC155', padding: 0 }}><Check size={11} /></button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {m.target != null ? fmt(m.target, symbol, currency) : <span style={{ color: '#B1B1BE' }}>Not set</span>}
                              {canEditTargets && <button onClick={() => startEdit(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4C4CF', padding: 0 }}><Edit2 size={9} /></button>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#374557', fontVariantNumeric: 'tabular-nums' }}>
                          {m.actual > 0 ? fmt(m.actual, symbol, currency) : <span style={{ color: '#B1B1BE' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {variance != null ? (
                            <span style={{ color: variance >= 0 ? '#2BC155' : '#FF5353', fontWeight: 600 }}>
                              {variance >= 0 ? '+' : ''}{fmt(Math.abs(variance), symbol, currency)}
                            </span>
                          ) : <span style={{ color: '#B1B1BE' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {pct > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 60, height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#2BC155' : pct >= 85 ? '#FF9B52' : '#FF5353' }} />
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
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...card }}>
            <SectionHeader title="Revenue Trend" sub={`Actual paid revenue, last ${months} months`} />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                <Tooltip formatter={(v: number) => `${symbol}${Math.round(Number(v)).toLocaleString()}`} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Target" fill="#E8EDFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#5D78FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {activeTab === 'pipeline' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ ...card }}>
              <SectionHeader title="Pipeline by Stage" sub="Active deal value" />
              {pipeline.length === 0 ? <EmptyState icon={Briefcase} title="No deals yet" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pipeline.map(p => ({ name: STAGE_LABEL[p.stage] ?? p.stage, value: p.value }))} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#374557' }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={(v: number) => fmt(Number(v), symbol, currency)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {pipeline.map((p, i) => <Cell key={i} fill={STAGE_COLOR[p.stage] ?? '#5D78FF'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {pipelineTotal > 0 && <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 8 }}>Total pipeline value: <strong style={{ color: '#374557' }}>{fmt(pipelineTotal, symbol, currency)}</strong></p>}
            </div>
            <div style={{ ...card }}>
              <SectionHeader title="Lead Funnel" sub="Leads by current status" />
              {funnel.length === 0 ? <EmptyState icon={BarChart2} title="No leads yet" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={funnelPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name}: ${e.value}`}>
                      {funnelPieData.map((_, i) => <Cell key={i} fill={['#5D78FF', '#FF9B52', '#8B5CF6', '#8C8C8C', '#2BC155', '#FF5353'][i % 6]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={{ ...card }}>
            <SectionHeader title="Support Ticket Trend" sub={`Weekly open vs resolved, last ${months} weeks`} />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ticketsTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="open" stroke="#FF5353" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resolved" stroke="#2BC155" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {activeTab === 'team' && (
        <>
          <div style={{ ...card }}>
            <SectionHeader title="Rep Leaderboard" sub="Ranked by won deal value" />
            {leaderboard.length === 0 ? <EmptyState icon={Award} title="No deal owners yet" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: '#F8F9FF' }}>
                      {['Rep', 'Role', 'Won Deals', 'Won Value', 'Total Deals'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#374557', borderBottom: '2px solid #F0F1F5' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((r, i) => (
                      <tr key={r.userId} style={{ borderBottom: '1px solid #F4F5F9' }}>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{i === 0 && '🏆 '}{r.name}</td>
                        <td style={{ padding: '11px 14px', fontSize: 11, color: '#B1B1BE' }}>{r.role}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{r.wonCount}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#2BC155' }}>{fmt(r.wonValue, symbol, currency)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{r.totalDeals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ ...card }}>
            <SectionHeader title="Top Products / Line Items" sub="By revenue from paid invoices" />
            {productPerf.length === 0 ? <EmptyState icon={BarChart2} title="No paid invoice line items yet" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={productPerf} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#374557' }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip formatter={(v: number) => fmt(Number(v), symbol, currency)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }} />
                  <Bar dataKey="revenue" fill="#5D78FF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {activeTab === 'departments' && (
        <div style={{ ...card }}>
          <SectionHeader title="Department Performance" sub="Leads, deals, pipeline value, and projects per department" />
          {departments.length === 0 ? <EmptyState icon={Building2} title="No departments configured" subtitle="Add departments in User Management to see per-department analytics." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ background: '#F8F9FF' }}>
                    {['Department', 'Leads', 'Deals', 'Pipeline Value', 'Projects', 'Won Deals', 'Won Value'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#374557', borderBottom: '2px solid #F0F1F5', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.departmentId} style={{ borderBottom: '1px solid #F4F5F9' }}>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{d.departmentName}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{d.leadCount}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{d.dealCount}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#5D78FF' }}>{fmt(d.pipelineValue, symbol, currency)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{d.projectCount}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{d.wonDealCount}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#2BC155' }}>{fmt(d.wonValue, symbol, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
