import { useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currencyContext'
import { useAuthStore } from '@/lib/authStore'
import { useIsMobile } from '@/lib/useIsMobile'
import { useActiveCompanyProfile, useCreateCompanyProfile, useUpdateCompanyProfile } from '@/hooks/useCompanyProfile'
import {
  Settings as SettingsIcon, Building2, Bell, User, Shield,
  ExternalLink, CheckCircle, ChevronRight,
} from 'lucide-react'

const tabs = ['Company', 'Profile', 'Notifications', 'System'] as const
type Tab = typeof tabs[number]

const TAB_ICONS: Record<Tab, React.ElementType> = {
  Company:       Building2,
  Profile:       User,
  Notifications: Bell,
  System:        Shield,
}

const initNotifications = [
  { label: 'New lead assigned to me',       group: 'Sales',        on: true  },
  { label: 'Deal stage changed',            group: 'Sales',        on: true  },
  { label: 'Approval request needs review', group: 'Approvals',    on: true  },
  { label: 'My approval request reviewed',  group: 'Approvals',    on: true  },
  { label: 'Project milestone reached',     group: 'Projects',     on: true  },
  { label: 'Task due today',                group: 'Tasks',        on: true  },
  { label: 'Support ticket opened',         group: 'Support',      on: true  },
  { label: 'Support ticket high priority',  group: 'Support',      on: true  },
  { label: 'Invoice overdue',               group: 'Finance',      on: true  },
  { label: 'Salary slip generated',         group: 'Payroll',      on: true  },
  { label: 'Weekly pipeline summary email', group: 'Digest',       on: false },
  { label: 'Monthly revenue report email',  group: 'Digest',       on: false },
]

function FieldRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, paddingBottom: 18, borderBottom: '1px solid #f4f5f9', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 140, flexShrink: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', margin: 0 }}>{label}</p>
        {desc && <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 3 }}>{desc}</p>}
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: on ? '#5D78FF' : '#E5E7EB',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }} />
    </div>
  )
}

function inp(hasError = false): React.CSSProperties {
  return {
    width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box',
    border: `1px solid ${hasError ? '#EF4444' : '#E5E7EB'}`,
    fontSize: 12, color: '#374557', outline: 'none', background: '#fff',
  }
}

export default function Settings() {
  const navigate = useNavigate()
  const { currency, setCurrency } = useCurrency()
  const user = useAuthStore(s => s.user)
  const isMobile = useIsMobile()

  const [activeTab, setActiveTab] = useState<Tab>('Company')
  const [notifications, setNotifications] = useState(initNotifications)
  const [savedMsg, setSavedMsg] = useState('')

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})

  // ── Company profile (drives the invoice letterhead) ──
  const { data: companyProfile } = useActiveCompanyProfile()
  const createCompany = useCreateCompanyProfile()
  const updateCompany = useUpdateCompanyProfile()
  const [savingCompany, setSavingCompany] = useState(false)
  const blankCp = {
    companyName: '', legalName: '', registeredAddr: '', gstin: '', pan: '',
    udyam: '', state: '', stateCode: '', email: '', phone: '', website: '',
  }
  const [cpForm, setCpForm] = useState<typeof blankCp | null>(null)
  // Server value until the user edits, then the local draft takes over.
  const cp = cpForm ?? {
    companyName: companyProfile?.companyName ?? '',
    legalName: companyProfile?.legalName ?? '',
    registeredAddr: companyProfile?.registeredAddr ?? '',
    gstin: companyProfile?.gstin ?? '',
    pan: companyProfile?.pan ?? '',
    udyam: companyProfile?.udyam ?? '',
    state: companyProfile?.state ?? '',
    stateCode: companyProfile?.stateCode ?? '',
    email: companyProfile?.email ?? '',
    phone: companyProfile?.phone ?? '',
    website: companyProfile?.website ?? '',
  }
  const setCp = (fn: (c: typeof blankCp) => typeof blankCp) => setCpForm(fn(cp))

  function save(msg = 'Saved') {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  async function saveCompany() {
    const required: [keyof typeof blankCp, string][] = [
      ['companyName', 'Company Name'], ['legalName', 'Legal Name'],
      ['registeredAddr', 'Registered Address'], ['gstin', 'GSTIN'], ['pan', 'PAN'],
      ['state', 'State'], ['stateCode', 'State Code'], ['email', 'Company Email'], ['phone', 'Company Phone'],
    ]
    const missing = required.filter(([k]) => !cp[k].trim()).map(([, label]) => label)
    if (missing.length) { save(`Required: ${missing.join(', ')}`); return }

    setSavingCompany(true)
    try {
      if (companyProfile?.id) {
        await updateCompany.mutateAsync({ id: companyProfile.id, ...cp })
      } else {
        await createCompany.mutateAsync({ ...cp, country: 'India', isActive: true })
      }
      setCpForm(null)
      save('Company settings saved')
    } catch (err: any) {
      save(err?.response?.data?.error ?? 'Save failed')
    } finally {
      setSavingCompany(false)
    }
  }

  function saveProfile() {
    const e: Record<string, string> = {}
    if (!profile.name.trim()) e.name = 'Required'
    if (profile.newPassword && profile.newPassword.length < 8) e.newPassword = 'Min 8 characters'
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setProfileErrors(e)
    if (!Object.keys(e).length) save('Profile saved')
  }

  function toggleNotif(i: number) {
    setNotifications(prev => prev.map((n, idx) => idx === i ? { ...n, on: !n.on } : n))
  }

  // Group notifications by group label
  const notifGroups = [...new Set(notifications.map(n => n.group))]

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <SettingsIcon size={20} color="#5D78FF" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Settings</h1>
      </div>

      {/* Mobile: horizontal tab strip */}
      {isMobile && (
        <div style={{ display: 'flex', overflowX: 'auto', gap: 4, marginBottom: 16, paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
          {tabs.map(tab => {
            const Icon = TAB_ICONS[tab]
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                padding: '9px 14px', fontSize: 12, fontWeight: activeTab === tab ? 700 : 500,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                background: activeTab === tab ? '#5D78FF' : '#fff',
                color: activeTab === tab ? '#fff' : '#374557',
                border: `1px solid ${activeTab === tab ? '#5D78FF' : '#f0f1f5'}`,
                minHeight: 44,
              }}>
                <Icon size={14} />{tab}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Sidebar — desktop only */}
        {!isMobile && (
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
            {tabs.map(tab => {
              const Icon = TAB_ICONS[tab]
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '11px 14px', fontSize: 12, fontWeight: activeTab === tab ? 700 : 500,
                  border: 'none', borderBottom: '1px solid #f4f5f9', cursor: 'pointer',
                  background: activeTab === tab ? '#5D78FF' : 'transparent',
                  color: activeTab === tab ? '#fff' : '#374557',
                  transition: 'all 0.15s',
                }}>
                  <Icon size={14} />
                  {tab}
                </button>
              )
            })}
          </div>

          {/* Quick links */}
          <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, overflow: 'hidden' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#B1B1BE', padding: '10px 14px 6px', letterSpacing: 0.5 }}>QUICK LINKS</p>
            {[
              { label: 'User Management', to: '/users' },
              { label: 'Roles & Permissions', to: '/roles' },
              { label: 'Approval Requests', to: '/approvals' },
            ].map(l => (
              <button key={l.to} onClick={() => navigate(l.to)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '9px 14px', fontSize: 12, color: '#5D78FF',
                border: 'none', borderTop: '1px solid #f4f5f9', background: 'transparent', cursor: 'pointer', fontWeight: 500,
              }}>
                {l.label}
                <ExternalLink size={11} />
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── Company ── */}
          {activeTab === 'Company' && (
            <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, padding: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 4 }}>Company Information</p>
              <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 24 }}>Shown on invoices, reports, and system emails.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FieldRow label="Company Name" desc="Name in the invoice letterhead">
                  <input value={cp.companyName} onChange={e => setCp(c => ({ ...c, companyName: e.target.value }))} placeholder="Aspiration Cleantech Ventures Pvt.Ltd." style={inp()} />
                </FieldRow>
                <FieldRow label="Legal Name" desc="Registered name on the tax invoice">
                  <input value={cp.legalName} onChange={e => setCp(c => ({ ...c, legalName: e.target.value }))} placeholder="Aspiration Cleantech Ventures Private Limited" style={inp()} />
                </FieldRow>
                <FieldRow label="Company Email" desc="Primary contact email">
                  <input value={cp.email} onChange={e => setCp(c => ({ ...c, email: e.target.value }))} type="email" placeholder="info@aspcv.com" style={inp()} />
                </FieldRow>
                <FieldRow label="Company Phone" desc="Main office number">
                  <input value={cp.phone} onChange={e => setCp(c => ({ ...c, phone: e.target.value }))} placeholder="+91 96777 63170" style={inp()} />
                </FieldRow>
                <FieldRow label="Website" desc="Printed under the phone number">
                  <input value={cp.website} onChange={e => setCp(c => ({ ...c, website: e.target.value }))} placeholder="www.aspcv.com" style={inp()} />
                </FieldRow>
                <FieldRow label="Registered Address" desc="One line per row — appears exactly like this on the invoice">
                  <textarea value={cp.registeredAddr} onChange={e => setCp(c => ({ ...c, registeredAddr: e.target.value }))} rows={4}
                    placeholder={'2nd Floor, No.18/4,\nMunusamy Maistry Street,\nIssa Pallavaram,\nChennai – 600043, Tamil Nadu, India'}
                    style={{ ...inp(), resize: 'vertical', fontFamily: 'inherit' }} />
                </FieldRow>
                <FieldRow label="GSTIN" desc="Used on invoices">
                  <input value={cp.gstin} onChange={e => setCp(c => ({ ...c, gstin: e.target.value }))} placeholder="33AAPCA1794H1ZH" style={inp()} />
                </FieldRow>
                <FieldRow label="PAN">
                  <input value={cp.pan} onChange={e => setCp(c => ({ ...c, pan: e.target.value }))} placeholder="AAPCA1794H" style={inp()} />
                </FieldRow>
                <FieldRow label="UDYAM Number" desc="Optional MSME registration">
                  <input value={cp.udyam} onChange={e => setCp(c => ({ ...c, udyam: e.target.value }))} placeholder="UDYAM-TN-02-0087917" style={inp()} />
                </FieldRow>
                <FieldRow label="State / State Code" desc="Drives intra vs inter-state GST">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={cp.state} onChange={e => setCp(c => ({ ...c, state: e.target.value }))} placeholder="Tamil Nadu" style={inp()} />
                    <input value={cp.stateCode} onChange={e => setCp(c => ({ ...c, stateCode: e.target.value }))} placeholder="33" style={{ ...inp(), width: 90 }} />
                  </div>
                </FieldRow>
                <FieldRow label="Currency" desc="Default for deals & invoices">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['INR', 'USD'] as const).map(c => (
                      <button key={c} onClick={() => setCurrency(c)} style={{
                        padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: `1px solid ${currency === c ? '#5D78FF' : '#E5E7EB'}`,
                        background: currency === c ? '#EEF2FF' : '#fff',
                        color: currency === c ? '#5D78FF' : '#374557', cursor: 'pointer',
                      }}>
                        {c === 'INR' ? '₹ INR' : '$ USD'}
                      </button>
                    ))}
                  </div>
                </FieldRow>
                <FieldRow label="Timezone" desc="For scheduling & reports">
                  <select style={inp()}>
                    <option>Asia/Kolkata (IST, GMT+5:30)</option>
                    <option>Europe/London (GMT+1)</option>
                    <option>America/New_York (EST, GMT-5)</option>
                    <option>UTC</option>
                  </select>
                </FieldRow>
                <FieldRow label="Date Format" desc="Display format across CRM">
                  <select style={inp()}>
                    <option>DD MMM YYYY (e.g. 13 Jun 2026)</option>
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </FieldRow>
                <FieldRow label="Office Check-in Time" desc="Late threshold for attendance">
                  <input defaultValue="09:00" type="time" style={{ ...inp(), width: 120 }} />
                </FieldRow>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                  <button onClick={saveCompany} disabled={savingCompany} style={{ padding: '9px 22px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingCompany ? 0.6 : 1 }}>
                    {savingCompany ? 'Saving…' : 'Save Changes'}
                  </button>
                  {savedMsg && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22C55E', fontWeight: 600 }}>
                      <CheckCircle size={13} /> {savedMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Profile ── */}
          {activeTab === 'Profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Personal info */}
              <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, padding: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 4 }}>Personal Information</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 24 }}>Your name and email visible to others in the system.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <FieldRow label="Full Name">
                    <input
                      value={profile.name}
                      onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                      style={inp(!!profileErrors.name)}
                    />
                    {profileErrors.name && <p style={{ fontSize: 10, color: '#EF4444', marginTop: 3 }}>{profileErrors.name}</p>}
                  </FieldRow>
                  <FieldRow label="Role" desc="Assigned by admin">
                    <input value={user?.roleName ?? user?.role ?? '—'} disabled style={{ ...inp(), background: '#fafbff', color: '#aaa' }} />
                  </FieldRow>
                </div>
              </div>

              {/* Change password */}
              <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, padding: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 4 }}>Change Password</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 24 }}>Leave blank to keep current password.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <FieldRow label="Current Password">
                    <input type="password" value={profile.currentPassword} onChange={e => setProfile(p => ({ ...p, currentPassword: e.target.value }))} style={inp()} placeholder="Current password" />
                  </FieldRow>
                  <FieldRow label="New Password" desc="Min 8 characters">
                    <input type="password" value={profile.newPassword} onChange={e => setProfile(p => ({ ...p, newPassword: e.target.value }))} style={inp(!!profileErrors.newPassword)} placeholder="New password" />
                    {profileErrors.newPassword && <p style={{ fontSize: 10, color: '#EF4444', marginTop: 3 }}>{profileErrors.newPassword}</p>}
                  </FieldRow>
                  <FieldRow label="Confirm Password">
                    <input type="password" value={profile.confirmPassword} onChange={e => setProfile(p => ({ ...p, confirmPassword: e.target.value }))} style={inp(!!profileErrors.confirmPassword)} placeholder="Repeat new password" />
                    {profileErrors.confirmPassword && <p style={{ fontSize: 10, color: '#EF4444', marginTop: 3 }}>{profileErrors.confirmPassword}</p>}
                  </FieldRow>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
                  <button onClick={saveProfile} style={{ padding: '9px 22px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Save Profile
                  </button>
                  {savedMsg && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22C55E', fontWeight: 600 }}>
                      <CheckCircle size={13} /> {savedMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === 'Notifications' && (
            <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, padding: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 4 }}>Notification Preferences</p>
              <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 24 }}>Control which alerts you receive in the system.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {notifGroups.map(group => (
                  <div key={group}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.6, marginBottom: 10 }}>{group.toUpperCase()}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #f0f1f5', borderRadius: 8, overflow: 'hidden' }}>
                      {notifications
                        .filter(n => n.group === group)
                        .map((item, i) => {
                          const idx = notifications.findIndex(n => n === item)
                          return (
                            <div key={item.label} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderBottom: i < notifications.filter(n => n.group === group).length - 1 ? '1px solid #f4f5f9' : 'none',
                              background: '#fff',
                            }}>
                              <p style={{ fontSize: 12, color: '#374557', margin: 0 }}>{item.label}</p>
                              <Toggle on={item.on} onChange={() => toggleNotif(idx)} />
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => save('Preferences saved')} style={{ marginTop: 24, padding: '9px 22px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Save Preferences
              </button>
              {savedMsg && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22C55E', fontWeight: 600, marginLeft: 12 }}>
                  <CheckCircle size={13} /> {savedMsg}
                </span>
              )}
            </div>
          )}

          {/* ── System ── */}
          {activeTab === 'System' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* App info */}
              <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, padding: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 20 }}>System Information</p>
                {[
                  { label: 'Application', value: 'ASPCV CRM' },
                  { label: 'Organisation', value: 'Aspiration Cleantech Ventures' },
                  { label: 'Version', value: '1.0.0' },
                  { label: 'Build Date', value: '13 Jun 2026' },
                  { label: 'Backend', value: 'Node.js + Express + Prisma' },
                  { label: 'Database', value: 'PostgreSQL' },
                  { label: 'Frontend', value: 'React + Vite + TypeScript' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: 20, padding: '10px 0', borderBottom: '1px solid #f4f5f9' }}>
                    <span style={{ fontSize: 12, color: '#B1B1BE', width: 160, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 12, color: '#374557', fontWeight: 500 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Admin shortcuts */}
              <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, overflow: 'hidden' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', padding: '16px 20px 12px' }}>Admin Tools</p>
                {[
                  { label: 'Manage Users & Roles',     desc: 'Assign roles, grant permissions, deactivate users', to: '/users' },
                  { label: 'Role Definitions',          desc: 'Create or edit roles and their permission sets', to: '/roles' },
                  { label: 'Approval Requests',         desc: 'Review pending approvals for employees and changes', to: '/approvals' },
                ].map(item => (
                  <button key={item.to} onClick={() => navigate(item.to)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '14px 20px', border: 'none',
                    borderTop: '1px solid #f4f5f9', background: '#fff', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: '#B1B1BE', margin: '2px 0 0' }}>{item.desc}</p>
                    </div>
                    <ChevronRight size={14} color="#B1B1BE" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
