import { useState } from 'react'
import { MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, Trash2, Edit2, CheckCircle2, PauseCircle } from 'lucide-react'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData, type Contact } from '@/lib/crmDataContext'

const statusStyle: Record<string, { bg: string; color: string }> = {
  Active:   { bg: '#E7FAF0', color: '#2BC155' },
  Inactive: { bg: '#F4F5F9', color: '#8C8C8C' },
}

const avatarColors = ['#5D78FF', '#FF9B52', '#2BC155', '#FF5353', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899']
const blankForm = { firstName: '', lastName: '', title: '', email: '', phone: '', mobile: '', department: '', account: '', status: 'Active' as Contact['status'] }
const PAGE_SIZE = 6

export default function Contacts() {
  const isMobile = useIsMobile()
  const { contacts, setContacts } = useCrmData()
  const [filter, setFilter] = useState<'All' | Contact['status']>('All')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Contact | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filtered = filter === 'All' ? contacts : contacts.filter(c => c.status === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openCreate() { setEditItem(null); setForm(blankForm); setErrors({}); setShowModal(true) }
  function openEdit(c: Contact) {
    setEditItem(c)
    setForm({ firstName: c.firstName, lastName: c.lastName, title: c.title, email: c.email, phone: c.phone, mobile: c.mobile, department: c.department, account: c.account, status: c.status })
    setErrors({}); setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditItem(null); setForm(blankForm); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'First name required'
    if (!form.lastName.trim()) e.lastName = 'Last name required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format'
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    if (editItem) {
      setContacts(p => p.map(c => c.id === editItem.id ? { ...c, ...form } : c))
    } else {
      setContacts(p => [{ id: String(Date.now()), ...form }, ...p])
    }
    closeModal()
  }

  function handleDelete(id: string) { setContacts(p => p.filter(c => c.id !== id)); setMenuOpen(null); setDeleteConfirm(null); setPage(1) }
  function changeFilter(f: typeof filter) { setFilter(f); setPage(1) }

  const departments = [...new Set(contacts.map(c => c.department))]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: isMobile ? 'stretch' : 'flex-start', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Contacts</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>People directory</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[{ label: 'Total', value: contacts.length, color: '#5D78FF' }, { label: 'Active', value: contacts.filter(c => c.status === 'Active').length, color: '#2BC155' }, { label: 'Inactive', value: contacts.filter(c => c.status === 'Inactive').length, color: '#8C8C8C' }].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <p style={{ fontSize: 11, color: '#374557' }}>{s.label}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 10 }}>By Department</p>
          {departments.map(dept => {
            const n = contacts.filter(c => c.department === dept).length
            return (
              <div key={dept} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: '#374557' }}>{dept}</p>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 10, background: '#E8EDFF', color: '#5D78FF' }}>{n}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['All', 'Active', 'Inactive'] as const).map(f => (
              <button key={f} onClick={() => changeFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === f ? '#5D78FF' : '#F4F5F9', color: filter === f ? '#fff' : '#B1B1BE' }}>{f}</button>
            ))}
          </div>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Plus size={14} /> New Contact
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map((c) => (
                <div key={c.id} onClick={() => openEdit(c)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: avatarColors[parseInt(c.id) % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{c.firstName[0]}{c.lastName[0]}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.firstName} {c.lastName}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{c.account}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[c.status].bg, color: statusStyle[c.status].color }}>{c.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Email</p>
                      <p style={{ fontSize: 11, color: '#374557' }}>{c.email}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Phone</p>
                      <p style={{ fontSize: 11, color: '#374557' }}>{c.phone}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Title</p>
                      <p style={{ fontSize: 11, color: '#374557' }}>{c.title}</p>
                    </div>
                  </div>
                </div>
              ))}
              {paginated.length === 0 && <p style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 24 }}>No records found.</p>}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                {['Contact', 'Title', 'Email', 'Phone', 'Account', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((c, i) => (
                <tr key={c.id} onClick={() => openEdit(c)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: avatarColors[parseInt(c.id) % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{c.firstName[0]}{c.lastName[0]}</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.firstName} {c.lastName}</p>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{c.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{c.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{c.phone}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: '#F4F5F9', color: '#374557' }}>{c.account}</span></td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[c.status].bg, color: statusStyle[c.status].color }}>{c.status}</span></td>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ position: 'relative' }}>
                      <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id) }} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                        <MoreHorizontal size={15} />
                      </button>
                      {menuOpen === c.id && (
                        <div style={dropdownStyle}>
                          <button onClick={() => { openEdit(c); setMenuOpen(null) }} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                          <button onClick={() => { setContacts(p => p.map(x => x.id === c.id ? { ...x, status: c.status === 'Active' ? 'Inactive' : 'Active' } : x)); setMenuOpen(null) }} style={menuItem}>{c.status === 'Active' ? <><PauseCircle size={12} style={{marginRight:6}}/>Deactivate</> : <><CheckCircle2 size={12} style={{marginRight:6}}/>Activate</>}</button>
                          <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                          <button onClick={() => { setDeleteConfirm(c.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No contacts found.</td></tr>}
            </tbody>
          </table>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}><ChevronLeft size={13} /> Prev</button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setPage(pg)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
              ))}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}>Next <ChevronRight size={13} /></button>
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Contact?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editItem ? 'Edit Contact' : 'New Contact'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="First Name *" error={errors.firstName}>
                  <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="First name" style={inp(!!errors.firstName)} />
                </Field>
                <Field label="Last Name *" error={errors.lastName}>
                  <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" style={inp(!!errors.lastName)} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Job Title">
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Director" style={inp(false)} />
                </Field>
                <Field label="Department">
                  <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Engineering" style={inp(false)} />
                </Field>
              </div>
              <Field label="Email *" error={errors.email}>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" style={inp(!!errors.email)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Office Phone">
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+44 ..." style={inp(false)} />
                </Field>
                <Field label="Mobile">
                  <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="+44 7..." style={inp(false)} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Account">
                  <select value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} style={inp(false)}>
                    <option value="">Select account...</option>
                    {accounts.map(a => <option key={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Contact['status'] })} style={inp(false)}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{editItem ? 'Save Changes' : 'Create Contact'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const dropdownStyle: React.CSSProperties = { position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', borderRadius: 8, border: '1px solid #F0F1F5', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150, overflow: 'hidden', padding: '4px 0' }
const menuItem: React.CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

function inp(hasError: boolean): React.CSSProperties {
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff' }
}
