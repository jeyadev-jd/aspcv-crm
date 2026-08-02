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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Completed Projects', value: String(allProjects.length), iconBg: '#EEF2FF', iconColor: '#5D78FF', Icon: Archive },
          { label: 'Total Budget', value: fmt(totalBudget), iconBg: '#ECFDF5', iconColor: '#10B981', Icon: DollarSign },
          { label: 'Total Profit', value: fmt(totalProfit), iconBg: '#F5F3FF', iconColor: '#8B5CF6', Icon: DollarSign, valueColor: totalProfit >= 0 ? '#16A34A' : '#DC2626' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: kpi.valueColor || '#23263B', marginTop: 4 }}>{kpi.value}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: kpi.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.Icon size={16} color={kpi.iconColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#B1B1BE' }} />
        <input
          style={{ width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 13, background: '#fff', color: '#23263B', outline: 'none' }}
          placeholder="Search by project name or customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => { e.currentTarget.style.borderColor = '#5D78FF' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
        />
      </div>

      {/* Project List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#B1B1BE' }}>Loading...</div>
      ) : isError ? (
        <EmptyState icon={AlertTriangle} title="Failed to load completed projects" subtitle="Something went wrong fetching this data."
          action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#B1B1BE' }}>{allProjects.length === 0 ? 'No completed projects yet' : 'No completed projects match your search'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((project: any) => (
            <div key={project.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: '#DCFCE7', color: '#15803D' }}>Completed</span>
                    {project.isLocked && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: '#F3F4F6', color: '#6B7280' }}>🔒 Locked</span>}
                  </div>
                  <h3 style={{ fontWeight: 600, color: '#23263B', fontSize: 14 }}>{project.title}</h3>
                  <p style={{ fontSize: 13, color: '#8A8B9F', marginTop: 2 }}>{project.company?.name}</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 12 }}>
                    {[
                      { label: 'Budget', value: fmt(project.budget || 0), color: '#2563EB' },
                      { label: 'Mfg Cost', value: fmt(project.manufacturingCost || 0), color: '#4F46E5' },
                      { label: 'Service Cost', value: fmt(project.serviceCost || 0), color: '#7C3AED' },
                      { label: 'Total Expenses', value: fmt(project.totalExpenses || 0), color: '#EA580C' },
                      { label: 'Profit', value: fmt(project.profit || 0), color: (project.profit || 0) >= 0 ? '#16A34A' : '#DC2626' },
                      { label: 'Completed', value: project.completedAt ? new Date(project.completedAt).toLocaleDateString() : '—', color: '#374151' },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 11, color: '#8A8B9F' }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    {project.warrantyPeriod && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: 99 }}>
                        <Shield size={12} /> {project.warrantyPeriod} months warranty
                      </span>
                    )}
                    {(project.warrantyStart || project.warrantyEnd) && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8A8B9F' }}>
                        <Calendar size={12} />
                        {project.warrantyStart ? new Date(project.warrantyStart).toLocaleDateString() : '?'} → {project.warrantyEnd ? new Date(project.warrantyEnd).toLocaleDateString() : '?'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedId(project.id === selectedId ? null : project.id)}
                  style={{ marginLeft: 16, padding: 8, background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#B1B1BE' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F4F5F9' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <ChevronRight size={16} style={{ transition: 'transform 0.2s', transform: selectedId === project.id ? 'rotate(90deg)' : 'none' }} />
                </button>
              </div>

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

  if (isLoading) return <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F0F1F5', fontSize: 13, color: '#B1B1BE' }}>Loading ERP data…</div>
  if (!erp) return null

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F0F1F5', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Cost Breakdown</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { label: 'Purchase', value: erp.purchaseCost },
            { label: 'Manufacturing', value: erp.manufacturingCost },
            { label: 'Labour', value: erp.labourCost },
            { label: 'Installation', value: erp.installationCost },
            { label: 'Service', value: erp.serviceCost },
          ].map(item => (
            <div key={item.label} style={{ background: '#F9FAFB', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8A8B9F', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#23263B' }}>{fmt(item.value || 0)}</div>
            </div>
          ))}
        </div>
      </div>

      {erp.purchaseOrders?.length > 0 && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Purchase Orders</h4>
          {erp.purchaseOrders.map((po: any) => (
            <div key={po.id} style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{po.refNumber} · {po.supplierName} · {fmt(po.totalAmount)} · {po.status}</div>
          ))}
        </div>
      )}

      {erp.workOrders?.length > 0 && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Manufacturing</h4>
          {erp.workOrders.map((wo: any) => (
            <div key={wo.id} style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{wo.refNumber} · {wo.title} · {wo.status} · Total: {fmt(wo.totalCost)}</div>
          ))}
        </div>
      )}

      {erp.serviceRecord && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Service Record</h4>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            Warranty: {erp.serviceRecord.warrantyStart ? new Date(erp.serviceRecord.warrantyStart).toLocaleDateString() : '?'} → {erp.serviceRecord.warrantyEnd ? new Date(erp.serviceRecord.warrantyEnd).toLocaleDateString() : '?'}
            · {erp.serviceRecord.serviceRequests?.length || 0} service requests
          </div>
        </div>
      )}
    </div>
  )
}
