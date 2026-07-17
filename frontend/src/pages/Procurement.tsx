import { useState } from 'react'
import { Plus, Package, FileText, Truck, CheckCircle2, Trash2, ChevronRight, AlertCircle, Download, Search, X, Clock, IndianRupee } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { BOMPDF } from '@/components/pdf/BOMPDF'
import { PurchaseOrderPDF } from '@/components/pdf/PurchaseOrderPDF'
import { useCurrency } from '@/lib/currencyContext'
import { useBOMs, useCreateBOM, useUpdateBOM, useSubmitBOM, useApproveBOM, useRejectBOM, useSendBOMToProcurement, useDeleteBOM } from '@/hooks/useERP'
import { usePurchaseOrders, useCreatePurchaseOrder, useUpdatePurchaseOrder, useApprovePO, useSendPO, useDeletePO, useGoodsReceipts, useCreateGoodsReceipt } from '@/hooks/useERP'
import type { BOMAPI, PurchaseOrderAPI } from '@/hooks/useERP'
import { useProjects } from '@/hooks/useProjects'

type Tab = 'bom' | 'po' | 'gr'

const BOM_STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  Submitted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  SentToProcurement: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
}

const PO_STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Delivered: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  Closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || colorMap.Draft}`}>{status}</span>
}

export default function Procurement() {
  const [tab, setTab] = useState<Tab>('bom')
  const [search, setSearch] = useState('')
  const [showBOMForm, setShowBOMForm] = useState(false)
  const [showPOForm, setShowPOForm] = useState(false)
  const [showGRForm, setShowGRForm] = useState(false)
  const [selectedBOM, setSelectedBOM] = useState<BOMAPI | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderAPI | null>(null)
  const { format: fmt } = useCurrency()

  const { data: boms = [], isLoading: bomLoading, isError: bomError, refetch: refetchBoms } = useBOMs()
  const { data: purchaseOrders = [], isLoading: poLoading, isError: poError, refetch: refetchPOs } = usePurchaseOrders()
  const { data: goodsReceipts = [], isLoading: grLoading, isError: grError, refetch: refetchGRs } = useGoodsReceipts()
  const { data: projects = [] } = useProjects()

  const createBOM = useCreateBOM()
  const submitBOM = useSubmitBOM()
  const approveBOM = useApproveBOM()
  const rejectBOM = useRejectBOM()
  const sendToProc = useSendBOMToProcurement()
  const deleteBOM = useDeleteBOM()

  const createPO = useCreatePurchaseOrder()
  const approvePO = useApprovePO()
  const sendPO = useSendPO()
  const deletePO = useDeletePO()

  const createGR = useCreateGoodsReceipt()

  const tabs = [
    { key: 'bom' as Tab, label: 'Bill of Materials', icon: FileText, count: boms.length },
    { key: 'po' as Tab, label: 'Purchase Orders', icon: Package, count: purchaseOrders.filter(p => p.status !== 'Closed').length },
    { key: 'gr' as Tab, label: 'Goods Receipts', icon: Truck, count: goodsReceipts.length },
  ]

  const q = search.trim().toLowerCase()
  const filteredBoms = q ? boms.filter(b => b.refNumber.toLowerCase().includes(q) || (b.project?.title ?? '').toLowerCase().includes(q)) : boms
  const filteredPOs = q ? purchaseOrders.filter(p => p.refNumber.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)) : purchaseOrders
  const filteredGRs = q ? goodsReceipts.filter(g => g.refNumber.toLowerCase().includes(q) || (g.purchaseOrder?.refNumber ?? '').toLowerCase().includes(q)) : goodsReceipts

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Procurement</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">BOM → Purchase Orders → Goods Receipt</p>
        </div>
        <button
          onClick={() => tab === 'bom' ? setShowBOMForm(true) : tab === 'po' ? setShowPOForm(true) : setShowGRForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {tab === 'bom' ? 'New BOM' : tab === 'po' ? 'New PO' : 'Receive Goods'}
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">BOMs Awaiting Approval</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{boms.filter(b => b.status === 'Submitted').length}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active Purchase Orders</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{purchaseOrders.filter(p => ['Draft', 'Sent'].includes(p.status)).length}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Package className="w-4 h-4 text-blue-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total PO Value</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(purchaseOrders.reduce((s, p) => s + p.totalAmount, 0))}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <IndianRupee className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="relative mb-2 hidden sm:block" style={{ width: 220 }}>
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ref, project…"
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:border-blue-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3 h-3" /></button>}
        </div>
      </div>

      {/* BOM Table */}
      {tab === 'bom' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
              <tr>
                {['Ref', 'Project', 'Items', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {bomLoading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              : bomError ? <tr><td colSpan={5} className="px-4 py-8 text-center text-red-400">Failed to load BOMs. <button onClick={() => refetchBoms()} className="underline">Retry</button></td></tr>
              : filteredBoms.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{boms.length === 0 ? 'No BOMs yet' : 'No BOMs match your search'}</td></tr>
              : filteredBoms.map(bom => (
                <tr key={bom.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{bom.refNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{bom.project?.title}</td>
                  <td className="px-4 py-3 text-gray-500">{bom.items?.length || 0} items</td>
                  <td className="px-4 py-3"><StatusBadge status={bom.status} colorMap={BOM_STATUS_COLORS} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedBOM(bom)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50">View</button>
                      {bom.status === 'Draft' && <button onClick={() => submitBOM.mutate(bom.id)} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">Submit</button>}
                      {bom.status === 'Submitted' && (
                        <>
                          <button onClick={() => approveBOM.mutate(bom.id)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">Approve</button>
                          <button onClick={() => rejectBOM.mutate(bom.id)} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">Reject</button>
                        </>
                      )}
                      {bom.status === 'Approved' && <button onClick={() => sendToProc.mutate(bom.id)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">→ Procurement</button>}
                      <button onClick={() => { if (confirm('Delete this BOM?')) deleteBOM.mutate(bom.id) }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Table */}
      {tab === 'po' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
              <tr>
                {['Ref', 'Supplier', 'Project', 'Amount', 'Status', 'Expected', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {poLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              : poError ? <tr><td colSpan={7} className="px-4 py-8 text-center text-red-400">Failed to load purchase orders. <button onClick={() => refetchPOs()} className="underline">Retry</button></td></tr>
              : filteredPOs.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{purchaseOrders.length === 0 ? 'No purchase orders yet' : 'No purchase orders match your search'}</td></tr>
              : filteredPOs.map(po => (
                <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{po.refNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{po.supplierName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{po.bom?.project?.title || '—'}</td>
                  <td className="px-4 py-3 font-medium">{fmt(po.totalAmount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={po.status} colorMap={PO_STATUS_COLORS} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedPO(po)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300">View</button>
                      {po.status === 'Draft' && <button onClick={() => approvePO.mutate(po.id)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded">Approve</button>}
                      {po.status === 'Approved' && <button onClick={() => sendPO.mutate(po.id)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">Send</button>}
                      {po.status === 'Approved' && (
                        <button onClick={() => { setSelectedPO(po); setShowGRForm(true) }} className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded">Receive</button>
                      )}
                      <button onClick={() => { if (confirm('Delete this Purchase Order?')) deletePO.mutate(po.id) }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GR Table */}
      {tab === 'gr' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
              <tr>
                {['Ref', 'Purchase Order', 'Supplier', 'Items', 'Received At'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {grLoading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              : grError ? <tr><td colSpan={5} className="px-4 py-8 text-center text-red-400">Failed to load goods receipts. <button onClick={() => refetchGRs()} className="underline">Retry</button></td></tr>
              : filteredGRs.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{goodsReceipts.length === 0 ? 'No goods receipts yet' : 'No goods receipts match your search'}</td></tr>
              : filteredGRs.map(gr => (
                <tr key={gr.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{gr.refNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{gr.purchaseOrder?.refNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{gr.purchaseOrder?.supplierName}</td>
                  <td className="px-4 py-3 text-gray-500">{gr.items?.length || 0} items → Raw Materials</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(gr.receivedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BOM Detail Modal */}
      {selectedBOM && !showGRForm && (
        <BOMDetailModal bom={selectedBOM} fmt={fmt} onClose={() => setSelectedBOM(null)} />
      )}

      {/* PO Detail Modal */}
      {selectedPO && !showGRForm && (
        <PODetailModal po={selectedPO} fmt={fmt} onClose={() => setSelectedPO(null)} />
      )}

      {/* BOM Form */}
      {showBOMForm && (
        <BOMFormModal
          projects={projects}
          onClose={() => setShowBOMForm(false)}
          onSave={(data: Parameters<typeof createBOM.mutate>[0]) => { createBOM.mutate(data); setShowBOMForm(false) }}
        />
      )}

      {/* PO Form */}
      {showPOForm && (
        <POFormModal
          boms={boms.filter(b => b.status === 'SentToProcurement')}
          onClose={() => setShowPOForm(false)}
          onSave={(data: Parameters<typeof createPO.mutate>[0]) => { createPO.mutate(data); setShowPOForm(false) }}
        />
      )}

      {/* GR Form */}
      {showGRForm && selectedPO && (
        <GRFormModal
          po={selectedPO}
          onClose={() => { setShowGRForm(false); setSelectedPO(null) }}
          onSave={(data: Record<string, unknown>) => { createGR.mutate({ purchaseOrderId: selectedPO.id, ...data } as Parameters<typeof createGR.mutate>[0]); setShowGRForm(false); setSelectedPO(null) }}
        />
      )}
    </div>
  )
}

function BOMDetailModal({ bom, fmt, onClose }: { bom: BOMAPI; fmt: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">BOM — {bom.refNumber}</h2>
            <p className="text-sm text-gray-500">{bom.project?.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BOM_STATUS_COLORS[bom.status]}`}>{bom.status}</span>
            <PDFDownloadLink
              document={<BOMPDF
                refNumber={bom.refNumber}
                date={bom.createdAt}
                status={bom.status}
                projectTitle={bom.project?.title ?? '—'}
                items={bom.items.map(i => ({
                  materialName: i.itemName,
                  quantity: i.quantity,
                  unit: i.unit,
                  estimatedUnitCost: i.estimatedCost,
                  estimatedTotalCost: (i.estimatedCost ?? 0) * i.quantity,
                  notes: i.supplier ? `Supplier: ${i.supplier}` : null,
                }))}
                description={bom.notes}
              />}
              fileName={`${bom.refNumber}.pdf`}
            >
              {({ loading }) => (
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Download className="w-3 h-3" /> {loading ? 'Building…' : 'PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-700">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left pb-2">Item</th>
                <th className="text-right pb-2">Qty</th>
                <th className="text-left pb-2 pl-3">Unit</th>
                <th className="text-right pb-2">Est. Cost</th>
                <th className="text-left pb-2 pl-3">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {bom.items.map((item, i) => (
                <tr key={i} className="py-2">
                  <td className="py-2">{item.itemName}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 pl-3 text-gray-500">{item.unit || '—'}</td>
                  <td className="py-2 text-right">{item.estimatedCost ? fmt(item.estimatedCost) : '—'}</td>
                  <td className="py-2 pl-3 text-gray-500">{item.supplier || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 dark:border-gray-600">
              <tr>
                <td colSpan={3} className="pt-3 text-xs text-gray-500">Total Estimated</td>
                <td className="pt-3 text-right font-bold">{fmt(bom.items.reduce((s, i) => s + (i.estimatedCost || 0) * i.quantity, 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          {bom.notes && <p className="mt-4 text-sm text-gray-500">{bom.notes}</p>}
        </div>
      </div>
    </div>
  )
}

function PODetailModal({ po, fmt, onClose }: { po: PurchaseOrderAPI; fmt: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">PO — {po.refNumber}</h2>
            <p className="text-sm text-gray-500">{po.supplierName} · {po.bom?.project?.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PO_STATUS_COLORS[po.status]}`}>{po.status}</span>
            <PDFDownloadLink
              document={<PurchaseOrderPDF
                refNumber={po.refNumber}
                date={po.createdAt}
                status={po.status}
                supplierName={po.supplierName}
                supplierContact={po.supplierPhone ?? po.supplierEmail}
                projectTitle={po.bom?.project?.title}
                deliveryDate={po.expectedDelivery}
                taxRate={po.taxPercent}
                subtotal={po.subtotal}
                taxAmount={po.totalAmount - po.subtotal}
                totalAmount={po.totalAmount}
                items={po.items.map(i => ({
                  description: i.itemName,
                  unit: i.unit,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  totalPrice: i.amount,
                }))}
                notes={po.notes}
              />}
              fileName={`${po.refNumber}.pdf`}
            >
              {({ loading }) => (
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Download className="w-3 h-3" /> {loading ? 'Building…' : 'PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {po.supplierEmail && <p className="text-sm text-gray-500">Email: {po.supplierEmail}</p>}
          {po.supplierPhone && <p className="text-sm text-gray-500">Phone: {po.supplierPhone}</p>}
          {po.expectedDelivery && <p className="text-sm text-gray-500">Expected: {new Date(po.expectedDelivery).toLocaleDateString()}</p>}
          <table className="w-full text-sm mt-4">
            <thead className="border-b border-gray-100 dark:border-gray-700">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left pb-2">Item</th>
                <th className="text-right pb-2">Qty</th>
                <th className="text-right pb-2">Unit Price</th>
                <th className="text-right pb-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {po.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2">{item.itemName}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{fmt(item.unitPrice)}</td>
                  <td className="py-2 text-right">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 dark:border-gray-600">
              <tr><td colSpan={3} className="pt-2 text-xs text-gray-500">Subtotal</td><td className="pt-2 text-right">{fmt(po.subtotal)}</td></tr>
              <tr><td colSpan={3} className="py-1 text-xs text-gray-500">Tax ({po.taxPercent}%)</td><td className="py-1 text-right">{fmt(po.totalAmount - po.subtotal)}</td></tr>
              <tr><td colSpan={3} className="pt-2 font-bold">Total</td><td className="pt-2 text-right font-bold">{fmt(po.totalAmount)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function BOMFormModal({ projects, onClose, onSave }: any) {
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ itemName: '', quantity: 1, unit: '', estimatedCost: 0, supplier: '', remarks: '' }])

  const addItem = () => setItems(prev => [...prev, { itemName: '', quantity: 1, unit: '', estimatedCost: 0, supplier: '', remarks: '' }])
  const updateItem = (i: number, k: string, v: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Bill of Materials</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Select project…</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Items</label>
              <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add Item</button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 mb-2 items-start">
                <input className="col-span-2 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white" placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, 'itemName', e.target.value)} />
                <input type="number" className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value))} />
                <input className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white" placeholder="Unit" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} />
                <input type="number" className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white" placeholder="Est. Cost" value={item.estimatedCost} onChange={e => updateItem(i, 'estimatedCost', parseFloat(e.target.value))} />
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-sm">×</button>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave({ projectId, notes, items })} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create BOM</button>
        </div>
      </div>
    </div>
  )
}

function POFormModal({ boms, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({ taxPercent: 18, items: [{ itemName: '', quantity: 1, unit: '', unitPrice: 0, amount: 0 }] })
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const addItem = () => set('items', [...form.items, { itemName: '', quantity: 1, unit: '', unitPrice: 0, amount: 0 }])
  const updateItem = (i: number, k: string, v: any) => {
    const items = form.items.map((item: any, idx: number) => {
      if (idx !== i) return item
      const updated = { ...item, [k]: v }
      if (k === 'quantity' || k === 'unitPrice') updated.amount = (k === 'quantity' ? v : item.quantity) * (k === 'unitPrice' ? v : item.unitPrice)
      return updated
    })
    set('items', items)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Purchase Order</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">BOM Reference</label>
              <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.bomId || ''} onChange={e => set('bomId', e.target.value)}>
                <option value="">None</option>
                {boms.map((b: any) => <option key={b.id} value={b.id}>{b.refNumber} — {b.project?.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Name *</label>
              <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.supplierName || ''} onChange={e => set('supplierName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Email</label>
              <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.supplierEmail || ''} onChange={e => set('supplierEmail', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expected Delivery</label>
              <input type="date" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.expectedDelivery || ''} onChange={e => set('expectedDelivery', e.target.value)} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Items</label>
              <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add Item</button>
            </div>
            {form.items.map((item: any, i: number) => (
              <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                <input className="col-span-2 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white" placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, 'itemName', e.target.value)} />
                <input type="number" className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value))} />
                <input type="number" className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white" placeholder="Unit Price" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value))} />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">{item.amount?.toFixed(2)}</span>
                  <button onClick={() => set('items', form.items.filter((_: any, idx: number) => idx !== i))} className="text-red-400 text-sm ml-1">×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tax %</label>
              <input type="number" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.taxPercent} onChange={e => set('taxPercent', parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create PO</button>
        </div>
      </div>
    </div>
  )
}

function GRFormModal({ po, onClose, onSave }: any) {
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState(po.items.map((i: any) => ({ itemName: i.itemName, description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice })))
  const updateItem = (i: number, k: string, v: any) => setItems((prev: any[]) => prev.map((item: any, idx: number) => idx === i ? { ...item, [k]: v } : item))

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Receive Goods — {po.refNumber}</h2>
          <p className="text-sm text-gray-500 mt-1">All items will be placed in <strong>Raw Materials</strong> inventory</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">Materials received will be stored in Raw Materials inventory. Inventory Manager must manually allocate them to projects.</p>
          </div>
          {items.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{item.itemName}</div>
                <div className="text-xs text-gray-500">Unit price: ₹{item.unitPrice}</div>
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-400 mb-1">Qty Received</label>
                <input type="number" className="w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 dark:text-white" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value))} />
              </div>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave({ items, notes })} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Receive & Add to Inventory</button>
        </div>
      </div>
    </div>
  )
}
