import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import { useState } from 'react'
import type React from 'react'
import { Plus, X, Edit2, Trash2, Store, Phone, Mail, MapPin, Loader2, Search, Package, AlertTriangle } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useDealers, useCreateDealer, useUpdateDealer, useDeleteDealer } from '@/hooks/useDealers'
import { useDealerItems, useCreateDealerItem, useUpdateDealerItem, useDeleteDealerItem } from '@/hooks/useDealers'
import type { Dealer, DealerContact } from '@/hooks/useDealers'

const blankContact: DealerContact = { name: '', designation: '', phone: '', email: '', whatsapp: '', isPrimary: false }
const blankForm = {
  name: '', company: '', gstNumber: '', phone: '', email: '',
  address: '', city: '', state: '', category: '', notes: '',
  contacts: [{ ...blankContact, isPrimary: true }] as DealerContact[],
}

export default function Dealers() {
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const { data: dealers = [], isLoading, isError, refetch } = useDealers(search || undefined)
  const create = useCreateDealer()
  const update = useUpdateDealer()
  const remove = useDeleteDealer()

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [selected, setSelected] = useState<Dealer | null>(null)
  const [detailTab, setDetailTab] = useState<'details' | 'items'>('details')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function openCreate() { setEditId(null); setForm(blankForm); setErrors({}); setShowModal(true) }
  function openEdit(d: Dealer) {
    setSelected(null); setEditId(d.id)
    setForm({
      name: d.name, company: d.company ?? '', gstNumber: d.gstNumber ?? '', phone: d.phone ?? '', email: d.email ?? '',
      address: d.address ?? '', city: d.city ?? '', state: d.state ?? '', category: d.category ?? '', notes: d.notes ?? '',
      contacts: d.contacts.length ? d.contacts.map(c => ({ ...c })) : [{ ...blankContact, isPrimary: true }],
    })
    setErrors({}); setShowModal(true)
  }
  function close() { setShowModal(false); setEditId(null); setForm(blankForm); setErrors({}) }

  function setContact(i: number, patch: Partial<DealerContact>) {
    setForm(f => ({ ...f, contacts: f.contacts.map((c, idx) => idx === i ? { ...c, ...patch } : c) }))
  }
  function addContact() { setForm(f => ({ ...f, contacts: [...f.contacts, { ...blankContact }] })) }
  function removeContact(i: number) { setForm(f => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) })) }

  async function save() {
    if (!form.name.trim()) { setErrors({ name: 'Dealer name required' }); return }
    const payload = {
      ...form,
      contacts: form.contacts.filter(c => c.name.trim()),
    }
    if (editId) await update.mutateAsync({ id: editId, ...payload })
    else await create.mutateAsync(payload)
    close()
  }

  async function handleDelete(id: string) { await remove.mutateAsync(id); setDeleteConfirm(null); setSelected(null) }

  if (isLoading) return <Spinner />
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load dealers" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: isMobile ? 1 : 'none' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dealers…"
            style={{ paddingLeft: 34, paddingRight: 14, height: 38, borderRadius: 10, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', width: isMobile ? '100%' : 260, boxSizing: 'border-box' }} />
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> New Dealer
        </button>
      </div>

      {/* Grid */}
      {dealers.length === 0 ? (
        <EmptyState icon={Store} title="No dealers yet" subtitle="Add your first dealer / supplier." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {dealers.map(d => {
            const primary = d.contacts.find(c => c.isPrimary) ?? d.contacts[0]
            return (
              <div key={d.id} onClick={() => setSelected(d)} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Store size={16} style={{ color: '#5D78FF' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{d.name}</p>
                      {d.company && <p style={{ fontSize: 11, color: '#B1B1BE' }}>{d.company}</p>}
                    </div>
                  </div>
                  {d.category && <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 8, background: '#F4F5F9', color: '#8C8C8C' }}>{d.category}</span>}
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {d.phone && <Row icon={Phone} text={d.phone} />}
                  {d.email && <Row icon={Mail} text={d.email} />}
                  {(d.city || d.state) && <Row icon={MapPin} text={[d.city, d.state].filter(Boolean).join(', ')} />}
                  {primary && <p style={{ fontSize: 11, color: '#8C8C8C', marginTop: 4 }}>Contact: <span style={{ color: '#374557', fontWeight: 500 }}>{primary.name}</span>{primary.phone ? ` · ${primary.phone}` : ''}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail */}
      {selected && (
        <DealerDetailModal
          dealer={selected}
          tab={detailTab}
          onTabChange={setDetailTab}
          onEdit={() => openEdit(selected)}
          onDelete={() => setDeleteConfirm(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 340 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Dealer?</p>
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
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Dealer' : 'New Dealer'}</p>
              <button onClick={close} style={iconBtn}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Dealer Name *" error={errors.name}><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp(!!errors.name)} /></F>
                <F label="Company"><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={inp(false)} /></F>
                <F label="GST Number"><input value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })} placeholder="22AAAAA0000A1Z5" style={inp(false)} /></F>
                <F label="Category"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Compressors" style={inp(false)} /></F>
                <F label="Phone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inp(false)} /></F>
                <F label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp(false)} /></F>
                <F label="City"><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} style={inp(false)} /></F>
                <F label="State"><input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} style={inp(false)} /></F>
              </div>
              <F label="Address"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={inp(false)} /></F>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Contacts</p>
                <button onClick={addContact} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer' }}><Plus size={12} /> Add</button>
              </div>
              {form.contacts.map((c, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 10, border: '1px solid #F0F1F5', background: '#FAFBFF', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={c.name} onChange={e => setContact(i, { name: e.target.value })} placeholder="Name" style={inp(false)} />
                    <input value={c.designation} onChange={e => setContact(i, { designation: e.target.value })} placeholder="Designation" style={inp(false)} />
                    <input value={c.phone} onChange={e => setContact(i, { phone: e.target.value })} placeholder="Phone" style={inp(false)} />
                    <input value={c.email} onChange={e => setContact(i, { email: e.target.value })} placeholder="Email" style={inp(false)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374557', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!c.isPrimary} onChange={e => setForm(f => ({ ...f, contacts: f.contacts.map((cc, idx) => ({ ...cc, isPrimary: idx === i ? e.target.checked : false })) }))} />
                      Primary contact
                    </label>
                    {form.contacts.length > 1 && <button onClick={() => removeContact(i)} style={{ color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}

              <F label="Notes"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inp(false), resize: 'vertical' }} /></F>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={create.isPending || update.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {(create.isPending || update.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Create Dealer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dealer Detail Modal with tabs ─────────────────────────────────────────────
const blankItem = { name: '', description: '', specification: '', unit: '', quantity: '', price: '', partNumber: '', brand: '', category: '', inStock: true, notes: '' }

function DealerDetailModal({ dealer, tab, onTabChange, onEdit, onDelete, onClose }: {
  dealer: Dealer; tab: string; onTabChange: (t: 'details' | 'items') => void
  onEdit: () => void; onDelete: () => void; onClose: () => void
}) {
  const { data: items = [] } = useDealerItems(dealer.id)
  const createItem = useCreateDealerItem(dealer.id)
  const updateItem = useUpdateDealerItem(dealer.id)
  const deleteItem = useDeleteDealerItem(dealer.id)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(blankItem)

  function openCreateItem() { setEditItemId(null); setItemForm(blankItem); setShowItemForm(true) }
  function openEditItem(it: any) { setEditItemId(it.id); setItemForm({ name: it.name, description: it.description ?? '', specification: it.specification ?? '', unit: it.unit ?? '', quantity: it.quantity != null ? String(it.quantity) : '', price: it.price != null ? String(it.price) : '', partNumber: it.partNumber ?? '', brand: it.brand ?? '', category: it.category ?? '', inStock: it.inStock, notes: it.notes ?? '' }); setShowItemForm(true) }
  async function saveItem() {
    if (!itemForm.name.trim()) return
    const payload = { ...itemForm, price: itemForm.price ? Number(itemForm.price) : undefined, quantity: itemForm.quantity ? Number(itemForm.quantity) : undefined }
    if (editItemId) await updateItem.mutateAsync({ itemId: editItemId, ...payload })
    else await createItem.mutateAsync(payload)
    setShowItemForm(false); setItemForm(blankItem); setEditItemId(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(620px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: '1px solid #F0F1F5', paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Store size={18} style={{ color: '#5D78FF' }} /></div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>{dealer.name}</p>
                {dealer.company && <p style={{ fontSize: 12, color: '#B1B1BE' }}>{dealer.company}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onEdit} style={iconBtn}><Edit2 size={14} /></button>
              <button onClick={onDelete} style={{ ...iconBtn, color: '#FF5353' }}><Trash2 size={14} /></button>
              <button onClick={onClose} style={iconBtn}><X size={16} /></button>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['details', 'items'] as const).map(t => (
              <button key={t} onClick={() => onTabChange(t)} style={{ padding: '10px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: tab === t ? '#5D78FF' : '#B1B1BE', borderBottom: `2px solid ${tab === t ? '#5D78FF' : 'transparent'}`, textTransform: 'capitalize' }}>
                {t === 'items' ? `Items (${items.length})` : 'Details'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <Detail label="GST Number" value={dealer.gstNumber} />
                <Detail label="Category" value={dealer.category} />
                <Detail label="Phone" value={dealer.phone} />
                <Detail label="Email" value={dealer.email} />
                <Detail label="City" value={dealer.city} />
                <Detail label="State" value={dealer.state} />
                <div style={{ gridColumn: '1 / -1' }}><Detail label="Address" value={dealer.address} /></div>
                {dealer.notes && <div style={{ gridColumn: '1 / -1' }}><Detail label="Notes" value={dealer.notes} /></div>}
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Contacts ({dealer.contacts.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dealer.contacts.map((c, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: '#FAFBFF', border: '1px solid #F0F1F5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.name}</p>
                      {c.isPrimary && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#E7FAF0', color: '#2BC155' }}>PRIMARY</span>}
                    </div>
                    {c.designation && <p style={{ fontSize: 11, color: '#B1B1BE' }}>{c.designation}</p>}
                    <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                      {c.phone && <span style={{ fontSize: 11, color: '#8C8C8C' }}>📞 {c.phone}</span>}
                      {c.email && <span style={{ fontSize: 11, color: '#8C8C8C' }}>✉ {c.email}</span>}
                    </div>
                  </div>
                ))}
                {dealer.contacts.length === 0 && <p style={{ fontSize: 11, color: '#B1B1BE' }}>No contacts.</p>}
              </div>
            </>
          )}

          {tab === 'items' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Dealer Items / Products</p>
                <button onClick={openCreateItem} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  <Plus size={12} /> New Item
                </button>
              </div>

              {showItemForm && (
                <div style={{ background: '#F8F9FF', borderRadius: 12, border: '1px solid #E8EDFF', padding: 16, marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 12 }}>{editItemId ? 'Edit Item' : 'New Item'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Item Name *</label>
                      <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. R-32 Refrigerant" style={inp(false)} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Description</label>
                      <textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Short description of the item…" style={{ ...inp(false), resize: 'vertical' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Specification</label>
                      <textarea value={itemForm.specification} onChange={e => setItemForm(f => ({ ...f, specification: e.target.value }))} rows={2} placeholder="Technical details, grade, size…" style={{ ...inp(false), resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Brand</label>
                      <input value={itemForm.brand} onChange={e => setItemForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Daikin" style={inp(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Part Number</label>
                      <input value={itemForm.partNumber} onChange={e => setItemForm(f => ({ ...f, partNumber: e.target.value }))} placeholder="SKU / Part No." style={inp(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Unit</label>
                      <input value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs / kg / m / set" style={inp(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Quantity</label>
                      <input type="number" min="0" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" style={inp(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Price (₹ INR)</label>
                      <input type="number" min="0" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} placeholder="0" style={inp(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Category</label>
                      <input value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Refrigerant" style={inp(false)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
                      <input type="checkbox" id="instock" checked={itemForm.inStock} onChange={e => setItemForm(f => ({ ...f, inStock: e.target.checked }))} />
                      <label htmlFor="instock" style={{ fontSize: 12, color: '#374557', cursor: 'pointer' }}>In Stock</label>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Notes</label>
                      <textarea value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inp(false), resize: 'vertical' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button onClick={() => { setShowItemForm(false); setItemForm(blankItem) }} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={saveItem} disabled={!itemForm.name.trim() || createItem.isPending || updateItem.isPending} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                      {(createItem.isPending || updateItem.isPending) ? 'Saving…' : editItemId ? 'Save Changes' : 'Add Item'}
                    </button>
                  </div>
                </div>
              )}

              {items.length === 0 && !showItemForm ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <Package size={24} style={{ color: '#D5D5D5', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: '#B1B1BE' }}>No items yet. Add products this dealer supplies.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((it: any) => (
                    <div key={it.id} style={{ background: '#FAFBFF', borderRadius: 10, border: '1px solid #F0F1F5', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{it.name}</p>
                            {it.brand && <span style={{ fontSize: 10, color: '#5D78FF', background: '#E8EDFF', borderRadius: 6, padding: '1px 7px' }}>{it.brand}</span>}
                            {it.category && <span style={{ fontSize: 10, color: '#8C8C8C', background: '#F4F5F9', borderRadius: 6, padding: '1px 7px' }}>{it.category}</span>}
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 6, background: it.inStock ? '#E7FAF0' : '#FFEEEE', color: it.inStock ? '#2BC155' : '#FF5353' }}>{it.inStock ? 'In Stock' : 'Out of Stock'}</span>
                          </div>
                          {it.description && <p style={{ fontSize: 11, color: '#374557', marginBottom: 4, lineHeight: 1.5 }}>{it.description}</p>}
                          {it.specification && <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, lineHeight: 1.5 }}>{it.specification}</p>}
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            {it.price != null && <span style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>₹{Number(it.price).toLocaleString()}{it.unit ? ` / ${it.unit}` : ''}</span>}
                            {it.quantity != null && <span style={{ fontSize: 11, color: '#B1B1BE' }}>Qty: {it.quantity}</span>}
                            {it.partNumber && <span style={{ fontSize: 11, color: '#B1B1BE' }}>Part: {it.partNumber}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => openEditItem(it)} style={{ ...iconBtn, padding: 6 }}><Edit2 size={12} /></button>
                          <button onClick={() => deleteItem.mutateAsync(it.id)} style={{ ...iconBtn, color: '#FF5353', padding: 6 }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ icon: Icon, text }: { icon: React.FC<{ size?: number; style?: React.CSSProperties }>; text: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={12} style={{ color: '#B1B1BE', flexShrink: 0 }} /><span style={{ fontSize: 11, color: '#8C8C8C' }}>{text}</span></div>
}
function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>{label}</p><p style={{ fontSize: 12, color: '#374557', fontWeight: 500 }}>{value || '—'}</p></div>
}
function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>{label}</label>{children}{error && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{error}</p>}</div>
}
const iconBtn: React.CSSProperties = { color: '#B1B1BE', background: '#F4F5F9', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8, display: 'flex' }
function inp(err: boolean): React.CSSProperties {
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${err ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
