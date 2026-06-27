import { useState } from 'react'
import type React from 'react'
import { Plus, X, Edit2, Boxes, Loader2, Search } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCurrency } from '@/lib/currencyContext'
import { useComponents, useCreateComponent, useUpdateComponent } from '@/hooks/useComponents'
import type { RawComponent } from '@/hooks/useComponents'
import { useDealers } from '@/hooks/useDealers'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  in_stock: { bg: '#E7FAF0', color: '#2BC155', label: 'In Stock' },
  assigned: { bg: '#E8EDFF', color: '#5D78FF', label: 'Assigned' },
  used:     { bg: '#F4F5F9', color: '#8C8C8C', label: 'Used' },
  returned: { bg: '#FFF5EE', color: '#FF9B52', label: 'Returned' },
  disposed: { bg: '#FFF0F0', color: '#FF5353', label: 'Disposed' },
}

const blankForm = {
  name: '', category: '', dealerName: '', dealerId: '',
  price: '', gstPercent: '18', hsnCode: '', unit: 'pcs', quantity: '1',
  warrantyMonths: '', notes: '',
}

function ageDays(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) }

export default function RawComponents() {
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { data: components = [], isLoading } = useComponents()
  const { data: dealers = [] } = useDealers()
  const create = useCreateComponent()
  const update = useUpdateComponent()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filtered = components.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false
    if (search && !`${c.name} ${c.refNumber} ${c.dealerName ?? ''} ${c.category ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalValue = components.reduce((s, c) => s + (c.price ?? 0) * (c.quantity ?? 1), 0)
  const inStock = components.filter(c => c.status === 'in_stock').length

  function openCreate() { setEditId(null); setForm(blankForm); setErrors({}); setShowModal(true) }
  function openEdit(c: RawComponent) {
    setEditId(c.id)
    setForm({
      name: c.name, category: c.category ?? '', dealerName: c.dealerName ?? '', dealerId: c.dealerId ?? '',
      price: c.price != null ? String(c.price) : '', gstPercent: c.gstPercent != null ? String(c.gstPercent) : '18',
      hsnCode: c.hsnCode ?? '', unit: c.unit ?? 'pcs', quantity: c.quantity != null ? String(c.quantity) : '1',
      warrantyMonths: c.warrantyMonths != null ? String(c.warrantyMonths) : '', notes: c.notes ?? '',
    })
    setErrors({}); setShowModal(true)
  }
  function close() { setShowModal(false); setEditId(null); setForm(blankForm); setErrors({}) }

  async function save() {
    if (!form.name.trim()) { setErrors({ name: 'Name required' }); return }
    const payload = {
      name: form.name, category: form.category || undefined,
      dealerName: form.dealerName || undefined, dealerId: form.dealerId || undefined,
      price: form.price ? Number(form.price) : undefined,
      gstPercent: form.gstPercent ? Number(form.gstPercent) : undefined,
      hsnCode: form.hsnCode || undefined, unit: form.unit || undefined,
      quantity: form.quantity ? Number(form.quantity) : 1,
      warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
      notes: form.notes || undefined,
    }
    if (editId) await update.mutateAsync({ id: editId, ...payload })
    else await create.mutateAsync(payload)
    close()
  }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <Loader2 size={24} style={{ color: '#5D78FF', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(150px, 220px))', gap: 12, marginBottom: 16 }}>
        <Stat label="Total Items" value={String(components.length)} />
        <Stat label="In Stock" value={String(inStock)} />
        <Stat label="Inventory Value" value={`${symbol}${totalValue.toLocaleString()}`} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search components…"
              style={{ paddingLeft: 34, paddingRight: 14, height: 38, borderRadius: 10, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', width: isMobile ? 180 : 240, boxSizing: 'border-box' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 38, padding: '0 12px', borderRadius: 10, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', background: '#fff' }}>
            <option value="All">All status</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> New Component
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
              {['Ref #', 'Name', 'Dealer', 'Price', 'GST', 'Qty', 'Warranty', 'Age', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: '#B1B1BE', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.in_stock
              const age = ageDays(c.receivedAt)
              return (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F4F5F9' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: '#5D78FF', whiteSpace: 'nowrap' }}>{c.refNumber}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.name}</p>
                    {c.category && <p style={{ fontSize: 10, color: '#B1B1BE' }}>{c.category}{c.hsnCode ? ` · HSN ${c.hsnCode}` : ''}</p>}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.dealerName || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557', whiteSpace: 'nowrap' }}>{c.price != null ? `${symbol}${c.price.toLocaleString()}` : '—'}{c.unit ? <span style={{ fontSize: 10, color: '#B1B1BE' }}>/{c.unit}</span> : ''}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.gstPercent != null ? `${c.gstPercent}%` : '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.quantity ?? 1}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#374557' }}>{c.warrantyMonths != null ? `${c.warrantyMonths} mo` : '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: age > 90 ? '#FF5353' : '#374557', fontWeight: age > 90 ? 700 : 400, whiteSpace: 'nowrap' }}>{age}d</td>
                  <td style={{ padding: '11px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: ss.bg, color: ss.color, whiteSpace: 'nowrap' }}>{ss.label}</span></td>
                  <td style={{ padding: '11px 14px' }}><button onClick={() => openEdit(c)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={14} /></button></td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center' }}>
                <Boxes size={26} style={{ color: '#D5D5D5', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: '#B1B1BE' }}>No components found.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 'min(560px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Component' : 'New Raw Component'}</p>
              <button onClick={close} style={{ color: '#B1B1BE', background: '#F4F5F9', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8 }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <F label="Component Name *" error={errors.name}><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Scroll Compressor 5HP" style={inp(!!errors.name)} /></F>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Category"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Compressors" style={inp(false)} /></F>
                <F label="Dealer">
                  <input list="dealer-list" value={form.dealerName} onChange={e => {
                    const d = dealers.find(x => x.name === e.target.value)
                    setForm({ ...form, dealerName: e.target.value, dealerId: d?.id ?? '' })
                  }} placeholder="Dealer name" style={inp(false)} />
                  <datalist id="dealer-list">{dealers.map(d => <option key={d.id} value={d.name} />)}</datalist>
                </F>
                <F label={`Price (${symbol})`}><input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inp(false)} /></F>
                <F label="GST %"><input type="number" min="0" value={form.gstPercent} onChange={e => setForm({ ...form, gstPercent: e.target.value })} style={inp(false)} /></F>
                <F label="HSN Code"><input value={form.hsnCode} onChange={e => setForm({ ...form, hsnCode: e.target.value })} placeholder="8414" style={inp(false)} /></F>
                <F label="Unit"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs / kg / m" style={inp(false)} /></F>
                <F label="Quantity"><input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={inp(false)} /></F>
                <F label="Warranty (months)"><input type="number" min="0" value={form.warrantyMonths} onChange={e => setForm({ ...form, warrantyMonths: e.target.value })} style={inp(false)} /></F>
              </div>
              {form.price && (
                <div style={{ background: '#F8F9FF', borderRadius: 10, padding: 12, fontSize: 12, color: '#374557', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Price incl. GST: <strong>{symbol}{(Number(form.price) * (1 + Number(form.gstPercent || 0) / 100)).toLocaleString()}</strong></span>
                  <span>Line total: <strong>{symbol}{(Number(form.price) * (1 + Number(form.gstPercent || 0) / 100) * Number(form.quantity || 1)).toLocaleString()}</strong></span>
                </div>
              )}
              <F label="Notes"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inp(false), resize: 'vertical' }} /></F>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={create.isPending || update.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {(create.isPending || update.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Add Component'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
      <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#374557' }}>{value}</p>
    </div>
  )
}
function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>{label}</label>{children}{error && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{error}</p>}</div>
}
function inp(err: boolean): React.CSSProperties {
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${err ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
