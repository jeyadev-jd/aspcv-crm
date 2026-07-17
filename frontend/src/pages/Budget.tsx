import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingDown, TrendingUp, Cpu, Shield, Search, AlertTriangle } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { api } from '@/lib/api'
import EmptyState from '@/components/shared/EmptyState'

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

function KPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-xs text-gray-400">{label}</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">₹{value.toLocaleString('en-IN')}</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Budget() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { format: fmt } = useCurrency()

  const { data: projects = [], isLoading, isError, refetch } = useQuery<ProjectBudget[]>({
    queryKey: ['projects-budget'],
    queryFn: () => api.get('/projects', { params: { includeERP: true, pageSize: 1000 } }).then(r => r.data.data),
  })

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budget & Cost Tracking</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Per-project budget, manufacturing cost, and service cost breakdown</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={DollarSign} label="Total Budget" value={fmt(totalBudget)} color="bg-blue-500" />
        <KPI icon={TrendingDown} label="Total Expenses" value={fmt(totalExpenses)} color="bg-orange-500" />
        <KPI icon={TrendingUp} label="Total Profit" value={fmt(totalProfit)} color={totalProfit >= 0 ? 'bg-green-500' : 'bg-red-500'} />
        <KPI icon={Shield} label="Service Cost" value={fmt(totalService)} color="bg-purple-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search projects…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Project cards */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : isError ? (
        <EmptyState icon={AlertTriangle} title="Failed to load project budgets" subtitle="Something went wrong fetching this data."
          action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No projects found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            return (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                {/* Title row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{p.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{p.company?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.warrantyPeriod && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{p.warrantyPeriod}m warranty</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      p.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      p.status === 'Manufacturing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{p.status}</span>
                  </div>
                </div>

                {/* Budget bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Budget Used</span>
                    <span className="font-medium">{fmt(budget - remaining)} / {fmt(budget)}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-orange-400' : 'bg-blue-500'}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-400">Remaining: <span className={`font-medium ${remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(remaining)}</span></span>
                    <span className="text-gray-400">{usedPct.toFixed(0)}% used</span>
                  </div>
                </div>

                {/* Cost breakdown bars */}
                <div className="border-t border-gray-50 dark:border-gray-700 pt-3 mb-3">
                  <Bar label="Purchase Cost" value={purchaseCost} max={budget} color="bg-indigo-400" />
                  <Bar label="Manufacturing Cost" value={mfgCost} max={budget} color="bg-blue-400" />
                  <Bar label="Service Cost" value={svcCost} max={budget || 1} color="bg-purple-400" />
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-3 gap-2 border-t border-gray-50 dark:border-gray-700 pt-3">
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Total Expenses</div>
                    <div className="text-sm font-bold text-orange-600">{fmt(totalExp)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Profit</div>
                    <div className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(profit)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Margin</div>
                    <div className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profitPct}%</div>
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
