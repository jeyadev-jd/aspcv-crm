import { useState } from 'react'
import { Plus, Package, Truck, CheckCircle2, Trash2, AlertCircle, Download, Search, X, IndianRupee } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { PurchaseOrderPDF } from '@/components/pdf/PurchaseOrderPDF'
import { useCurrency } from '@/lib/currencyContext'
import { usePurchaseOrders, useCreatePurchaseOrder, useApprovePO, useSendPO, useDeletePO, useGoodsReceipts, useCreateGoodsReceipt } from '@/hooks/useERP'
import type { PurchaseOrderAPI } from '@/hooks/useERP'
import { useProjects } from '@/hooks/useProjects'
import { useConfirm } from '@/components/shared/useConfirm'

type Tab = 'po' | 'gr'

const PO_STATUS_STYLES: Record<string, React.CSSProperties> = {
  Draft: { background: '#F0F1F5', color: '#5A5B6A' },
  Sent: { background: '#DBEAFE', color: '#1E40AF' },
  Approved: { background: '#D1FAE5', color: '#065F46' },
  Delivered: { background: '#EDE9FE', color: '#6B21A8' },
  Closed: { background: '#F0F1F5', color: '#8A8B9F' },
}

function StatusBadge({ status, styleMap }: { status: string; styleMap: Record<string, React.CSSProperties> }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 500,
      ...(styleMap[status] || styleMap.Draft)
    }}>{status}</span>
  )
}

export default function Procurement() {
  const { confirm, confirmDialog } = useConfirm()
  const [tab, setTab] = useState<Tab>('po')
  const [search, setSearch] = useState('')
  const [showPOForm, setShowPOForm] = useState(false)
  const [showGRForm, setShowGRForm] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderAPI | null>(null)
  const { format: fmt } = useCurrency()

  const { data: purchaseOrders = [], isLoading: poLoading, isError: poError, refetch: refetchPOs } = usePurchaseOrders()
  const { data: goodsReceipts = [], isLoading: grLoading, isError: grError, refetch: refetchGRs } = useGoodsReceipts()
  const { data: projects = [] } = useProjects()

  const createPO = useCreatePurchaseOrder()
  const approvePO = useApprovePO()
  const sendPO = useSendPO()
  const deletePO = useDeletePO()

  const createGR = useCreateGoodsReceipt()

  const tabs = [
    { key: 'po' as Tab, label: 'Purchase Orders', icon: Package, count: purchaseOrders.filter(p => p.status !== 'Closed').length },
    { key: 'gr' as Tab, label: 'Goods Receipts', icon: Truck, count: goodsReceipts.length },
  ]

  const q = search.trim().toLowerCase()
  const filteredPOs = q ? purchaseOrders.filter(p => p.refNumber.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)) : purchaseOrders
  const filteredGRs = q ? goodsReceipts.filter(g => g.refNumber.toLowerCase().includes(q) || (g.purchaseOrder?.refNumber ?? '').toLowerCase().includes(q)) : goodsReceipts

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {confirmDialog}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button
          onClick={() => tab === 'po' ? setShowPOForm(true) : setShowGRForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#2563EB', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          {tab === 'po' ? 'New PO' : 'Receive Goods'}
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Purchase Orders</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#23263B', marginTop: 4 }}>{purchaseOrders.filter(p => ['Draft', 'Sent'].includes(p.status)).length}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package style={{ width: 16, height: 16, color: '#3B82F6' }} />
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total PO Value</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#23263B', marginTop: 4 }}>{fmt(purchaseOrders.reduce((s, p) => s + p.totalAmount, 0))}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IndianRupee style={{ width: 16, height: 16, color: '#10B981' }} />
          </div>
        </div>
      </div>

      {/* Tabs + search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #F0F1F5' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 14, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid #2563EB' : '2px solid transparent',
              color: tab === t.key ? '#2563EB' : '#8A8B9F',
            }}>
              <t.icon style={{ width: 16, height: 16 }} />
              {t.label}
              {t.count > 0 && <span style={{ background: '#F0F1F5', color: '#5A5B6A', fontSize: 12, padding: '2px 6px', borderRadius: 9999 }}>{t.count}</span>}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', marginBottom: 8, width: 220 }}>
          <Search style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A8B9F' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ref, project..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 28, paddingTop: 6, paddingBottom: 6, fontSize: 12, borderRadius: 8, border: '1px solid #F0F1F5', outline: 'none', background: '#fff', color: '#23263B', boxSizing: 'border-box' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A8B9F', padding: 0 }}><X style={{ width: 12, height: 12 }} /></button>}
        </div>
      </div>

      {/* PO Table */}
      {tab === 'po' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #F0F1F5' }}>
                {['Ref', 'Supplier', 'Project', 'Amount', 'Status', 'Expected', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {poLoading ? <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#8A8B9F' }}>Loading...</td></tr>
              : poError ? <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#EF4444' }}>Failed to load purchase orders. <button onClick={() => refetchPOs()} style={{ textDecoration: 'underline', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Retry</button></td></tr>
              : filteredPOs.length === 0 ? <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#8A8B9F' }}>{purchaseOrders.length === 0 ? 'No purchase orders yet' : 'No purchase orders match your search'}</td></tr>
              : filteredPOs.map(po => (
                <tr key={po.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#8A8B9F' }}>{po.refNumber}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#23263B' }}>{po.supplierName}</td>
                  <td style={{ padding: '12px 16px', color: '#8A8B9F', fontSize: 12 }}>{po.project?.title || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#23263B' }}>{fmt(po.totalAmount)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={po.status} styleMap={PO_STATUS_STYLES} /></td>
                  <td style={{ padding: '12px 16px', color: '#8A8B9F', fontSize: 12 }}>{po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => setSelectedPO(po)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #F0F1F5', borderRadius: 4, color: '#5A5B6A', background: '#fff', cursor: 'pointer' }}>View</button>
                      {po.status === 'Draft' && <button onClick={() => approvePO.mutate(po.id)} style={{ padding: '4px 8px', fontSize: 12, background: '#ECFDF5', color: '#065F46', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Approve</button>}
                      {po.status === 'Approved' && <button onClick={() => sendPO.mutate(po.id)} style={{ padding: '4px 8px', fontSize: 12, background: '#EFF6FF', color: '#1E40AF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Send</button>}
                      {po.status === 'Approved' && (
                        <button onClick={() => { setSelectedPO(po); setShowGRForm(true) }} style={{ padding: '4px 8px', fontSize: 12, background: '#F5F3FF', color: '#6B21A8', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Receive</button>
                      )}
                      <button onClick={() => { confirm({ title: 'Delete this Purchase Order?', onConfirm: () => deletePO.mutate(po.id) }) }} style={{ padding: 4, background: 'none', border: 'none', borderRadius: 4, color: '#F87171', cursor: 'pointer' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
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
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #F0F1F5' }}>
                {['Ref', 'Purchase Order', 'Supplier', 'Items', 'Received At'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#8A8B9F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grLoading ? <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#8A8B9F' }}>Loading...</td></tr>
              : grError ? <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#EF4444' }}>Failed to load goods receipts. <button onClick={() => refetchGRs()} style={{ textDecoration: 'underline', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Retry</button></td></tr>
              : filteredGRs.length === 0 ? <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#8A8B9F' }}>{goodsReceipts.length === 0 ? 'No goods receipts yet' : 'No goods receipts match your search'}</td></tr>
              : filteredGRs.map(gr => (
                <tr key={gr.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#8A8B9F' }}>{gr.refNumber}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#23263B' }}>{gr.purchaseOrder?.refNumber}</td>
                  <td style={{ padding: '12px 16px', color: '#8A8B9F' }}>{gr.purchaseOrder?.supplierName}</td>
                  <td style={{ padding: '12px 16px', color: '#8A8B9F' }}>{gr.items?.length || 0} items &rarr; Raw Materials</td>
                  <td style={{ padding: '12px 16px', color: '#8A8B9F', fontSize: 12 }}>{new Date(gr.receivedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedPO && !showGRForm && (
        <PODetailModal po={selectedPO} fmt={fmt} onClose={() => setSelectedPO(null)} />
      )}

      {/* PO Form */}
      {showPOForm && (
        <POFormModal
          projects={projects}
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

const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalCard: React.CSSProperties = { background: '#fff', borderRadius: 16, width: '100%', maxHeight: '90vh', overflowY: 'auto' }
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #F0F1F5', borderRadius: 8, padding: '8px 12px', fontSize: 14, background: '#fff', color: '#23263B', outline: 'none', boxSizing: 'border-box' }
const inputSmall: React.CSSProperties = { border: '1px solid #F0F1F5', borderRadius: 4, padding: '6px 8px', fontSize: 12, background: '#fff', color: '#23263B', outline: 'none', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#8A8B9F', marginBottom: 4 }

function PODetailModal({ po, fmt, onClose }: { po: PurchaseOrderAPI; fmt: any; onClose: () => void }) {
  return (
    <div style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: 672 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>PO — {po.refNumber}</h2>
            <p style={{ fontSize: 14, color: '#8A8B9F', margin: '4px 0 0' }}>{po.supplierName} &middot; {po.project?.title}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={po.status} styleMap={PO_STATUS_STYLES} />
            <PDFDownloadLink
              document={<PurchaseOrderPDF
                refNumber={po.refNumber}
                date={po.createdAt}
                status={po.status}
                supplierName={po.supplierName}
                supplierContact={po.supplierPhone ?? po.supplierEmail}
                projectTitle={po.project?.title}
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
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  <Download style={{ width: 12, height: 12 }} /> {loading ? 'Building…' : 'PDF'}
                </button>
              )}
            </PDFDownloadLink>
            <button onClick={onClose} style={{ color: '#8A8B9F', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>&times;</button>
          </div>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {po.supplierEmail && <p style={{ fontSize: 14, color: '#8A8B9F', margin: 0 }}>Email: {po.supplierEmail}</p>}
          {po.supplierPhone && <p style={{ fontSize: 14, color: '#8A8B9F', margin: 0 }}>Phone: {po.supplierPhone}</p>}
          {po.expectedDelivery && <p style={{ fontSize: 14, color: '#8A8B9F', margin: 0 }}>Expected: {new Date(po.expectedDelivery).toLocaleDateString()}</p>}
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F1F5' }}>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontSize: 11, color: '#8A8B9F', textTransform: 'uppercase' }}>Item</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, fontSize: 11, color: '#8A8B9F', textTransform: 'uppercase' }}>Qty</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, fontSize: 11, color: '#8A8B9F', textTransform: 'uppercase' }}>Unit Price</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, fontSize: 11, color: '#8A8B9F', textTransform: 'uppercase' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '8px 0', color: '#23263B' }}>{item.itemName}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#23263B' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#23263B' }}>{fmt(item.unitPrice)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#23263B' }}>{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #E5E7EB' }}>
                <td colSpan={3} style={{ paddingTop: 8, fontSize: 12, color: '#8A8B9F' }}>Subtotal</td>
                <td style={{ paddingTop: 8, textAlign: 'right', color: '#23263B' }}>{fmt(po.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ padding: '4px 0', fontSize: 12, color: '#8A8B9F' }}>Tax ({po.taxPercent}%)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', color: '#23263B' }}>{fmt(po.totalAmount - po.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ paddingTop: 8, fontWeight: 700, color: '#23263B' }}>Total</td>
                <td style={{ paddingTop: 8, textAlign: 'right', fontWeight: 700, color: '#23263B' }}>{fmt(po.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function POFormModal({ projects, onClose, onSave }: any) {
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
    <div style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: 768 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>Create Purchase Order</h2>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Project</label>
              <select style={inputStyle} value={form.projectId || ''} onChange={e => set('projectId', e.target.value)}>
                <option value="">None</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Supplier Name *</label>
              <input style={inputStyle} value={form.supplierName || ''} onChange={e => set('supplierName', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Supplier Email</label>
              <input style={inputStyle} value={form.supplierEmail || ''} onChange={e => set('supplierEmail', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Expected Delivery</label>
              <input type="date" style={inputStyle} value={form.expectedDelivery || ''} onChange={e => set('expectedDelivery', e.target.value)} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#8A8B9F' }}>Items</label>
              <button onClick={addItem} style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>+ Add Item</button>
            </div>
            {form.items.map((item: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input style={inputSmall} placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, 'itemName', e.target.value)} />
                <input type="number" style={inputSmall} placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value))} />
                <input type="number" style={inputSmall} placeholder="Unit Price" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value))} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#8A8B9F' }}>{item.amount?.toFixed(2)}</span>
                  <button onClick={() => set('items', form.items.filter((_: any, idx: number) => idx !== i))} style={{ color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginLeft: 4 }}>&times;</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Tax %</label>
              <input type="number" style={inputStyle} value={form.taxPercent} onChange={e => set('taxPercent', parseFloat(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input style={inputStyle} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 14, color: '#5A5B6A', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{ padding: '8px 16px', fontSize: 14, background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Create PO</button>
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
    <div style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: 672 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #F0F1F5' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#23263B', margin: 0 }}>Receive Goods — {po.refNumber}</h2>
          <p style={{ fontSize: 14, color: '#8A8B9F', marginTop: 4 }}>All items will be placed in <strong>Raw Materials</strong> inventory</p>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlertCircle style={{ width: 16, height: 16, color: '#D97706', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>Materials received will be stored in Raw Materials inventory. Inventory Manager must manually allocate them to projects.</p>
          </div>
          {items.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#23263B' }}>{item.itemName}</div>
                <div style={{ fontSize: 12, color: '#8A8B9F' }}>Unit price: &#8377;{item.unitPrice}</div>
              </div>
              <div style={{ width: 96 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#8A8B9F', marginBottom: 4 }}>Qty Received</label>
                <input type="number" style={{ ...inputSmall, width: '100%' }} value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value))} />
              </div>
            </div>
          ))}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 14, color: '#5A5B6A', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave({ items, notes })} style={{ padding: '8px 16px', fontSize: 14, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 style={{ width: 16, height: 16 }} />Receive &amp; Add to Inventory</button>
        </div>
      </div>
    </div>
  )
}
