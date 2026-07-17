import { useState } from 'react'
import { Plus, FileText, ShoppingCart, CheckCircle2, XCircle, Eye, Trash2, TrendingUp, Clock, DollarSign, FileCheck, Download } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { HandoverDocumentPDF } from '@/components/pdf/HandoverDocumentPDF'
import { useCurrency } from '@/lib/currencyContext'
import { useQuotations, useSalesOrders, useHandoverDocs, useCreateQuotation, useUpdateQuotation, useDeleteQuotation, useCreateSalesOrder, useUpdateSalesOrder, useMarkSalesOrderWon, useDeleteSalesOrder, useAcceptHandover, useRejectHandover } from '@/hooks/useSales'
import type { QuotationAPI, SalesOrderAPI, HandoverDocAPI } from '@/hooks/useSales'
import { useCompanies } from '@/hooks/useCompanies'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/lib/authStore'

type Tab = 'quotations' | 'orders' | 'handover'

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  Accepted: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  Expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  Confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  Won: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Lost: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.Draft}`}>{status}</span>
}

export default function Sales() {
  const [tab, setTab] = useState<Tab>('quotations')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<QuotationAPI | SalesOrderAPI | null>(null)
  const [selectedHandover, setSelectedHandover] = useState<HandoverDocAPI | null>(null)
  const [acceptingDoc, setAcceptingDoc] = useState<HandoverDocAPI | null>(null)
  const [selectedSEId, setSelectedSEId] = useState('')
  const { format: fmt } = useCurrency()

  const { data: quotations = [], isLoading: qLoading } = useQuotations()
  const { data: salesOrders = [], isLoading: soLoading } = useSalesOrders()
  const { data: handoverDocs = [], isLoading: hdLoading } = useHandoverDocs()
  const { data: companies = [] } = useCompanies()
  const can = useAuthStore(s => s.can)
  const { data: users = [] } = useUsers(can('hr_user', 'read_all'))

  const createQuotation = useCreateQuotation()
  const updateQuotation = useUpdateQuotation()
  const deleteQuotation = useDeleteQuotation()
  const createSO = useCreateSalesOrder()
  const updateSO = useUpdateSalesOrder()
  const markWon = useMarkSalesOrderWon()
  const deleteSO = useDeleteSalesOrder()
  const acceptHandover = useAcceptHandover()
  const rejectHandover = useRejectHandover()

  const loading = qLoading || soLoading || hdLoading

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'quotations', label: 'Quotations', icon: FileText, count: quotations.length },
    { key: 'orders', label: 'Sales Orders', icon: ShoppingCart, count: salesOrders.length },
    { key: 'handover', label: 'Handover Docs', icon: FileCheck, count: handoverDocs.filter(h => h.status === 'pending').length },
  ]

  const wonValue = salesOrders.filter(s => s.status === 'Won').reduce((s, o) => s + (o.budget || 0), 0)
  const activeOrders = salesOrders.filter(s => s.status === 'Confirmed').length
  const pendingHandovers = handoverDocs.filter(h => h.status === 'pending').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Quotations → Sales Orders → Handover</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {tab === 'quotations' ? 'New Quotation' : 'New Sales Order'}
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={FileText} label="Quotations" value={quotations.length} color="blue" />
        <KPICard icon={TrendingUp} label="Won Value" value={fmt(wonValue)} color="green" />
        <KPICard icon={Clock} label="Active Orders" value={activeOrders} color="orange" />
        <KPICard icon={DollarSign} label="Pending Handovers" value={pendingHandovers} color="purple" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && (
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          {tab === 'quotations' && (
            <QuotationsTable
              quotations={quotations}
              fmt={fmt}
              onEdit={(q: QuotationAPI) => { setEditItem(q); setShowForm(true) }}
              onDelete={(q: QuotationAPI) => deleteQuotation.mutate(q.id)}
              onConvertToSO={(q: QuotationAPI) => {
                createSO.mutate({ companyId: q.companyId, quotationId: q.id, title: q.title, budget: q.totalAmount, warrantyPeriod: q.warrantyPeriod, deliveryDate: q.deliveryDate, scope: q.scope, notes: q.notes } as Parameters<typeof createSO.mutate>[0])
              }}
            />
          )}
          {tab === 'orders' && (
            <SalesOrdersTable
              orders={salesOrders}
              fmt={fmt}
              onEdit={(o: SalesOrderAPI) => { setEditItem(o); setShowForm(true) }}
              onDelete={(o: SalesOrderAPI) => deleteSO.mutate(o.id)}
              onMarkWon={(o: SalesOrderAPI) => markWon.mutate(o.id)}
              isMarkingWon={markWon.isPending}
            />
          )}
          {tab === 'handover' && (
            <HandoverTable
              docs={handoverDocs}
              onAccept={(doc: HandoverDocAPI) => { setAcceptingDoc(doc); setSelectedSEId('') }}
              onReject={(doc: HandoverDocAPI) => rejectHandover.mutate(doc.id)}
              onView={(doc: HandoverDocAPI) => setSelectedHandover(doc)}
              isAccepting={acceptHandover.isPending}
              isRejecting={rejectHandover.isPending}
            />
          )}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <SalesFormModal
          tab={tab}
          editItem={editItem}
          companies={companies}
          quotations={quotations}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSaveQuotation={(data: Record<string, unknown>) => {
            if (editItem) updateQuotation.mutate({ id: editItem.id, ...data } as Parameters<typeof updateQuotation.mutate>[0])
            else createQuotation.mutate(data as Parameters<typeof createQuotation.mutate>[0])
            setShowForm(false)
          }}
          onSaveSalesOrder={(data: Record<string, unknown>) => {
            if (editItem) updateSO.mutate({ id: editItem.id, ...data } as Parameters<typeof updateSO.mutate>[0])
            else createSO.mutate(data as Parameters<typeof createSO.mutate>[0])
            setShowForm(false)
          }}
        />
      )}

      {/* SE Assignment Modal when accepting handover */}
      {acceptingDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Accept Handover</h2>
            <p className="text-sm text-gray-500 mb-4">{acceptingDoc.projectName} — assign a Service Engineer to handle BOM creation.</p>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Service Engineer</label>
            <select
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white mb-6"
              value={selectedSEId}
              onChange={e => setSelectedSEId(e.target.value)}
            >
              <option value="">— Assign later —</option>
              {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.roleName ?? u.role})</option>)}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAcceptingDoc(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  acceptHandover.mutate({ id: acceptingDoc.id, assignedSEId: selectedSEId || undefined })
                  setAcceptingDoc(null)
                }}
                disabled={acceptHandover.isPending}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Accept & Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handover Detail Modal */}
      {selectedHandover && (
        <HandoverDetailModal doc={selectedHandover} fmt={fmt} onClose={() => setSelectedHandover(null)} />
      )}
    </div>
  )
}

function KPICard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  )
}

function QuotationsTable({ quotations, fmt, onEdit, onDelete, onConvertToSO }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
          <tr>
            {['Ref', 'Title', 'Customer', 'Amount', 'Status', 'Valid Until', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {quotations.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No quotations yet</td></tr>
          ) : quotations.map((q: QuotationAPI) => (
            <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{q.refNumber}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{q.title}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{q.company?.name}</td>
              <td className="px-4 py-3 font-medium">{fmt(q.totalAmount)}</td>
              <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
              <td className="px-4 py-3 text-gray-500 text-xs">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(q)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500"><Eye className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onConvertToSO(q)} className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100" title="Convert to Sales Order">→ SO</button>
                  <button onClick={() => onDelete(q)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SalesOrdersTable({ orders, fmt, onEdit, onDelete, onMarkWon, isMarkingWon }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
          <tr>
            {['Ref', 'Title', 'Customer', 'Budget', 'Status', 'Project', 'Handover', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {orders.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No sales orders yet</td></tr>
          ) : orders.map((o: SalesOrderAPI) => (
            <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.refNumber}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{o.title}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{o.company?.name}</td>
              <td className="px-4 py-3 font-medium">{o.budget ? fmt(o.budget) : '—'}</td>
              <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
              <td className="px-4 py-3 text-xs text-gray-500">{o.project?.title || '—'}</td>
              <td className="px-4 py-3 text-xs">{o.handoverDoc ? <StatusBadge status={o.handoverDoc.status} /> : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(o)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500"><Eye className="w-3.5 h-3.5" /></button>
                  {o.status === 'Confirmed' && (
                    <button
                      onClick={() => onMarkWon(o)}
                      disabled={isMarkingWon}
                      className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-100 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Won
                    </button>
                  )}
                  <button onClick={() => onDelete(o)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HandoverTable({ docs, onAccept, onReject, onView, isAccepting, isRejecting }: any) {
  return (
    <div className="space-y-3">
      {docs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No handover documents yet. Mark a Sales Order as Won to generate one.</div>
      ) : docs.map((doc: HandoverDocAPI) => (
        <div key={doc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-gray-400">{doc.refNumber}</span>
                <StatusBadge status={doc.status} />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{doc.projectName}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Customer: {doc.customerDetails} · Budget: {doc.budget ? `₹${doc.budget.toLocaleString()}` : '—'} · Warranty: {doc.warrantyPeriod ? `${doc.warrantyPeriod} months` : '—'}
              </p>
              {doc.scope && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{doc.scope}</p>}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button onClick={() => onView(doc)} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50">View</button>
              {doc.status === 'pending' && (
                <>
                  <button
                    onClick={() => onAccept(doc)}
                    disabled={isAccepting}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Accept & Create Project
                  </button>
                  <button
                    onClick={() => onReject(doc)}
                    disabled={isRejecting}
                    className="px-3 py-1.5 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function HandoverDetailModal({ doc, fmt, onClose }: { doc: HandoverDocAPI; fmt: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Handover Document</h2>
            <p className="text-sm text-gray-500">{doc.refNumber}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={doc.status} />
            <PDFDownloadLink
              document={<HandoverDocumentPDF
                refNumber={doc.refNumber}
                date={doc.createdAt}
                status={doc.status}
                customerName={doc.customerDetails || 'Customer'}
                projectTitle={doc.projectName}
                estimatedValue={doc.budget}
                estimatedDelivery={doc.deliveryDate}
                projectDescription={doc.scope}
                specialConditions={doc.notes}
              />}
              fileName={`${doc.refNumber}.pdf`}
            >
              {({ loading }) => (
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                  <Download className="w-3 h-3" /> {loading ? 'Building…' : 'PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Project Name" value={doc.projectName} />
          <Field label="Customer" value={doc.customerDetails || '—'} />
          <Field label="Budget" value={doc.budget ? fmt(doc.budget) : '—'} />
          <Field label="Warranty Period" value={doc.warrantyPeriod ? `${doc.warrantyPeriod} months` : '—'} />
          <Field label="Delivery Date" value={doc.deliveryDate ? new Date(doc.deliveryDate).toLocaleDateString() : '—'} />
          <Field label="Product Details" value={doc.productDetails || '—'} />
          <Field label="Scope of Work" value={doc.scope || '—'} />
          <Field label="Notes" value={doc.notes || '—'} />
          {doc.acceptedAt && <Field label="Accepted At" value={new Date(doc.acceptedAt).toLocaleString()} />}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-gray-900 dark:text-white">{value}</div>
    </div>
  )
}

function SalesFormModal({ tab, editItem, companies, quotations, onClose, onSaveQuotation, onSaveSalesOrder }: any) {
  const [form, setForm] = useState<Record<string, any>>(editItem || {})
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const isQuotation = tab === 'quotations'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {editItem ? 'Edit' : 'New'} {isQuotation ? 'Quotation' : 'Sales Order'}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
            <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.companyId || ''} onChange={e => set('companyId', e.target.value)}>
              <option value="">Select customer…</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
            <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Heat Pump System for XYZ Factory" />
          </div>
          {!isQuotation && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Quotation (optional)</label>
              <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.quotationId || ''} onChange={e => set('quotationId', e.target.value)}>
                <option value="">None</option>
                {quotations.map((q: any) => <option key={q.id} value={q.id}>{q.refNumber} — {q.title}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Budget / Total Amount</label>
              <input type="number" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.budget || form.totalAmount || ''} onChange={e => set(isQuotation ? 'totalAmount' : 'budget', parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Warranty (months)</label>
              <input type="number" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.warrantyPeriod || ''} onChange={e => set('warrantyPeriod', parseInt(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Date</label>
            <input type="date" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.deliveryDate?.slice(0, 10) || ''} onChange={e => set('deliveryDate', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scope of Work</label>
            <textarea rows={3} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.scope || ''} onChange={e => set('scope', e.target.value)} />
          </div>
          {!isQuotation && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product Details</label>
              <textarea rows={2} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.productDetails || ''} onChange={e => set('productDetails', e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button
            onClick={() => isQuotation ? onSaveQuotation(form) : onSaveSalesOrder(form)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {editItem ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
