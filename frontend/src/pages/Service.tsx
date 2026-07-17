import { useState } from 'react'
import { Shield, AlertTriangle, Plus, CheckCircle2, Clock, Wrench, Phone, Download, Search, X } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { WarrantyCertificatePDF } from '@/components/pdf/WarrantyCertificatePDF'
import { ServiceReportPDF } from '@/components/pdf/ServiceReportPDF'
import { useServiceRecords, useUpdateServiceRecord, useCreateServiceRequest, useUpdateServiceRequest, useWarrantyExpiring } from '@/hooks/useERP'
import type { ServiceRecordAPI, ServiceRequestAPI } from '@/hooks/useERP'
import EmptyState from '@/components/shared/EmptyState'

const REQ_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  InProgress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  Resolved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function warrantyDaysLeft(end?: string): number | null {
  if (!end) return null
  const ms = new Date(end).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function WarrantyBadge({ endDate }: { endDate?: string }) {
  const days = warrantyDaysLeft(endDate)
  if (days === null) return <span className="text-xs text-gray-400">No warranty</span>
  if (days < 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Expired</span>
  if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">{days}d left ⚠️</span>
  if (days <= 90) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{days}d left</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{days}d left</span>
}

type Tab = 'records' | 'expiring'

export default function Service() {
  const [tab, setTab] = useState<Tab>('records')
  const [search, setSearch] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecordAPI | null>(null)
  const [showRequestForm, setShowRequestForm] = useState(false)

  const { data: records = [], isLoading, isError, refetch } = useServiceRecords()
  const { data: expiring = [] } = useWarrantyExpiring(60)

  const updateRecord = useUpdateServiceRecord()
  const createRequest = useCreateServiceRequest()
  const updateRequest = useUpdateServiceRequest()

  const openRequests = records.reduce((s, r) => s + r.serviceRequests.filter(req => req.status === 'Open').length, 0)
  const expiringCount = expiring.length
  const q = search.trim().toLowerCase()
  const filteredRecords = q ? records.filter(r => r.project.title.toLowerCase().includes(q) || r.project.company.name.toLowerCase().includes(q)) : records

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Service & Warranty</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Post-installation service records and warranty tracking</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Shield} label="Service Records" value={records.length} color="blue" />
        <KPICard icon={AlertTriangle} label="Open Complaints" value={openRequests} color="red" />
        <KPICard icon={Clock} label="Warranty Expiring (60d)" value={expiringCount} color="orange" />
        <KPICard icon={CheckCircle2} label="Resolved Requests" value={records.reduce((s, r) => s + r.serviceRequests.filter(req => req.status === 'Resolved' || req.status === 'Closed').length, 0)} color="green" />
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          {[
            { key: 'records' as Tab, label: 'Service Records', count: records.length },
            { key: 'expiring' as Tab, label: 'Warranty Expiring', count: expiringCount },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {t.label}
              {t.count > 0 && <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>
        {tab === 'records' && (
          <div className="relative mb-2 hidden sm:block" style={{ width: 220 }}>
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project, customer…"
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:border-blue-400" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3 h-3" /></button>}
          </div>
        )}
      </div>

      {/* Records */}
      {tab === 'records' && (
        <div className="space-y-4">
          {isLoading ? <div className="text-center py-12 text-gray-400">Loading...</div>
          : isError ? (
            <EmptyState icon={AlertTriangle} title="Failed to load service records" subtitle="Something went wrong fetching this data."
              action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
          )
          : filteredRecords.length === 0 ? <div className="text-center py-12 text-gray-400">{records.length === 0 ? 'No service records yet. Complete a project to automatically create one.' : 'No service records match your search.'}</div>
          : filteredRecords.map(record => (
            <ServiceRecordCard
              key={record.id}
              record={record}
              onViewDetails={() => setSelectedRecord(record)}
              onAddRequest={() => { setSelectedRecord(record); setShowRequestForm(true) }}
              onResolveRequest={(req) => updateRequest.mutate({ requestId: req.id, status: 'Resolved' })}
            />
          ))}
        </div>
      )}

      {/* Expiring warranties */}
      {tab === 'expiring' && (
        <div className="space-y-3">
          {expiring.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No warranties expiring in the next 60 days.</div>
          ) : expiring.map(record => (
            <div key={record.id} className="bg-white dark:bg-gray-800 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{record.project?.title}</h3>
                <p className="text-sm text-gray-500">{record.project?.company?.name}</p>
              </div>
              <div className="text-right">
                <WarrantyBadge endDate={record.warrantyEnd} />
                <div className="text-xs text-gray-400 mt-1">Expires: {record.warrantyEnd ? new Date(record.warrantyEnd).toLocaleDateString() : '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail + Request Modal */}
      {selectedRecord && !showRequestForm && (
        <ServiceDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onAddRequest={() => setShowRequestForm(true)}
          onUpdateRequest={(req, status) => updateRequest.mutate({ requestId: req.id, status })}
        />
      )}

      {/* New Request Form */}
      {showRequestForm && selectedRecord && (
        <NewRequestModal
          record={selectedRecord}
          onClose={() => { setShowRequestForm(false); setSelectedRecord(null) }}
          onSave={(data: Record<string, unknown>) => { createRequest.mutate({ id: selectedRecord.id, ...data } as Parameters<typeof createRequest.mutate>[0]); setShowRequestForm(false); setSelectedRecord(null) }}
        />
      )}
    </div>
  )
}

function KPICard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}><Icon className="w-5 h-5" /></div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  )
}

function ServiceRecordCard({ record, onViewDetails, onAddRequest, onResolveRequest }: { record: ServiceRecordAPI; onViewDetails: () => void; onAddRequest: () => void; onResolveRequest: (req: ServiceRequestAPI) => void }) {
  const openReqs = record.serviceRequests.filter(r => r.status === 'Open' || r.status === 'InProgress')
  const days = warrantyDaysLeft(record.warrantyEnd)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{record.project?.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{record.project?.company?.name}</p>
          {record.productDescription && <p className="text-xs text-gray-400 mt-0.5">{record.productDescription}</p>}
        </div>
        <div className="text-right space-y-1">
          <WarrantyBadge endDate={record.warrantyEnd} />
          {record.warrantyEnd && <div className="text-xs text-gray-400">{new Date(record.warrantyEnd).toLocaleDateString()}</div>}
        </div>
      </div>

      {record.installationDate && (
        <p className="text-xs text-gray-400 mb-2">Installed: {new Date(record.installationDate).toLocaleDateString()}</p>
      )}

      {/* Open requests */}
      {openReqs.length > 0 && (
        <div className="mt-3 space-y-2">
          {openReqs.map(req => (
            <div key={req.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-750 rounded-lg p-2.5">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${REQ_STATUS_COLORS[req.status]}`}>{req.status}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{req.title}</span>
              </div>
              <button onClick={() => onResolveRequest(req)} className="text-xs text-green-600 hover:underline">Resolve</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button onClick={onViewDetails} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50">View History</button>
        <button onClick={onAddRequest} className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-1"><Plus className="w-3 h-3" />New Request</button>
        <span className="ml-auto text-xs text-gray-400">{record.serviceRequests.length} total requests</span>
      </div>
    </div>
  )
}

function ServiceDetailModal({ record, onClose, onAddRequest, onUpdateRequest }: { record: ServiceRecordAPI; onClose: () => void; onAddRequest: () => void; onUpdateRequest: (req: ServiceRequestAPI, status: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{record.project?.title}</h2>
            <p className="text-sm text-gray-500">{record.project?.company?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <WarrantyBadge endDate={record.warrantyEnd} />
            <PDFDownloadLink
              document={<WarrantyCertificatePDF
                certNumber={`WC-${record.id.slice(0, 8).toUpperCase()}`}
                customerName={record.project?.company?.name ?? 'Customer'}
                projectTitle={record.project?.title ?? '—'}
                warrantyStartDate={record.warrantyStart}
                warrantyEndDate={record.warrantyEnd}
                warrantyPeriodMonths={record.warrantyMonths}
                completionDate={record.installationDate}
              />}
              fileName={`warranty-${record.project?.title?.replace(/\s+/g, '-')}.pdf`}
            >
              {({ loading }) => (
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                  <Download className="w-3 h-3" /> {loading ? 'Building…' : 'Warranty PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <PDFDownloadLink
              document={<ServiceReportPDF
                reportNumber={`SR-${record.id.slice(0, 8).toUpperCase()}`}
                generatedDate={new Date().toISOString()}
                customerName={record.project?.company?.name ?? 'Customer'}
                projectTitle={record.project?.title ?? '—'}
                warrantyStart={record.warrantyStart}
                warrantyEnd={record.warrantyEnd}
                totalServiceCost={record.serviceCost}
                openRequests={record.serviceRequests.filter((r: any) => r.status === 'Open' || r.status === 'InProgress').length}
                closedRequests={record.serviceRequests.filter((r: any) => r.status === 'Resolved' || r.status === 'Closed').length}
                serviceRequests={record.serviceRequests.map((r: any) => ({
                  type: r.type,
                  description: r.title + (r.description ? `\n${r.description}` : ''),
                  status: r.status,
                  priority: r.priority,
                  reportedDate: r.createdAt,
                  cost: r.cost,
                  resolutionNotes: r.resolutionNotes,
                }))}
              />}
              fileName={`service-report-${record.project?.title?.replace(/\s+/g, '-')}.pdf`}
            >
              {({ loading }) => (
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Download className="w-3 h-3" /> {loading ? 'Building…' : 'Report PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">Installation:</span> <span className="text-gray-900 dark:text-white">{record.installationDate ? new Date(record.installationDate).toLocaleDateString() : '—'}</span></div>
            <div><span className="text-gray-400">Warranty Start:</span> <span className="text-gray-900 dark:text-white">{record.warrantyStart ? new Date(record.warrantyStart).toLocaleDateString() : '—'}</span></div>
            <div><span className="text-gray-400">Warranty End:</span> <span className="text-gray-900 dark:text-white">{record.warrantyEnd ? new Date(record.warrantyEnd).toLocaleDateString() : '—'}</span></div>
            <div><span className="text-gray-400">Service Cost:</span> <span className="text-gray-900 dark:text-white">₹{record.serviceCost.toLocaleString()}</span></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Service Requests</h3>
              <button onClick={onAddRequest} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add Request</button>
            </div>
            {record.serviceRequests.length === 0 ? (
              <p className="text-sm text-gray-400">No service requests yet</p>
            ) : (
              <div className="space-y-3">
                {record.serviceRequests.map(req => (
                  <div key={req.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${REQ_STATUS_COLORS[req.status]}`}>{req.status}</span>
                          <span className="text-xs text-gray-400 capitalize">{req.type}</span>
                          <span className="text-xs text-gray-400">#{req.refNumber}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{req.title}</p>
                        {req.description && <p className="text-xs text-gray-500 mt-0.5">{req.description}</p>}
                        {req.engineerName && <p className="text-xs text-gray-400 mt-1">Engineer: {req.engineerName}</p>}
                        {req.cost > 0 && <p className="text-xs text-gray-500 mt-0.5">Cost: ₹{req.cost.toLocaleString()}</p>}
                      </div>
                      {req.status === 'Open' && (
                        <div className="flex flex-col gap-1 ml-3">
                          <button onClick={() => onUpdateRequest(req, 'InProgress')} className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">Start</button>
                          <button onClick={() => onUpdateRequest(req, 'Resolved')} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">Resolve</button>
                        </div>
                      )}
                      {req.status === 'InProgress' && (
                        <button onClick={() => onUpdateRequest(req, 'Resolved')} className="ml-3 text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">Resolve</button>
                      )}
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

function NewRequestModal({ record, onClose, onSave }: any) {
  const [form, setForm] = useState({ type: 'complaint', title: '', description: '', priority: 'Medium', engineerName: '', cost: 0 })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Service Request</h2>
          <p className="text-sm text-gray-500">{record.project?.title}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="complaint">Complaint</option>
                <option value="maintenance">Maintenance</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
            <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief description of the issue" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Details</label>
            <textarea rows={3} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assigned Engineer</label>
              <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.engineerName} onChange={e => set('engineerName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Cost</label>
              <input type="number" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.cost} onChange={e => set('cost', parseFloat(e.target.value))} />
            </div>
          </div>
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Request</button>
        </div>
      </div>
    </div>
  )
}
