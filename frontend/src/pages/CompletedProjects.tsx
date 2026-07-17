import { useState } from 'react'
import { Search, Archive, DollarSign, Calendar, Shield, ChevronRight, AlertTriangle } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { useProjects } from '@/hooks/useProjects'
import { useProjectERP } from '@/hooks/useERP'
import EmptyState from '@/components/shared/EmptyState'

export default function CompletedProjects() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { format: fmt } = useCurrency()

  const { data: allProjects = [], isLoading, isError, refetch } = useProjects({ status: 'Completed' })

  const filtered = allProjects.filter((p: any) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.company?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalBudget = allProjects.reduce((s: number, p: any) => s + (p.budget || 0), 0)
  const totalProfit = allProjects.reduce((s: number, p: any) => s + (p.profit || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Completed Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Immutable archive of all completed projects</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Completed Projects</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{allProjects.length}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center"><Archive className="w-4 h-4 text-blue-500" /></div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Budget</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(totalBudget)}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center"><DollarSign className="w-4 h-4 text-emerald-500" /></div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Profit</div>
            <div className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(totalProfit)}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center"><DollarSign className="w-4 h-4 text-purple-500" /></div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 dark:text-white"
          placeholder="Search by project name or customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Project List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : isError ? (
        <EmptyState icon={AlertTriangle} title="Failed to load completed projects" subtitle="Something went wrong fetching this data."
          action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{allProjects.length === 0 ? 'No completed projects yet' : 'No completed projects match your search'}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((project: any) => (
            <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Completed</span>
                    {project.isLocked && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700">🔒 Locked</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{project.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{project.company?.name}</p>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3">
                    {[
                      { label: 'Budget', value: fmt(project.budget || 0), color: 'text-blue-600' },
                      { label: 'Mfg Cost', value: fmt(project.manufacturingCost || 0), color: 'text-indigo-600' },
                      { label: 'Service Cost', value: fmt(project.serviceCost || 0), color: 'text-purple-600' },
                      { label: 'Total Expenses', value: fmt(project.totalExpenses || 0), color: 'text-orange-600' },
                      { label: 'Profit', value: fmt(project.profit || 0), color: (project.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600' },
                      { label: 'Completed', value: project.completedAt ? new Date(project.completedAt).toLocaleDateString() : '—', color: 'text-gray-700 dark:text-gray-200' },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="text-xs text-gray-400">{item.label}</div>
                        <div className={`text-sm font-semibold ${item.color}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {project.warrantyPeriod && (
                      <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                        <Shield className="w-3 h-3" /> {project.warrantyPeriod} months warranty
                      </span>
                    )}
                    {(project.warrantyStart || project.warrantyEnd) && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {project.warrantyStart ? new Date(project.warrantyStart).toLocaleDateString() : '?'} → {project.warrantyEnd ? new Date(project.warrantyEnd).toLocaleDateString() : '?'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedId(project.id === selectedId ? null : project.id)}
                  className="ml-4 p-2 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-lg text-gray-400"
                >
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedId === project.id ? 'rotate-90' : ''}`} />
                </button>
              </div>

              {/* Expanded ERP Details */}
              {selectedId === project.id && (
                <ProjectERPExpanded projectId={project.id} fmt={fmt} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectERPExpanded({ projectId, fmt }: { projectId: string; fmt: any }) {
  const { data: erp, isLoading } = useProjectERP(projectId)

  if (isLoading) return <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-400">Loading ERP data…</div>
  if (!erp) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
      {/* Cost breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cost Breakdown</h4>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: 'Purchase', value: erp.purchaseCost },
            { label: 'Manufacturing', value: erp.manufacturingCost },
            { label: 'Labour', value: erp.labourCost },
            { label: 'Installation', value: erp.installationCost },
            { label: 'Service', value: erp.serviceCost },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 dark:bg-gray-750 rounded-lg p-2.5 text-center">
              <div className="text-xs text-gray-400 mb-1">{item.label}</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">{fmt(item.value || 0)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BOMs */}
      {erp.boms?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill of Materials</h4>
          {erp.boms.map((bom: any) => (
            <div key={bom.id} className="text-xs text-gray-500 mb-1">{bom.refNumber} · {bom.items?.length} items · {bom.status}</div>
          ))}
        </div>
      )}

      {/* Purchase Orders */}
      {erp.boms?.flatMap((b: any) => b.purchaseOrders || []).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Purchase Orders</h4>
          {erp.boms.flatMap((b: any) => b.purchaseOrders || []).map((po: any) => (
            <div key={po.id} className="text-xs text-gray-500 mb-1">{po.refNumber} · {po.supplierName} · {fmt(po.totalAmount)} · {po.status}</div>
          ))}
        </div>
      )}

      {/* Work Orders */}
      {erp.workOrders?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Manufacturing</h4>
          {erp.workOrders.map((wo: any) => (
            <div key={wo.id} className="text-xs text-gray-500 mb-1">{wo.refNumber} · {wo.title} · {wo.status} · Total: {fmt(wo.totalCost)}</div>
          ))}
        </div>
      )}

      {/* Service */}
      {erp.serviceRecord && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service Record</h4>
          <div className="text-xs text-gray-500">
            Warranty: {erp.serviceRecord.warrantyStart ? new Date(erp.serviceRecord.warrantyStart).toLocaleDateString() : '?'} → {erp.serviceRecord.warrantyEnd ? new Date(erp.serviceRecord.warrantyEnd).toLocaleDateString() : '?'}
            · {erp.serviceRecord.serviceRequests?.length || 0} service requests
          </div>
        </div>
      )}
    </div>
  )
}
