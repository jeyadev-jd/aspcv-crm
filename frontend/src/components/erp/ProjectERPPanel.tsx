import { useState } from 'react'
import { DollarSign, Package, Cpu, Shield, FileText, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { useProjectERP, useCompleteProject, useCancelProject, useAssignProject } from '@/hooks/useERP'
import { useBOMs, useWorkOrders, useInventoryAllocations } from '@/hooks/useERP'
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

  if (isLoading) return <div className="text-xs text-gray-400 py-2">Loading ERP data…</div>
  if (!erp) return null

  const isCompleted = projectStatus === 'Completed'
  const isCancelled = projectStatus === 'Cancelled'

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 mt-4 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500" /> ERP Details
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Cost Breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cost Tracking</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Budget', value: erp.budget, color: 'text-blue-600' },
                { label: 'Remaining', value: erp.remainingBudget, color: erp.remainingBudget > 0 ? 'text-green-600' : 'text-red-600' },
                { label: 'Purchase Cost', value: erp.purchaseCost },
                { label: 'Mfg Cost', value: erp.manufacturingCost },
                { label: 'Labour Cost', value: erp.labourCost },
                { label: 'Service Cost', value: erp.serviceCost },
                { label: 'Total Expenses', value: erp.totalExpenses, color: 'text-orange-600' },
                { label: 'Profit', value: erp.profit, color: (erp.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 dark:bg-gray-750 rounded-lg p-2.5">
                  <div className="text-xs text-gray-400">{item.label}</div>
                  <div className={`text-sm font-medium ${item.color || 'text-gray-900 dark:text-white'}`}>{fmt(item.value || 0)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Assign PM/SE */}
          {!isLocked && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assignment</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Project Manager</label>
                  <select
                    className="w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white"
                    value={erp.assignedPMId || ''}
                    onChange={e => assignProject.mutate({ id: projectId, assignedPMId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Service Engineer</label>
                  <select
                    className="w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white"
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

          {/* BOM Status */}
          {erp.boms?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">BOMs ({erp.boms.length})</h4>
              {erp.boms.map((bom: any) => (
                <div key={bom.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-gray-600 dark:text-gray-300">{bom.refNumber} · {bom.items?.length} items</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    bom.status === 'Approved' || bom.status === 'SentToProcurement' ? 'bg-green-100 text-green-700' :
                    bom.status === 'Submitted' ? 'bg-yellow-100 text-yellow-700' :
                    bom.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>{bom.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Work Orders */}
          {erp.workOrders?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Work Orders ({erp.workOrders.length})</h4>
              {erp.workOrders.map((wo: any) => (
                <div key={wo.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-gray-600 dark:text-gray-300">{wo.refNumber} · {wo.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{fmt(wo.totalCost)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      wo.status === 'Finished' ? 'bg-green-100 text-green-700' :
                      wo.status === 'InProduction' || wo.status === 'Assembly' ? 'bg-blue-100 text-blue-700' :
                      wo.status === 'Testing' ? 'bg-purple-100 text-purple-700' :
                      wo.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>{wo.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Service Record */}
          {erp.serviceRecord && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service Record</h4>
              <div className="text-xs text-gray-500 space-y-1">
                {erp.serviceRecord.warrantyEnd && (
                  <div>Warranty ends: {new Date(erp.serviceRecord.warrantyEnd).toLocaleDateString()}</div>
                )}
                <div>{erp.serviceRecord.serviceRequests?.length || 0} service requests</div>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isCompleted && !isCancelled && !isLocked && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => completeProject.mutate(projectId)}
                disabled={completeProject.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {completeProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Complete Project
              </button>
              <button
                onClick={() => setShowCancelForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              >
                <XCircle className="w-3 h-3" /> Cancel Project
              </button>
            </div>
          )}

          {isLocked && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-2">
              <Shield className="w-3 h-3" /> Project records are locked (completed)
            </div>
          )}
        </div>
      )}

      {/* Cancel Form */}
      {showCancelForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cancel Project</h2>
            <p className="text-sm text-gray-500 mb-3">Allocated materials will be returned to inventory based on manufacturing status.</p>
            <textarea
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white mb-4"
              placeholder="Reason for cancellation…"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCancelForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={() => { cancelProject.mutate({ id: projectId, reason: cancelReason }); setShowCancelForm(false) }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
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
