import { useState } from 'react'
import { Plus, X, MoreHorizontal, CheckCircle2 } from 'lucide-react'
import type React from 'react'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'

interface User {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Sales' | 'Engineer' | 'Support' | 'Viewer'
  status: 'Active' | 'Inactive'
  lastLogin: string
}

const initUsers: User[] = [
  { id: '1', name: 'Jeyadev',        email: 'jeyadev2006@gmail.com',   role: 'Admin',    status: 'Active',   lastLogin: '20 May 2026' },
  { id: '2', name: 'James Keating',  email: 'j.keating@aspcv.co.uk',  role: 'Sales',    status: 'Active',   lastLogin: '20 May 2026' },
  { id: '3', name: 'Priya Rao',      email: 'p.rao@aspcv.co.uk',      role: 'Sales',    status: 'Active',   lastLogin: '19 May 2026' },
  { id: '4', name: 'Dan Hughes',     email: 'd.hughes@aspcv.co.uk',   role: 'Engineer', status: 'Active',   lastLogin: '18 May 2026' },
  { id: '5', name: 'Chloe Parks',    email: 'c.parks@aspcv.co.uk',    role: 'Support',  status: 'Active',   lastLogin: '17 May 2026' },
  { id: '6', name: 'Sam Colton',     email: 's.colton@aspcv.co.uk',   role: 'Engineer', status: 'Inactive', lastLogin: '01 Apr 2026' },
]

const roles = ['Admin', 'Sales', 'Engineer', 'Support', 'Viewer'] as User['role'][]

const roleStyle: Record<string, { bg: string; color: string }> = {
  Admin:    { bg: '#FFF3F3', color: '#FF5353' },
  Sales:    { bg: '#E8EDFF', color: '#5D78FF' },
  Engineer: { bg: '#FFF5EE', color: '#FF9B52' },
  Support:  { bg: '#E7FAF0', color: '#2BC155' },
  Viewer:   { bg: '#F4F5F9', color: '#8C8C8C' },
}

const statusStyle: Record<string, { bg: string; color: string }> = {
  Active:   { bg: '#E7FAF0', color: '#2BC155' },
  Inactive: { bg: '#F4F5F9', color: '#8C8C8C' },
}

const blankForm = { name: '', email: '', role: 'Sales' as User['role'], status: 'Active' as User['status'] }

const tabs = ['Users', 'Roles', 'General', 'Notifications'] as const
type Tab = typeof tabs[number]

const initNotifications = [
  { label: 'New Lead assigned to me',          on: true  },
  { label: 'Deal stage changed',               on: true  },
  { label: 'Project milestone reached',        on: true  },
  { label: 'Support ticket opened',            on: true  },
  { label: 'Support ticket High priority',     on: true  },
  { label: 'Invoice overdue',                  on: true  },
  { label: 'Task due today',                   on: true  },
  { label: 'Weekly pipeline summary email',    on: false },
  { label: 'Monthly revenue report email',     on: false },
]

export default function Settings() {
  const isMobile = useIsMobile()
  const { currency, setCurrency } = useCurrency()
  const [activeTab, setActiveTab] = useState<Tab>('Users')
  const [users, setUsers] = useState(initUsers)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notifications, setNotifications] = useState(initNotifications)
  const [savedMsg, setSavedMsg] = useState(false)

  function toggleNotif(i: number) {
    setNotifications(prev => prev.map((n, idx) => idx === i ? { ...n, on: !n.on } : n))
  }

  function handleSaveGeneral() {
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name required'
    if (!form.email.trim()) e.email = 'Email required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const u: User = {
      id: String(Date.now()), name: form.name, email: form.email,
      role: form.role, status: form.status,
      lastLogin: '—',
    }
    setUsers(p => [...p, u])
    setShowModal(false)
    setForm(blankForm)
    setErrors({})
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start' }}>
      {/* Tab sidebar */}
      <div style={{ width: isMobile ? '100%' : 180, flexShrink: 0 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '12px 16px', fontSize: 12, fontWeight: activeTab === tab ? 600 : 500,
              border: 'none', cursor: 'pointer',
              background: activeTab === tab ? '#5D78FF' : 'transparent',
              color: activeTab === tab ? '#fff' : '#374557',
              borderBottom: '1px solid #F0F1F5',
              transition: 'all 0.15s',
            }}>{tab}</button>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16, marginTop: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 4 }}>ASPCV CRM</p>
          <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 10 }}>Aspiration Cleantech Ventures</p>
          <p style={{ fontSize: 10, color: '#B1B1BE' }}>Version 1.0.0</p>
          <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 2 }}>Build 2026.05.20</p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeTab === 'Users' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>User Management</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{users.length} users · {users.filter(u => u.status === 'Active').length} active</p>
              </div>
              <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Plus size={14} /> Invite User
              </button>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                    {['User', 'Role', 'Status', 'Last Login', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #F4F5F9' : 'none' }}>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#5D78FF,#8B5CF6)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{u.name[0]}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{u.name}</p>
                            <p style={{ fontSize: 11, color: '#B1B1BE' }}>{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: roleStyle[u.role].bg, color: roleStyle[u.role].color }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[u.status].bg, color: statusStyle[u.status].color }}>{u.status}</span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 11, color: '#B1B1BE' }}>{u.lastLogin}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <button style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer' }}><MoreHorizontal size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Roles' && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 4 }}>Role Permissions</p>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Access control per module</p>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F4F5F9', background: '#FAFBFF' }}>
                    <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>Module</th>
                    {roles.map(r => <th key={r} style={{ textAlign: 'center', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { module: 'Dashboard',   perms: [true, true, true, true, true] },
                    { module: 'Leads',       perms: [true, true, false, false, true] },
                    { module: 'Accounts',    perms: [true, true, false, false, true] },
                    { module: 'Contacts',    perms: [true, true, false, true, true] },
                    { module: 'Deals',       perms: [true, true, false, false, false] },
                    { module: 'Products',    perms: [true, true, true, false, true] },
                    { module: 'Projects',    perms: [true, true, true, true, true] },
                    { module: 'Support',     perms: [true, false, true, true, false] },
                    { module: 'Reports',     perms: [true, true, false, false, false] },
                    { module: 'Settings',    perms: [true, false, false, false, false] },
                  ].map((row, i) => (
                    <tr key={row.module} style={{ borderBottom: i < 9 ? '1px solid #F4F5F9' : 'none' }}>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: '#374557', fontWeight: 500 }}>{row.module}</td>
                      {row.perms.map((allowed, j) => (
                        <td key={j} style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {allowed ? <CheckCircle2 size={14} style={{color:'#2BC155'}}/> : <span style={{color:'#D5D5D5'}}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'General' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 20 }}>General Settings</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: 'Company Name', value: 'Aspiration Cleantech Ventures', desc: 'Displayed on invoices and reports' },
                { label: 'Trading Name', value: 'ASPCV', desc: 'Short name used in the CRM' },
                { label: 'Company Email', value: 'admin@aspcv.co.uk', desc: 'Primary contact email' },
                { label: 'Company Phone', value: '+44 113 000 1234', desc: 'Main office number' },
                { label: 'HQ Address', value: 'Leeds, LS1 1BA, United Kingdom', desc: 'Registered address' },
                { label: 'Currency', value: '__currency__', desc: 'Default currency for deals and invoices' },
                { label: 'Timezone', value: 'Europe/London (GMT+1)', desc: 'Used for scheduling and reports' },
                { label: 'Date Format', value: 'DD MMM YYYY', desc: 'e.g. 20 May 2026' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 16, borderBottom: '1px solid #F4F5F9' }}>
                  <div style={{ width: 180, flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{item.label}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 2 }}>{item.desc}</p>
                  </div>
                  {item.value === '__currency__' ? (
                    <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                      {(['INR', 'USD'] as const).map(c => (
                        <button
                          key={c}
                          onClick={() => setCurrency(c)}
                          style={{
                            padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: `1px solid ${currency === c ? '#5D78FF' : '#F0F1F5'}`,
                            background: currency === c ? '#E8EDFF' : '#fff',
                            color: currency === c ? '#5D78FF' : '#374557',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {c === 'INR' ? '₹ INR (Indian Rupee)' : '$ USD (US Dollar)'}
                        </button>
                      ))}
                      <p style={{ fontSize: 11, color: '#B1B1BE', alignSelf: 'center', marginLeft: 4 }}>
                        1 USD = ₹83.50
                      </p>
                    </div>
                  ) : (
                    <input defaultValue={item.value} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none' }} />
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={handleSaveGeneral} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Save Changes</button>
                {savedMsg && <span style={{ fontSize: 12, color: '#2BC155', fontWeight: 600 }}>✓ Saved</span>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Notifications' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 4 }}>Notification Preferences</p>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 20 }}>Control what alerts you receive</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {notifications.map((item, i) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #F4F5F9' }}>
                  <p style={{ fontSize: 12, color: '#374557' }}>{item.label}</p>
                  <div onClick={() => toggleNotif(i)} style={{ width: 36, height: 20, borderRadius: 10, background: item.on ? '#5D78FF' : '#F4F5F9', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: 2, left: item.on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>Invite User</p>
              <button onClick={() => { setShowModal(false); setErrors({}) }} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Full Name *" error={errors.name}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" style={inp(!!errors.name)} />
              </Field>
              <Field label="Email *" error={errors.email}>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@aspcv.co.uk" style={inp(!!errors.email)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Role">
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as User['role'] })} style={inp(false)}>
                    {roles.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as User['status'] })} style={inp(false)}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => { setShowModal(false); setErrors({}) }} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
  return {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`,
    fontSize: 12, color: '#374557', outline: 'none', background: '#fff',
  }
}
