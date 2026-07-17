import { useState } from 'react'
import { Plus, Play, CheckSquare, Cpu, Wrench, FlaskConical, Trash2, ClipboardList, Package, AlertTriangle, IndianRupee, Search, X } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder, useAddProductionLog, useConsumeMaterial, useDeleteWorkOrder } from '@/hooks/useERP'
import { useInventoryAllocations } from '@/hooks/useERP'
import type { WorkOrderAPI } from '@/hooks/useERP'
import { useProjects } from '@/hooks/useProjects'
import EmptyState from '@/components/shared/EmptyState'

const WO_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  Waiting:     { label: 'Waiting',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',     icon: ClipboardList },
  InProduction:{ label: 'In Production',color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',     icon: Play },
  Assembly:    { label: 'Assembly',     color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Wrench },
  Testing:     { label: 'Testing',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: FlaskConical },
  Finished:    { label: 'Finished',     color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',  icon: CheckSquare },
  Cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',          icon: Trash2 },
}

const WO_STATUS_ORDER = ['Waiting', 'InProduction', 'Assembly', 'Testing', 'Finished'] as const

export default function Manufacturing() {
  const [selectedWO, setSelectedWO] = useState<WorkOrderAPI | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filterProject, setFilterProject] = useState('')
  const [search, setSearch] = useState('')
  const [showLogForm, setShowLogForm] = useState(false)
  const [showConsumeForm, setShowConsumeForm] = useState(false)
  const { format: fmt } = useCurrency()

  const { data: workOrders = [], isLoading, isError, refetch } = useWorkOrders(filterProject || undefined)
  const { data: projects = [] } = useProjects()
  const { data: allocations = [] } = useInventoryAllocations(selectedWO ? { projectId: selectedWO.projectId } : undefined)

  const createWO = useCreateWorkOrder()
  const updateWO = useUpdateWorkOrder()
  const addLog = useAddProductionLog()
  const consume = useConsumeMaterial()
  const deleteWO = useDeleteWorkOrder()

  const activeCount = workOrders.filter(w => ['InProduction', 'Assembly', 'Testing'].includes(w.status)).length
  const finishedCount = workOrders.filter(w => w.status === 'Finished').length
  const totalMaterialCost = workOrders.reduce((s, w) => s + w.materialCost, 0)
  const totalLabourCost = workOrders.reduce((s, w) => s + w.labourCost, 0)

  const q = search.trim().toLowerCase()
  const filteredWOs = q ? workOrders.filter(w => w.refNumber.toLowerCase().includes(q) || w.title.toLowerCase().includes(q)) : workOrders

  const nextStatus = (current: string): string | null => {
    const idx = WO_STATUS_ORDER.indexOf(current as any)
    if (idx === -1 || idx === WO_STATUS_ORDER.length - 1) return null
    return WO_STATUS_ORDER[idx + 1]
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manufacturing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Work orders, production logs, material consumption</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Work Order
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Active Work Orders" value={activeCount} color="blue" icon={Play} />
        <KPICard label="Finished" value={finishedCount} color="green" icon={CheckSquare} />
        <KPICard label="Material Cost" value={fmt(totalMaterialCost)} color="orange" icon={Package} />
        <KPICard label="Labour Cost" value={fmt(totalLabourCost)} color="purple" icon={IndianRupee} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <div className="relative" style={{ width: 220 }}>
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work order, ref…"
            className="w-full pl-8 pr-7 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-blue-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3 h-3" /></button>}
        </div>
      </div>

      {/* Work Orders Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : isError ? (
        <EmptyState icon={AlertTriangle} title="Failed to load work orders" subtitle="Something went wrong fetching this data."
          action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
      ) : filteredWOs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{workOrders.length === 0 ? 'No work orders. Create one to start manufacturing.' : 'No work orders match your search.'}</div>
      ) : (
        <div className="grid gap-4">
          {filteredWOs.map(wo => {
            const cfg = WO_STATUS_CONFIG[wo.status] || WO_STATUS_CONFIG.Waiting
            const StatusIcon = cfg.icon
            const next = nextStatus(wo.status)
            return (
              <div key={wo.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{wo.refNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mt-0.5">{wo.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{wo.project?.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs text-gray-500">
                      <div>Material: {fmt(wo.materialCost)}</div>
                      <div>Labour: {fmt(wo.labourCost)}</div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">Total: {fmt(wo.totalCost)}</div>
                    </div>
                  </div>
                </div>

                {/* Recent logs */}
                {wo.logs.length > 0 && (
                  <div className="mt-3 pl-13 space-y-1">
                    {wo.logs.slice(0, 2).map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-gray-300 mt-1 flex-shrink-0" />
                        <span>{log.entry}</span>
                        <span className="text-gray-400 ml-auto">{new Date(log.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button onClick={() => setSelectedWO(wo)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50">View Details</button>
                  {next && (
                    <button
                      onClick={() => updateWO.mutate({ id: wo.id, status: next })}
                      className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded hover:bg-blue-100"
                    >
                      → {WO_STATUS_CONFIG[next]?.label}
                    </button>
                  )}
                  <button onClick={() => { setSelectedWO(wo); setShowLogForm(true) }} className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100">+ Log</button>
                  {['InProduction', 'Assembly'].includes(wo.status) && (
                    <button onClick={() => { setSelectedWO(wo); setShowConsumeForm(true) }} className="px-2 py-1 text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-600 rounded hover:bg-orange-100 flex items-center gap-1"><Package className="w-3 h-3" />Consume Material</button>
                  )}
                  <button onClick={() => { if (confirm('Delete this work order?')) deleteWO.mutate(wo.id) }} className="ml-auto p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedWO && !showLogForm && !showConsumeForm && (
        <WODetailModal wo={selectedWO} fmt={fmt} onClose={() => setSelectedWO(null)} />
      )}

      {/* Create WO Form */}
      {showCreateForm && (
        <CreateWOModal
          projects={projects}
          onClose={() => setShowCreateForm(false)}
          onSave={(data: Parameters<typeof createWO.mutate>[0]) => { createWO.mutate(data); setShowCreateForm(false) }}
        />
      )}

      {/* Add Log Form */}
      {showLogForm && selectedWO && (
        <AddLogModal
          wo={selectedWO}
          onClose={() => { setShowLogForm(false); setSelectedWO(null) }}
          onSave={(entry: string) => { addLog.mutate({ id: selectedWO.id, entry }); setShowLogForm(false); setSelectedWO(null) }}
        />
      )}

      {/* Consume Material Form */}
      {showConsumeForm && selectedWO && (
        <ConsumeMaterialModal
          wo={selectedWO}
          allocations={allocations}
          fmt={fmt}
          onClose={() => { setShowConsumeForm(false); setSelectedWO(null) }}
          onSave={(data: Record<string, unknown>) => { consume.mutate({ id: selectedWO.id, ...data } as Parameters<typeof consume.mutate>[0]); setShowConsumeForm(false); setSelectedWO(null) }}
        />
      )}
    </div>
  )
}

function KPICard({ label, value, color, icon: Icon }: { label: string; value: any; color: string; icon?: any }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    orange: 'text-orange-600 dark:text-orange-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/30',
    green: 'bg-green-50 dark:bg-green-900/30',
    orange: 'bg-orange-50 dark:bg-orange-900/30',
    purple: 'bg-purple-50 dark:bg-purple-900/30',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</div>
      </div>
      {Icon && (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColors[color]}`}>
          <Icon className={`w-4 h-4 ${colors[color]}`} />
        </div>
      )}
    </div>
  )
}

function WODetailModal({ wo, fmt, onClose }: { wo: WorkOrderAPI; fmt: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{wo.title}</h2>
            <p className="text-sm text-gray-500">{wo.refNumber} · {wo.project?.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-6">
          {/* Costs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center"><div className="text-lg font-bold">{fmt(wo.materialCost)}</div><div className="text-xs text-gray-500">Material Cost</div></div>
            <div className="text-center"><div className="text-lg font-bold">{fmt(wo.labourCost)}</div><div className="text-xs text-gray-500">Labour Cost</div></div>
            <div className="text-center"><div className="text-lg font-bold text-blue-600">{fmt(wo.totalCost)}</div><div className="text-xs text-gray-500">Total Cost</div></div>
          </div>

          {/* Material Consumptions */}
          {wo.materialConsumptions.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Materials Consumed</h3>
              <div className="space-y-2">
                {wo.materialConsumptions.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-gray-700 dark:text-gray-300">{c.rawComponent?.name}</span>
                    <span className="text-gray-500">{c.quantity} {c.rawComponent?.unit || 'units'}</span>
                    <span className="font-medium">{fmt(c.totalCost || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Production Logs */}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Production Log</h3>
            {wo.logs.length === 0 ? (
              <p className="text-sm text-gray-400">No log entries yet</p>
            ) : (
              <div className="space-y-2">
                {wo.logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">{log.entry}</span>
                      <span className="text-xs text-gray-400 ml-2">— {log.actorName || 'System'} · {new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateWOModal({ projects, onClose, onSave }: any) {
  const [form, setForm] = useState({ projectId: '', title: '', notes: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Work Order</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.projectId} onChange={e => set('projectId', e.target.value)}>
              <option value="">Select project…</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Work Order Title</label>
            <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Compressor Assembly" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea rows={3} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
        </div>
      </div>
    </div>
  )
}

function AddLogModal({ wo, onClose, onSave }: any) {
  const [entry, setEntry] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Production Log</h2>
          <p className="text-sm text-gray-500">{wo.refNumber} · {wo.title}</p>
        </div>
        <div className="p-6">
          <textarea rows={4} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Log entry…" value={entry} onChange={e => setEntry(e.target.value)} />
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave(entry)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Log</button>
        </div>
      </div>
    </div>
  )
}

function ConsumeMaterialModal({ wo, allocations, fmt, onClose, onSave }: any) {
  const [rawComponentId, setRawComponentId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const selected = allocations.find((a: any) => a.rawComponentId === rawComponentId)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Consume Material</h2>
          <p className="text-sm text-gray-500">{wo.refNumber} · {wo.title}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Material (from project allocations)</label>
            <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={rawComponentId} onChange={e => setRawComponentId(e.target.value)}>
              <option value="">Select material…</option>
              {allocations.map((a: any) => (
                <option key={a.rawComponentId} value={a.rawComponentId}>
                  {a.rawComponent?.name} (Available: {a.rawComponent?.quantity || 0} {a.rawComponent?.unit || 'units'})
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3 text-sm">
              <div className="text-gray-500">Unit cost: {fmt(selected.rawComponent?.price || 0)}</div>
              <div className="font-medium text-gray-900 dark:text-white">Estimated total: {fmt((selected.rawComponent?.price || 0) * quantity)}</div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantity to Consume</label>
            <input type="number" min="1" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSave({ rawComponentId, quantity, notes })}
            disabled={!rawComponentId}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            Consume & Update Costs
          </button>
        </div>
      </div>
    </div>
  )
}
