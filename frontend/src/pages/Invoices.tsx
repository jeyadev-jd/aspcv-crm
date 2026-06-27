import { useState, useRef } from 'react'
import { MoreHorizontal, X, Paperclip, ChevronLeft, ChevronRight, Plus, FileText, Download, Star, Trash2 } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { CsvImportExport } from '@/components/shared/CsvImportExport'
import type { CsvColDef } from '@/components/shared/CsvImportExport'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { InvoicePDF } from '@/components/pdf/InvoicePDF'
import { useSignatories, useCreateSignatory, useUpdateSignatory, useDeleteSignatory } from '@/hooks/useSignatories'

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoiceItem { id: string; item: string; hsnCode?: string; rate?: number; hours?: number; amount: number }
interface Invoice {
  id: string; number: string; date: string; customer: string
  status: string; amount: number; createdAt?: string
  customerGstin?: string; customerState?: string; placeOfSupply?: string
  typeOfSupply?: string; poNo?: string; poDate?: string; gstRate?: number; paymentTerms?: string
  signatoryId?: string
  items: InvoiceItem[]
  activities: { id?: string; text: string; createdAt?: string }[]
}

// ─── Backend hooks ────────────────────────────────────────────────────────────
function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices').then(r => r.data),
  })
}
function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/invoices', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INV_CSV_COLS: CsvColDef<Invoice>[] = [
  { header: 'Number',   accessor: r => r.number },
  { header: 'Date',     accessor: r => r.date },
  { header: 'Customer', accessor: r => r.customer },
  { header: 'Status',   accessor: r => r.status },
  { header: 'Amount',   accessor: r => String(r.amount) },
]
const INV_CSV_TEMPLATE = { Number: 'INV-2026-0001', Date: '01 Jan 2026', Customer: 'Acme Corp', Status: 'Unpaid', Amount: '100000' }
const VALID_INV_STATUSES = new Set(['Paid', 'Unpaid', 'Scheduled', 'Processing'])
const avatarColors = ['#5D78FF', '#FF9B52', '#FF5353', '#2BC155', '#8B5CF6']
const PAGE_SIZE = 5

const statusStyle: Record<string, { bg: string; color: string }> = {
  Paid:       { bg: '#E7FAF0', color: '#2BC155' },
  Unpaid:     { bg: '#FFF3F3', color: '#FF5353' },
  Scheduled:  { bg: '#E8EDFF', color: '#5D78FF' },
  Processing: { bg: '#FFF5EE', color: '#FF9B52' },
}

function fmtAmt(inr: number, symbol: string, currency: string): string {
  const v = currency === 'USD' ? inr / 83.5 : inr
  if (currency === 'INR') {
    if (v >= 100000) return `${symbol}${(v / 100000).toFixed(1)}L`
    if (v >= 1000)   return `${symbol}${(v / 1000).toFixed(1)}k`
  } else {
    if (v >= 1000) return `${symbol}${(v / 1000).toFixed(1)}k`
  }
  return `${symbol}${Math.round(v).toLocaleString()}`
}

function avatarColor(id: string) {
  const hash = id.split('').reduce((h, c) => h + c.charCodeAt(0), 0)
  return avatarColors[hash % avatarColors.length]
}

function fmtDateStr(d: string) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

// ─── PDF Modal ────────────────────────────────────────────────────────────────
const blankPdfForm = {
  toAddr: '', customerGstin: '', customerState: '', placeOfSupply: '',
  typeOfSupply: 'Service and Supply', poNo: '', poDate: '',
  gstRate: '9', paymentTerms: '', description: '',
}

function PdfModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const [form, setForm] = useState({ ...blankPdfForm, placeOfSupply: inv.customerState ?? '', customerState: inv.customerState ?? '', customerGstin: inv.customerGstin ?? '', poNo: inv.poNo ?? '', paymentTerms: inv.paymentTerms ?? '', gstRate: String(inv.gstRate ?? 9) })
  const [signId, setSignId] = useState<string | null>(null)
  const [showSigForm, setShowSigForm] = useState(false)
  const [sigForm, setSigForm] = useState({ name: '', designation: '', signatureData: '' })
  const sigFileRef = useRef<HTMLInputElement>(null)

  const { data: signatories = [] } = useSignatories()
  const createSig = useCreateSignatory()
  const updateSig = useUpdateSignatory()
  const deleteSig = useDeleteSignatory()

  const selectedSig = signatories.find(s => s.id === signId) ?? signatories.find(s => s.isDefault) ?? null

  function handleSigUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setSigForm(f => ({ ...f, signatureData: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  async function addSignatory() {
    if (!sigForm.name.trim()) return
    const row = await createSig.mutateAsync({ ...sigForm })
    setSignId(row.id)
    setSigForm({ name: '', designation: '', signatureData: '' })
    setShowSigForm(false)
  }

  const items = inv.items.length > 0
    ? inv.items.map(i => ({ item: i.item, hsnCode: i.hsnCode, rate: i.rate, hours: i.hours, amount: i.amount }))
    : [{ item: form.description || inv.customer, amount: inv.amount }]

  const pdfProps = {
    number: inv.number, date: inv.date, customer: inv.customer,
    toAddr: form.toAddr, customerGstin: form.customerGstin, customerState: form.customerState,
    placeOfSupply: form.placeOfSupply, typeOfSupply: form.typeOfSupply,
    poNo: form.poNo, poDate: form.poDate,
    gstRate: Number(form.gstRate) || 9, paymentTerms: form.paymentTerms,
    items,
    signatoryName: selectedSig?.name, signatoryDesignation: selectedSig?.designation ?? undefined,
    signatureData: selectedSig?.signatureData ?? undefined,
  }

  const inp: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid #F0F1F5', fontSize: 11, outline: 'none', boxSizing: 'border-box', color: '#374557', background: '#fafafa' }

  return (
    <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="crm-modal" style={{ width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Generate PDF — Invoice #{inv.number}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
          {/* Left: invoice fields */}
          <div style={{ padding: '16px 20px', borderRight: '1px solid #F0F1F5', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Invoice Details</p>

            {inv.items.length === 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#374557', marginBottom: 3 }}>Description (shown in PDF items)</p>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Supply and installation of 10kW Heat Pump system..." rows={2}
                  style={{ ...inp, resize: 'vertical' }} />
              </div>
            )}

            {([
              { key: 'toAddr',        label: 'Customer Address',     placeholder: 'Full billing address...', multi: true },
              { key: 'customerGstin', label: 'Customer GSTIN',       placeholder: '27AAPCS1234A1Z1' },
              { key: 'customerState', label: 'Customer State',       placeholder: 'Maharashtra' },
              { key: 'placeOfSupply', label: 'Place of Supply',      placeholder: 'Tamil Nadu' },
              { key: 'typeOfSupply',  label: 'Type of Supply',       placeholder: 'Service and Supply' },
              { key: 'poNo',          label: 'PO Number',            placeholder: 'PO-2026-001' },
              { key: 'poDate',        label: 'PO Date',              placeholder: '', type: 'date' },
              { key: 'gstRate',       label: 'GST Rate per leg (%)', placeholder: '9', type: 'number' },
              { key: 'paymentTerms',  label: 'Payment Terms',        placeholder: '30 days net' },
            ] as { key: string; label: string; placeholder: string; type?: string; multi?: boolean }[]).map(({ key, label, placeholder, type, multi }) => (
              <div key={key}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#374557', marginBottom: 3 }}>{label}</p>
                {multi
                  ? <textarea value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} rows={2} style={{ ...inp, resize: 'vertical' }} />
                  : <input type={type || 'text'} value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={inp} />
                }
              </div>
            ))}
          </div>

          {/* Right: signatory */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Signatory</p>

            {signatories.map(s => {
              const active = signId === s.id || (!signId && s.isDefault)
              return (
                <div key={s.id} onClick={() => setSignId(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: `2px solid ${active ? '#5D78FF' : '#F0F1F5'}`, cursor: 'pointer', background: active ? '#F0F4FF' : '#fff' }}>
                  {s.signatureData
                    ? <img src={s.signatureData} alt="" style={{ height: 34, width: 80, objectFit: 'contain', borderRadius: 4, border: '1px solid #F0F1F5', background: '#fff' }} />
                    : <div style={{ width: 80, height: 34, borderRadius: 4, background: '#F4F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#B1B1BE' }}>No sig</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                    {s.designation && <p style={{ fontSize: 10, color: '#B1B1BE' }}>{s.designation}</p>}
                    {s.isDefault && <span style={{ fontSize: 9, background: '#E8EDFF', color: '#5D78FF', padding: '1px 6px', borderRadius: 10 }}>Default</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button title="Set default" onClick={e => { e.stopPropagation(); updateSig.mutate({ id: s.id, isDefault: true }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.isDefault ? '#5D78FF' : '#D5D5D5', padding: 3 }}>
                      <Star size={12} fill={s.isDefault ? '#5D78FF' : 'none'} />
                    </button>
                    <button title="Delete" onClick={e => { e.stopPropagation(); if (window.confirm(`Delete signatory "${s.name}"?`)) deleteSig.mutate(s.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: 3 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}

            <button onClick={() => setShowSigForm(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>
              <Plus size={12} /> {showSigForm ? 'Cancel' : 'Add Signatory'}
            </button>

            {showSigForm && (
              <div style={{ background: '#FAFBFF', borderRadius: 8, border: '1px solid #F0F1F5', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={sigForm.name} onChange={e => setSigForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name *" style={inp} />
                <input value={sigForm.designation} onChange={e => setSigForm(f => ({ ...f, designation: e.target.value }))} placeholder="Designation (e.g. Director)" style={inp} />
                <div>
                  <p style={{ fontSize: 10, color: '#374557', marginBottom: 4 }}>Signature image</p>
                  {sigForm.signatureData && (
                    <img src={sigForm.signatureData} alt="preview" style={{ height: 40, maxWidth: 160, objectFit: 'contain', borderRadius: 4, border: '1px solid #F0F1F5', marginBottom: 6, display: 'block', background: '#fff' }} />
                  )}
                  <input ref={sigFileRef} type="file" accept="image/*" onChange={handleSigUpload} style={{ display: 'none' }} />
                  <button onClick={() => sigFileRef.current?.click()}
                    style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, border: '1px dashed #D5D5D5', background: '#fff', color: '#374557', cursor: 'pointer' }}>
                    Upload PNG / JPG
                  </button>
                </div>
                <button onClick={addSignatory} disabled={createSig.isPending || !sigForm.name.trim()}
                  style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', opacity: createSig.isPending || !sigForm.name.trim() ? 0.6 : 1 }}>
                  {createSig.isPending ? 'Saving...' : 'Save Signatory'}
                </button>
              </div>
            )}

            {selectedSig ? (
              <div style={{ padding: '10px 12px', background: '#E7FAF0', borderRadius: 8, fontSize: 11, color: '#2BC155' }}>
                PDF signatory: <strong>{selectedSig.name}</strong>
                {selectedSig.signatureData ? ' (signature included)' : ' — no signature uploaded'}
              </div>
            ) : signatories.length === 0 ? (
              <p style={{ fontSize: 11, color: '#B1B1BE' }}>No signatories yet. Add one to include a signature in the PDF.</p>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #F0F1F5', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
          <PDFDownloadLink document={<InvoicePDF {...pdfProps} />} fileName={`${inv.number}.pdf`}
            style={{ textDecoration: 'none' }}>
            {({ loading }) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: loading ? '#8B9FFF' : '#5D78FF', color: '#fff', cursor: loading ? 'wait' : 'pointer' }}>
                <Download size={13} />
                {loading ? 'Generating…' : 'Download PDF'}
              </span>
            )}
          </PDFDownloadLink>
        </div>
      </div>
    </div>
  )
}

// ─── New Invoice form types ───────────────────────────────────────────────────
interface FormItem { item: string; hsnCode: string; rate: string; hours: string; amount: string }
const blankItem = (): FormItem => ({ item: '', hsnCode: '', rate: '', hours: '1', amount: '' })
const blankForm = {
  number: '', customer: '', date: new Date().toISOString().slice(0, 10), status: 'Unpaid' as const,
  toAddr: '', customerGstin: '', customerState: '', placeOfSupply: '',
  typeOfSupply: 'Service and Supply', poNo: '', poDate: '', gstRate: '9', paymentTerms: '',
}

export default function Invoices() {
  const isMobile = useIsMobile()
  const { symbol, currency } = useCurrency()

  const { data: invoices = [], isLoading } = useInvoices()
  const createInvoice = useCreateInvoice()

  const [tab, setTab]           = useState<'All' | 'Draft' | 'Scheduled' | 'Paid'>('All')
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [comment, setComment]   = useState('')
  const [page, setPage]         = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(blankForm)
  const [formItems, setFormItems] = useState<FormItem[]>([blankItem()])
  const [formErr, setFormErr]   = useState<Record<string, string>>({})
  const [pdfInv, setPdfInv]     = useState<Invoice | null>(null)

  function importInvoices(rows: Record<string, string>[]) {
    let success = 0; const errors: string[] = []
    rows.forEach(async (row, i) => {
      if (!row.Customer || !row.Amount) { errors.push(`Row ${i + 1}: Customer and Amount required`); return }
      const status = VALID_INV_STATUSES.has(row.Status) ? row.Status : 'Unpaid'
      try {
        await createInvoice.mutateAsync({ number: row.Number || `IMP-${Date.now()}-${i}`, date: row.Date || new Date().toISOString(), customer: row.Customer, status, amount: Number(row.Amount) || 0 })
        success++
      } catch { errors.push(`Row ${i + 1}: Failed to save`) }
    })
    return { total: rows.length, success, errors }
  }

  const filtered   = tab === 'All' ? invoices : invoices.filter(i => i.status === tab)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function changeTab(t: typeof tab) { setTab(t); setPage(1) }
  function selectedIndex() { return filtered.findIndex(i => i.id === selected?.id) }
  function goModalPrev() { const idx = selectedIndex(); if (idx > 0) setSelected(filtered[idx - 1]) }
  function goModalNext() { const idx = selectedIndex(); if (idx < filtered.length - 1) setSelected(filtered[idx + 1]) }

  function recalcItem(items: FormItem[], idx: number) {
    return items.map((it, i) => {
      if (i !== idx) return it
      const r = parseFloat(it.rate) || 0
      const h = parseFloat(it.hours) || 0
      return { ...it, amount: r && h ? String(Math.round(r * h)) : it.amount }
    })
  }

  function setItemField(idx: number, key: keyof FormItem, val: string) {
    setFormItems(prev => {
      const next = prev.map((it, i) => i === idx ? { ...it, [key]: val } : it)
      if (key === 'rate' || key === 'hours') return recalcItem(next, idx)
      return next
    })
  }

  const itemsSubTotal = formItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
  const gstLeg = itemsSubTotal * (parseFloat(form.gstRate) || 9) / 100
  const grandTotal = itemsSubTotal + gstLeg * 2

  async function submitAdd() {
    const e: Record<string, string> = {}
    if (!form.number.trim()) e.number = 'Invoice number required'
    if (!form.customer.trim()) e.customer = 'Customer name required'
    if (!form.date) e.date = 'Date required'
    const validItems = formItems.filter(it => it.item.trim() && parseFloat(it.amount) > 0)
    if (!validItems.length) e.items = 'Add at least one item with amount'
    if (Object.keys(e).length) { setFormErr(e); return }
    try {
      await createInvoice.mutateAsync({
        number: form.number.trim(), date: form.date, customer: form.customer.trim(), status: form.status,
        toAddr: form.toAddr, customerGstin: form.customerGstin, customerState: form.customerState,
        placeOfSupply: form.placeOfSupply, typeOfSupply: form.typeOfSupply,
        poNo: form.poNo, poDate: form.poDate || undefined, gstRate: parseFloat(form.gstRate) || 9,
        paymentTerms: form.paymentTerms,
        items: validItems.map(it => ({ item: it.item.trim(), hsnCode: it.hsnCode || undefined, rate: parseFloat(it.rate) || undefined, hours: parseFloat(it.hours) || undefined, amount: parseFloat(it.amount) })),
      })
      setShowModal(false)
    } catch { setFormErr({ number: 'Failed — invoice number may already exist' }) }
  }

  const inp = (err?: boolean): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${err ? '#FF5353' : '#F0F1F5'}`,
    fontSize: 12, outline: 'none', boxSizing: 'border-box', color: '#374557',
  })

  const totalInr     = invoices.reduce((s, i) => s + i.amount, 0)
  const scheduledInr = invoices.filter(i => i.status === 'Scheduled').reduce((s, i) => s + i.amount, 0)
  const unpaidInr    = invoices.filter(i => i.status === 'Unpaid').reduce((s, i) => s + i.amount, 0)
  const paidInr      = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)

  const sideStats = [
    { label: 'All Invoices', sub: 'Total value',  value: fmtAmt(totalInr, symbol, currency),     bar: '#5D78FF', pct: 65 },
    { label: 'Scheduled',    sub: 'Upcoming',      value: fmtAmt(scheduledInr, symbol, currency), bar: '#FF9B52', pct: 45 },
    { label: 'Unpaid',       sub: 'Outstanding',   value: fmtAmt(unpaidInr, symbol, currency),    bar: '#FF5353', pct: 30 },
    { label: 'Paid',         sub: 'Collected',     value: fmtAmt(paidInr, symbol, currency),      bar: '#2BC155', pct: 55 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start', height: '100%' }}>
      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 200, flexShrink: 0 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Invoices breakdown</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Summary by status</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sideStats.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#374557' }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>{s.sub}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{s.value}</p>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${s.pct}%`, background: s.bar }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', borderBottom: '2px solid #F0F1F5' }}>
            {(['All', 'Draft', 'Scheduled', 'Paid'] as const).map(t => (
              <button key={t} onClick={() => changeTab(t)} style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 600,
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
                marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CsvImportExport data={invoices} columns={INV_CSV_COLS} filename="invoices.csv" templateRow={INV_CSV_TEMPLATE} onImport={importInvoices} compact={isMobile} />
            <button onClick={() => { setForm(blankForm); setFormItems([blankItem()]); setFormErr({}); setShowModal(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={13} /> New Invoice
            </button>
          </div>
        </div>

        <div className="crm-table-wrap" style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto', minHeight: 'calc(100vh - 200px)' }}>
          {isLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>Loading invoices…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No invoices — click "New Invoice" to create one</div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map(inv => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={14} style={{ color: '#5D78FF' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>#{inv.number}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{inv.customer}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[inv.status]?.bg, color: statusStyle[inv.status]?.color }}>{inv.status}</span>
                      <button onClick={e => { e.stopPropagation(); setPdfInv(inv) }}
                        style={{ background: '#E8EDFF', border: 'none', borderRadius: 6, padding: 5, cursor: 'pointer', color: '#5D78FF', display: 'flex', alignItems: 'center' }}>
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Amount</p><p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{fmtAmt(inv.amount, symbol, currency)}</p></div>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Date</p><p style={{ fontSize: 11, color: '#374557' }}>{fmtDateStr(inv.date)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  {['Number', 'Date', 'Customer', 'Status', `Amount (${currency})`, ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((inv, i) => (
                  <tr key={inv.id} onClick={() => setSelected(inv)}
                    style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={14} style={{ color: '#5D78FF' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#374557' }}>#{inv.number}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: '#374557' }}>{fmtDateStr(inv.date)}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(inv.id), flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#374557' }}>{inv.customer}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[inv.status]?.bg, color: statusStyle[inv.status]?.color }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{fmtAmt(inv.amount, symbol, currency)}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={e => { e.stopPropagation(); setPdfInv(inv) }}
                          style={{ background: '#E8EDFF', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#5D78FF', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                          <Download size={12} /> PDF
                        </button>
                        <button style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}>
                <ChevronLeft size={13} /> PREV
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => setPage(pg)}
                    style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}>
                NEXT <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="crm-modal" style={{ width: '100%', maxWidth: 740 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>Invoice #{selected.number}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => { setPdfInv(selected); setSelected(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#E8EDFF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}>
                  <Download size={13} /> Download PDF
                </button>
                <button onClick={() => setSelected(null)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} style={{ color: '#5D78FF' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{selected.customer}</p>
                    <p style={{ fontSize: 11, color: '#B1B1BE' }}>{fmtDateStr(selected.date)}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[selected.status]?.bg, color: statusStyle[selected.status]?.color }}>
                    {selected.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, fontSize: 12 }}>
                  <div>
                    <p style={{ fontWeight: 500, color: '#B1B1BE', marginBottom: 4 }}>From:</p>
                    <p style={{ fontWeight: 600, color: '#374557' }}>Aspiration Cleantech Ventures Pvt. Ltd.</p>
                    {['Chennai - 600043', 'Tamil Nadu, India', 'info@aspcv.com'].map((l, i) => (
                      <p key={i} style={{ color: '#B1B1BE' }}>{l}</p>
                    ))}
                  </div>
                  <div>
                    <p style={{ fontWeight: 500, color: '#B1B1BE', marginBottom: 4 }}>Bill to:</p>
                    <p style={{ fontWeight: 600, color: '#374557' }}>{selected.customer}</p>
                    {selected.customerState && <p style={{ color: '#B1B1BE' }}>{selected.customerState}</p>}
                    {selected.customerGstin && <p style={{ color: '#B1B1BE' }}>GSTIN: {selected.customerGstin}</p>}
                  </div>
                </div>

                <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 12 }}>Summary</p>
                <div style={{ border: '1px solid #F0F1F5', borderRadius: 10 }}>
                  <div style={{ padding: '12px 16px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#374557' }}>
                        <span>{it.item}</span><span>{fmtAmt(it.amount, symbol, currency)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: selected.items.length > 0 ? '1px solid #F0F1F5' : 'none', paddingTop: selected.items.length > 0 ? 6 : 0, color: '#374557' }}>
                      <span>Total</span><span>{fmtAmt(selected.amount, symbol, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 16 }}>Activities</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(selected.activities ?? []).slice(0, 4).map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#5D78FF', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 12, color: '#374557' }}>{a.text}</p>
                        {a.createdAt && <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{fmtDateStr(a.createdAt)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '8px 12px', border: '1px solid #F0F1F5' }}>
                  <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && setComment('')}
                    placeholder="Add a comment..." style={{ flex: 1, fontSize: 12, color: '#374557', background: 'transparent', border: 'none', outline: 'none' }} />
                  <button style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><Paperclip size={14} /></button>
                  <button onClick={() => setComment('')} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Send</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid #F0F1F5' }}>
              <button onClick={goModalPrev} disabled={selectedIndex() <= 0}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: selectedIndex() <= 0 ? '#D5D5D5' : '#374557', background: 'none', border: 'none', cursor: selectedIndex() <= 0 ? 'default' : 'pointer' }}>
                <ChevronLeft size={14} /> PREV
              </button>
              <span style={{ fontSize: 11, color: '#B1B1BE' }}>{selectedIndex() + 1} / {filtered.length}</span>
              <button onClick={goModalNext} disabled={selectedIndex() >= filtered.length - 1}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: selectedIndex() >= filtered.length - 1 ? '#D5D5D5' : '#374557', background: 'none', border: 'none', cursor: selectedIndex() >= filtered.length - 1 ? 'default' : 'pointer' }}>
                NEXT <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showModal && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="crm-modal" style={{ width: '100%', maxWidth: 860, maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Invoice</p>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Row 1: Invoice header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Invoice Number *</p>
                  <input autoFocus value={form.number} onChange={e => { setForm(f => ({ ...f, number: e.target.value })); setFormErr(p => ({ ...p, number: '' })) }}
                    placeholder="INV-2026-0001" style={inp(!!formErr.number)} />
                  {formErr.number && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{formErr.number}</p>}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Date *</p>
                  <input type="date" value={form.date} onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setFormErr(p => ({ ...p, date: '' })) }} style={inp(!!formErr.date)} />
                  {formErr.date && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{formErr.date}</p>}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Status</p>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof form.status }))} style={{ ...inp(), cursor: 'pointer' }}>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Processing">Processing</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>GST Rate per leg (%)</p>
                  <input type="number" value={form.gstRate} onChange={e => setForm(f => ({ ...f, gstRate: e.target.value }))} placeholder="9" style={inp()} />
                </div>
              </div>

              {/* Row 2: Bill To */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 10, borderBottom: '1px solid #F0F1F5', paddingBottom: 6 }}>Bill To</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Customer Name *</p>
                    <input value={form.customer} onChange={e => { setForm(f => ({ ...f, customer: e.target.value })); setFormErr(p => ({ ...p, customer: '' })) }}
                      placeholder="Company or person name..." style={inp(!!formErr.customer)} />
                    {formErr.customer && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{formErr.customer}</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Customer GSTIN</p>
                    <input value={form.customerGstin} onChange={e => setForm(f => ({ ...f, customerGstin: e.target.value }))} placeholder="27AAPCS1234A1Z1" style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Billing Address</p>
                    <textarea value={form.toAddr} onChange={e => setForm(f => ({ ...f, toAddr: e.target.value }))} placeholder="Full address..." rows={2} style={{ ...inp(), resize: 'vertical' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Customer State</p>
                    <input value={form.customerState} onChange={e => setForm(f => ({ ...f, customerState: e.target.value }))} placeholder="Maharashtra" style={inp()} />
                  </div>
                </div>
              </div>

              {/* Row 3: Supply details */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 10, borderBottom: '1px solid #F0F1F5', paddingBottom: 6 }}>Supply Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  {([
                    { key: 'placeOfSupply', label: 'Place of Supply',  ph: 'Tamil Nadu' },
                    { key: 'typeOfSupply',  label: 'Type of Supply',   ph: 'Service and Supply' },
                    { key: 'poNo',          label: 'PO Number',        ph: 'PO-2026-001' },
                    { key: 'paymentTerms',  label: 'Payment Terms',    ph: '30 days net' },
                  ] as { key: keyof typeof form; label: string; ph: string }[]).map(({ key, label, ph }) => (
                    <div key={key}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>{label}</p>
                      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={inp()} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>PO Date</p>
                  <input type="date" value={form.poDate} onChange={e => setForm(f => ({ ...f, poDate: e.target.value }))} style={{ ...inp(), maxWidth: 200 }} />
                </div>
              </div>

              {/* Row 4: Items */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 10, borderBottom: '1px solid #F0F1F5', paddingBottom: 6 }}>Items</p>
                {formErr.items && <p style={{ fontSize: 11, color: '#FF5353', marginBottom: 8 }}>{formErr.items}</p>}

                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 90px 28px', gap: 6, marginBottom: 6 }}>
                  {['Description', 'HSN Code', 'Rate (₹)', 'Qty', 'Amount (₹)', ''].map(h => (
                    <p key={h} style={{ fontSize: 10, fontWeight: 600, color: '#B1B1BE' }}>{h}</p>
                  ))}
                </div>

                {formItems.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 90px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input value={it.item} onChange={e => setItemField(idx, 'item', e.target.value)} placeholder="Item description..." style={inp()} />
                    <input value={it.hsnCode} onChange={e => setItemField(idx, 'hsnCode', e.target.value)} placeholder="998313" style={inp()} />
                    <input type="number" value={it.rate} onChange={e => setItemField(idx, 'rate', e.target.value)} placeholder="0" style={inp()} />
                    <input type="number" value={it.hours} onChange={e => setItemField(idx, 'hours', e.target.value)} placeholder="1" style={inp()} />
                    <input type="number" value={it.amount} onChange={e => setItemField(idx, 'amount', e.target.value)} placeholder="0" style={inp()} />
                    <button onClick={() => setFormItems(p => p.length > 1 ? p.filter((_, i) => i !== idx) : p)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: 0, display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <button onClick={() => setFormItems(p => [...p, blankItem()])}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer', marginTop: 4 }}>
                  <Plus size={12} /> Add Item
                </button>

                {/* Totals */}
                {itemsSubTotal > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', gap: 20 }}>
                      <span style={{ color: '#B1B1BE' }}>Sub-Total</span>
                      <span style={{ fontWeight: 600, color: '#374557', minWidth: 90, textAlign: 'right' }}>₹ {itemsSubTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                      <span style={{ color: '#B1B1BE' }}>SGST @ {form.gstRate || 9}%</span>
                      <span style={{ color: '#374557', minWidth: 90, textAlign: 'right' }}>₹ {Math.round(gstLeg).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                      <span style={{ color: '#B1B1BE' }}>CGST @ {form.gstRate || 9}%</span>
                      <span style={{ color: '#374557', minWidth: 90, textAlign: 'right' }}>₹ {Math.round(gstLeg).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, borderTop: '1px solid #F0F1F5', paddingTop: 6, marginTop: 2 }}>
                      <span style={{ fontWeight: 700, color: '#374557' }}>Grand Total</span>
                      <span style={{ fontWeight: 700, color: '#5D78FF', minWidth: 90, textAlign: 'right' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 24px', borderTop: '1px solid #F0F1F5', flexShrink: 0 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitAdd} disabled={createInvoice.isPending}
                style={{ padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', opacity: createInvoice.isPending ? 0.7 : 1 }}>
                {createInvoice.isPending ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Generation Modal */}
      {pdfInv && <PdfModal inv={pdfInv} onClose={() => setPdfInv(null)} />}
    </div>
  )
}
