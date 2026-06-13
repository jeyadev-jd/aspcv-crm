import { useState, useRef, useEffect } from 'react'
import {
  MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, Trash2, Edit2,
  Search, Phone, Mail, MessageCircle, Building2, SlidersHorizontal,
  ChevronDown, User, Loader2,
} from 'lucide-react'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData } from '@/lib/crmDataContext'
import { useApiContacts, useCreateContact, useUpdateContact, useDeleteContact, type ApiContact } from '@/hooks/useContacts'
import { useContactEvents, useCreateContactEvent, useDeleteContactEvent, type ContactEvent } from '@/hooks/useContactEvents'
import DesignationInput from '@/components/shared/DesignationInput'

const avatarColors = ['#5D78FF', '#FF9B52', '#2BC155', '#FF5353', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899']
function avatarColor(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return avatarColors[Math.abs(h) % avatarColors.length] }
function initials(name: string) { const p = name.trim().split(' '); return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '') }

const blankForm = { name: '', designation: '', email: '', phone: '', whatsapp: '', notes: '', companyId: '' }
const PAGE_SIZE = 10

export default function Contacts() {
  const isMobile = useIsMobile()
  const { accounts } = useCrmData()
  const { data: contacts = [], isLoading } = useApiContacts()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<{ account: string[]; designation: string[]; status: string[] }>({ account: [], designation: [], status: [] })
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [detailContact, setDetailContact] = useState<ApiContact | null>(null)

  // close filter dropdowns on outside click
  const filterRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handle(e: MouseEvent) { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const designations = Array.from(new Set(contacts.map(c => c.designation).filter(Boolean))) as string[]
  const companyNames = Array.from(new Set(contacts.map(c => c.company?.name).filter(Boolean))) as string[]

  const filtered = contacts.filter(c => {
    if (search) {
      const q = search.toLowerCase()
      if (![c.name, c.email, c.phone, c.designation, c.company?.name].some(v => v?.toLowerCase().includes(q))) return false
    }
    if (filters.account.length && !filters.account.includes(c.company?.name ?? '')) return false
    if (filters.designation.length && !filters.designation.includes(c.designation ?? '')) return false
    if (filters.status.length) {
      const s = c.isActive ? 'Active' : 'Inactive'
      if (!filters.status.includes(s)) return false
    }
    return true
  }).sort((a, b) => {
    if (sort === 'name_asc') return a.name.localeCompare(b.name)
    if (sort === 'name_desc') return b.name.localeCompare(a.name)
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (sort === 'company') return (a.company?.name ?? '').localeCompare(b.company?.name ?? '')
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeFilterCount = Object.values(filters).reduce((n, a) => n + a.length, 0) + (sort ? 1 : 0)

  function toggleFilter(key: keyof typeof filters, val: string) {
    setFilters(prev => { const a = prev[key]; return { ...prev, [key]: a.includes(val) ? a.filter(v => v !== val) : [...a, val] } })
    setPage(1)
  }
  function clearAll() { setFilters({ account: [], designation: [], status: [] }); setSort(''); setSearch(''); setPage(1) }

  function openCreate() { setEditId(null); setForm(blankForm); setErrors({}); setShowModal(true) }
  function openEdit(c: ApiContact) {
    setEditId(c.id)
    setForm({ name: c.name, designation: c.designation ?? '', email: c.email ?? '', phone: c.phone ?? '', whatsapp: c.whatsapp ?? '', notes: c.notes ?? '', companyId: c.companyId })
    setErrors({}); setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditId(null); setForm(blankForm); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    return e
  }

  async function handleSave() {
    const e = validate(); if (Object.keys(e).length) { setErrors(e); return }
    const payload = { name: form.name.trim(), designation: form.designation || undefined, email: form.email || undefined, phone: form.phone || undefined, whatsapp: form.whatsapp || undefined, notes: form.notes || undefined, companyId: form.companyId || undefined }
    if (editId) await updateContact.mutateAsync({ id: editId, ...payload })
    else await createContact.mutateAsync(payload)
    closeModal()
  }

  async function handleDelete(id: string) {
    await deleteContact.mutateAsync(id)
    setMenuOpen(null); setDeleteConfirm(null)
    if (detailContact?.id === id) setDetailContact(null)
  }

  const byCompany = companyNames.map(name => ({ name, count: contacts.filter(c => c.company?.name === name).length })).sort((a, b) => b.count - a.count).slice(0, 6)

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}><Loader2 size={24} style={{ color: '#5D78FF', animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div style={{ display: 'flex', gap: 20, minHeight: 'calc(100vh - 120px)', flex: 1, position: 'relative' }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setMenuOpen(null)} />}

      {/* ── Sidebar ── */}
      {!isMobile && (
        <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Overview</p>
            {[
              { label: 'Total', value: contacts.length, color: '#5D78FF' },
              { label: 'Active', value: contacts.filter(c => c.isActive).length, color: '#2BC155' },
              { label: 'Inactive', value: contacts.filter(c => !c.isActive).length, color: '#8C8C8C' },
              { label: 'With Email', value: contacts.filter(c => c.email).length, color: '#FF9B52' },
              { label: 'With WhatsApp', value: contacts.filter(c => c.whatsapp).length, color: '#25D366' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: '#6B7280' }}>{s.label}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>By Company</p>
            {byCompany.length === 0 && <p style={{ fontSize: 11, color: '#B1B1BE' }}>No data</p>}
            {byCompany.map(({ name, count }) => (
              <div key={name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <p style={{ fontSize: 11, color: '#374557', fontWeight: 500 }}>{name}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#5D78FF' }}>{count}</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: '#F4F5F9' }}>
                  <div style={{ height: 3, borderRadius: 2, background: '#5D78FF', width: `${Math.round((count / contacts.length) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374557', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Designations</p>
            {designations.slice(0, 6).map(d => (
              <div key={d} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: '#6B7280' }}>{d}</p>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: '#F0F4FF', color: '#5D78FF' }}>{contacts.filter(c => c.designation === d).length}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ marginBottom: 14 }} ref={filterRef}>
          {/* Search + New */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search name, email, phone, company…"
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid #E8EAED', fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
              />
              {search && <button onClick={() => { setSearch(''); setPage(1) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}><X size={12} /></button>}
            </div>
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Plus size={14} /> New Contact
            </button>
          </div>

          {/* Filter row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: '#F4F5F9', fontSize: 11, color: '#6B7280' }}>
              <SlidersHorizontal size={12} />
              {activeFilterCount > 0 && <span style={{ background: '#5D78FF', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>}
            </div>

            {([
              { key: 'status' as const, label: 'Status', opts: ['Active', 'Inactive'] },
              { key: 'account' as const, label: 'Company', opts: companyNames },
              { key: 'designation' as const, label: 'Designation', opts: designations },
            ]).map(({ key, label, opts }) => {
              const sel = filters[key]; const active = sel.length > 0; const isOpen = openFilter === key
              return (
                <div key={key} style={{ position: 'relative' }}>
                  <button onClick={() => setOpenFilter(isOpen ? null : key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: active ? 600 : 400, border: `1px solid ${active ? '#5D78FF' : '#E8EAED'}`, background: active ? '#EEF2FF' : '#fff', color: active ? '#5D78FF' : '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {active ? `${label}: ${sel.length > 1 ? `${sel.length} selected` : sel[0]}` : label}
                    {active ? <span onClick={e => { e.stopPropagation(); setFilters(p => ({ ...p, [key]: [] })) }} style={{ display: 'flex', alignItems: 'center' }}><X size={9} /></span> : <ChevronDown size={10} style={{ color: '#9CA3AF' }} />}
                  </button>
                  {isOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', border: '1px solid #E8EAED', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 190, maxHeight: 280, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F4F5F9', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, flexShrink: 0 }}>{label}</div>
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {opts.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3AF' }}>No options</div>}
                        {opts.map(opt => {
                          const checked = sel.includes(opt)
                          return (
                            <label key={opt} onClick={() => toggleFilter(key, opt)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', background: checked ? '#F5F7FF' : 'transparent', fontSize: 12, color: checked ? '#374557' : '#6B7280', fontWeight: checked ? 600 : 400 }}>
                              <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${checked ? '#5D78FF' : '#D1D5DB'}`, background: checked ? '#5D78FF' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {checked && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>}
                              </span>
                              <span style={{ flex: 1 }}>{opt}</span>
                              <span style={{ fontSize: 10, color: '#B1B1BE' }}>{contacts.filter(c => key === 'account' ? c.company?.name === opt : key === 'designation' ? c.designation === opt : (opt === 'Active' ? c.isActive : !c.isActive)).length}</span>
                            </label>
                          )
                        })}
                      </div>
                      {sel.length > 0 && <div style={{ padding: '6px 14px', borderTop: '1px solid #F4F5F9', flexShrink: 0 }}><button onClick={() => setFilters(p => ({ ...p, [key]: [] }))} style={{ fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button></div>}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Sort */}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: sort ? 600 : 400, border: `1px solid ${sort ? '#5D78FF' : '#E8EAED'}`, background: sort ? '#EEF2FF' : '#fff', color: sort ? '#5D78FF' : '#6B7280', cursor: 'pointer' }}>
                {sort === 'name_asc' ? 'Name A→Z' : sort === 'name_desc' ? 'Name Z→A' : sort === 'newest' ? 'Newest' : sort === 'company' ? 'Company' : 'Sort'}
                {sort ? <span onClick={e => { e.stopPropagation(); setSort('') }} style={{ display: 'flex' }}><X size={9} /></span> : <ChevronDown size={10} style={{ color: '#9CA3AF' }} />}
              </button>
              {openFilter === 'sort' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200, background: '#fff', border: '1px solid #E8EAED', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px 0', minWidth: 170 }}>
                  {[{ v: 'name_asc', l: 'Name A → Z' }, { v: 'name_desc', l: 'Name Z → A' }, { v: 'newest', l: 'Newest First' }, { v: 'company', l: 'By Company' }].map(({ v, l }) => (
                    <button key={v} onClick={() => { setSort(v); setOpenFilter(null) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 14px', fontSize: 12, background: sort === v ? '#F5F7FF' : 'transparent', color: sort === v ? '#5D78FF' : '#374557', fontWeight: sort === v ? 600 : 400, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      {sort === v ? <span style={{ fontSize: 9, fontWeight: 900 }}>✓</span> : <span style={{ width: 11 }} />}{l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active chips */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              {(Object.entries(filters) as [keyof typeof filters, string[]][]).map(([k, vals]) =>
                vals.map(v => (
                  <span key={`${k}-${v}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 20, background: '#EEF2FF', color: '#5D78FF', fontSize: 10, fontWeight: 600, border: '1px solid #C7D2FE' }}>
                    <span style={{ color: '#818CF8', fontWeight: 400, marginRight: 1 }}>{k === 'account' ? 'Co' : k === 'designation' ? 'Title' : 'Status'}:</span>{v}
                    <button onClick={() => toggleFilter(k, v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}><X size={9} /></button>
                  </span>
                ))
              )}
              <button onClick={clearAll} style={{ fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all</button>
            </div>
          )}

          {/* Result count */}
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F5F9', background: '#FAFBFF' }}>
                {['Contact', 'Designation', 'Company', 'Email', 'Phone', 'WhatsApp', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((c, i) => {
                const color = avatarColor(c.name)
                return (
                  <tr key={c.id} onClick={() => setDetailContact(c)}
                    style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials(c.name)}</span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.name}</p>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#6B7280' }}>{c.designation || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {c.company?.name ? <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: '#F4F5F9', color: '#374557', fontWeight: 500 }}>{c.company.name}</span> : <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#374557' }}>{c.email || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#374557' }}>{c.phone || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#25D366' }}>{c.whatsapp || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: c.isActive ? '#E7FAF0' : '#F4F5F9', color: c.isActive ? '#2BC155' : '#8C8C8C' }}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ x: r.right, y: r.bottom + 4 }); setMenuOpen(menuOpen === c.id ? null : c.id) }}
                        style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>
                        <MoreHorizontal size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>
                  {search || activeFilterCount > 0 ? 'No contacts match filters.' : 'No contacts yet.'}
                </td></tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 20px', borderTop: '1px solid #F4F5F9', marginTop: 'auto', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}>
                <ChevronLeft size={13} /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setPage(pg)}
                  style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}>
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Detail Panel ── */}
      {detailContact && (
        <div style={{ width: 300, flexShrink: 0, background: '#fff', borderRadius: 14, border: '1px solid #F0F1F5', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarColor(detailContact.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{initials(detailContact.name)}</span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{detailContact.name}</p>
                {detailContact.designation && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{detailContact.designation}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(detailContact)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}><Edit2 size={11} /> Edit</button>
              <button onClick={() => setDetailContact(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}><X size={16} /></button>
            </div>
          </div>

          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: detailContact.isActive ? '#E7FAF0' : '#F4F5F9', color: detailContact.isActive ? '#2BC155' : '#8C8C8C', alignSelf: 'flex-start' }}>
            {detailContact.isActive ? 'Active' : 'Inactive'}
          </span>

          {detailContact.company && (
            <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={14} style={{ color: '#5D78FF', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5 }}>Company</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{detailContact.company.name}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {detailContact.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={13} style={{ color: '#FF9B52' }} />
                </div>
                <div>
                  <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</p>
                  <p style={{ fontSize: 11, color: '#374557', fontWeight: 500 }}>{detailContact.email}</p>
                </div>
              </div>
            )}
            {detailContact.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone size={13} style={{ color: '#5D78FF' }} />
                </div>
                <div>
                  <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</p>
                  <p style={{ fontSize: 11, color: '#374557', fontWeight: 500 }}>{detailContact.phone}</p>
                </div>
              </div>
            )}
            {detailContact.whatsapp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E7FAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageCircle size={13} style={{ color: '#25D366' }} />
                </div>
                <div>
                  <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5 }}>WhatsApp</p>
                  <p style={{ fontSize: 11, color: '#374557', fontWeight: 500 }}>{detailContact.whatsapp}</p>
                </div>
              </div>
            )}
          </div>

          {detailContact.notes && (
            <div>
              <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Notes</p>
              <p style={{ fontSize: 11, color: '#374557', lineHeight: 1.6, background: '#F8F9FF', borderRadius: 8, padding: '8px 10px' }}>{detailContact.notes}</p>
            </div>
          )}

          <ContactEventsSection contactId={detailContact.id} />

          <div style={{ borderTop: '1px solid #F4F5F9', paddingTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => updateContact.mutateAsync({ id: detailContact.id, isActive: !detailContact.isActive }).then(() => setDetailContact(c => c ? { ...c, isActive: !c.isActive } : c))}
              style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #E8EAED', background: '#fff', color: '#374557', cursor: 'pointer' }}>
              {detailContact.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={() => setDeleteConfirm(detailContact.id)}
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #FFD5D5', background: '#FFF5F5', color: '#FF5353', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Floating 3-dot menu */}
      {menuOpen && (() => {
        const c = contacts.find(x => x.id === menuOpen)
        if (!c) return null
        return (
          <div style={{ position: 'fixed', top: menuPos.y, left: menuPos.x - 160, zIndex: 200, background: '#fff', border: '1px solid #E8EAED', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 160 }}>
            <button onClick={() => { openEdit(c); setMenuOpen(null) }} style={mi}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
            <button onClick={() => { setDetailContact(c); setMenuOpen(null) }} style={mi}><User size={12} style={{ marginRight: 8 }} />View Detail</button>
            <button onClick={() => { updateContact.mutateAsync({ id: c.id, isActive: !c.isActive }); setMenuOpen(null) }} style={mi}>{c.isActive ? 'Deactivate' : 'Activate'}</button>
            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
            <button onClick={() => { setDeleteConfirm(c.id); setMenuOpen(null) }} style={{ ...mi, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
          </div>
        )
      })()}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Contact?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm!)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{editId ? 'Edit Contact' : 'New Contact'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Full Name *" error={errors.name}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" style={inp(!!errors.name)} />
              </Field>
              <Field label="Designation">
                <DesignationInput value={form.designation} onChange={v => setForm(f => ({ ...f, designation: v }))} placeholder="e.g. Director, Engineer" />
              </Field>
              <Field label="Company">
                <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} style={inp(false)}>
                  <option value="">Select company…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="Email" error={errors.email}>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" type="email" style={inp(!!errors.email)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Phone">
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" style={inp(false)} />
                </Field>
                <Field label="WhatsApp">
                  <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="+91 … (if diff)" style={inp(false)} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes…" rows={2} style={{ ...inp(false), resize: 'vertical' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '14px 24px', borderTop: '1px solid #F0F1F5' }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #E8EAED', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={createContact.isPending || updateContact.isPending} style={{ flex: 2, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {createContact.isPending || updateContact.isPending ? 'Saving…' : editId ? 'Save Changes' : 'Create Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const mi: React.CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }

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
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}

const EVENT_ICONS: Record<string, string> = { birthday: '🎂', anniversary: '🎉', custom: '📅' }

function ContactEventsSection({ contactId }: { contactId: string }) {
  const { data: events = [] } = useContactEvents(contactId)
  const createEvent = useCreateContactEvent(contactId)
  const deleteEvent = useDeleteContactEvent(contactId)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ type: 'birthday', title: 'Birthday', eventDate: '', recurring: true, notes: '' })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Events</p>
        <button onClick={() => setShowAdd(v => !v)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#5D78FF', cursor: 'pointer', fontWeight: 600 }}>+ Add</button>
      </div>

      {showAdd && (
        <div style={{ background: '#F8F9FF', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={form.type} onChange={e => { const t = e.target.value; setForm(p => ({ ...p, type: t, title: t === 'birthday' ? 'Birthday' : t === 'anniversary' ? 'Anniversary' : p.title })) }} style={{ border: '1px solid #E8E9F0', borderRadius: 6, padding: '5px 7px', fontSize: 11, background: '#fff', flex: 1 }}>
              <option value="birthday">Birthday</option>
              <option value="anniversary">Anniversary</option>
              <option value="custom">Custom</option>
            </select>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title" style={{ border: '1px solid #E8E9F0', borderRadius: 6, padding: '5px 7px', fontSize: 11, flex: 2 }} />
          </div>
          <input type="date" value={form.eventDate} onChange={e => setForm(p => ({ ...p, eventDate: e.target.value }))} style={{ border: '1px solid #E8E9F0', borderRadius: 6, padding: '5px 7px', fontSize: 11, background: '#fff' }} />
          <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.recurring} onChange={e => setForm(p => ({ ...p, recurring: e.target.checked }))} />
            Recurring annually
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { if (form.eventDate) { createEvent.mutate(form as any, { onSuccess: () => { setShowAdd(false); setForm({ type: 'birthday', title: 'Birthday', eventDate: '', recurring: true, notes: '' }) } }) } }}
              style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >Save</button>
            <button onClick={() => setShowAdd(false)} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {events.map(ev => (
        <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F8F9FF' }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 14 }}>{EVENT_ICONS[ev.type] ?? '📅'}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{ev.title}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                {new Date(ev.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                {ev.recurring && ' · yearly'}
              </div>
            </div>
          </div>
          <button onClick={() => deleteEvent.mutate(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 3 }}>×</button>
        </div>
      ))}
      {events.length === 0 && !showAdd && <p style={{ fontSize: 11, color: '#C4C4C4', margin: 0 }}>No events added</p>}
    </div>
  )
}
