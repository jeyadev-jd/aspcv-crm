import { useState } from 'react'
import { DollarSign, Package, Cpu, Shield, FileText, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { useProjectERP, useCompleteProject, useCancelProject, useAssignProject } from '@/hooks/useERP'
import { useUsers } from '@/hooks/useUsers'

interface Props {
  projectId: string
  projectStatus: string
  isLocked?: boolean
}

export function ProjectERPPanel({ projectId, projectStatus, isLocked }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const { fmt } = useCurrency()

  const { data: erp, isLoading } = useProjectERP(projectId)
  const { data: users = [] } = useUsers()
  const completeProject = useCompleteProject()
  const cancelProject = useCancelProject()
  const assignProject = useAssignProject()

  if (isLoading) return <div style={{ fontSize: 12, color: '#B1B1BE', padding: '8px 0' }}>Loading ERP data…</div>
  if (!erp) return null

  const isCompleted = projectStatus === 'Completed'
  const isCancelled = projectStatus === 'Cancelled'

  return (
    <div style={{ borderTop: '1px solid #F0F1F5', marginTop: 16, paddingTop: 16 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={16} color="#5D78FF" /> ERP Details
        </span>
        {expanded ? <ChevronUp size={16} color="#B1B1BE" /> : <ChevronDown size={16} color="#B1B1BE" />}
      </button>

      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cost Breakdown */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Cost Tracking</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Budget', value: erp.budget, color: '#2563EB' },
                { label: 'Remaining', value: erp.remainingBudget, color: erp.remainingBudget > 0 ? '#16A34A' : '#DC2626' },
                { label: 'Purchase Cost', value: erp.purchaseCost },
                { label: 'Mfg Cost', value: erp.manufacturingCost },
                { label: 'Labour Cost', value: erp.labourCost },
                { label: 'Service Cost', value: erp.serviceCost },
                { label: 'Total Expenses', value: erp.totalExpenses, color: '#EA580C' },
                { label: 'Profit', value: erp.profit, color: (erp.profit || 0) >= 0 ? '#16A34A' : '#DC2626' },
              ].map(item => (
                <div key={item.label} style={{ background: '#F9FAFB', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#8A8B9F' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: item.color || '#23263B' }}>{fmt(item.value || 0)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Assign PM/SE */}
          {!isLocked && (
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Assignment</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#8A8B9F', marginBottom: 4 }}>Project Manager</label>
                  <select
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 4, padding: '6px 8px', fontSize: 12, background: '#fff', color: '#23263B' }}
                    value={erp.assignedPMId || ''}
                    onChange={e => assignProject.mutate({ id: projectId, assignedPMId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#8A8B9F', marginBottom: 4 }}>Service Engineer</label>
                  <select
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 4, padding: '6px 8px', fontSize: 12, background: '#fff', color: '#23263B' }}
                    value={erp.assignedSEId || ''}
                    onChange={e => assignProject.mutate({ id: projectId, assignedSEId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Orders */}
          {erp.purchaseOrders?.length > 0 && (
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Purchase Orders ({erp.purchaseOrders.length})</h4>
              {erp.purchaseOrders.map((po: any) => (
                <div key={po.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                  <span style={{ color: '#6B7280' }}>{po.refNumber} · {po.supplierName}</span>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 11,
                    background: po.status === 'Approved' || po.status === 'Delivered' ? '#DCFCE7' :
                      po.status === 'Sent' ? '#FEF9C3' : '#F3F4F6',
                    color: po.status === 'Approved' || po.status === 'Delivered' ? '#15803D' :
                      po.status === 'Sent' ? '#A16207' : '#6B7280',
                  }}>{po.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Work Orders */}
          {erp.workOrders?.length > 0 && (
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Work Orders ({erp.workOrders.length})</h4>
              {erp.workOrders.map((wo: any) => (
                <div key={wo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                  <span style={{ color: '#6B7280' }}>{wo.refNumber} · {wo.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#B1B1BE' }}>{fmt(wo.totalCost)}</span>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 11,
                      background: wo.status === 'Finished' ? '#DCFCE7' :
                        wo.status === 'InProduction' || wo.status === 'Assembly' ? '#DBEAFE' :
                        wo.status === 'Testing' ? '#F3E8FF' :
                        wo.status === 'Cancelled' ? '#FEE2E2' : '#F3F4F6',
                      color: wo.status === 'Finished' ? '#15803D' :
                        wo.status === 'InProduction' || wo.status === 'Assembly' ? '#1D4ED8' :
                        wo.status === 'Testing' ? '#7C3AED' :
                        wo.status === 'Cancelled' ? '#B91C1C' : '#6B7280',
                    }}>{wo.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Service Record */}
          {erp.serviceRecord && (
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Service Record</h4>
              <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {erp.serviceRecord.warrantyEnd && (
                  <div>Warranty ends: {new Date(erp.serviceRecord.warrantyEnd).toLocaleDateString()}</div>
                )}
                <div>{erp.serviceRecord.serviceRequests?.length || 0} service requests</div>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isCompleted && !isCancelled && !isLocked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid #F0F1F5' }}>
              <button
                onClick={() => completeProject.mutate(projectId)}
                disabled={completeProject.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: completeProject.isPending ? 0.5 : 1 }}
              >
                {completeProject.isPending ? <Loader2 size={12} /> : <CheckCircle2 size={12} />}
                Complete Project
              </button>
              <button
                onClick={() => setShowCancelForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                <XCircle size={12} /> Cancel Project
              </button>
            </div>
          )}

          {isLocked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#B1B1BE', paddingTop: 8 }}>
              <Shield size={12} /> Project records are locked (completed)
            </div>
          )}
        </div>
      )}

      {/* Cancel Form */}
      {showCancelForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 448, padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', marginBottom: 16 }}>Cancel Project</h2>
            <p style={{ fontSize: 13, color: '#8A8B9F', marginBottom: 12 }}>Allocated materials will be returned to inventory based on manufacturing status.</p>
            <textarea
              rows={3}
              style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#23263B', marginBottom: 16, resize: 'vertical' }}
              placeholder="Reason for cancellation…"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setShowCancelForm(false)} style={{ padding: '8px 16px', fontSize: 13, color: '#6B7280', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => { cancelProject.mutate({ id: projectId, reason: cancelReason }); setShowCancelForm(false) }}
                style={{ padding: '8px 16px', fontSize: 13, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
