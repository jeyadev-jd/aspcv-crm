import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Play, CheckSquare, Cpu, Wrench, FlaskConical, Trash2, ClipboardList, Package, AlertTriangle, IndianRupee, Search, X } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { api } from '@/lib/api'
import { useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder, useAddProductionLog, useConsumeMaterial, useDeleteWorkOrder, useBulkDeleteWorkOrders } from '@/hooks/useERP'
import { useInventoryAllocations } from '@/hooks/useERP'
import type { WorkOrderAPI } from '@/hooks/useERP'
import { useProjects } from '@/hooks/useProjects'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import BulkActionBar from '@/components/shared/BulkActionBar'
import BulkDeleteDialog from '@/components/shared/BulkDeleteDialog'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Waiting:      { bg: '#F3F4F6', text: '#374151' },
  InProduction: { bg: '#DBEAFE', text: '#1D4ED8' },
  Assembly:     { bg: '#FEF3C7', text: '#A16207' },
  Testing:      { bg: '#F3E8FF', text: '#7C3AED' },
  Finished:     { bg: '#D1FAE5', text: '#047857' },
  Cancelled:    { bg: '#FEE2E2', text: '#B91C1C' },
}

const WO_STATUS_CONFIG: Record<string, { label: string; icon: any }> = {
  Waiting:      { label: 'Waiting',       icon: ClipboardList },
  InProduction: { label: 'In Production', icon: Play },
  Assembly:     { label: 'Assembly',      icon: Wrench },
  Testing:      { label: 'Testing',       icon: FlaskConical },
  Finished:     { label: 'Finished',      icon: CheckSquare },
  Cancelled:    { label: 'Cancelled',     icon: Trash2 },
}

const WO_STATUS_ORDER = ['Waiting', 'InProduction', 'Assembly', 'Testing', 'Finished'] as const

export default function Manufacturing() {
  const [selectedWO, setSelectedWO] = useState<WorkOrderAPI | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
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
  const bulkDeleteWO = useBulkDeleteWorkOrders()
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  const [deleteWOTarget, setDeleteWOTarget] = useState<typeof workOrders[number] | null>(null)
  // Finishing a work order locks in its consumed inventory, so it confirms
  // first; the earlier stage transitions stay one-click.
  const [finishTarget, setFinishTarget] = useState<typeof workOrders[number] | null>(null)

  const activeCount = workOrders.filter(w => ['InProduction', 'Assembly', 'Testing'].includes(w.status)).length
  const finishedCount = workOrders.filter(w => w.status === 'Finished').length
  const totalMaterialCost = workOrders.reduce((s, w) => s + w.materialCost, 0)
  const totalLabourCost = workOrders.reduce((s, w) => s + w.labourCost, 0)

  const q = search.trim().toLowerCase()
  const filteredWOs = workOrders.filter(w => {
    if (filterStatus && w.status !== filterStatus) return false
    if (q && !(w.refNumber.toLowerCase().includes(q) || w.title.toLowerCase().includes(q))) return false
    return true
  })

  // All statuses HR/production can set — includes going back a stage (revert)
  // and Cancelled. Finished is confirmed separately as it locks costs.
  const ALL_STATUSES = [...WO_STATUS_ORDER, 'Cancelled'] as const

  const bulk = useBulkSelect(filteredWOs.map(w => w.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
        {filteredWOs.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
            <input type="checkbox" checked={bulk.allSelected} ref={el => { if (el) el.indeterminate = bulk.someSelected }} onChange={bulk.toggleAll} />
            Select all
          </label>
        )}
        <button
          onClick={() => setShowCreateForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <Plus style={{ width: 16, height: 16 }} /> New Work Order
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPICard label="Active Work Orders" value={activeCount} color="blue" icon={Play} />
        <KPICard label="Finished" value={finishedCount} color="green" icon={CheckSquare} />
        <KPICard label="Material Cost" value={fmt(totalMaterialCost)} color="orange" icon={Package} />
        <KPICard label="Labour Cost" value={fmt(totalLabourCost)} color="purple" icon={IndianRupee} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          style={{ border: '1px solid #F0F1F5', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#23263B', outline: 'none' }}
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select
          style={{ border: '1px solid #F0F1F5', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#23263B', outline: 'none' }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(WO_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ position: 'relative', width: 220 }}>
          <Search style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A8B9F' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work order, ref…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 28, paddingTop: 8, paddingBottom: 8, fontSize: 13, borderRadius: 8, border: '1px solid #F0F1F5', background: '#fff', color: '#23263B', outline: 'none' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A8B9F', padding: 0 }}><X style={{ width: 12, height: 12 }} /></button>}
        </div>
      </div>

      {/* Work Orders Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#8A8B9F' }}>Loading...</div>
      ) : isError ? (
        <EmptyState icon={AlertTriangle} title="Failed to load work orders" subtitle="Something went wrong fetching this data."
          action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
      ) : filteredWOs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#8A8B9F' }}>{workOrders.length === 0 ? 'No work orders. Create one to start manufacturing.' : 'No work orders match your search.'}</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filteredWOs.map(wo => {
            const cfg = WO_STATUS_CONFIG[wo.status] || WO_STATUS_CONFIG.Waiting
            const sc = STATUS_COLORS[wo.status] || STATUS_COLORS.Waiting
            const StatusIcon = cfg.icon
            return (
              <div key={wo.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${bulk.isSelected(wo.id) ? '#5D78FF' : '#F0F1F5'}`, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <input type="checkbox" checked={bulk.isSelected(wo.id)} onChange={() => bulk.toggle(wo.id)} style={{ marginTop: 4, cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: sc.bg, color: sc.text }}>
                      <StatusIcon style={{ width: 20, height: 20 }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#8A8B9F' }}>{wo.refNumber}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: sc.bg, color: sc.text }}>{cfg.label}</span>
                      </div>
                      <h3 style={{ fontWeight: 600, color: '#23263B', margin: '2px 0 0', fontSize: 14 }}>{wo.title}</h3>
                      <p style={{ fontSize: 12, color: '#8A8B9F', margin: '2px 0 0' }}>{wo.project?.title}</p>
                      {wo.scopeItem && (
                        <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: '#EDE9FE', color: '#7C3AED' }}>
                          {wo.scopeItem.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#8A8B9F' }}>
                      <div>Material: {fmt(wo.materialCost)}</div>
                      <div>Labour: {fmt(wo.labourCost)}</div>
                      <div style={{ fontWeight: 500, color: '#23263B' }}>Total: {fmt(wo.totalCost)}</div>
                    </div>
                  </div>
                </div>

                {/* Recent logs */}
                {wo.logs.length > 0 && (
                  <div style={{ marginTop: 12, paddingLeft: 52, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {wo.logs.slice(0, 2).map(log => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#8A8B9F' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB', marginTop: 4, flexShrink: 0 }} />
                        <span>{log.entry}</span>
                        <span style={{ color: '#B0B1C0', marginLeft: 'auto' }}>{new Date(log.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedWO(wo)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #F0F1F5', borderRadius: 4, color: '#8A8B9F', background: '#fff', cursor: 'pointer' }}>View Details</button>
                  {/* Dynamic status — set any stage, forward or back (revert). */}
                  <select
                    value={wo.status}
                    onChange={e => {
                      const s = e.target.value
                      if (s === wo.status) return
                      if (s === 'Finished') setFinishTarget(wo)
                      else updateWO.mutate({ id: wo.id, status: s })
                    }}
                    style={{ padding: '4px 8px', fontSize: 12, background: '#EFF6FF', color: '#2563EB', border: '1px solid #DBEAFE', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{WO_STATUS_CONFIG[s]?.label ?? s}</option>)}
                  </select>
                  {updateWO.isPending && <span style={{ fontSize: 11, color: '#8A8B9F' }}>Updating…</span>}
                  <button onClick={() => { setSelectedWO(wo); setShowLogForm(true) }} style={{ padding: '4px 8px', fontSize: 12, background: '#F4F5F9', color: '#8A8B9F', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ Log</button>
                  {['InProduction', 'Assembly'].includes(wo.status) && (
                    <button onClick={() => { setSelectedWO(wo); setShowConsumeForm(true) }} style={{ padding: '4px 8px', fontSize: 12, background: '#FFF7ED', color: '#EA580C', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Package style={{ width: 12, height: 12 }} />Consume Material</button>
                  )}
                  <button onClick={() => setDeleteWOTarget(wo)} style={{ marginLeft: 'auto', padding: 4, background: 'none', border: 'none', borderRadius: 4, color: '#F87171', cursor: 'pointer' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BulkActionBar count={bulk.count} entityLabel="work orders" onDelete={() => setShowBulkDelete(true)} onClear={bulk.clear} />

      {showBulkDelete && (
        <BulkDeleteDialog
          count={bulk.count}
          entityLabel="work orders"
          isPending={bulkDeleteWO.isPending}
          onCancel={() => setShowBulkDelete(false)}
          onConfirm={async () => {
            await bulkDeleteWO.mutateAsync(bulk.selectedIds)
            setShowBulkDelete(false)
            bulk.clear()
          }}
        />
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

      {finishTarget && (
        <ConfirmDialog
          title="Finish this work order?"
          message={`${finishTarget.refNumber} will be marked Finished. Consumed materials and recorded costs are locked in at this point.`}
          confirmLabel="Finish"
          danger={false}
          isPending={updateWO.isPending}
          onCancel={() => setFinishTarget(null)}
          onConfirm={() => { updateWO.mutate({ id: finishTarget.id, status: 'Finished' }); setFinishTarget(null) }}
        />
      )}

      {deleteWOTarget && (
        <ConfirmDialog
          title="Delete this work order?"
          message={`${deleteWOTarget.refNumber} and its production logs will be removed. This cannot be undone.`}
          confirmLabel="Delete"
          isPending={deleteWO.isPending}
          onCancel={() => setDeleteWOTarget(null)}
          onConfirm={() => { deleteWO.mutate(deleteWOTarget.id); setDeleteWOTarget(null) }}
        />
      )}
    </div>
  )
}

const KPI_COLORS: Record<string, { text: string; bg: string }> = {
  blue:   { text: '#2563EB', bg: '#EFF6FF' },
  green:  { text: '#059669', bg: '#ECFDF5' },
  orange: { text: '#EA580C', bg: '#FFF7ED' },
  purple: { text: '#7C3AED', bg: '#F5F3FF' },
}

function KPICard({ label, value, color, icon: Icon }: { label: string; value: any; color: string; icon?: any }) {
  const c = KPI_COLORS[color] || KPI_COLORS.blue
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: c.text }}>{value}</div>
      </div>
      {Icon && (
        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
          <Icon style={{ width: 16, height: 16, color: c.text }} />
        </div>
      )}
    </div>
  )
}

function WODetailModal({ wo, fmt, onClose }: { wo: WorkOrderAPI; fmt: any; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 672, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>{wo.title}</h2>
            <p style={{ fontSize: 13, color: '#8A8B9F', margin: '4px 0 0' }}>{wo.refNumber} · {wo.project?.title}</p>
          </div>
          <button onClick={onClose} style={{ color: '#8A8B9F', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Costs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#23263B' }}>{fmt(wo.materialCost)}</div><div style={{ fontSize: 12, color: '#8A8B9F' }}>Material Cost</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#23263B' }}>{fmt(wo.labourCost)}</div><div style={{ fontSize: 12, color: '#8A8B9F' }}>Labour Cost</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#2563EB' }}>{fmt(wo.totalCost)}</div><div style={{ fontSize: 12, color: '#8A8B9F' }}>Total Cost</div></div>
          </div>

          {/* Material Consumptions */}
          {wo.materialConsumptions.length > 0 && (
            <div>
              <h3 style={{ fontWeight: 500, color: '#23263B', marginBottom: 8, fontSize: 14 }}>Materials Consumed</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wo.materialConsumptions.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #F9FAFB' }}>
                    <span style={{ color: '#23263B' }}>{c.rawComponent?.name}</span>
                    <span style={{ color: '#8A8B9F' }}>{c.quantity} {c.rawComponent?.unit || 'units'}</span>
                    <span style={{ fontWeight: 500, color: '#23263B' }}>{fmt(c.totalCost || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Production Logs */}
          <div>
            <h3 style={{ fontWeight: 500, color: '#23263B', marginBottom: 8, fontSize: 14 }}>Production Log</h3>
            {wo.logs.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8A8B9F' }}>No log entries yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wo.logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#60A5FA', marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <span style={{ color: '#23263B' }}>{log.entry}</span>
                      <span style={{ fontSize: 12, color: '#8A8B9F', marginLeft: 8 }}>— {log.actorName || 'System'} · {new Date(log.createdAt).toLocaleString()}</span>
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
  const [form, setForm] = useState({ projectId: '', title: '', notes: '', scopeItemId: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #F0F1F5', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#23263B', outline: 'none' }

  // Scope of Supply lines for the selected project — lets the work order
  // declare which scope line it's fulfilling.
  const { data: scopeItems = [] } = useQuery<{ id: string; title: string; productType?: string }[]>({
    queryKey: ['project-scope-items', form.projectId],
    queryFn: () => api.get(`/projects/${form.projectId}/scope-items`).then(r => r.data),
    enabled: !!form.projectId,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 448 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>New Work Order</h2>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }}>Project</label>
            <select style={inputStyle} value={form.projectId} onChange={e => { set('projectId', e.target.value); set('scopeItemId', '') }}>
              <option value="">Select project…</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }}>Scope of Supply (optional)</label>
            <select style={inputStyle} value={form.scopeItemId} onChange={e => set('scopeItemId', e.target.value)} disabled={!form.projectId}>
              <option value="">— None —</option>
              {scopeItems.map(s => <option key={s.id} value={s.id}>{s.title}{s.productType ? ` (${s.productType})` : ''}</option>)}
            </select>
            {form.projectId && scopeItems.length === 0 && (
              <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 4 }}>No scope of supply defined for this project yet.</p>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }}>Work Order Title</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Compressor Assembly" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }}>Notes</label>
            <textarea rows={3} style={inputStyle} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: '#8A8B9F', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave({ ...form, scopeItemId: form.scopeItemId || undefined })} style={{ padding: '8px 16px', fontSize: 13, background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create</button>
        </div>
      </div>
    </div>
  )
}

function AddLogModal({ wo, onClose, onSave }: any) {
  const [entry, setEntry] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 448 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>Add Production Log</h2>
          <p style={{ fontSize: 13, color: '#8A8B9F', margin: '4px 0 0' }}>{wo.refNumber} · {wo.title}</p>
        </div>
        <div style={{ padding: 24 }}>
          <textarea rows={4} style={{ width: '100%', border: '1px solid #F0F1F5', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#23263B', outline: 'none' }} placeholder="Log entry…" value={entry} onChange={e => setEntry(e.target.value)} />
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: '#8A8B9F', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(entry)} style={{ padding: '8px 16px', fontSize: 13, background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Add Log</button>
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
  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #F0F1F5', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#23263B', outline: 'none' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 448 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>Consume Material</h2>
          <p style={{ fontSize: 13, color: '#8A8B9F', margin: '4px 0 0' }}>{wo.refNumber} · {wo.title}</p>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }}>Material (from project allocations)</label>
            <select style={inputStyle} value={rawComponentId} onChange={e => setRawComponentId(e.target.value)}>
              <option value="">Select material…</option>
              {allocations.map((a: any) => (
                <option key={a.rawComponentId} value={a.rawComponentId}>
                  {a.rawComponent?.name} (Available: {a.rawComponent?.quantity || 0} {a.rawComponent?.unit || 'units'})
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <div style={{ background: '#F4F5F9', borderRadius: 8, padding: 12, fontSize: 13 }}>
              <div style={{ color: '#8A8B9F' }}>Unit cost: {fmt(selected.rawComponent?.price || 0)}</div>
              <div style={{ fontWeight: 500, color: '#23263B' }}>Estimated total: {fmt((selected.rawComponent?.price || 0) * quantity)}</div>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }}>Quantity to Consume</label>
            <input type="number" min="1" style={inputStyle} value={quantity} onChange={e => setQuantity(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }}>Notes</label>
            <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: '#8A8B9F', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => onSave({ rawComponentId, quantity, notes })}
            disabled={!rawComponentId}
            style={{ padding: '8px 16px', fontSize: 13, background: rawComponentId ? '#EA580C' : '#F0F1F5', color: rawComponentId ? '#fff' : '#8A8B9F', border: 'none', borderRadius: 8, cursor: rawComponentId ? 'pointer' : 'default', fontWeight: 600 }}
          >
            Consume & Update Costs
          </button>
        </div>
      </div>
    </div>
  )
}
