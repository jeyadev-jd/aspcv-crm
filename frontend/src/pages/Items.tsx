import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import { useState } from 'react'
import type React from 'react'
import { Plus, X, Edit2, Trash2, Package, Search, AlertTriangle } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useSetItemDealerPrice, useDeleteItemDealerPrice, useBulkDeleteItems } from '@/hooks/useItems'
import type { ItemAPI } from '@/hooks/useItems'
import { useDealers } from '@/hooks/useDealers'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import BulkActionBar from '@/components/shared/BulkActionBar'
import BulkDeleteDialog from '@/components/shared/BulkDeleteDialog'

const blankForm = {
  dealerId: '', name: '', description: '', specification: '', unit: '', quantity: '', price: '',
  partNumber: '', brand: '', category: '', inStock: true, notes: '',
}

export default function Items() {
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const { data: items = [], isLoading, isError, refetch } = useItems(search ? { q: search } : undefined)
  const { data: dealers = [] } = useDealers()
  const create = useCreateItem()
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const bulkDelete = useBulkDeleteItems()
  const bulk = useBulkSelect(items.map(i => i.id))
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [dealerSearch, setDealerSearch] = useState('')
  const [dealerDropdownOpen, setDealerDropdownOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Multi-dealer pricing: which item we're adding an alternative vendor to
  const [vendorFor, setVendorFor] = useState<ItemAPI | null>(null)
  const [vendorForm, setVendorForm] = useState({ dealerId: '', price: '', referenceNumber: '', leadTimeDays: '', minOrderQty: '', isPreferred: false })
  const [vendorErr, setVendorErr] = useState('')
  const setVendorPrice = useSetItemDealerPrice()
  const deleteVendorPrice = useDeleteItemDealerPrice()

  function openVendorModal(it: ItemAPI) {
    setVendorFor(it)
    setVendorForm({ dealerId: '', price: '', referenceNumber: '', leadTimeDays: '', minOrderQty: '', isPreferred: false })
    setVendorErr('')
  }

  async function saveVendorPrice() {
    if (!vendorFor) return
    if (!vendorForm.dealerId) { setVendorErr('Pick a dealer'); return }
    const price = parseFloat(vendorForm.price)
    if (!Number.isFinite(price) || price < 0) { setVendorErr('Enter a valid price'); return }
    setVendorErr('')
    try {
      await setVendorPrice.mutateAsync({
        itemId: vendorFor.id,
        dealerId: vendorForm.dealerId,
        price,
        referenceNumber: vendorForm.referenceNumber || null,
        leadTimeDays: vendorForm.leadTimeDays ? Number(vendorForm.leadTimeDays) : null,
        minOrderQty: vendorForm.minOrderQty ? Number(vendorForm.minOrderQty) : null,
        isPreferred: vendorForm.isPreferred,
      })
      setVendorFor(null)
    } catch (e: any) {
      setVendorErr(e?.response?.data?.error ?? 'Failed to save vendor price')
    }
  }

  const filteredDealers = dealers.filter(d => d.name.toLowerCase().includes(dealerSearch.toLowerCase()))

  function openCreate() {
    setEditId(null); setForm(blankForm); setDealerSearch(''); setErrors({}); setShowModal(true)
  }
  function openEdit(it: ItemAPI) {
    setEditId(it.id)
    setForm({
      dealerId: it.dealerId, name: it.name, description: it.description ?? '', specification: it.specification ?? '',
      unit: it.unit ?? '', quantity: it.quantity != null ? String(it.quantity) : '', price: it.price != null ? String(it.price) : '',
      partNumber: it.partNumber ?? '', brand: it.brand ?? '', category: it.category ?? '', inStock: it.inStock, notes: it.notes ?? '',
    })
    setDealerSearch(it.dealer?.name ?? '')
    setErrors({}); setShowModal(true)
  }
  function close() { setShowModal(false); setEditId(null); setForm(blankForm); setDealerSearch(''); setErrors({}) }

  async function save() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Item name required'
    if (!form.dealerId) e.dealerId = 'Select a dealer'
    if (Object.keys(e).length) { setErrors(e); return }
    const payload = {
      ...form,
      price: form.price ? Number(form.price) : undefined,
      quantity: form.quantity ? Number(form.quantity) : undefined,
    }
    if (editId) await update.mutateAsync({ id: editId, ...payload })
    else await create.mutateAsync(payload)
    close()
  }

  async function handleDelete(id: string) { await remove.mutateAsync(id); setDeleteConfirm(null) }

  function selectDealer(id: string, name: string) {
    setForm(f => ({ ...f, dealerId: id })); setDealerSearch(name); setDealerDropdownOpen(false)
  }

  if (isLoading) return <Spinner />
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load items" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: isMobile ? 1 : 'none' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items, dealers, brands…"
            style={{ paddingLeft: 34, paddingRight: 14, height: 38, borderRadius: 10, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', width: isMobile ? '100%' : 300, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {items.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={bulk.allSelected} ref={el => { if (el) el.indeterminate = bulk.someSelected }} onChange={bulk.toggleAll} />
              Select all
            </label>
          )}
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Plus size={14} /> New Item
          </button>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <EmptyState icon={Package} title={search ? 'No items match your search' : 'No items yet'}
          subtitle={search ? 'Try a different search term.' : 'Add products supplied by your dealers to get started.'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {items.map(it => (
            <div key={it.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${bulk.isSelected(it.id) ? '#5D78FF' : '#F0F1F5'}`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <input type="checkbox" checked={bulk.isSelected(it.id)} onChange={() => bulk.toggle(it.id)} style={{ flexShrink: 0, cursor: 'pointer' }} />
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={16} style={{ color: '#5D78FF' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#374557', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</p>
                    <p style={{ fontSize: 11, color: '#5D78FF' }}>{it.dealer?.name}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => openEdit(it)} style={iconBtn}><Edit2 size={12} /></button>
                  <button onClick={() => setDeleteConfirm(it.id)} style={{ ...iconBtn, color: '#FF5353' }}><Trash2 size={12} /></button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {it.brand && <span style={{ fontSize: 10, color: '#5D78FF', background: '#E8EDFF', borderRadius: 6, padding: '1px 7px' }}>{it.brand}</span>}
                {it.category && <span style={{ fontSize: 10, color: '#8C8C8C', background: '#F4F5F9', borderRadius: 6, padding: '1px 7px' }}>{it.category}</span>}
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 6, background: it.inStock ? '#E7FAF0' : '#FFEEEE', color: it.inStock ? '#2BC155' : '#FF5353' }}>{it.inStock ? 'In Stock' : 'Out of Stock'}</span>
              </div>

              {it.description && <p style={{ fontSize: 11, color: '#374557', marginTop: 8, lineHeight: 1.5 }}>{it.description}</p>}
              {it.specification && <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 1.5 }}>{it.specification}</p>}

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px solid #F4F5F9' }}>
                {it.price != null && <span style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>₹{Number(it.price).toLocaleString()}{it.unit ? ` / ${it.unit}` : ''}</span>}
                {it.quantity != null && <span style={{ fontSize: 11, color: '#B1B1BE' }}>Qty: {it.quantity}</span>}
                {it.partNumber && <span style={{ fontSize: 11, color: '#B1B1BE' }}>Part: {it.partNumber}</span>}
              </div>

              {/* Other dealers supplying this same part, cheapest / preferred first */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F4F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.6 }}>
                    OTHER DEALERS ({it.dealerPrices?.length ?? 0})
                  </p>
                  <button onClick={() => openVendorModal(it)}
                    style={{ fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    + Add
                  </button>
                </div>
                {(it.dealerPrices ?? []).length === 0 ? (
                  <p style={{ fontSize: 11, color: '#C4C4CF' }}>Only sourced from {it.dealer?.name}.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {it.dealerPrices!.map(dp => (
                      <div key={dp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span style={{ color: '#374557', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dp.dealer?.name}
                          {dp.isPreferred && <span style={{ color: '#2BC155', marginLeft: 5 }}>★</span>}
                        </span>
                        {dp.minOrderQty != null && <span style={{ color: '#B1B1BE' }}>MOQ {dp.minOrderQty}</span>}
                        {dp.leadTimeDays != null && <span style={{ color: '#B1B1BE' }}>{dp.leadTimeDays}d</span>}
                        <span style={{ color: '#374557', fontWeight: 700 }}>₹{Number(dp.price).toLocaleString()}</span>
                        <button onClick={() => deleteVendorPrice.mutate({ itemId: it.id, priceId: dp.id })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: 0, display: 'flex' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <BulkActionBar count={bulk.count} entityLabel="items" onDelete={() => setShowBulkDelete(true)} onClear={bulk.clear} />

      {showBulkDelete && (
        <BulkDeleteDialog
          count={bulk.count}
          entityLabel="items"
          isPending={bulkDelete.isPending}
          onCancel={() => setShowBulkDelete(false)}
          onConfirm={async () => {
            await bulkDelete.mutateAsync(bulk.selectedIds)
            setShowBulkDelete(false)
            bulk.clear()
          }}
        />
      )}

      {/* Add an alternative dealer + their price for this item */}
      {vendorFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 'min(440px, 96vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>Add Dealer Price</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{vendorFor.name}</p>
              </div>
              <button onClick={() => setVendorFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Dealer *</p>
                <select value={vendorForm.dealerId} onChange={e => setVendorForm(f => ({ ...f, dealerId: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }}>
                  <option value="">Select dealer…</option>
                  {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Price *</p>
                  <input type="number" min="0" value={vendorForm.price} onChange={e => setVendorForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Lead time (days)</p>
                  <input type="number" min="0" value={vendorForm.leadTimeDays} onChange={e => setVendorForm(f => ({ ...f, leadTimeDays: e.target.value }))}
                    placeholder="—" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Min order quantity</p>
                <input type="number" min="1" value={vendorForm.minOrderQty} onChange={e => setVendorForm(f => ({ ...f, minOrderQty: e.target.value }))}
                  placeholder="e.g. 10" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Dealer part / quote reference</p>
                <input value={vendorForm.referenceNumber} onChange={e => setVendorForm(f => ({ ...f, referenceNumber: e.target.value }))}
                  placeholder="e.g. QT-2026-114" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374557' }}>
                <input type="checkbox" checked={vendorForm.isPreferred} onChange={e => setVendorForm(f => ({ ...f, isPreferred: e.target.checked }))} />
                Preferred vendor for this item
              </label>

              {vendorErr && <p style={{ fontSize: 11, color: '#FF5353' }}>{vendorErr}</p>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setVendorFor(null)}
                  style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveVendorPrice} disabled={setVendorPrice.isPending}
                  style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                  {setVendorPrice.isPending ? 'Saving…' : 'Save Price'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 340 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Item?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 'min(580px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Item' : 'New Item'}</p>
              <button onClick={close} style={iconBtn}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Dealer Name *</label>
                <input
                  value={dealerSearch}
                  onChange={e => { setDealerSearch(e.target.value); setForm(f => ({ ...f, dealerId: '' })); setDealerDropdownOpen(true) }}
                  onFocus={() => setDealerDropdownOpen(true)}
                  placeholder="Search or select dealer…"
                  style={inp(!!errors.dealerId)}
                />
                {dealerDropdownOpen && filteredDealers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #F0F1F5', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', zIndex: 10 }}>
                    {filteredDealers.map(d => (
                      <button key={d.id} onClick={() => selectDealer(d.id, d.name)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#374557', background: form.dealerId === d.id ? '#F5F7FF' : 'none', border: 'none', cursor: 'pointer' }}>
                        {d.name}{d.company ? ` · ${d.company}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                {errors.dealerId && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{errors.dealerId}</p>}
              </div>

              <F label="Item Name *" error={errors.name}><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. R-32 Refrigerant" style={inp(!!errors.name)} /></F>
              <F label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Short description…" style={{ ...inp(false), resize: 'vertical' }} /></F>
              <F label="Specification"><textarea value={form.specification} onChange={e => setForm({ ...form, specification: e.target.value })} rows={2} placeholder="Technical details, grade, size…" style={{ ...inp(false), resize: 'vertical' }} /></F>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Unit"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs / kg / m / set" style={inp(false)} /></F>
                <F label="Quantity"><input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" style={inp(false)} /></F>
                <F label="Price (₹ INR)"><input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0" style={inp(false)} /></F>
                <F label="Category"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Refrigerant" style={inp(false)} /></F>
                <F label="Brand"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Daikin" style={inp(false)} /></F>
                <F label="Part Number"><input value={form.partNumber} onChange={e => setForm({ ...form, partNumber: e.target.value })} placeholder="SKU / Part No." style={inp(false)} /></F>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="instock" checked={form.inStock} onChange={e => setForm({ ...form, inStock: e.target.checked })} />
                <label htmlFor="instock" style={{ fontSize: 12, color: '#374557', cursor: 'pointer' }}>In Stock</label>
              </div>

              <F label="Notes"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inp(false), resize: 'vertical' }} /></F>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={create.isPending || update.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {(create.isPending || update.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>{label}</label>{children}{error && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{error}</p>}</div>
}
const iconBtn: React.CSSProperties = { color: '#B1B1BE', background: '#F4F5F9', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8, display: 'flex' }
function inp(err: boolean): React.CSSProperties {
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${err ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
