import { useState, useRef } from 'react'
import { MoreHorizontal, X, Paperclip, ChevronLeft, ChevronRight, Plus, FileText, Download, Star, Trash2, Pencil, AlertTriangle } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'
import Pagination from '@/components/shared/Pagination'
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
import { useBankAccounts, useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount } from '@/hooks/useBankAccounts'
import { useActiveCompanyProfile } from '@/hooks/useCompanyProfile'
import { useConfirm } from '@/components/shared/useConfirm'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { toast } from '@/lib/toast'
import { useProjects } from '@/hooks/useProjects'
import type { BulkDeleteResult } from '@/hooks/useSupport'

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoiceItem {
  id: string; item: string; hsnCode?: string; rate?: number; hours?: number; amount: number
  quantity?: number; unit?: string; discountPct?: number; taxableValue?: number
  gstRate?: number; cgstAmt?: number; sgstAmt?: number; igstAmt?: number
  cessRate?: number; cessAmt?: number; lineTotal?: number
}
interface Invoice {
  id: string; number: string; date: string; customer: string
  status: string; amount: number; createdAt?: string
  invoiceType?: string; supplyType?: string; reverseCharge?: boolean
  customerGstin?: string; customerState?: string; customerStateCode?: string
  placeOfSupply?: string; typeOfSupply?: string
  poNo?: string; poDate?: string; gstRate?: number; paymentTerms?: string; paymentTermCode?: string
  signatoryId?: string; bankAccountId?: string; companyProfileId?: string
  toAddr?: string; shippingAddr?: string; invoiceDiscount?: number
  subTotal?: number; totalCgst?: number; totalSgst?: number; totalIgst?: number
  totalCess?: number; totalTax?: number; roundOff?: number; grandTotal?: number
  paidAmount?: number; financialYear?: string
  dueDate?: string; paidAt?: string; poDateStr?: string; project?: { name?: string } | null
  originalInvoiceNo?: string; cnDnReason?: string
  items: InvoiceItem[]
  activities: { id?: string; text: string; createdAt?: string }[]
  payments?: { id: string; amount: number; method?: string; paidAt: string; notes?: string }[]
}

// ─── Backend hooks ────────────────────────────────────────────────────────────
function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices', { params: { pageSize: 1000 } }).then(r => r.data.data),
  })
}
function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/invoices', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}
/**
 * Bulk delete. Only Draft invoices are removable — the server returns anything
 * else in `blocked`, since generated invoices must be cancelled to keep the
 * numbering sequence intact.
 */
function useBulkDeleteInvoices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/invoices/bulk-delete', { ids }).then(r => r.data as BulkDeleteResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}
function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => api.put(`/invoices/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

// ─── Workflow hooks ──────────────────────────────────────────────────────────
function useSubmitInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/submit`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}
function useWorkflowAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, comments, delegateToId }: { id: string; action: string; comments?: string; delegateToId?: string }) =>
      api.patch(`/invoices/${id}/workflow-action`, { action, comments, delegateToId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}
function usePendingApprovals() {
  return useQuery<any[]>({
    queryKey: ['pending-approvals'],
    queryFn: () => api.get('/invoices/workflow/pending').then(r => r.data),
  })
}
function useWorkflowHistory(invoiceId: string | null) {
  return useQuery({
    queryKey: ['workflow-history', invoiceId],
    queryFn: () => api.get(`/invoices/${invoiceId}/workflow-history`).then(r => r.data),
    enabled: !!invoiceId,
  })
}

const WORKFLOW_STATUSES = new Set(['Submitted', 'DeptReview', 'MgrApproval', 'FinanceReview', 'FinanceApproval', 'DirectorApproval'])

function statusLabel(s: string) {
  const labels: Record<string, string> = {
    DeptReview: 'Dept Review', MgrApproval: 'Manager Approval',
    FinanceReview: 'Finance Review', FinanceApproval: 'Finance Approval',
    DirectorApproval: 'Director Approval', PaymentProcessing: 'Payment Processing',
  }
  return labels[s] || s
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
const VALID_INV_STATUSES = new Set(['Paid', 'Unpaid', 'Draft', 'Sent', 'PartiallyPaid', 'Overdue', 'Cancelled', 'PendingApproval', 'Generated', 'Closed', 'Scheduled', 'Processing', 'Submitted', 'DeptReview', 'MgrApproval', 'FinanceReview', 'FinanceApproval', 'DirectorApproval', 'Approved', 'Returned', 'Rejected', 'PaymentProcessing'])
const avatarColors = ['#5D78FF', '#FF9B52', '#FF5353', '#2BC155', '#8B5CF6']
const PAGE_SIZE = 5

const statusStyle: Record<string, { bg: string; color: string }> = {
  Draft:           { bg: '#F4F5F9', color: '#6B7280' },
  PendingApproval: { bg: '#FFF5EE', color: '#FF9B52' },
  Approved:        { bg: '#E8EDFF', color: '#5D78FF' },
  Generated:       { bg: '#E8EDFF', color: '#5D78FF' },
  Sent:            { bg: '#EDE9FE', color: '#8B5CF6' },
  Unpaid:          { bg: '#FFF3F3', color: '#FF5353' },
  PartiallyPaid:   { bg: '#FFF5EE', color: '#FF9B52' },
  Paid:            { bg: '#E7FAF0', color: '#2BC155' },
  Overdue:         { bg: '#FFF3F3', color: '#DC2626' },
  Closed:          { bg: '#E7FAF0', color: '#059669' },
  Cancelled:       { bg: '#FEE2E2', color: '#991B1B' },
  Scheduled:       { bg: '#E8EDFF', color: '#5D78FF' },
  Processing:      { bg: '#FFF5EE', color: '#FF9B52' },
  Submitted:       { bg: '#FFF5EE', color: '#FF9B52' },
  DeptReview:      { bg: '#FEF3C7', color: '#D97706' },
  MgrApproval:     { bg: '#FEF3C7', color: '#B45309' },
  FinanceReview:   { bg: '#DBEAFE', color: '#2563EB' },
  FinanceApproval: { bg: '#DBEAFE', color: '#1D4ED8' },
  DirectorApproval:{ bg: '#EDE9FE', color: '#7C3AED' },
  Returned:        { bg: '#FFF3F3', color: '#DC2626' },
  Rejected:        { bg: '#FEE2E2', color: '#991B1B' },
  PaymentProcessing:{ bg: '#E8EDFF', color: '#5D78FF' },
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

// Full ₹ amount with Indian digit grouping — used where an exact figure matters
// (amount breakdowns, tax summary) rather than the compact L/k form.
function fmtFullInr(inr: number, symbol: string, currency: string) {
  const v = currency === 'USD' ? inr / 83.5 : inr
  return `${symbol}${Math.round(v).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`
}

// ─── Invoice-type badges ────────────────────────────────────────────────────────
// Every InvoiceType enum value maps to a short label + colour so each row is
// self-describing instead of every invoice looking identical.
const INVOICE_TYPE_META: Record<string, { label: string; bg: string; color: string }> = {
  TaxInvoice:        { label: 'Tax',        bg: '#E8EDFF', color: '#5D78FF' },
  BillOfSupply:      { label: 'Bill/Supply',bg: '#F4F5F9', color: '#6B7280' },
  ProformaInvoice:   { label: 'Proforma',   bg: '#FEF3C7', color: '#B45309' },
  CreditNote:        { label: 'Credit Note',bg: '#FEE2E2', color: '#991B1B' },
  DebitNote:         { label: 'Debit Note', bg: '#FFEDD5', color: '#C2410C' },
  ExportInvoice:     { label: 'Export',     bg: '#E7FAF0', color: '#059669' },
  SalesInvoice:      { label: 'Sales',      bg: '#E8EDFF', color: '#5D78FF' },
  PurchaseInvoice:   { label: 'Purchase',   bg: '#EDE9FE', color: '#7C3AED' },
  CommercialInvoice: { label: 'Commercial', bg: '#E8EDFF', color: '#5D78FF' },
  RecurringInvoice:  { label: 'Recurring',  bg: '#DBEAFE', color: '#2563EB' },
  ServiceInvoice:    { label: 'Service',    bg: '#DBEAFE', color: '#2563EB' },
  FinalInvoice:      { label: 'Final',      bg: '#E7FAF0', color: '#059669' },
  ExpenseClaim:      { label: 'Expense',    bg: '#FFF5EE', color: '#FF9B52' },
  VendorBill:        { label: 'Vendor Bill',bg: '#EDE9FE', color: '#7C3AED' },
}
function invoiceTypeMeta(t?: string) {
  return (t && INVOICE_TYPE_META[t]) || { label: t || 'Tax', bg: '#F4F5F9', color: '#6B7280' }
}

// Two-letter initials for the customer badge — replaces the meaningless colour circle.
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const OPEN_STATUSES = ['Sent', 'Unpaid', 'PartiallyPaid', 'Overdue', 'Generated', 'Approved']
function isOpen(status: string) { return OPEN_STATUSES.includes(status) }
function outstandingOf(i: { grandTotal?: number; amount: number; paidAmount?: number }) {
  return (i.grandTotal || i.amount) - (i.paidAmount || 0)
}

// Days between now and the due date; positive = still due, negative = overdue.
function dueInfo(inv: { dueDate?: string; status: string }): { label: string; tone: string } | null {
  if (!inv.dueDate) return null
  const days = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000)
  if (['Paid', 'Closed', 'Cancelled'].includes(inv.status)) return null
  if (days < 0)  return { label: `${Math.abs(days)}d overdue`, tone: '#DC2626' }
  if (days === 0) return { label: 'Due today', tone: '#FF9B52' }
  if (days <= 3) return { label: `${days}d left`, tone: '#FF9B52' }
  return { label: `${days}d left`, tone: '#B1B1BE' }
}

// Aging bucket for an open receivable, keyed off due date (falls back to invoice date).
function agingBucket(inv: { dueDate?: string; date: string }): '0-30' | '31-60' | '61-90' | '90+' {
  const ref = inv.dueDate || inv.date
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000)
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

// ─── PDF Modal ────────────────────────────────────────────────────────────────
const blankPdfForm = {
  toAddr: '', customerGstin: '', customerState: '', customerStateCode: '', placeOfSupply: '',
  typeOfSupply: 'Service and Supply', poNo: '', poDate: '',
  gstRate: '9', paymentTerms: '', description: '',
}

function PdfModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const { confirm, confirmDialog } = useConfirm()
  const [form, setForm] = useState({ ...blankPdfForm, toAddr: inv.toAddr ?? '', placeOfSupply: inv.placeOfSupply ?? inv.customerState ?? '', customerState: inv.customerState ?? '', customerStateCode: inv.customerStateCode ?? '', customerGstin: inv.customerGstin ?? '', typeOfSupply: inv.typeOfSupply ?? 'Service and Supply', poNo: inv.poNo ?? '', poDate: inv.poDate?.slice(0, 10) ?? '', paymentTerms: inv.paymentTerms ?? '', gstRate: String(inv.gstRate ?? 9) })
  const { data: companyProfile } = useActiveCompanyProfile()
  const [signId, setSignId] = useState<string | null>(inv.signatoryId ?? null)
  const [showSigForm, setShowSigForm] = useState(false)
  const updateInvoice = useUpdateInvoice()
  const [sigForm, setSigForm] = useState({ name: '', designation: '', signatureData: '' })
  const sigFileRef = useRef<HTMLInputElement>(null)

  const { data: signatories = [] } = useSignatories()
  const createSig = useCreateSignatory()
  const updateSig = useUpdateSignatory()
  const deleteSig = useDeleteSignatory()

  const selectedSig = signatories.find(s => s.id === signId) ?? signatories.find(s => s.isDefault) ?? null

  const [bankId, setBankId] = useState<string | null>(inv.bankAccountId ?? null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [editingBankId, setEditingBankId] = useState<string | null>(null)
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', ifscCode: '' })

  const { data: bankAccounts = [] } = useBankAccounts()
  const createBank = useCreateBankAccount()
  const updateBank = useUpdateBankAccount()
  const deleteBank = useDeleteBankAccount()

  const selectedBank = bankAccounts.find(b => b.id === bankId) ?? bankAccounts.find(b => b.isDefault) ?? null

  function selectBank(id: string) {
    setBankId(id)
    updateInvoice.mutate({ id: inv.id, bankAccountId: id })
  }

  async function addBankAccount() {
    if (!bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifscCode.trim()) return
    const row = await createBank.mutateAsync({ ...bankForm })
    selectBank(row.id)
    setBankForm({ bankName: '', accountNumber: '', ifscCode: '' })
    setShowBankForm(false)
  }

  function startEditBank(b: { id: string; bankName: string; accountNumber: string; ifscCode: string }) {
    setEditingBankId(b.id)
    setBankForm({ bankName: b.bankName, accountNumber: b.accountNumber, ifscCode: b.ifscCode })
    setShowBankForm(false)
  }

  async function saveBankEdit() {
    if (!editingBankId || !bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifscCode.trim()) return
    await updateBank.mutateAsync({ id: editingBankId, ...bankForm })
    setEditingBankId(null)
    setBankForm({ bankName: '', accountNumber: '', ifscCode: '' })
  }

  function handleSigUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setSigForm(f => ({ ...f, signatureData: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  function selectSig(id: string) {
    setSignId(id)
    updateInvoice.mutate({ id: inv.id, signatoryId: id })
  }

  async function addSignatory() {
    if (!sigForm.name.trim()) return
    const row = await createSig.mutateAsync({ ...sigForm })
    selectSig(row.id)
    setSigForm({ name: '', designation: '', signatureData: '' })
    setShowSigForm(false)
  }

  const items = inv.items.length > 0
    ? inv.items.map(i => ({
        item: i.item, hsnCode: i.hsnCode, rate: i.rate, hours: i.hours, amount: i.amount,
        quantity: i.quantity, unit: i.unit, discountPct: i.discountPct, taxableValue: i.taxableValue,
        gstRate: i.gstRate, cgstAmt: i.cgstAmt, sgstAmt: i.sgstAmt, igstAmt: i.igstAmt,
        cessRate: i.cessRate, cessAmt: i.cessAmt, lineTotal: i.lineTotal,
      }))
    : [{ item: form.description || inv.customer, amount: inv.amount }]

  const pdfProps = {
    number: inv.number, date: inv.date, customer: inv.customer,
    toAddr: form.toAddr, shippingAddr: inv.shippingAddr,
    customerGstin: form.customerGstin, customerState: form.customerState,
    customerStateCode: form.customerStateCode || inv.customerStateCode,
    placeOfSupply: form.placeOfSupply, supplyType: inv.supplyType,
    typeOfSupply: form.typeOfSupply, reverseCharge: inv.reverseCharge,
    invoiceType: inv.invoiceType,
    poNo: form.poNo, poDate: form.poDate,
    gstRate: Number(form.gstRate) || 18, paymentTerms: form.paymentTerms,
    items,
    subTotal: inv.subTotal, totalCgst: inv.totalCgst, totalSgst: inv.totalSgst,
    totalIgst: inv.totalIgst, totalCess: inv.totalCess, totalTax: inv.totalTax,
    roundOff: inv.roundOff, grandTotal: inv.grandTotal, invoiceDiscount: inv.invoiceDiscount,
    originalInvoiceNo: inv.originalInvoiceNo, cnDnReason: inv.cnDnReason,
    status: inv.status,
    signatoryName: selectedSig?.name, signatoryDesignation: selectedSig?.designation ?? undefined,
    signatureData: selectedSig?.signatureData ?? undefined,
    bankName: selectedBank?.bankName, bankAccountNumber: selectedBank?.accountNumber, bankIfsc: selectedBank?.ifscCode,
    // Letterhead comes from the configured Company Profile; the PDF falls back
    // to its built-in ASPCV defaults when none is set up yet.
    companyName: companyProfile?.companyName,
    companyLegalName: companyProfile?.legalName,
    companyAddr: companyProfile?.registeredAddr,
    companyGstin: companyProfile?.gstin,
    companyPan: companyProfile?.pan,
    companyState: companyProfile?.state,
    companyStateCode: companyProfile?.stateCode,
    companyUdyam: companyProfile?.udyam ?? undefined,
    companyPhone: companyProfile?.phone,
    companyEmail: companyProfile?.email,
    companyWebsite: companyProfile?.website ?? undefined,
    logoUrl: companyProfile?.logoUrl ?? undefined,
    sealUrl: companyProfile?.sealUrl ?? undefined,
    declarationText: companyProfile?.declarationText ?? undefined,
    termsText: companyProfile?.termsText ?? undefined,
  }

  const inp: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid #F0F1F5', fontSize: 11, outline: 'none', boxSizing: 'border-box', color: '#374557', background: '#fafafa' }

  return (
    <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {confirmDialog}
      <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
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
              { key: 'customerStateCode', label: 'Customer State Code', placeholder: '33' },
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
                <div key={s.id} onClick={() => selectSig(s.id)}
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
                    <button title="Delete" onClick={e => { e.stopPropagation(); confirm({ title: `Delete signatory "${s.name}"?`, onConfirm: () => deleteSig.mutate(s.id) }) }}
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

            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginTop: 8, marginBottom: 2 }}>Bank Account</p>

            {bankAccounts.map(b => {
              const active = bankId === b.id || (!bankId && b.isDefault)
              if (editingBankId === b.id) {
                return (
                  <div key={b.id} style={{ background: '#FAFBFF', borderRadius: 8, border: '1px solid #F0F1F5', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Bank name & branch *" style={inp} />
                    <input value={bankForm.accountNumber} onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="A/C number *" style={inp} />
                    <input value={bankForm.ifscCode} onChange={e => setBankForm(f => ({ ...f, ifscCode: e.target.value }))} placeholder="IFSC code *" style={inp} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={saveBankEdit} disabled={updateBank.isPending || !bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifscCode.trim()}
                        style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', opacity: updateBank.isPending || !bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifscCode.trim() ? 0.6 : 1 }}>
                        {updateBank.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => { setEditingBankId(null); setBankForm({ bankName: '', accountNumber: '', ifscCode: '' }) }}
                        style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={b.id} onClick={() => selectBank(b.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: `2px solid ${active ? '#5D78FF' : '#F0F1F5'}`, cursor: 'pointer', background: active ? '#F0F4FF' : '#fff' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.bankName}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>A/C {b.accountNumber} · {b.ifscCode}</p>
                    {b.isDefault && <span style={{ fontSize: 9, background: '#E8EDFF', color: '#5D78FF', padding: '1px 6px', borderRadius: 10 }}>Default</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button title="Set default" onClick={e => { e.stopPropagation(); updateBank.mutate({ id: b.id, isDefault: true }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: b.isDefault ? '#5D78FF' : '#D5D5D5', padding: 3 }}>
                      <Star size={12} fill={b.isDefault ? '#5D78FF' : 'none'} />
                    </button>
                    <button title="Edit" onClick={e => { e.stopPropagation(); startEditBank(b) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', padding: 3 }}>
                      <Pencil size={12} />
                    </button>
                    <button title="Delete" onClick={e => { e.stopPropagation(); confirm({ title: `Delete bank account "${b.bankName}"?`, onConfirm: () => deleteBank.mutate(b.id) }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: 3 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}

            <button onClick={() => { setShowBankForm(s => !s); setEditingBankId(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>
              <Plus size={12} /> {showBankForm ? 'Cancel' : 'Add Bank Account'}
            </button>

            {showBankForm && (
              <div style={{ background: '#FAFBFF', borderRadius: 8, border: '1px solid #F0F1F5', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Bank name & branch *" style={inp} />
                <input value={bankForm.accountNumber} onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="A/C number *" style={inp} />
                <input value={bankForm.ifscCode} onChange={e => setBankForm(f => ({ ...f, ifscCode: e.target.value }))} placeholder="IFSC code *" style={inp} />
                <button onClick={addBankAccount} disabled={createBank.isPending || !bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifscCode.trim()}
                  style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', opacity: createBank.isPending || !bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifscCode.trim() ? 0.6 : 1 }}>
                  {createBank.isPending ? 'Saving...' : 'Save Bank Account'}
                </button>
              </div>
            )}

            {selectedBank ? (
              <div style={{ padding: '10px 12px', background: '#E7FAF0', borderRadius: 8, fontSize: 11, color: '#2BC155' }}>
                PDF beneficiary: <strong>{selectedBank.bankName}</strong> · A/C {selectedBank.accountNumber}
              </div>
            ) : bankAccounts.length === 0 ? (
              <p style={{ fontSize: 11, color: '#B1B1BE' }}>No bank accounts yet. Add one to set the invoice beneficiary.</p>
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
interface FormItem { item: string; hsnCode: string; rate: string; hours: string; quantity: string; unit: string; discountPct: string; gstRate: string; amount: string }
const blankItem = (): FormItem => ({ item: '', hsnCode: '', rate: '', hours: '1', quantity: '1', unit: 'HRS', discountPct: '0', gstRate: '18', amount: '' })
const blankForm = {
  number: '', customer: '', date: new Date().toISOString().slice(0, 10), status: 'Draft' as const,
  toAddr: '', shippingAddr: '', customerGstin: '', customerState: '', customerStateCode: '', placeOfSupply: '',
  typeOfSupply: 'Service and Supply', invoiceType: 'TaxInvoice', poNo: '', poDate: '',
  gstRate: '18', paymentTerms: '', paymentTermCode: '', invoiceDiscount: '0',
  projectId: '',  // optional link to a project
}

export default function Invoices() {
  const isMobile = useIsMobile()
  const { symbol, currency } = useCurrency()

  const { data: invoices = [], isLoading, isError, refetch } = useInvoices()
  const bulkDelete = useBulkDeleteInvoices()
  const createInvoice = useCreateInvoice()

  const [tab, setTab]           = useState<string>('All')
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [amountBand, setAmountBand] = useState('All')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const qc = useQueryClient()
  const { confirm, confirmDialog } = useConfirm()
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [comment, setComment]   = useState('')
  const [page, setPage]         = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(blankForm)
  const [formItems, setFormItems] = useState<FormItem[]>([blankItem()])
  const [formErr, setFormErr]   = useState<Record<string, string>>({})
  const [pdfInv, setPdfInv]     = useState<Invoice | null>(null)
  const [actionComment, setActionComment] = useState('')

  const submitInvoice = useSubmitInvoice()
  const workflowAction = useWorkflowAction()
  const { data: pendingApprovals = [] } = usePendingApprovals()
  const { data: wfHistory } = useWorkflowHistory(selected?.id || null)
  const { data: allProjects = [] } = useProjects()

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

  const byTab = tab === 'All' ? invoices : tab === 'InWorkflow' ? invoices.filter(i => WORKFLOW_STATUSES.has(i.status)) : invoices.filter(i => i.status === tab)
  const q = search.trim().toLowerCase()
  const filtered = byTab.filter(i => {
    if (typeFilter !== 'All' && (i.invoiceType || 'TaxInvoice') !== typeFilter) return false
    const total = i.grandTotal || i.amount
    if (amountBand === '<1L' && total >= 100000) return false
    if (amountBand === '1L-5L' && (total < 100000 || total >= 500000)) return false
    if (amountBand === '>5L' && total < 500000) return false
    if (q) {
      const hay = [i.number, i.customer, i.customerGstin, i.poNo, i.project?.name].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Bulk-selection helpers (operate on the currently filtered set).
  const allVisibleSelected = paginated.length > 0 && paginated.every(i => selectedIds.has(i.id))
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAllVisible() {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (allVisibleSelected) paginated.forEach(i => n.delete(i.id))
      else paginated.forEach(i => n.add(i.id))
      return n
    })
  }

  const bulkBtn = (color: string): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: color, color: '#fff', border: 'none', cursor: 'pointer',
  })

  // Bulk approve/cancel run client-side over the existing single-item endpoints —
  // no dedicated bulk API needed. Reminder has no endpoint yet, so it stays disabled.
  function runBulk(action: 'approve' | 'cancel') {
    const ids = [...selectedIds]
    const verb = action === 'approve' ? 'Approve' : 'Cancel'
    confirm({
      title: `${verb} ${ids.length} invoice${ids.length === 1 ? '' : 's'}?`,
      message: action === 'cancel' ? 'Cancelled invoices cannot be un-cancelled.' : 'Selected invoices will be approved.',
      confirmLabel: verb, danger: action === 'cancel',
      onConfirm: async () => {
        setBulkBusy(true)
        let done = 0, failed = 0
        for (const id of ids) {
          try { await api.patch(`/invoices/${id}/${action}`); done++ } catch { failed++ }
        }
        setBulkBusy(false)
        setSelectedIds(new Set())
        qc.invalidateQueries({ queryKey: ['invoices'] })
        toast[failed ? 'error' : 'success'](`${verb}d ${done} invoice${done === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}`)
      },
    })
  }

  /**
   * Only Draft invoices can be deleted — the server enforces this and reports
   * the rest, so the confirmation says up front how many of the selection will
   * actually go rather than implying all of them will.
   */
  function runBulkDelete() {
    const ids = [...selectedIds]
    const draftCount = invoices.filter(i => ids.includes(i.id) && i.status === 'Draft').length
    confirm({
      title: `Delete ${draftCount} draft invoice${draftCount === 1 ? '' : 's'}?`,
      message: draftCount === 0
        ? 'None of the selected invoices are drafts. Generated invoices must be cancelled instead.'
        : `${draftCount} of ${ids.length} selected ${ids.length === 1 ? 'is a draft' : 'are drafts'} and will be permanently deleted. The rest must be cancelled instead.`,
      confirmLabel: 'Delete drafts', danger: true,
      onConfirm: async () => {
        if (draftCount === 0) return
        try {
          const res = await bulkDelete.mutateAsync(ids)
          setSelectedIds(new Set())
          setPage(1)
          toast[res.blocked?.length ? 'error' : 'success'](
            `Deleted ${res.deleted} draft${res.deleted === 1 ? '' : 's'}${res.blocked?.length ? `, ${res.blocked.length} skipped` : ''}`,
          )
        } catch {
          toast.error('Bulk delete failed')
        }
      },
    })
  }

  function changeTab(t: typeof tab) { setTab(t); setPage(1) }
  function selectedIndex() { return filtered.findIndex(i => i.id === selected?.id) }
  function goModalPrev() { const idx = selectedIndex(); if (idx > 0) setSelected(filtered[idx - 1]) }
  function goModalNext() { const idx = selectedIndex(); if (idx < filtered.length - 1) setSelected(filtered[idx + 1]) }

  function recalcItem(items: FormItem[], idx: number) {
    return items.map((it, i) => {
      if (i !== idx) return it
      const r = parseFloat(it.rate) || 0
      const q = parseFloat(it.quantity) || parseFloat(it.hours) || 1
      const gross = r * q
      const disc = gross * (parseFloat(it.discountPct) || 0) / 100
      const taxable = gross - disc
      return { ...it, amount: taxable > 0 ? String(Math.round(taxable * 100) / 100) : it.amount }
    })
  }

  function setItemField(idx: number, key: keyof FormItem, val: string) {
    setFormItems(prev => {
      const next = prev.map((it, i) => i === idx ? { ...it, [key]: val } : it)
      if (['rate', 'hours', 'quantity', 'discountPct'].includes(key)) return recalcItem(next, idx)
      return next
    })
  }

  const itemsSubTotal = formItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
  const invDiscount = parseFloat(form.invoiceDiscount) || 0
  const taxableAfterDisc = itemsSubTotal - invDiscount
  const avgGstRate = formItems.length > 0 ? formItems.reduce((s, it) => s + (parseFloat(it.gstRate) || 18), 0) / formItems.length : 18
  const totalGst = taxableAfterDisc * avgGstRate / 100
  const grandTotal = taxableAfterDisc + totalGst

  async function submitAdd() {
    const e: Record<string, string> = {}
    if (!form.customer.trim()) e.customer = 'Customer name required'
    if (!form.date) e.date = 'Date required'
    if (!form.placeOfSupply.trim()) e.placeOfSupply = 'Place of Supply required for GST'
    const validItems = formItems.filter(it => it.item.trim() && parseFloat(it.amount) > 0)
    if (!validItems.length) e.items = 'Add at least one item with amount'
    validItems.forEach((it, i) => {
      if (!it.hsnCode.trim()) e[`item_${i}_hsn`] = `Item ${i + 1}: HSN/SAC required`
    })
    if (Object.keys(e).length) { setFormErr(e); return }
    try {
      await createInvoice.mutateAsync({
        number: form.number.trim() || undefined,
        date: form.date, customer: form.customer.trim(), invoiceType: form.invoiceType,
        toAddr: form.toAddr, shippingAddr: form.shippingAddr,
        customerGstin: form.customerGstin, customerState: form.customerState,
        customerStateCode: form.customerStateCode, placeOfSupply: form.placeOfSupply,
        typeOfSupply: form.typeOfSupply, poNo: form.poNo, poDate: form.poDate || undefined,
        gstRate: parseFloat(form.gstRate) || 18, paymentTerms: form.paymentTerms,
        paymentTermCode: form.paymentTermCode || undefined,
        invoiceDiscount: parseFloat(form.invoiceDiscount) || 0,
        projectId: form.projectId || undefined,
        items: validItems.map(it => ({
          item: it.item.trim(), hsnCode: it.hsnCode || undefined,
          rate: parseFloat(it.rate) || 0, quantity: parseFloat(it.quantity) || parseFloat(it.hours) || 1,
          unit: it.unit || 'HRS', hours: parseFloat(it.hours) || undefined,
          discountPct: parseFloat(it.discountPct) || 0, gstRate: parseFloat(it.gstRate) || 18,
          amount: parseFloat(it.amount),
        })),
      })
      setShowModal(false)
    } catch { setFormErr({ customer: 'Failed to create invoice' }) }
  }

  const inp = (err?: boolean): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${err ? '#FF5353' : '#F0F1F5'}`,
    fontSize: 12, outline: 'none', boxSizing: 'border-box', color: '#374557',
  })

  // ─── Finance KPIs (computed over ALL invoices, not the filtered view) ──────────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStr = now.toISOString().slice(0, 10)

  const totalRevenueInr = invoices.reduce((s, i) => s + (i.grandTotal || i.amount), 0)
  const collectedInr    = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0)
  const outstandingInr  = invoices.filter(i => isOpen(i.status)).reduce((s, i) => s + outstandingOf(i), 0)
  const overdueInr      = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + outstandingOf(i), 0)
  const thisMonthInr    = invoices.filter(i => new Date(i.date) >= monthStart).reduce((s, i) => s + (i.grandTotal || i.amount), 0)
  // Today's collection: payments recorded today across all invoices.
  const todaysCollection = invoices.reduce((s, i) =>
    s + (i.payments || []).filter(p => (p.paidAt || '').slice(0, 10) === todayStr).reduce((a, p) => a + p.amount, 0), 0)

  const nonDraft = invoices.filter(i => !['Draft', 'Cancelled', 'Rejected'].includes(i.status))
  const avgInvoiceValue = nonDraft.length ? totalRevenueInr / invoices.length : 0
  const collectionRate  = totalRevenueInr > 0 ? (collectedInr / totalRevenueInr) * 100 : 0
  const overduePct      = outstandingInr > 0 ? (overdueInr / outstandingInr) * 100 : 0
  // Average payment days: date → first payment, over invoices that have both.
  const paidTimed = invoices.filter(i => i.paidAt && i.date)
  const avgPaymentDays = paidTimed.length
    ? Math.round(paidTimed.reduce((s, i) => s + Math.max(0, (new Date(i.paidAt!).getTime() - new Date(i.date).getTime()) / 86400000), 0) / paidTimed.length)
    : 0

  const kpis = [
    { label: 'Total Revenue',    value: fmtAmt(totalRevenueInr, symbol, currency), accent: '#5D78FF' },
    { label: 'Collected',        value: fmtAmt(collectedInr, symbol, currency),    accent: '#2BC155' },
    { label: 'Outstanding',      value: fmtAmt(outstandingInr, symbol, currency),  accent: '#FF9B52' },
    { label: "Today's Collection", value: fmtAmt(todaysCollection, symbol, currency), accent: '#8B5CF6' },
    { label: 'This Month',       value: fmtAmt(thisMonthInr, symbol, currency),    accent: '#2563EB' },
    { label: 'Avg Invoice Value',value: fmtAmt(avgInvoiceValue, symbol, currency), accent: '#0EA5E9' },
    { label: 'Avg Payment Days', value: `${avgPaymentDays}d`,                      accent: '#6B7280' },
    { label: 'Collection Rate',  value: `${collectionRate.toFixed(0)}%`,           accent: '#059669' },
    { label: 'Overdue %',        value: `${overduePct.toFixed(0)}%`,               accent: '#DC2626' },
  ]

  // ─── Receivables aging (open invoices only) ───────────────────────────────────
  const agingInit = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } as Record<string, number>
  const aging = invoices.filter(i => isOpen(i.status)).reduce((acc, i) => {
    acc[agingBucket(i)] += outstandingOf(i); return acc
  }, { ...agingInit })
  const agingMax = Math.max(1, ...Object.values(aging))
  const agingRows = [
    { band: '0-30',  color: '#2BC155' },
    { band: '31-60', color: '#FF9B52' },
    { band: '61-90', color: '#F97316' },
    { band: '90+',   color: '#DC2626' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start', height: '100%' }}>
      {/* Left panel — finance KPIs + receivables aging */}
      <div style={{ width: isMobile ? '100%' : 232, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Finance overview</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 14 }}>Across all invoices</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ background: '#FAFBFF', border: '1px solid #F0F1F5', borderRadius: 10, padding: '10px 10px', borderLeft: `3px solid ${k.accent}` }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#374557', lineHeight: 1.1 }}>{k.value}</p>
                <p style={{ fontSize: 9.5, color: '#B1B1BE', marginTop: 3 }}>{k.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Outstanding aging</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 14 }}>Days past due</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agingRows.map(r => (
              <div key={r.band}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{r.band} days</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{fmtAmt(aging[r.band], symbol, currency)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${(aging[r.band] / agingMax) * 100}%`, background: r.color, transition: 'width .2s' }} />
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
            {(['All', 'Draft', 'InWorkflow', 'Approved', 'Sent', 'Paid', 'Overdue', 'Rejected'] as const).map(t => (
              <button key={t} onClick={() => changeTab(t)} style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 600,
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
                marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE', transition: 'all 0.15s',
              }}>{t === 'InWorkflow' ? 'In Workflow' : t}{t === 'InWorkflow' && pendingApprovals.length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, background: '#FF5353', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>{pendingApprovals.length}</span>
              )}</button>
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

        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search invoice no, customer, GSTIN, PO, project…"
            style={{ flex: isMobile ? '1 1 100%' : '1 1 260px', minWidth: 0, padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, outline: 'none', color: '#374557' }}
          />
          <select value={amountBand} onChange={e => { setAmountBand(e.target.value); setPage(1) }}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', background: '#fff', cursor: 'pointer' }}>
            <option value="All">Any amount</option>
            <option value="<1L">Below ₹1L</option>
            <option value="1L-5L">₹1L – ₹5L</option>
            <option value=">5L">Above ₹5L</option>
          </select>
          {(search || typeFilter !== 'All' || amountBand !== 'All') && (
            <button onClick={() => { setSearch(''); setTypeFilter('All'); setAmountBand('All'); setPage(1) }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, fontWeight: 600, color: '#B1B1BE', background: '#fff', cursor: 'pointer' }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 11, color: '#B1B1BE', marginLeft: 'auto' }}>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
        </div>

        {/* Bulk-action bar */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', background: '#EEF2FF', border: '1px solid #E0E7FF', borderRadius: 10, padding: '8px 14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5D78FF' }}>{selectedIds.size} selected</span>
            <button disabled={bulkBusy} onClick={() => runBulk('approve')} style={bulkBtn('#2BC155')}>Approve</button>
            <button disabled={bulkBusy} onClick={() => runBulk('cancel')} style={bulkBtn('#DC2626')}>Cancel</button>
            <button disabled={bulkBusy || bulkDelete.isPending} onClick={runBulkDelete} style={bulkBtn('#991B1B')}>Delete drafts</button>
            <button disabled title="Requires reminder endpoint — coming soon" style={{ ...bulkBtn('#94A3B8'), cursor: 'not-allowed', opacity: 0.55 }}>Send Reminder</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
          </div>
        )}

        <div className="crm-table-wrap" style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>Loading invoices…</div>
          ) : isError ? (
            <EmptyState icon={AlertTriangle} title="Failed to load invoices" subtitle="Something went wrong fetching this data."
              action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
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
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[inv.status]?.bg || '#F4F5F9', color: statusStyle[inv.status]?.color || '#6B7280' }}>{statusLabel(inv.status)}</span>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  <th style={{ padding: '10px 16px', width: 36 }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} style={{ cursor: 'pointer' }} />
                  </th>
                  {['Invoice', 'Type', 'Customer', 'Status', 'Invoice / Due', `Amount (${currency})`, ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((inv, i) => {
                  const tm = invoiceTypeMeta(inv.invoiceType)
                  const due = dueInfo(inv)
                  const grand = inv.grandTotal || inv.amount
                  const sub = inv.subTotal || inv.amount
                  const tax = inv.totalTax || Math.max(0, grand - sub)
                  const checked = selectedIds.has(inv.id)
                  return (
                  <tr key={inv.id} onClick={() => setSelected(inv)}
                    style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer', transition: 'background 0.1s', background: checked ? '#F5F8FF' : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = checked ? '#EEF3FF' : '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = checked ? '#F5F8FF' : 'transparent')}>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(inv.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={14} style={{ color: '#5D78FF' }} />
                        </div>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'block' }}>#{inv.number}</span>
                          {inv.poNo && <span style={{ fontSize: 10, color: '#B1B1BE' }}>PO {inv.poNo}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: tm.bg, color: tm.color, whiteSpace: 'nowrap' }}>{tm.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(inv.id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials(inv.customer)}</div>
                        <div>
                          <span style={{ fontSize: 12, color: '#374557', display: 'block' }}>{inv.customer}</span>
                          {inv.customerGstin && <span style={{ fontSize: 9.5, color: '#B1B1BE' }}>{inv.customerGstin}</span>}
                          {inv.project?.name && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: '#5D78FF', background: '#E8EDFF', padding: '1px 7px', borderRadius: 20, display: 'inline-block', marginTop: 2 }}>
                              🔗 {inv.project.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[inv.status]?.bg || '#F4F5F9', color: statusStyle[inv.status]?.color || '#6B7280' }}>
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>
                      <span style={{ display: 'block' }}>{fmtDateStr(inv.date)}</span>
                      {inv.dueDate
                        ? <span style={{ fontSize: 10, color: due?.tone || '#B1B1BE', fontWeight: due ? 600 : 400 }}>Due {fmtDateStr(inv.dueDate)}{due ? ` · ${due.label}` : ''}</span>
                        : <span style={{ fontSize: 10, color: '#D5D5D5' }}>No due date</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374557', display: 'block' }}>{fmtFullInr(grand, symbol, currency)}</span>
                      <span style={{ fontSize: 9.5, color: '#B1B1BE' }}>Sub {fmtAmt(sub, symbol, currency)} · Tax {fmtAmt(tax, symbol, currency)}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
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
                )})}
              </tbody>
            </table>
          )}

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 740 }}>
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
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[selected.status]?.bg || '#F4F5F9', color: statusStyle[selected.status]?.color || '#6B7280' }}>
                    {statusLabel(selected.status)}
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
                    {selected.toAddr && <p style={{ color: '#B1B1BE', whiteSpace: 'pre-line' }}>{selected.toAddr}</p>}
                    {selected.customerState && <p style={{ color: '#B1B1BE' }}>{selected.customerState}</p>}
                    {selected.customerGstin && <p style={{ color: '#B1B1BE' }}>GSTIN: {selected.customerGstin}</p>}
                    {selected.customerStateCode && <p style={{ color: '#B1B1BE' }}>State Code: {selected.customerStateCode}</p>}
                  </div>
                </div>

                <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 12 }}>Summary</p>
                <div style={{ border: '1px solid #F0F1F5', borderRadius: 10 }}>
                  <div style={{ padding: '12px 16px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#374557' }}>
                        <span>{it.item}</span><span>{fmtFullInr(it.lineTotal ?? it.amount, symbol, currency)}</span>
                      </div>
                    ))}
                    {/* Tax breakdown — shows only the lines that carry a value */}
                    {([
                      ['Taxable Amount', selected.subTotal || selected.amount, true],
                      ['CGST', selected.totalCgst],
                      ['SGST', selected.totalSgst],
                      ['IGST', selected.totalIgst],
                      ['CESS', selected.totalCess],
                      ['Round Off', selected.roundOff],
                    ] as [string, number | undefined, boolean?][]).map(([label, val, always]) =>
                      (always || (val && Math.abs(val) > 0.001)) ? (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color: label === 'Taxable Amount' ? '#374557' : '#B1B1BE', borderTop: label === 'Taxable Amount' && selected.items.length > 0 ? '1px solid #F0F1F5' : 'none', paddingTop: label === 'Taxable Amount' && selected.items.length > 0 ? 6 : 0 }}>
                          <span>{label}</span><span>{fmtFullInr(val || 0, symbol, currency)}</span>
                        </div>
                      ) : null
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #F0F1F5', paddingTop: 6, color: '#374557' }}>
                      <span>Grand Total</span><span style={{ color: '#5D78FF' }}>{fmtFullInr(selected.grandTotal || selected.amount, symbol, currency)}</span>
                    </div>
                    {(selected.paidAmount ?? 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2BC155', fontWeight: 600 }}>
                        <span>Paid</span><span>{fmtFullInr(selected.paidAmount || 0, symbol, currency)}</span>
                      </div>
                    )}
                    {outstandingOf(selected) > 0.001 && !['Paid', 'Cancelled'].includes(selected.status) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FF9B52', fontWeight: 600 }}>
                        <span>Balance Due</span><span>{fmtFullInr(outstandingOf(selected), symbol, currency)}</span>
                      </div>
                    )}
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

            {/* Workflow Actions */}
            <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Submit button for Draft/Returned */}
              {(selected.status === 'Draft' || selected.status === 'Returned') && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={async () => {
                    try {
                      await submitInvoice.mutateAsync(selected.id)
                      const updated = invoices.find(i => i.id === selected.id)
                      if (updated) setSelected({ ...updated })
                      else setSelected(null)
                      refetch()
                    } catch (e: any) { alert(e?.response?.data?.error || 'Submit failed') }
                  }} disabled={submitInvoice.isPending}
                    style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    {submitInvoice.isPending ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                </div>
              )}

              {/* Approve/Reject/Return for workflow statuses */}
              {WORKFLOW_STATUSES.has(selected.status) && (
                <div style={{ background: '#F8F9FD', borderRadius: 10, padding: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 8 }}>Approval Action</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 10 }}>Status: {statusLabel(selected.status)}</p>
                  <input value={actionComment} onChange={e => setActionComment(e.target.value)}
                    placeholder="Add comments (optional)..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={async () => {
                      try {
                        await workflowAction.mutateAsync({ id: selected.id, action: 'Approve', comments: actionComment })
                        setActionComment(''); setSelected(null); refetch()
                      } catch (e: any) { alert(e?.response?.data?.error || 'Action failed') }
                    }} disabled={workflowAction.isPending}
                      style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2BC155', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      Approve
                    </button>
                    <button onClick={async () => {
                      if (!actionComment.trim()) { alert('Comments required for rejection'); return }
                      try {
                        await workflowAction.mutateAsync({ id: selected.id, action: 'Reject', comments: actionComment })
                        setActionComment(''); setSelected(null); refetch()
                      } catch (e: any) { alert(e?.response?.data?.error || 'Action failed') }
                    }} disabled={workflowAction.isPending}
                      style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#FF5353', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      Reject
                    </button>
                    <button onClick={async () => {
                      try {
                        await workflowAction.mutateAsync({ id: selected.id, action: 'Return', comments: actionComment })
                        setActionComment(''); setSelected(null); refetch()
                      } catch (e: any) { alert(e?.response?.data?.error || 'Action failed') }
                    }} disabled={workflowAction.isPending}
                      style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fff', color: '#D97706', border: '1px solid #D97706', cursor: 'pointer' }}>
                      Return
                    </button>
                  </div>
                </div>
              )}

              {/* Workflow history */}
              {wfHistory?.approvalActions?.length > 0 && (
                <div style={{ background: '#F8F9FD', borderRadius: 10, padding: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 8 }}>Workflow: {wfHistory.template?.name}</p>
                  {wfHistory.approvalActions.map((a: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: '#374557', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{a.stepName}</span>
                      <span style={{ color: '#B1B1BE' }}>{a.assignedTo?.name}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: a.action === 'Approve' ? '#E7FAF0' : a.action === 'Reject' ? '#FEE2E2' : a.action === 'Return' ? '#FEF3C7' : '#F4F5F9',
                        color: a.action === 'Approve' ? '#2BC155' : a.action === 'Reject' ? '#DC2626' : a.action === 'Return' ? '#D97706' : '#6B7280',
                      }}>
                        {a.action || 'Pending'}
                      </span>
                      {a.comments && <span style={{ color: '#B1B1BE', fontStyle: 'italic' }}>"{a.comments}"</span>}
                    </div>
                  ))}
                </div>
              )}
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
          <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 960, maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Invoice</p>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Row 1: Invoice header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Invoice Number</p>
                  <input value={form.number} onChange={e => { setForm(f => ({ ...f, number: e.target.value })); setFormErr(p => ({ ...p, number: '' })) }}
                    placeholder="Auto-generated on approval" style={inp(!!formErr.number)} />
                  <p style={{ fontSize: 9, color: '#B1B1BE', marginTop: 2 }}>Leave blank for auto-numbering</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Date *</p>
                  <input type="date" value={form.date} onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setFormErr(p => ({ ...p, date: '' })) }} style={inp(!!formErr.date)} />
                  {formErr.date && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{formErr.date}</p>}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Invoice Type</p>
                  <select value="TaxInvoice" disabled style={{ ...inp(), cursor: 'not-allowed', background: '#F4F5F9' }}>
                    <option value="TaxInvoice">Tax Invoice</option>
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Payment Terms</p>
                  <select value={form.paymentTermCode} onChange={e => setForm(f => ({ ...f, paymentTermCode: e.target.value, paymentTerms: e.target.selectedOptions[0]?.text || '' }))} style={{ ...inp(), cursor: 'pointer' }}>
                    <option value="">Select...</option>
                    <option value="IMM">Immediate</option>
                    <option value="NET7">Net 7 Days</option>
                    <option value="NET15">Net 15 Days</option>
                    <option value="NET30">Net 30 Days</option>
                    <option value="NET45">Net 45 Days</option>
                    <option value="NET60">Net 60 Days</option>
                    <option value="ADV">Advance</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
              </div>

              {/* Project Link — optional */}
              <div style={{ background: '#F8F9FF', border: '1px solid #E8EDFF', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#5D78FF', marginBottom: 5 }}>🔗 Link to Project (optional)</p>
                <SearchableSelect
                  value={form.projectId}
                  placeholder="— No project linked —"
                  options={(allProjects as any[]).map(p => ({
                    value: p.id,
                    label: p.name,
                    sublabel: p.company?.name,
                  }))}
                  onChange={pid => {
                    const proj = allProjects.find((p: any) => p.id === pid)
                    setForm(f => ({
                      ...f,
                      projectId: pid,
                      // Auto-fill customer from project company if customer is blank
                      customer: f.customer || proj?.company?.name || proj?.title || f.customer,
                    }))
                  }}
                />
              </div>

              {/* Row 2: Bill To */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 10, borderBottom: '1px solid #F0F1F5', paddingBottom: 6 }}>Bill To</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Customer Name *</p>
                    <input autoFocus value={form.customer} onChange={e => { setForm(f => ({ ...f, customer: e.target.value })); setFormErr(p => ({ ...p, customer: '' })) }}
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
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Shipping Address</p>
                    <textarea value={form.shippingAddr} onChange={e => setForm(f => ({ ...f, shippingAddr: e.target.value }))} placeholder="Same as billing if blank..." rows={2} style={{ ...inp(), resize: 'vertical' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Customer State</p>
                    <input value={form.customerState} onChange={e => setForm(f => ({ ...f, customerState: e.target.value }))} placeholder="Maharashtra" style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>State Code</p>
                    <input value={form.customerStateCode} onChange={e => setForm(f => ({ ...f, customerStateCode: e.target.value }))} placeholder="27" style={inp()} />
                  </div>
                </div>
              </div>

              {/* Row 3: Supply details */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 10, borderBottom: '1px solid #F0F1F5', paddingBottom: 6 }}>Supply Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Place of Supply *</p>
                    <input value={form.placeOfSupply} onChange={e => { setForm(f => ({ ...f, placeOfSupply: e.target.value })); setFormErr(p => ({ ...p, placeOfSupply: '' })) }} placeholder="33 (state code)" style={inp(!!formErr.placeOfSupply)} />
                    {formErr.placeOfSupply && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{formErr.placeOfSupply}</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Type of Supply</p>
                    <input value={form.typeOfSupply} onChange={e => setForm(f => ({ ...f, typeOfSupply: e.target.value }))} placeholder="Service and Supply" style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>PO Number</p>
                    <input value={form.poNo} onChange={e => setForm(f => ({ ...f, poNo: e.target.value }))} placeholder="PO-2026-001" style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>PO Date</p>
                    <input type="date" value={form.poDate} onChange={e => setForm(f => ({ ...f, poDate: e.target.value }))} style={inp()} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Invoice-Level Discount (₹)</p>
                    <input type="number" value={form.invoiceDiscount} onChange={e => setForm(f => ({ ...f, invoiceDiscount: e.target.value }))} placeholder="0" style={inp()} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Custom Payment Terms</p>
                    <input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="e.g. 50% advance, 50% on delivery" style={inp()} />
                  </div>
                </div>
              </div>

              {/* Row 4: Items */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 10, borderBottom: '1px solid #F0F1F5', paddingBottom: 6 }}>Line Items</p>
                {formErr.items && <p style={{ fontSize: 11, color: '#FF5353', marginBottom: 8 }}>{formErr.items}</p>}

                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 55px 50px 65px 45px 50px 75px 28px', gap: 4, marginBottom: 6 }}>
                  {['Description', 'HSN/SAC *', 'Rate ₹', 'Qty', 'Unit', 'Disc%', 'GST%', 'Amount ₹', ''].map(h => (
                    <p key={h} style={{ fontSize: 9, fontWeight: 600, color: '#B1B1BE' }}>{h}</p>
                  ))}
                </div>

                {formItems.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 55px 50px 65px 45px 50px 75px 28px', gap: 4, marginBottom: 6, alignItems: 'center' }}>
                    <input value={it.item} onChange={e => setItemField(idx, 'item', e.target.value)} placeholder="Description..." style={inp()} />
                    <input value={it.hsnCode} onChange={e => setItemField(idx, 'hsnCode', e.target.value)} placeholder="998314" style={inp(!!formErr[`item_${idx}_hsn`])} />
                    <input type="number" value={it.rate} onChange={e => setItemField(idx, 'rate', e.target.value)} placeholder="0" style={inp()} />
                    <input type="number" value={it.quantity} onChange={e => { setItemField(idx, 'quantity', e.target.value); setItemField(idx, 'hours', e.target.value) }} placeholder="1" style={inp()} />
                    <select value={it.unit} onChange={e => setItemField(idx, 'unit', e.target.value)} style={{ ...inp(), cursor: 'pointer', fontSize: 10, padding: '6px 4px' }}>
                      <option value="HRS">HRS</option><option value="NOS">NOS</option><option value="KGS">KGS</option>
                      <option value="MTR">MTR</option><option value="LTR">LTR</option><option value="SQM">SQM</option>
                      <option value="PCS">PCS</option><option value="SET">SET</option><option value="OTH">OTH</option>
                    </select>
                    <input type="number" value={it.discountPct} onChange={e => setItemField(idx, 'discountPct', e.target.value)} placeholder="0" style={inp()} />
                    <select value={it.gstRate} onChange={e => setItemField(idx, 'gstRate', e.target.value)} style={{ ...inp(), cursor: 'pointer', fontSize: 10, padding: '6px 4px' }}>
                      <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option>
                      <option value="18">18%</option><option value="28">28%</option>
                    </select>
                    <input type="number" value={it.amount} onChange={e => setItemField(idx, 'amount', e.target.value)} placeholder="0" style={{ ...inp(), fontWeight: 600 }} />
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
                      <span style={{ color: '#B1B1BE' }}>Sub-Total (Taxable)</span>
                      <span style={{ fontWeight: 600, color: '#374557', minWidth: 90, textAlign: 'right' }}>₹ {itemsSubTotal.toLocaleString('en-IN')}</span>
                    </div>
                    {invDiscount > 0 && (
                      <div style={{ display: 'flex', gap: 20 }}>
                        <span style={{ color: '#B1B1BE' }}>Invoice Discount</span>
                        <span style={{ color: '#FF5353', minWidth: 90, textAlign: 'right' }}>-₹ {invDiscount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 20 }}>
                      <span style={{ color: '#B1B1BE' }}>GST (avg {avgGstRate.toFixed(0)}%)</span>
                      <span style={{ color: '#374557', minWidth: 90, textAlign: 'right' }}>₹ {Math.round(totalGst).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, borderTop: '1px solid #F0F1F5', paddingTop: 6, marginTop: 2 }}>
                      <span style={{ fontWeight: 700, color: '#374557' }}>Grand Total (est.)</span>
                      <span style={{ fontWeight: 700, color: '#5D78FF', minWidth: 90, textAlign: 'right' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</span>
                    </div>
                    <p style={{ fontSize: 9, color: '#B1B1BE', marginTop: 2 }}>Exact CGST/SGST/IGST split computed server-side based on Place of Supply</p>
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
      {confirmDialog}
    </div>
  )
}
