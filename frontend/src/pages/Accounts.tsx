import Pagination from '@/components/shared/Pagination'
import RowMenu from '@/components/shared/RowMenu'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'
import { X, Plus, Building2, Trash2, Edit2, CheckCircle2, PauseCircle } from 'lucide-react'
import type React from 'react'
import { useCrmData, type Account } from '@/lib/crmDataContext'
import { api } from '@/lib/api'

const DEFAULT_STATUS_STYLE = { bg: '#F4F5F9', color: '#8C8C8C' }
const statusStyle: Record<string, { bg: string; color: string }> = {
  Active:   { bg: '#E7FAF0', color: '#2BC155' },
  Inactive: { bg: '#F4F5F9', color: '#8C8C8C' },
  Prospect: { bg: '#E8EDFF', color: '#5D78FF' },
}
function getStatusStyle(status: string) { return statusStyle[status] ?? DEFAULT_STATUS_STYLE }

const industries = ['Housing', 'Construction', 'Real Estate', 'Engineering', 'Sustainability', 'Property', 'Manufacturing', 'Other']
const blankForm = { name: '', industry: 'Housing', website: '', phone: '', email: '', address: '', employees: '', status: 'Prospect' as Account['status'] }
const PAGE_SIZE = 5

export default function Accounts() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { accounts, addAccount } = useCrmData()
  const [filter, setFilter] = useState<'All' | Account['status']>('All')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Account | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filtered = filter === 'All' ? accounts : accounts.filter(a => a.status === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalRevenue = accounts.filter(a => a.status === 'Active').reduce((s, a) => s + a.revenue, 0)
  const byIndustry = industries.map(ind => ({ ind, count: accounts.filter(a => a.industry === ind).length })).filter(x => x.count > 0)

  function openCreate() { setEditItem(null); setForm(blankForm); setErrors({}); setShowModal(true) }
  function openEdit(acct: Account) {
    setEditItem(acct)
    setForm({ name: acct.name, industry: acct.industry, website: acct.website, phone: acct.phone, email: acct.email, address: acct.address, employees: String(acct.employees), status: acct.status })
    setErrors({}); setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditItem(null); setForm(blankForm); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Account name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (form.employees && (isNaN(Number(form.employees)) || Number(form.employees) < 0)) e.employees = 'Must be a positive number'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    if (editItem) {
      await api.patch(`/companies/${editItem.id}`, {
        name: form.name, industry: form.industry, website: form.website,
        phone: form.phone, email: form.email,
      })
    } else {
      await addAccount({ name: form.name, industry: form.industry, website: form.website, phone: form.phone, email: form.email })
    }
    closeModal()
  }

  async function handleDelete(id: string) {
    await api.delete(`/companies/${id}`)
    setMenuOpen(null); setDeleteConfirm(null); setPage(1)
  }
  function changeFilter(f: typeof filter) { setFilter(f); setPage(1) }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: isMobile ? 'stretch' : 'flex-start', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Account Stats</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Client portfolio overview</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total Accounts', value: accounts.length,                                      color: '#5D78FF' },
              { label: 'Active',         value: accounts.filter(a => a.status === 'Active').length,   color: '#2BC155' },
              { label: 'Prospects',      value: accounts.filter(a => a.status === 'Prospect').length, color: '#FF9B52' },
              { label: 'Inactive',       value: accounts.filter(a => a.status === 'Inactive').length, color: '#8C8C8C' },
              { label: 'Open Deals',     value: accounts.reduce((s, a) => s + a.openDeals, 0),        color: '#5D78FF' },
            ].map(s => (
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
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>Active Revenue</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#374557' }}>{symbol}{(totalRevenue / 1000).toFixed(0)}k</p>
          <p style={{ fontSize: 10, color: '#2BC155', marginTop: 2 }}>From active accounts</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 10 }}>By Industry</p>
          {byIndustry.map(({ ind, count }) => (
            <div key={ind} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: '#374557' }}>{ind}</p>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 10, background: '#E8EDFF', color: '#5D78FF' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['All', 'Active', 'Prospect', 'Inactive'] as const).map(f => (
              <button key={f} onClick={() => changeFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === f ? '#5D78FF' : '#F4F5F9', color: filter === f ? '#fff' : '#B1B1BE', transition: 'all 0.15s' }}>{f}</button>
            ))}
          </div>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Plus size={14} /> New Account
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map((acct) => (
                <div key={acct.id} onClick={() => navigate(`/customers/${acct.id}`)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#E8EDFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={15} style={{ color: '#5D78FF' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{acct.name}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{acct.website}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: getStatusStyle(acct.status).bg, color: getStatusStyle(acct.status).color }}>{acct.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Industry</p>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#F4F5F9', color: '#374557' }}>{acct.industry}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Employees</p>
                      <p style={{ fontSize: 11, color: '#374557', fontWeight: 600 }}>{acct.employees.toLocaleString()}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Deals</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: acct.openDeals > 0 ? '#5D78FF' : '#B1B1BE' }}>{acct.openDeals} deals</p>
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
                {['Account', 'Industry', 'Employees', 'Contact', 'Deals', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((acct, i) => (
                <tr key={acct.id} onClick={() => navigate(`/customers/${acct.id}`)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#E8EDFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={15} style={{ color: '#5D78FF' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{acct.name}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{acct.website}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#F4F5F9', color: '#374557' }}>{acct.industry}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{acct.employees.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 11, color: '#374557' }}>{acct.phone}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>{acct.email}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 700, color: acct.openDeals > 0 ? '#5D78FF' : '#B1B1BE' }}>{acct.openDeals}</span></td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: getStatusStyle(acct.status).bg, color: getStatusStyle(acct.status).color }}>{acct.status}</span></td>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <RowMenu open={menuOpen === acct.id} onOpenChange={o => setMenuOpen(o ? acct.id : null)}>
                      <button onClick={() => { openEdit(acct); setMenuOpen(null) }} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                      <button onClick={() => { api.patch(`/companies/${acct.id}`, { isActive: true }); setMenuOpen(null) }} style={menuItem}><CheckCircle2 size={12} style={{marginRight:6}}/>Mark Active</button>
                      <button onClick={() => { api.patch(`/companies/${acct.id}`, { isActive: false }); setMenuOpen(null) }} style={menuItem}><PauseCircle size={12} style={{marginRight:6}}/>Mark Inactive</button>
                      <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                      <button onClick={() => { setDeleteConfirm(acct.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                    </RowMenu>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No accounts found.</td></tr>}
            </tbody>
          </table>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Archive this account?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>
              The account is hidden from lists but its contacts, deals, projects and invoices are kept. An admin can restore it later.
            </p>
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
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editItem ? 'Edit Account' : 'New Account'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Account Name *" error={errors.name}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company name" style={inp(!!errors.name)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Industry">
                  <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} style={inp(false)}>
                    {industries.map(i => <option key={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Account['status'] })} style={inp(false)}>
                    {(['Active', 'Prospect', 'Inactive'] as Account['status'][]).map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Email" error={errors.email}>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="info@company.com" style={inp(!!errors.email)} />
                </Field>
                <Field label="Phone">
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+44 ..." style={inp(false)} />
                </Field>
              </div>
              <Field label="Website">
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="company.com" style={inp(false)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <Field label="Address">
                  <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="City, Postcode" style={inp(false)} />
                </Field>
                <Field label="Employees" error={errors.employees}>
                  <input value={form.employees} onChange={e => setForm({ ...form, employees: e.target.value })} placeholder="0" type="number" min="0" style={inp(!!errors.employees)} />
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{editItem ? 'Save Changes' : 'Create Account'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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