import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, TrendingDown, TrendingUp, Shield, Search, AlertTriangle, Pencil, X, Check } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { useAuthStore } from '@/lib/authStore'
import { api } from '@/lib/api'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from '@/lib/toast'

const PROJECT_STATUSES = ['Planning', 'Engineering', 'Procurement', 'Manufacturing', 'Installation', 'Testing', 'Completed', 'Active', 'OnHold', 'Cancelled']

interface ProjectBudget {
  id: string
  title: string
  status: string
  budget?: number
  remainingBudget?: number
  purchaseCost?: number
  manufacturingCost?: number
  labourCost?: number
  installationCost?: number
  serviceCost?: number
  totalExpenses?: number
  profit?: number
  warrantyPeriod?: number
  company?: { name: string }
}

const colorMap: Record<string, string> = {
  'bg-blue-500': '#3B82F6',
  'bg-orange-500': '#F97316',
  'bg-green-500': '#22C55E',
  'bg-red-500': '#EF4444',
  'bg-purple-500': '#A855F7',
}

function KPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: colorMap[color] || '#3B82F6' }}>
          <Icon style={{ width: 16, height: 16, color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#8A8B9F' }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#23263B' }}>{value}</div>
        </div>
      </div>
    </div>
  )
}

const barColorMap: Record<string, string> = {
  'bg-indigo-400': '#818CF8',
  'bg-blue-400': '#60A5FA',
  'bg-purple-400': '#C084FC',
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#8A8B9F' }}>{label}</span>
        <span style={{ fontWeight: 500, color: '#23263B' }}>₹{value.toLocaleString('en-IN')}</span>
      </div>
      <div style={{ width: '100%', background: '#F0F1F5', borderRadius: 9999, height: 6 }}>
        <div style={{ height: 6, borderRadius: 9999, background: barColorMap[color] || '#60A5FA', width: `${pct}%` }} />
      </div>
    </div>
  )
}

function getStatusStyle(status: string): React.CSSProperties {
  if (status === 'Completed') return { background: '#DCFCE7', color: '#15803D' }
  if (status === 'Cancelled') return { background: '#FEE2E2', color: '#B91C1C' }
  if (status === 'Manufacturing') return { background: '#DBEAFE', color: '#1D4ED8' }
  return { background: '#F4F5F9', color: '#23263B' }
}

export default function Budget() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBudget, setEditBudget] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const { format: fmt } = useCurrency()
  const can = useAuthStore(s => s.can)
  const editable = can('project', 'edit')
  const qc = useQueryClient()

  const { data: projects = [], isLoading, isError, refetch } = useQuery<ProjectBudget[]>({
    queryKey: ['projects-budget'],
    queryFn: () => api.get('/projects', { params: { includeERP: true, pageSize: 1000 } }).then(r => r.data.data),
  })

  const updateProject = useMutation({
    mutationFn: ({ id, ...data }: { id: string; budget?: number; status?: string }) =>
      api.put(`/projects/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects-budget'] }); setEditingId(null) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update project'),
  })

  function startEdit(p: ProjectBudget) {
    setEditingId(p.id)
    setEditBudget(String(p.budget ?? ''))
    setEditStatus(p.status)
  }
  function saveEdit(id: string) {
    updateProject.mutate({ id, budget: editBudget === '' ? undefined : Math.max(0, Number(editBudget) || 0), status: editStatus })
  }

  const filtered = projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.company?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)
  const totalExpenses = projects.reduce((s, p) => s + (p.totalExpenses ?? 0), 0)
  const totalProfit = projects.reduce((s, p) => s + (p.profit ?? 0), 0)
  const totalService = projects.reduce((s, p) => s + (p.serviceCost ?? 0), 0)

  const statuses = ['all', ...Array.from(new Set(projects.map(p => p.status)))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <KPI icon={DollarSign} label="Total Budget" value={fmt(totalBudget)} color="bg-blue-500" />
        <KPI icon={TrendingDown} label="Total Expenses" value={fmt(totalExpenses)} color="bg-orange-500" />
        <KPI icon={TrendingUp} label="Total Profit" value={fmt(totalProfit)} color={totalProfit >= 0 ? 'bg-green-500' : 'bg-red-500'} />
        <KPI icon={Shield} label="Service Cost" value={fmt(totalService)} color="bg-purple-500" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 192 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#8A8B9F' }} />
          <input
            type="text" placeholder="Search projects…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #F0F1F5', borderRadius: 8, fontSize: 13, background: '#fff', color: '#23263B', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 12px', fontSize: 12, borderRadius: 8, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: statusFilter === s ? '#5D78FF' : '#F4F5F9',
                color: statusFilter === s ? '#fff' : '#23263B',
              }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Project cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#8A8B9F' }}>Loading…</div>
      ) : isError ? (
        <EmptyState icon={AlertTriangle} title="Failed to load project budgets" subtitle="Something went wrong fetching this data."
          action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#8A8B9F' }}>No projects found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 }}>
          {filtered.map(p => {
            const budget = p.budget ?? 0
            const remaining = p.remainingBudget ?? budget
            const mfgCost = p.manufacturingCost ?? 0
            const svcCost = p.serviceCost ?? 0
            const purchaseCost = p.purchaseCost ?? 0
            const totalExp = p.totalExpenses ?? (mfgCost + svcCost + purchaseCost)
            const profit = p.profit ?? (budget - totalExp)
            const profitPct = budget > 0 ? ((profit / budget) * 100).toFixed(1) : '0'
            const usedPct = budget > 0 ? Math.min(100, ((budget - remaining) / budget) * 100) : 0
            const usedBarColor = usedPct > 90 ? '#EF4444' : usedPct > 70 ? '#FB923C' : '#3B82F6'

            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 20 }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontWeight: 600, color: '#23263B', fontSize: 14, margin: 0 }}>{p.title}</h3>
                    <p style={{ fontSize: 12, color: '#8A8B9F', margin: '2px 0 0 0' }}>{p.company?.name}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.warrantyPeriod && (
                      <span style={{ fontSize: 12, color: '#9333EA', background: '#FAF5FF', padding: '2px 8px', borderRadius: 9999 }}>{p.warrantyPeriod}m warranty</span>
                    )}
                    {editingId === p.id ? (
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                        style={{ fontSize: 12, padding: '2px 6px', borderRadius: 8, border: '1px solid #F0F1F5', color: '#23263B' }}>
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, ...getStatusStyle(p.status) }}>{p.status}</span>
                    )}
                    {editable && (
                      editingId === p.id ? (
                        <>
                          <button onClick={() => saveEdit(p.id)} disabled={updateProject.isPending}
                            title="Save" style={{ background: '#22C55E', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', color: '#fff', display: 'flex' }}>
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditingId(null)} title="Cancel"
                            style={{ background: '#F4F5F9', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', color: '#8A8B9F', display: 'flex' }}>
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(p)} title="Edit budget / status"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8B9F', display: 'flex', padding: 4 }}>
                          <Pencil size={13} />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Budget bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#8A8B9F' }}>Budget Used</span>
                    {editingId === p.id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#8A8B9F' }}>₹</span>
                        <input type="number" min="0" value={editBudget} onChange={e => setEditBudget(e.target.value)} placeholder="Set budget"
                          style={{ width: 110, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #F0F1F5', color: '#23263B', outline: 'none' }} />
                      </span>
                    ) : (
                      <span style={{ fontWeight: 500, color: '#23263B' }}>
                        {budget > 0
                          ? `${fmt(budget - remaining)} / ${fmt(budget)}`
                          : totalExp > 0
                            ? <span style={{ color: '#EF4444' }}>{fmt(totalExp)} spent — no budget set</span>
                            : 'No budget set'}
                      </span>
                    )}
                  </div>
                  <div style={{ width: '100%', background: '#F0F1F5', borderRadius: 9999, height: 8 }}>
                    <div style={{ height: 8, borderRadius: 9999, background: usedBarColor, width: `${usedPct}%`, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                    <span style={{ color: '#8A8B9F' }}>Remaining: <span style={{ fontWeight: 500, color: remaining < 0 ? '#EF4444' : '#16A34A' }}>{fmt(remaining)}</span></span>
                    <span style={{ color: '#8A8B9F' }}>{usedPct.toFixed(0)}% used</span>
                  </div>
                </div>

                {/* Cost breakdown bars */}
                <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 12, marginBottom: 12 }}>
                  <Bar label="Purchase Cost" value={purchaseCost} max={budget} color="bg-indigo-400" />
                  <Bar label="Manufacturing Cost" value={mfgCost} max={budget} color="bg-blue-400" />
                  <Bar label="Service Cost" value={svcCost} max={budget || 1} color="bg-purple-400" />
                </div>

                {/* Summary row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, borderTop: '1px solid #F0F1F5', paddingTop: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#8A8B9F' }}>Total Expenses</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F97316' }}>{fmt(totalExp)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#8A8B9F' }}>Profit</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: profit >= 0 ? '#16A34A' : '#EF4444' }}>{fmt(profit)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#8A8B9F' }}>Margin</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: profit >= 0 ? '#16A34A' : '#EF4444' }}>{profitPct}%</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
