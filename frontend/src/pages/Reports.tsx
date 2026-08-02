import { useState, useMemo } from 'react'
import type React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  Edit2, Check, Download, TrendingUp, Target, Briefcase, DollarSign, Award,
  Building2, FileText, BarChart2, LifeBuoy, FolderKanban, CalendarRange, Info,
} from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import { useAuthStore } from '@/lib/authStore'
import {
  useRevenueReport, useSetRevenueTarget, usePipelineReport, useFunnelReport,
  useLeaderboardReport, useProductPerformanceReport, useTicketsTrendReport,
  useDepartmentsReport, useReportsSummary, useTicketReport, useProjectReport,
  usePipelineValueReport,
} from '@/hooks/useReports'
import type { ReportRange } from '@/hooks/useReports'

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
const PRIORITY_COLOR: Record<string, string> = {
  Critical: '#cc0000', High: '#FF5353', Medium: '#FF9B52', Low: '#2BC155',
}
const SERIES = ['#5D78FF', '#FF9B52', '#8B5CF6', '#2BC155', '#FF5353', '#0EA5E9', '#F59E0B', '#8C8C8C']

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1px solid #F0F1F5',
  padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

function hrs(h: number | null): string {
  if (h == null) return '—'
  return h >= 24 ? `${(h / 24).toFixed(1)}d` : `${h}h`
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

/**
 * Shown wherever a metric cannot be computed. Distinguishes "nothing recorded
 * in this window" from "some records exist but too few to be meaningful" —
 * rendering a 0 in either case would read as a real result.
 */
function NoData({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 4px', color: '#B1B1BE' }}>
      <Info size={15} style={{ flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#8C8C8C' }}>{title}</p>
        {detail && <p style={{ fontSize: 11, marginTop: 2 }}>{detail}</p>}
      </div>
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

const PRESETS = [3, 6, 12]
type TabKey = 'overview' | 'pipeline' | 'projects' | 'support' | 'team' | 'departments'

function currentMonthValue(offsetMonths = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function labelMonth(value: string): string {
  const [y, m] = value.split('-').map(Number)
  if (!y || !m) return value
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export default function Reports() {
  const { currency, symbol } = useCurrency()
  const can = useAuthStore(s => s.can)
  const canEditTargets = can('financial', 'edit')

  const [preset, setPreset] = useState<number | 'custom'>(6)
  const [customFrom, setCustomFrom] = useState(currentMonthValue(-5))
  const [customTo, setCustomTo] = useState(currentMonthValue(0))
  const [editTarget, setEditTarget] = useState<{ month: number; year: number } | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const range: ReportRange = useMemo(
    () => (preset === 'custom' ? { from: customFrom, to: customTo } : { months: preset }),
    [preset, customFrom, customTo],
  )
  const rangeLabel = preset === 'custom'
    ? `${labelMonth(customFrom)} — ${labelMonth(customTo)}`
    : `Last ${preset} months`

  const { data: summary, isLoading: loadingSummary } = useReportsSummary(range)
  const { data: revenue = [], isLoading: loadingRevenue } = useRevenueReport(range)
  const { data: pipeline = [], isLoading: loadingPipeline } = usePipelineReport(range)
  const { data: funnel = [], isLoading: loadingFunnel } = useFunnelReport(range)
  const { data: pipelineValue2, isLoading: loadingPipelineValue } = usePipelineValueReport(range)
  const { data: leaderboard = [], isLoading: loadingLeaderboard } = useLeaderboardReport(range)
  const { data: productPerf = [], isLoading: loadingProducts } = useProductPerformanceReport(range)
  const { data: ticketsTrend = [], isLoading: loadingTrend } = useTicketsTrendReport(range)
  const { data: ticketReport, isLoading: loadingTickets } = useTicketReport(range)
  const { data: projectReport, isLoading: loadingProjects } = useProjectReport(range)
  const { data: departments = [], isLoading: loadingDepartments } = useDepartmentsReport(range)
  const setTarget = useSetRevenueTarget()

  const isLoading = loadingSummary || loadingRevenue || loadingPipeline || loadingFunnel || loadingPipelineValue ||
    loadingLeaderboard || loadingProducts || loadingTrend || loadingTickets || loadingProjects || loadingDepartments

  if (isLoading) return <Spinner label="Loading analytics…" />

  const toDisp = (inr: number) => currency === 'USD' ? inr / INR_RATE : inr
  const revenueTotal = summary?.revenueTotal ?? 0
  const pipelineValue = summary?.pipelineValue ?? 0
  const wonValue = summary?.wonValue ?? 0

  const chartData = revenue.map(m => ({
    m: m.label,
    Target: m.target != null ? Math.round(toDisp(m.target)) : null,
    Actual: Math.round(toDisp(m.actual)),
  }))
  const revenueHasData = revenue.some(m => m.actual > 0 || m.target != null)

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

  function download(name: string, rows: (string | number)[][]) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  /** Exports whatever the active tab is showing, not just revenue. */
  function handleExport() {
    const stamp = preset === 'custom' ? `${customFrom}_${customTo}` : `${preset}mo`
    if (activeTab === 'support' && ticketReport) {
      download(`aspcv_tickets_${stamp}.csv`, [
        ['Metric', 'Value'],
        ['Total tickets', ticketReport.total],
        ['Resolved', ticketReport.resolvedCount],
        ['Overdue', ticketReport.overdue],
        ['Unassigned', ticketReport.unassigned],
        ['SLA compliance %', ticketReport.slaCompliancePct ?? 'Not enough data'],
        ['Avg resolution hours', ticketReport.avgResolutionHours ?? 'Not enough data'],
        [],
        ['Assignee', 'Total', 'Resolved', 'Breached'],
        ...ticketReport.byAssignee.map(a => [a.name, a.total, a.resolved, a.breached]),
      ])
      return
    }
    if (activeTab === 'projects' && projectReport) {
      download(`aspcv_projects_${stamp}.csv`, [
        ['Metric', 'Value'],
        ['Total projects', projectReport.total],
        ['Active', projectReport.activeCount],
        ['Completed', projectReport.completedCount],
        ['On-time %', projectReport.onTimePct ?? 'Not enough data'],
        ['Total budget', projectReport.totalBudget],
        ['Total spend', projectReport.totalSpend],
        ['Over budget count', projectReport.overBudgetCount],
        [],
        ['Project', 'Budget', 'Spend', 'Over by'],
        ...projectReport.topOverBudget.map(p => [p.title, p.budget, p.spend, p.overBy]),
      ])
      return
    }
    if (activeTab === 'pipeline' && pipelineValue2) {
      download(`aspcv_pipeline_${stamp}.csv`, [
        ['Metric', 'Value'],
        ['Open deals', pipelineValue2.openCount],
        ['Open pipeline value', pipelineValue2.openValue],
        ['Weighted value', pipelineValue2.weightedValue],
        ['Avg deal size', pipelineValue2.avgDealSize ?? 'No open deals'],
        ['Won value', pipelineValue2.wonValue],
        ['Lost value', pipelineValue2.lostValue],
        [],
        ['Stage', 'Deals', 'Value', 'Weighted', 'Share %'],
        ...pipelineValue2.byStage.map(s => [STAGE_LABEL[s.stage] ?? s.stage, s.count, s.value, Math.round(s.weighted), s.sharePct]),
        [],
        ['Month', 'Created', 'Won', 'Lost'],
        ...pipelineValue2.trend.map(t => [t.label, t.created, t.won, t.lost]),
      ])
      return
    }
    if (activeTab === 'departments') {
      download(`aspcv_departments_${stamp}.csv`, [
        ['Department', 'Leads', 'Deals', 'Pipeline Value', 'Projects', 'Won Deals', 'Won Value'],
        ...departments.map(d => [d.departmentName, d.leadCount, d.dealCount, d.pipelineValue, d.projectCount, d.wonDealCount, d.wonValue]),
      ])
      return
    }
    if (activeTab === 'team') {
      download(`aspcv_team_${stamp}.csv`, [
        ['Rep', 'Role', 'Won Deals', 'Won Value', 'Total Deals'],
        ...leaderboard.map(r => [r.name, r.role, r.wonCount, r.wonValue, r.totalDeals]),
      ])
      return
    }
    download(`aspcv_revenue_${stamp}.csv`, [
      ['Month', 'Target', 'Actual', 'Variance', '% Attainment'],
      ...revenue.map(m => {
        const pct = m.target ? Math.round((m.actual / m.target) * 100) : 0
        return [m.label, m.target != null ? Math.round(toDisp(m.target)) : '', Math.round(toDisp(m.actual)),
          m.target != null ? Math.round(toDisp(m.actual - m.target)) : '', pct ? `${pct}%` : 'N/A']
      }),
    ])
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview',    label: 'Overview' },
    { key: 'pipeline',    label: 'Pipeline & Funnel' },
    { key: 'projects',    label: 'Projects' },
    { key: 'support',     label: 'Support' },
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
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Live data · {rangeLabel}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 10, padding: 4, border: '1px solid #F0F1F5', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: activeTab === t.key ? '#5D78FF' : 'transparent', color: activeTab === t.key ? '#fff' : '#B1B1BE' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PRESETS.map(m => (
              <button key={m} onClick={() => setPreset(m)}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #F0F1F5', background: preset === m ? '#EEF2FF' : '#fff', color: preset === m ? '#5D78FF' : '#374557', cursor: 'pointer' }}>
                {m}mo
              </button>
            ))}
            <button onClick={() => setPreset('custom')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #F0F1F5', background: preset === 'custom' ? '#EEF2FF' : '#fff', color: preset === 'custom' ? '#5D78FF' : '#374557', cursor: 'pointer' }}>
              <CalendarRange size={12} />Custom
            </button>
          </div>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #5D78FF', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
            <Download size={12} />Export CSV
          </button>
        </div>
      </div>

      {preset === 'custom' && (
        <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>Month & year range</span>
          <label style={{ fontSize: 11, color: '#B1B1BE', display: 'flex', alignItems: 'center', gap: 6 }}>
            From
            <input type="month" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none' }} />
          </label>
          <label style={{ fontSize: 11, color: '#B1B1BE', display: 'flex', alignItems: 'center', gap: 6 }}>
            To
            <input type="month" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none' }} />
          </label>
          <span style={{ fontSize: 10, color: '#C4C4CF' }}>Both months are included. Maximum 60 months.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
        <KpiCard label="Revenue (Paid)" value={fmt(revenueTotal, symbol, currency)}
          sub={summary?.invoiceCount ? `${summary.invoiceCount} paid invoices` : 'No paid invoices in range'} color="#2BC155" icon={DollarSign} />
        <KpiCard label="Active Pipeline" value={fmt(pipelineValue, symbol, currency)} sub="Excl. closed deals" color="#5D78FF" icon={Briefcase} />
        <KpiCard label="Closed Won" value={fmt(wonValue, symbol, currency)} sub="In selected range" color="#8B5CF6" icon={Target} />
        <KpiCard label="Win Rate" value={summary?.winRate != null ? `${summary.winRate}%` : '—'}
          sub={summary?.winRate == null ? 'No deals created in range' : `Of ${summary.dealCount} deals`} color="#FF9B52" icon={TrendingUp} />
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
            {revenue.length === 0 ? (
              <NoData title="No months in the selected range" detail="Widen the date range to see revenue." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: '#F8F9FF' }}>
                      {['Month', 'Target', 'Actual Revenue', 'Variance', '% Attainment', 'Status'].map(h => (
                        <th key={h} style={th}>{h}</th>
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
            )}
          </div>

          <div style={{ ...card }}>
            <SectionHeader title="Revenue Trend" sub={`Actual paid revenue · ${rangeLabel}`} />
            {!revenueHasData ? (
              <NoData title="No revenue recorded in this range" detail="Nothing to chart until an invoice is marked Paid." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={4} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <Tooltip formatter={(v: number) => `${symbol}${Math.round(Number(v)).toLocaleString()}`} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Target" fill="#E8EDFF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#5D78FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {activeTab === 'pipeline' && (
        <>
          {pipelineValue2 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                <KpiCard label="Open Pipeline Value" value={fmt(pipelineValue2.openValue, symbol, currency)}
                  sub={`${pipelineValue2.openCount} open deals`} color="#5D78FF" icon={Briefcase} />
                <KpiCard label="Weighted Value" value={fmt(pipelineValue2.weightedValue, symbol, currency)}
                  sub="Value × probability" color="#8B5CF6" icon={Target} />
                <KpiCard label="Avg Deal Size"
                  value={pipelineValue2.avgDealSize != null ? fmt(pipelineValue2.avgDealSize, symbol, currency) : '—'}
                  sub={pipelineValue2.avgDealSize == null ? 'No open deals' : 'Across open pipeline'}
                  color="#FF9B52" icon={BarChart2} />
                <KpiCard label="Won Value" value={fmt(pipelineValue2.wonValue, symbol, currency)} sub="Closed won in range" color="#2BC155" icon={TrendingUp} />
                <KpiCard label="Lost Value" value={fmt(pipelineValue2.lostValue, symbol, currency)} sub="Closed lost in range" color="#FF5353" icon={Target} />
              </div>

              <div style={{ ...card }}>
                <SectionHeader title="Pipeline Value by Stage" sub="Raw value, probability-weighted value, and share of open pipeline" />
                {pipelineValue2.openValue === 0 ? (
                  <NoData title="No open pipeline in this range"
                    detail="Every deal in the window is already closed won or lost." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                      <thead><tr style={{ background: '#F8F9FF' }}>{['Stage', 'Deals', 'Value', 'Weighted', 'Share'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {pipelineValue2.byStage.map(s => (
                          <tr key={s.stage} style={{ borderBottom: '1px solid #F4F5F9' }}>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${STAGE_COLOR[s.stage] ?? '#5D78FF'}18`, color: STAGE_COLOR[s.stage] ?? '#5D78FF' }}>
                                {STAGE_LABEL[s.stage] ?? s.stage}
                              </span>
                            </td>
                            <td style={td}>{s.count}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{fmt(s.value, symbol, currency)}</td>
                            <td style={{ ...td, color: '#8B5CF6', fontWeight: 600 }}>{fmt(s.weighted, symbol, currency)}</td>
                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 60, height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                                  <div style={{ height: '100%', borderRadius: 3, width: `${s.sharePct}%`, background: STAGE_COLOR[s.stage] ?? '#5D78FF' }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{s.sharePct}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: '#FAFBFF' }}>
                          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>Total</td>
                          <td style={{ ...td, fontWeight: 700 }}>{pipelineValue2.openCount}</td>
                          <td style={{ ...td, fontWeight: 700 }}>{fmt(pipelineValue2.openValue, symbol, currency)}</td>
                          <td style={{ ...td, fontWeight: 700, color: '#8B5CF6' }}>{fmt(pipelineValue2.weightedValue, symbol, currency)}</td>
                          <td style={td} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ ...card }}>
                <SectionHeader title="Pipeline Movement" sub={`Value created vs won vs lost per month · ${rangeLabel}`} />
                {pipelineValue2.trend.every(t => t.created === 0 && t.won === 0 && t.lost === 0) ? (
                  <NoData title="No deal movement in this range" detail="No deal was created, won, or lost between the selected months." />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={pipelineValue2.trend.map(t => ({
                      label: t.label,
                      Created: Math.round(toDisp(t.created)),
                      Won: Math.round(toDisp(t.won)),
                      Lost: Math.round(toDisp(t.lost)),
                    }))} barGap={3} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                      <Tooltip formatter={(v: number) => `${symbol}${Math.round(Number(v)).toLocaleString()}`} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Created" fill="#5D78FF" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Won" fill="#2BC155" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Lost" fill="#FF5353" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div style={{ ...card }}>
              <SectionHeader title="Pipeline by Stage" sub="Active deal value" />
              {pipeline.length === 0 ? (
                <NoData title="No deals created in this range" detail="Try a wider date range or add deals." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={pipeline.map(p => ({ name: STAGE_LABEL[p.stage] ?? p.stage, value: p.value }))} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#374557' }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip formatter={(v: number) => fmt(Number(v), symbol, currency)} contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {pipeline.map((p, i) => <Cell key={i} fill={STAGE_COLOR[p.stage] ?? '#5D78FF'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 8 }}>Total pipeline value: <strong style={{ color: '#374557' }}>{fmt(pipelineTotal, symbol, currency)}</strong></p>
                </>
              )}
            </div>
            <div style={{ ...card }}>
              <SectionHeader title="Lead Funnel" sub="Leads by current status" />
              {funnel.length === 0 ? (
                <NoData title="No leads created in this range" detail="Lead funnel appears once leads exist in the window." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={funnelPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name}: ${e.value}`}>
                      {funnelPieData.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'projects' && (
        projectReport == null || projectReport.total === 0 ? (
          <div style={{ ...card }}>
            <EmptyState icon={FolderKanban} title="No projects in this range"
              subtitle="No project was created between the selected months. Widen the range or create a project." />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              <KpiCard label="Projects" value={String(projectReport.total)} sub={`${projectReport.activeCount} active`} color="#5D78FF" icon={FolderKanban} />
              <KpiCard label="Completed" value={String(projectReport.completedCount)} sub="In selected range" color="#2BC155" icon={Check} />
              <KpiCard label="On-Time Delivery"
                value={projectReport.onTimePct != null ? `${projectReport.onTimePct}%` : '—'}
                sub={projectReport.onTimePct == null ? 'No completed project had a target date' : `Based on ${projectReport.onTimeSampleSize} projects`}
                color="#8B5CF6" icon={Target} />
              <KpiCard label="Over Budget" value={String(projectReport.overBudgetCount)}
                sub={projectReport.budgetedCount === 0 ? 'No project has a budget set' : `Of ${projectReport.budgetedCount} budgeted`}
                color="#FF5353" icon={TrendingUp} />
              <KpiCard label="Avg Progress" value={projectReport.avgProgress != null ? `${projectReport.avgProgress}%` : '—'}
                sub="Across all projects" color="#FF9B52" icon={BarChart2} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <div style={{ ...card }}>
                <SectionHeader title="Projects by Status" sub="Delivery stage distribution" />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={projectReport.byStatus} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                    <XAxis dataKey="status" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {projectReport.byStatus.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ ...card }}>
                <SectionHeader title="Budget vs Spend" sub="Across all projects in range" />
                {projectReport.totalBudget === 0 ? (
                  <NoData title="No budgets set" detail="Set a project budget to compare planned against actual spend." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={[{
                        name: 'All projects',
                        Budget: Math.round(toDisp(projectReport.totalBudget)),
                        Spend: Math.round(toDisp(projectReport.totalSpend)),
                      }]} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                        <Tooltip formatter={(v: number) => `${symbol}${Math.round(Number(v)).toLocaleString()}`} contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Budget" fill="#E8EDFF" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Spend" fill="#5D78FF" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 8 }}>
                      Net profit: <strong style={{ color: projectReport.totalProfit >= 0 ? '#2BC155' : '#FF5353' }}>
                        {fmt(projectReport.totalProfit, symbol, currency)}
                      </strong>
                    </p>
                  </>
                )}
              </div>
            </div>

            <div style={{ ...card }}>
              <SectionHeader title="Projects Over Budget" sub="Largest overruns first" />
              {projectReport.topOverBudget.length === 0 ? (
                <NoData title="No project is over budget"
                  detail={projectReport.budgetedCount === 0 ? 'No project has a budget set, so nothing can be compared.' : 'All budgeted projects are within their allocation.'} />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead><tr style={{ background: '#F8F9FF' }}>{['Project', 'Budget', 'Spend', 'Over By'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {projectReport.topOverBudget.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #F4F5F9' }}>
                          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{p.title}</td>
                          <td style={td}>{fmt(p.budget, symbol, currency)}</td>
                          <td style={td}>{fmt(p.spend, symbol, currency)}</td>
                          <td style={{ ...td, color: '#FF5353', fontWeight: 700 }}>+{fmt(p.overBy, symbol, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      )}

      {activeTab === 'support' && (
        ticketReport == null || ticketReport.total === 0 ? (
          <div style={{ ...card }}>
            <EmptyState icon={LifeBuoy} title="No support tickets in this range"
              subtitle="No ticket was raised between the selected months. Widen the range or raise a ticket from the Support page." />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              <KpiCard label="Tickets Raised" value={String(ticketReport.total)} sub={`${ticketReport.resolvedCount} resolved`} color="#5D78FF" icon={LifeBuoy} />
              <KpiCard label="Overdue" value={String(ticketReport.overdue)} sub={ticketReport.overdue === 0 ? 'All within SLA' : 'Past due date'} color="#FF5353" icon={Target} />
              <KpiCard label="Unassigned" value={String(ticketReport.unassigned)} sub={ticketReport.unassigned === 0 ? 'All owned' : 'Needs an owner'} color="#8B5CF6" icon={Award} />
              <KpiCard label="SLA Compliance"
                value={ticketReport.slaCompliancePct != null ? `${ticketReport.slaCompliancePct}%` : '—'}
                sub={ticketReport.slaCompliancePct == null ? 'Not enough resolved tickets' : `Based on ${ticketReport.slaSampleSize} resolved`}
                color="#2BC155" icon={Check} />
              <KpiCard label="Avg Resolution" value={hrs(ticketReport.avgResolutionHours)}
                sub={ticketReport.avgResolutionHours == null ? 'Nothing resolved yet' : 'Open to resolved'} color="#FF9B52" icon={TrendingUp} />
            </div>

            <div style={{ ...card }}>
              <SectionHeader title="Ticket Volume Trend" sub={`Opened vs resolved per month · ${rangeLabel}`} />
              {ticketsTrend.length === 0 ? (
                <NoData title="No trend data in this range" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={ticketsTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="opened" name="Opened" stroke="#FF5353" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#2BC155" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <div style={{ ...card }}>
                <SectionHeader title="By Priority" sub="Ticket mix" />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={ticketReport.byPriority.map(p => ({ name: p.priority, value: p.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e: any) => `${e.name}: ${e.value}`}>
                      {ticketReport.byPriority.map((p, i) => <Cell key={i} fill={PRIORITY_COLOR[p.priority] ?? SERIES[i % SERIES.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...card }}>
                <SectionHeader title="By Category" sub="What is going wrong" />
                {ticketReport.byCategory.length === 0 ? (
                  <NoData title="No categories recorded" detail="Set a category on tickets to break this down." />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ticketReport.byCategory} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: '#374557' }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#5D78FF" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div style={{ ...card }}>
              <SectionHeader title="Engineer Workload" sub="Tickets handled, resolved, and SLA breaches per owner" />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead><tr style={{ background: '#F8F9FF' }}>{['Assignee', 'Total', 'Resolved', 'Breached', 'Resolution Rate'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {ticketReport.byAssignee.map(a => {
                      const rate = a.total ? Math.round((a.resolved / a.total) * 100) : 0
                      return (
                        <tr key={a.userId} style={{ borderBottom: '1px solid #F4F5F9' }}>
                          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: a.userId === 'unassigned' ? '#B1B1BE' : '#374557' }}>{a.name}</td>
                          <td style={td}>{a.total}</td>
                          <td style={td}>{a.resolved}</td>
                          <td style={{ ...td, color: a.breached > 0 ? '#FF5353' : '#374557', fontWeight: a.breached > 0 ? 700 : 400 }}>{a.breached}</td>
                          <td style={td}>{rate}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...card }}>
              <SectionHeader title="Tickets by Project" sub="Which delivered work generates service load" />
              {ticketReport.byProject.length === 0 ? (
                <NoData title="No tickets linked to a project" detail="Link tickets to a project to see service load per delivery." />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                    <thead><tr style={{ background: '#F8F9FF' }}>{['Project', 'Total Tickets', 'Still Open'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {ticketReport.byProject.map(p => (
                        <tr key={p.projectId} style={{ borderBottom: '1px solid #F4F5F9' }}>
                          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: p.projectId === 'none' ? '#B1B1BE' : '#374557' }}>{p.title}</td>
                          <td style={td}>{p.total}</td>
                          <td style={{ ...td, color: p.open > 0 ? '#FF9B52' : '#374557' }}>{p.open}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      )}

      {activeTab === 'team' && (
        <>
          <div style={{ ...card }}>
            <SectionHeader title="Rep Leaderboard" sub="Ranked by won deal value" />
            {leaderboard.length === 0 ? (
              <NoData title="No deal owners in this range" detail="Assign owners to deals to populate the leaderboard." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead><tr style={{ background: '#F8F9FF' }}>{['Rep', 'Role', 'Won Deals', 'Won Value', 'Total Deals'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {leaderboard.map((r, i) => (
                      <tr key={r.userId} style={{ borderBottom: '1px solid #F4F5F9' }}>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{i === 0 && '🏆 '}{r.name}</td>
                        <td style={{ padding: '11px 14px', fontSize: 11, color: '#B1B1BE' }}>{r.role}</td>
                        <td style={td}>{r.wonCount}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#2BC155' }}>{fmt(r.wonValue, symbol, currency)}</td>
                        <td style={td}>{r.totalDeals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ ...card }}>
            <SectionHeader title="Top Products / Line Items" sub="By revenue from paid invoices" />
            {productPerf.length === 0 ? (
              <NoData title="No paid invoice line items in this range" detail="Mark invoices as Paid to see product revenue." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={productPerf} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#B1B1BE' }} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#374557' }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip formatter={(v: number) => fmt(Number(v), symbol, currency)} contentStyle={tooltipStyle} />
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
          {departments.length === 0 ? (
            <EmptyState icon={Building2} title="No departments configured" subtitle="Add departments in User Management to see per-department analytics." />
          ) : departments.every(d => d.leadCount === 0 && d.dealCount === 0 && d.projectCount === 0) ? (
            <NoData title="No department activity in this range"
              detail={`${departments.length} departments exist, but none recorded leads, deals, or projects between the selected months.`} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead><tr style={{ background: '#F8F9FF' }}>{['Department', 'Leads', 'Deals', 'Pipeline Value', 'Projects', 'Won Deals', 'Won Value'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.departmentId} style={{ borderBottom: '1px solid #F4F5F9' }}>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{d.departmentName}</td>
                      <td style={td}>{d.leadCount}</td>
                      <td style={td}>{d.dealCount}</td>
                      <td style={{ ...td, fontWeight: 600, color: '#5D78FF' }}>{fmt(d.pipelineValue, symbol, currency)}</td>
                      <td style={td}>{d.projectCount}</td>
                      <td style={td}>{d.wonDealCount}</td>
                      <td style={{ ...td, fontWeight: 600, color: '#2BC155' }}>{fmt(d.wonValue, symbol, currency)}</td>
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

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#374557',
  letterSpacing: 0.4, borderBottom: '2px solid #F0F1F5', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 12, color: '#374557', fontVariantNumeric: 'tabular-nums' }
const tooltipStyle: React.CSSProperties = { fontSize: 11, borderRadius: 10, border: '1px solid #F0F1F5' }
