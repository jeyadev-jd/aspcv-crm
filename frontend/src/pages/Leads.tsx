import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, UserCheck,
  Trash2, Edit2, Loader2, Globe, MapPin,
  SlidersHorizontal, ChevronDown,
} from 'lucide-react'
import { useCrmData } from '@/lib/crmDataContext'
import { api } from '@/lib/api'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useChangeLeadStatus } from '@/hooks/useLeads'
import DesignationInput from '@/components/shared/DesignationInput'
import IndustryInput from '@/components/shared/IndustryInput'
import { useUsers } from '@/hooks/useUsers'
import LeadDetailPanel from '@/components/shared/LeadDetailPanel'
import type React from 'react'

const productOptions = [
  'Air Source Heat Pump 8kW', 'Water Source Heat Pump 12kW', 'Swimming Pool Heat Pump 200L',
  'Heat Pump Dryer Unit', 'Solar Tunnel Dryer 10kWp', 'Sludge Dryer Unit 10kWh',
  'Process Chiller 7kW', 'Waste Heat Recovery Unit', 'ORC Power Module 50kW', 'BLDC Ceiling Fan + LED Kit',
]

const INDIA_STATES = [
  'None', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry', 'Jammu & Kashmir', 'Ladakh',
]

const STATUS_LABEL: Record<string, string> = {
  Enquiry: 'Enquiry', ProspectiveLead: 'Prospective Lead', ProjectHold: 'Project Hold',
  Hibernated: 'Hibernated', OrderWon: 'Order Won', OrderLost: 'Order Lost',
}
const STATUS_TO_API: Record<string, string> = {
  'Enquiry': 'Enquiry', 'Prospective Lead': 'ProspectiveLead', 'Project Hold': 'ProjectHold',
  'Hibernated': 'Hibernated', 'Order Won': 'OrderWon', 'Order Lost': 'OrderLost',
}
const statusStyle: Record<string, { bg: string; color: string }> = {
  Enquiry: { bg: '#E8EDFF', color: '#5D78FF' }, ProspectiveLead: { bg: '#FFF5EE', color: '#FF9B52' },
  ProjectHold: { bg: '#F3EEFF', color: '#8B5CF6' }, Hibernated: { bg: '#F4F5F9', color: '#8C8C8C' },
  OrderWon: { bg: '#E7FAF0', color: '#2BC155' }, OrderLost: { bg: '#FFEEEE', color: '#FF5353' },
}
type UIStatus = 'Enquiry' | 'Prospective Lead' | 'Project Hold' | 'Hibernated' | 'Order Won' | 'Order Lost'
const UI_STATUSES: UIStatus[] = ['Enquiry', 'Prospective Lead', 'Project Hold', 'Hibernated', 'Order Won', 'Order Lost']

interface ContactRow { id?: string; name: string; designation: string; email: string; phone: string; whatsapp: string; isPrimary: boolean }
const blankContact = (): ContactRow => ({ name: '', designation: '', email: '', phone: '', whatsapp: '', isPrimary: false })

const blankForm = {
  title: '', companyId: '', region: 'North', commercialType: 'Capex',
  status: 'Enquiry', estimatedValue: '', closeDate: '',
  notes: '', monthlyRemarks: '',
  leadDate: new Date().toISOString().slice(0, 10),
  // company location fields
  customerType: 'Indian' as 'Indian' | 'International',
  companyRegion: 'North', state: 'None', city: '', area: '', country: '',
  // company ref fields
  companyNickname: '', companyStateCode: '', companyAreaCode: '', companyCityCode: '',
  companyIndustry: '',
}
interface SourceRow { source: string; sourceName: string }
const blankSource = (): SourceRow => ({ source: 'Direct', sourceName: '' })

const PAGE_SIZE = 6

export default function Leads() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { accounts } = useCrmData()

  const { data: leads = [], isLoading } = useLeads()
  const { data: allUsers = [] } = useUsers()
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const changeStatus = useChangeLeadStatus()

  const [filters, setFilters] = useState<{ status: string[]; source: string[]; region: string[]; commercialType: string[]; salesPerson: string[]; clientType: string[]; stage: string[]; state: string[]; closeDate: string[] }>({ status: [], source: [], region: [], commercialType: [], salesPerson: [], clientType: [], stage: [], state: [], closeDate: [] })
  const [valueMin, setValueMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [sort, setSort] = useState('')
  const [sources, setSources] = useState<SourceRow[]>([blankSource()])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [contacts, setContacts] = useState<ContactRow[]>([blankContact()])
  const [formOwners, setFormOwners] = useState<{ id: string; name: string }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [detailLead, setDetailLead] = useState<typeof leads[0] | null>(null)
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [companyName, setCompanyName] = useState('')
  const companyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (companyRef.current && !companyRef.current.contains(e.target as Node)) setCompanySuggestions([]) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleCompanyChange(val: string) {
    setCompanyName(val)
    if (val.trim()) setCompanySuggestions(accounts.map(a => a.name).filter(a => a.toLowerCase().includes(val.toLowerCase())))
    else setCompanySuggestions([])
  }

  // Filters
  const filtered = leads.filter(l => {
    if (filters.status.length && !filters.status.includes(STATUS_LABEL[l.status])) return false
    if (filters.source.length && !l.sources?.some(s => filters.source.includes(s.source)) && !filters.source.includes(l.source ?? '')) return false
    if (filters.region.length && !filters.region.includes(l.region ?? '')) return false
    if (filters.commercialType.length && !filters.commercialType.includes(l.commercialType ?? '')) return false
    if (filters.salesPerson.length && !l.owners?.some(o => filters.salesPerson.includes(o.user?.name ?? ''))) return false
    if (filters.clientType.length) {
      const ct = l.company?.customerType
      const match = filters.clientType.includes('India') ? (ct === 'Indian' || ct === 'India') : filters.clientType.includes(ct ?? '')
      if (!match) return false
    }
    if (filters.stage.length && !filters.stage.includes(l.stage)) return false
    if (filters.state.length && !filters.state.includes(l.company?.state ?? '')) return false
    const minN = valueMin.trim() !== '' ? Number(valueMin) : null
    const maxN = valueMax.trim() !== '' ? Number(valueMax) : null
    if (minN !== null && !isNaN(minN) && (l.estimatedValue ?? 0) < minN) return false
    if (maxN !== null && !isNaN(maxN) && (l.estimatedValue ?? 0) > maxN) return false
    if (filters.closeDate.length) {
      const now = new Date(); now.setHours(0,0,0,0)
      const cd = l.closeDate ? new Date(l.closeDate) : null
      const match = filters.closeDate.some(p => {
        if (p === 'Overdue') return cd ? cd < now : false
        if (p === 'This Month') return cd ? cd.getFullYear() === now.getFullYear() && cd.getMonth() === now.getMonth() : false
        if (p === 'Next Month') { const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1); return cd ? cd.getFullYear() === nm.getFullYear() && cd.getMonth() === nm.getMonth() : false }
        if (p === 'This Quarter') { const q = Math.floor(now.getMonth() / 3); return cd ? Math.floor(cd.getMonth() / 3) === q && cd.getFullYear() === now.getFullYear() : false }
        if (p === 'No Close Date') return !cd
        return false
      })
      if (!match) return false
    }
    return true
  }).sort((a, b) => {
    if (sort === 'value_asc') return (a.estimatedValue ?? 0) - (b.estimatedValue ?? 0)
    if (sort === 'value_desc') return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0)
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (sort === 'close_near') return (a.closeDate ?? '9999').localeCompare(b.closeDate ?? '9999')
    if (sort === 'close_far') return (b.closeDate ?? '').localeCompare(a.closeDate ?? '')
    return 0
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pipeline = leads.filter(l => l.status !== 'OrderLost' && l.status !== 'Hibernated').reduce((s, l) => s + (l.estimatedValue ?? 0), 0)
  const counts = Object.fromEntries(UI_STATUSES.map(s => [s, leads.filter(l => STATUS_LABEL[l.status] === s).length])) as Record<UIStatus, number>
  const salesPersonNames = Array.from(new Set(leads.flatMap(l => l.owners?.map(o => o.user?.name).filter(Boolean) ?? []))) as string[]
  const activeFilterCount = Object.values(filters).reduce((n, arr) => n + arr.length, 0) + (sort ? 1 : 0) + (valueMin ? 1 : 0) + (valueMax ? 1 : 0)

  function openCreate() {
    setEditId(null); setForm(blankForm); setCompanyName(''); setContacts([blankContact()]); setSources([blankSource()]); setFormOwners([]); setErrors({}); setShowModal(true)
  }

  function openEdit(lead: typeof leads[0]) {
    setEditId(lead.id)
    setCompanyName(lead.company?.name ?? '')
    setForm({
      title: lead.title, companyId: lead.companyId,
      region: lead.region, commercialType: lead.commercialType,
      status: STATUS_LABEL[lead.status] ?? lead.status,
      estimatedValue: lead.estimatedValue ? String(lead.estimatedValue) : '',
      closeDate: lead.closeDate ? lead.closeDate.slice(0, 10) : '',
      notes: lead.notes ?? '',
      monthlyRemarks: lead.monthlyRemarks ?? '',
      leadDate: lead.leadDate ? lead.leadDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      customerType: 'Indian', companyRegion: 'North', state: 'None', city: '', area: '', country: '',
      companyNickname: lead.company?.nickname ?? '',
      companyStateCode: lead.company?.stateCode ?? '',
      companyAreaCode: lead.company?.areaCode ?? '',
      companyCityCode: lead.company?.cityCode ?? '',
      companyIndustry: '',
    })
    setContacts(lead.contacts?.length
      ? lead.contacts.map(c => ({ id: c.id, name: c.name, designation: c.designation ?? '', email: c.email ?? '', phone: c.phone ?? '', whatsapp: c.whatsapp ?? '', isPrimary: c.isPrimary }))
      : [blankContact()]
    )
    setSources(lead.sources?.length
      ? lead.sources.map(s => ({ source: s.source, sourceName: s.sourceName ?? '' }))
      : [blankSource()]
    )
    setFormOwners(lead.owners?.map(o => ({ id: o.userId, name: o.user?.name ?? '' })) ?? [])
    setErrors({}); setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditId(null); setForm(blankForm); setContacts([blankContact()]); setSources([blankSource()]); setFormOwners([]); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Title required'
    if (!companyName.trim()) e.company = 'Company required'
    if (contacts.some(c => !c.name.trim())) e.contacts = 'All contact rows must have a name'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const matchedAccount = accounts.find(a => a.name.toLowerCase() === companyName.toLowerCase())
    const validSources = sources.filter(s => s.source.trim())
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      companyId: matchedAccount?.id ?? form.companyId,
      source: validSources[0]?.source || 'Direct',
      region: form.region, commercialType: form.commercialType,
      status: STATUS_TO_API[form.status] ?? form.status,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
      closeDate: form.closeDate || undefined,
      leadDate: form.leadDate || undefined,
      notes: form.notes || undefined,
      monthlyRemarks: form.monthlyRemarks || undefined,
      contacts: contacts.filter(c => c.name.trim()).map(c => ({
        ...(c.id ? { id: c.id } : {}),
        name: c.name.trim(), designation: c.designation || undefined,
        email: c.email || undefined, phone: c.phone || undefined,
        whatsapp: c.whatsapp || undefined, isPrimary: c.isPrimary,
      })),
      sources: validSources.map(s => ({ source: s.source, sourceName: s.sourceName || undefined })),
    }
    const companyId = matchedAccount?.id ?? form.companyId
    const companyUpdates: Record<string, string> = {}
    if (form.companyNickname) companyUpdates.nickname = form.companyNickname
    if (form.companyStateCode) companyUpdates.stateCode = form.companyStateCode
    if (form.companyAreaCode) companyUpdates.areaCode = form.companyAreaCode
    if (form.companyCityCode) companyUpdates.cityCode = form.companyCityCode
    if (form.companyIndustry) companyUpdates.industry = form.companyIndustry
    if (companyId && Object.keys(companyUpdates).length) {
      await api.patch(`/companies/${companyId}`, companyUpdates)
    }
    let savedId = editId
    if (editId) {
      await updateLead.mutateAsync({ id: editId, ...payload })
    } else {
      const created = await createLead.mutateAsync(payload) as { id: string }
      savedId = created.id
    }
    // Sync owners
    if (savedId) {
      const existing = leads.find(l => l.id === savedId)?.owners ?? []
      const existingIds = existing.map(o => o.userId)
      const newIds = formOwners.map(o => o.id)
      for (const id of existingIds.filter(id => !newIds.includes(id))) {
        await api.delete(`/leads/${savedId}/owners/${id}`)
      }
      for (const o of formOwners.filter(o => !existingIds.includes(o.id))) {
        await api.post(`/leads/${savedId}/owners`, { userId: o.id, role: 'primary' })
      }
    }
    closeModal()
  }

  async function handleDelete(id: string) {
    await deleteLead.mutateAsync(id)
    setMenuOpen(null); setDeleteConfirm(null); setPage(1)
  }

  function toggleFilter(key: keyof typeof filters, val: string) {
    setFilters(prev => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }
    })
    setPage(1)
  }
  function clearFilterKey(key: keyof typeof filters) { setFilters(prev => ({ ...prev, [key]: [] })); setPage(1) }
  function clearAll() { setFilters({ status: [], source: [], region: [], commercialType: [], salesPerson: [], clientType: [], stage: [], state: [], closeDate: [] }); setSort(''); setValueMin(''); setValueMax(''); setPage(1) }

  const st = (status: string) => statusStyle[status] ?? statusStyle.Enquiry

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <Loader2 size={24} style={{ color: '#5D78FF', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setMenuOpen(null)} />}

      {/* Left panel */}
      {!isMobile && (
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky' as const, top: 0, alignSelf: 'flex-start' }}>
          {/* Overview — clickable */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Lead Overview</p>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 14 }}>Click to filter</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { label: 'Total Leads',      value: leads.length,               color: '#5D78FF', f: 'All' },
                { label: 'Enquiry',          value: counts['Enquiry'],          color: '#5D78FF', f: 'Enquiry' },
                { label: 'Prospective Lead', value: counts['Prospective Lead'], color: '#FF9B52', f: 'Prospective Lead' },
                { label: 'Project Hold',     value: counts['Project Hold'],     color: '#8B5CF6', f: 'Project Hold' },
                { label: 'Hibernated',       value: counts['Hibernated'],       color: '#8C8C8C', f: 'Hibernated' },
                { label: 'Order Won',        value: counts['Order Won'],        color: '#2BC155', f: 'Order Won' },
                { label: 'Order Lost',       value: counts['Order Lost'],       color: '#FF5353', f: 'Order Lost' },
              ]).map(s => {
                const active = s.f === 'All' ? filters.status.length === 0 : filters.status.includes(s.f)
                return (
                <div key={s.label} onClick={() => s.f === 'All' ? clearFilterKey('status') : toggleFilter('status', s.f)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderRadius: 6, padding: '4px 6px', background: active ? '#F0F4FF' : 'transparent', transition: 'background 0.1s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    <p style={{ fontSize: 11, color: active ? '#5D78FF' : '#374557', fontWeight: active ? 600 : 400 }}>{s.label}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: active ? '#5D78FF' : '#374557' }}>{s.value}</p>
                </div>
              )})}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>Pipeline Value</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#374557' }}>{symbol}{(pipeline / 1000).toFixed(0)}k</p>
            <p style={{ fontSize: 10, color: '#2BC155', marginTop: 2 }}>Qualified + Active leads</p>
          </div>

          {/* Source breakdown */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 10 }}>Source Breakdown</p>
            {['Direct', 'Channel Partner', 'WLB Partner', 'Business Partner'].map(src => {
              const n = leads.filter(l => l.source === src).length
              const pct = leads.length ? Math.round((n / leads.length) * 100) : 0
              return (
                <div key={src} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ fontSize: 10, color: '#374557' }}>{src}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>{pct}%</p>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: '#5D78FF' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ marginBottom: 14 }} onClick={e => { if (!(e.target as HTMLElement).closest('[data-filter-dropdown]')) setOpenFilter(null) }}>
          {/* Row 1: status pills + New Lead */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => { clearFilterKey('status'); setPage(1) }}
                style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `2px solid ${filters.status.length === 0 ? '#5D78FF' : '#E8EAED'}`, cursor: 'pointer', background: filters.status.length === 0 ? '#5D78FF' : '#fff', color: filters.status.length === 0 ? '#fff' : '#6B7280', transition: 'all 0.15s' }}>
                All <span style={{ fontSize: 10, opacity: 0.7 }}>({leads.length})</span>
              </button>
              {UI_STATUSES.map(s => {
                const active = filters.status.includes(s)
                const st = statusStyle[STATUS_TO_API[s]] ?? { bg: '#F4F5F9', color: '#8C8C8C' }
                return (
                  <button key={s} onClick={() => toggleFilter('status', s)}
                    style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `2px solid ${active ? st.color : '#E8EAED'}`, cursor: 'pointer', background: active ? st.bg : '#fff', color: active ? st.color : '#6B7280', transition: 'all 0.15s' }}>
                    {s} <span style={{ fontSize: 10, opacity: 0.7 }}>({counts[s] ?? 0})</span>
                  </button>
                )
              })}
            </div>
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Plus size={14} /> New Lead
            </button>
          </div>

          {/* Row 2: filter dropdowns + sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: '#F4F5F9', fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
              <SlidersHorizontal size={12} />
              {activeFilterCount > 0 && <span style={{ background: '#5D78FF', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>}
            </div>
            {([
              { key: 'source' as const, label: 'Source', opts: ['Direct', 'Channel Partner', 'WLB Partner', 'Business Partner'] },
              { key: 'region' as const, label: 'Region', opts: ['North', 'West', 'South', 'East'] },
              { key: 'commercialType' as const, label: 'Type', opts: ['Capex', 'Opex', 'Deferred', 'Esco', 'Rental'] },
              { key: 'salesPerson' as const, label: 'Sales Person', opts: salesPersonNames },
              { key: 'clientType' as const, label: 'Client Type', opts: ['India', 'International'] },
              { key: 'stage' as const, label: 'Stage', opts: ['Lead', 'QualifiedLead', 'Deal', 'Project', 'Installation', 'Support'] },
              { key: 'state' as const, label: 'State', opts: INDIA_STATES.filter(s => s !== 'None') },
            ]).map(({ key, label, opts }) => {
              const sel = filters[key]
              const active = sel.length > 0
              const isOpen = openFilter === key
              return (
                <div key={key} data-filter-dropdown style={{ position: 'relative' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenFilter(isOpen ? null : key) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: active ? 600 : 400, border: `1px solid ${active ? '#5D78FF' : '#E8EAED'}`, background: active ? '#EEF2FF' : '#fff', color: active ? '#5D78FF' : '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {active ? `${label}: ${sel.length > 1 ? `${sel.length} selected` : sel[0]}` : label}
                    {active && <span onClick={e => { e.stopPropagation(); clearFilterKey(key) }} style={{ marginLeft: 2, display: 'flex', alignItems: 'center', color: '#5D78FF' }}><X size={9} /></span>}
                    {!active && <ChevronDown size={10} style={{ marginLeft: 2, color: '#9CA3AF' }} />}
                  </button>
                  {isOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', border: '1px solid #E8EAED', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px 0', minWidth: 200, maxHeight: 320, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F4F5F9', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, flexShrink: 0 }}>{label}</div>
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                      {opts.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3AF' }}>No options</div>}
                      {opts.map(opt => {
                        const checked = sel.includes(opt)
                        const optCount = leads.filter(l => {
                          if (key === 'source') return l.sources?.some(s => s.source === opt) || l.source === opt
                          if (key === 'region') return l.region === opt
                          if (key === 'commercialType') return l.commercialType === opt
                          if (key === 'salesPerson') return l.owners?.some(o => o.user?.name === opt)
                          if (key === 'clientType') return opt === 'India' ? (l.company?.customerType === 'India' || l.company?.customerType === 'Indian') : l.company?.customerType === opt
                          if (key === 'stage') return l.stage === opt
                          if (key === 'state') return l.company?.state === opt
                          return false
                        }).length
                        return (
                          <label key={opt} onClick={() => toggleFilter(key, opt)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', background: checked ? '#F5F7FF' : 'transparent', fontSize: 12, color: checked ? '#374557' : '#6B7280', fontWeight: checked ? 600 : 400 }}>
                            <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${checked ? '#5D78FF' : '#D1D5DB'}`, background: checked ? '#5D78FF' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.1s' }}>
                              {checked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 900 }}>✓</span>}
                            </span>
                            <span style={{ flex: 1 }}>{key === 'stage' ? ({ QualifiedLead: 'Qualified Lead', Lead: 'Lead', Deal: 'Deal', Project: 'Project', Installation: 'Installation', Support: 'Support' }[opt] ?? opt) : opt}</span>
                            <span style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 400 }}>{optCount}</span>
                          </label>
                        )
                      })}
                      </div>{/* end scroll */}
                      {sel.length > 0 && (
                        <div style={{ padding: '6px 14px', borderTop: '1px solid #F4F5F9', flexShrink: 0 }}>
                          <button onClick={() => clearFilterKey(key)} style={{ fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Value Range */}
            <div data-filter-dropdown style={{ position: 'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'value' ? null : 'value') }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: (valueMin || valueMax) ? 600 : 400, border: `1px solid ${(valueMin || valueMax) ? '#5D78FF' : '#E8EAED'}`, background: (valueMin || valueMax) ? '#EEF2FF' : '#fff', color: (valueMin || valueMax) ? '#5D78FF' : '#6B7280', cursor: 'pointer' }}>
                {valueMin || valueMax ? `₹${valueMin ? Number(valueMin).toLocaleString() : '0'} – ₹${valueMax ? Number(valueMax).toLocaleString() : '∞'}` : 'Value'}
                {(valueMin || valueMax) ? <span onClick={e => { e.stopPropagation(); setValueMin(''); setValueMax(''); setPage(1) }} style={{ display: 'flex', alignItems: 'center' }}><X size={9} /></span> : <ChevronDown size={10} style={{ color: '#9CA3AF' }} />}
              </button>
              {openFilter === 'value' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', border: '1px solid #E8EAED', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px 14px', minWidth: 220 }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 10 }}>Estimated Value (₹)</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" placeholder="Min" value={valueMin} onChange={e => { setValueMin(e.target.value); setPage(1) }}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #E8EAED', fontSize: 12, outline: 'none', color: '#374557' }} />
                    <span style={{ color: '#9CA3AF', fontSize: 11 }}>to</span>
                    <input type="number" placeholder="Max" value={valueMax} onChange={e => { setValueMax(e.target.value); setPage(1) }}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #E8EAED', fontSize: 12, outline: 'none', color: '#374557' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>{valueMin && valueMax ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : ''}</span>
                    {(valueMin || valueMax) && <button onClick={() => { setValueMin(''); setValueMax(''); setPage(1) }} style={{ fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Clear</button>}
                  </div>
                </div>
              )}
            </div>

            {/* Close Date */}
            <div data-filter-dropdown style={{ position: 'relative' }}>
              {(() => {
                const sel = filters.closeDate; const active = sel.length > 0
                return <>
                  <button onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'closeDate' ? null : 'closeDate') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: active ? 600 : 400, border: `1px solid ${active ? '#5D78FF' : '#E8EAED'}`, background: active ? '#EEF2FF' : '#fff', color: active ? '#5D78FF' : '#6B7280', cursor: 'pointer' }}>
                    {active ? (sel.length > 1 ? `Close: ${sel.length} selected` : `Close: ${sel[0]}`) : 'Close Date'}
                    {active ? <span onClick={e => { e.stopPropagation(); clearFilterKey('closeDate') }} style={{ display: 'flex', alignItems: 'center' }}><X size={9} /></span> : <ChevronDown size={10} style={{ color: '#9CA3AF' }} />}
                  </button>
                  {openFilter === 'closeDate' && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', border: '1px solid #E8EAED', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px 0', minWidth: 190 }}>
                      <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F4F5F9', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Close Date</div>
                      {['Overdue', 'This Month', 'Next Month', 'This Quarter', 'No Close Date'].map(opt => {
                        const checked = sel.includes(opt)
                        return (
                          <label key={opt} onClick={() => toggleFilter('closeDate', opt)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', background: checked ? '#F5F7FF' : 'transparent', fontSize: 12, color: checked ? '#374557' : '#6B7280', fontWeight: checked ? 600 : 400 }}>
                            <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${checked ? '#5D78FF' : '#D1D5DB'}`, background: checked ? '#5D78FF' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {checked && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>}
                            </span>
                            {opt}
                          </label>
                        )
                      })}
                      {sel.length > 0 && <div style={{ padding: '6px 14px', borderTop: '1px solid #F4F5F9', marginTop: 2 }}><button onClick={() => clearFilterKey('closeDate')} style={{ fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button></div>}
                    </div>
                  )}
                </>
              })()}
            </div>

            {/* Sort */}
            <div data-filter-dropdown style={{ position: 'relative', marginLeft: 'auto' }}>
              <button
                onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'sort' ? null : 'sort') }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: sort ? 600 : 400, border: `1px solid ${sort ? '#5D78FF' : '#E8EAED'}`, background: sort ? '#EEF2FF' : '#fff', color: sort ? '#5D78FF' : '#6B7280', cursor: 'pointer' }}>
                {sort ? (sort === 'value_asc' ? 'Value ↑' : sort === 'value_desc' ? 'Value ↓' : sort === 'newest' ? 'Newest' : sort === 'oldest' ? 'Oldest' : sort === 'close_near' ? 'Close ↑' : 'Close ↓') : 'Sort'}
                {sort ? <span onClick={e => { e.stopPropagation(); setSort('') }} style={{ display: 'flex', alignItems: 'center' }}><X size={9} /></span> : <ChevronDown size={10} style={{ color: '#9CA3AF' }} />}
              </button>
              {openFilter === 'sort' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200, background: '#fff', border: '1px solid #E8EAED', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px 0', minWidth: 180 }}>
                  <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F4F5F9', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Sort by</div>
                  {[
                    { v: 'newest', label: 'Newest First' }, { v: 'oldest', label: 'Oldest First' },
                    { v: 'value_desc', label: 'Value: High → Low' }, { v: 'value_asc', label: 'Value: Low → High' },
                    { v: 'close_near', label: 'Close Date: Nearest' }, { v: 'close_far', label: 'Close Date: Farthest' },
                  ].map(({ v, label }) => (
                    <button key={v} onClick={() => { setSort(v); setPage(1); setOpenFilter(null) }}
                      style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 14px', fontSize: 12, background: sort === v ? '#F5F7FF' : 'transparent', color: sort === v ? '#5D78FF' : '#374557', fontWeight: sort === v ? 600 : 400, border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8 }}>
                      {sort === v && <span style={{ color: '#5D78FF', fontSize: 9, fontWeight: 900 }}>✓</span>}
                      {sort !== v && <span style={{ width: 11 }} />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              {(Object.entries(filters) as [keyof typeof filters, string[]][]).map(([k, vals]) =>
                vals.map(v => {
                  const stageLabels: Record<string, string> = { QualifiedLead: 'Qualified Lead', Lead: 'Lead', Deal: 'Deal', Project: 'Project', Installation: 'Installation', Support: 'Support' }
                  const keyLabel: Record<string, string> = { source: 'Source', region: 'Region', commercialType: 'Type', salesPerson: 'Person', clientType: 'Client', status: 'Status', stage: 'Stage', state: 'State', closeDate: 'Close' }
                  const displayVal = k === 'stage' ? (stageLabels[v] ?? v) : v
                  return (
                    <span key={`${k}-${v}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 20, background: '#EEF2FF', color: '#5D78FF', fontSize: 10, fontWeight: 600, border: '1px solid #C7D2FE' }}>
                      <span style={{ color: '#818CF8', fontWeight: 400, marginRight: 1 }}>{keyLabel[k]}:</span>{displayVal}
                      <button onClick={() => toggleFilter(k, v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}><X size={9} /></button>
                    </span>
                  )
                })
              )}
              {valueMin && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 20, background: '#EEF2FF', color: '#5D78FF', fontSize: 10, fontWeight: 600, border: '1px solid #C7D2FE' }}><span style={{ color: '#818CF8', fontWeight: 400, marginRight: 1 }}>Min:</span>₹{Number(valueMin).toLocaleString()}<button onClick={() => { setValueMin(''); setPage(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}><X size={9} /></button></span>}
              {valueMax && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 20, background: '#EEF2FF', color: '#5D78FF', fontSize: 10, fontWeight: 600, border: '1px solid #C7D2FE' }}><span style={{ color: '#818CF8', fontWeight: 400, marginRight: 1 }}>Max:</span>₹{Number(valueMax).toLocaleString()}<button onClick={() => { setValueMax(''); setPage(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}><X size={9} /></button></span>}
              <button onClick={clearAll} style={{ fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all</button>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</p>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F5F9', background: '#FAFBFF' }}>
                {['Lead / Contacts', 'Company', 'Source', 'Region', 'Status', 'Est. Value', 'Owner', ''].map(h => (
                  <th key={h} style={{ textAlign: h === 'Est. Value' ? 'center' : 'left', padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((lead, i) => {
                const s = st(lead.status)
                const primary = lead.contacts?.find(c => c.isPrimary) ?? lead.contacts?.[0]
                return (
                  <tr key={lead.id} onClick={() => setDetailLead(lead)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserCheck size={14} style={{ color: s.color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{lead.title}</p>
                          {primary && <p style={{ fontSize: 10, color: '#B1B1BE' }}>{primary.name}{primary.designation ? ` · ${primary.designation}` : ''}</p>}
                          {(lead.contacts?.length ?? 0) > 1 && <p style={{ fontSize: 10, color: '#5D78FF' }}>+{(lead.contacts?.length ?? 0) - 1} more</p>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#374557' }}>{lead.company?.name ?? '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: '#F4F5F9', color: '#374557', fontWeight: 500 }}>{lead.sources?.[0]?.source ?? lead.source}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#374557' }}>{lead.region}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>
                        {STATUS_LABEL[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {lead.estimatedValue
                        ? <span style={{ fontSize: 12, fontWeight: 700, color: '#2BC155' }}>{symbol}{lead.estimatedValue.toLocaleString()}</span>
                        : <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#374557' }}>
                      {lead.owners?.map(o => o.user?.name).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ x: r.right, y: r.bottom + 4 }); setMenuOpen(menuOpen === lead.id ? null : lead.id) }}
                          style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen === lead.id && (
                          <div style={{ ...dropdownStyle, position: 'fixed', top: menuPos.y, right: 'auto', left: menuPos.x - 170, zIndex: 200 }}>
                            <button onClick={() => { openEdit(lead); setMenuOpen(null) }} style={menuItemStyle}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                            <button onClick={() => { setDeleteConfirm(lead.id); setMenuOpen(null) }} style={{ ...menuItemStyle, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <div style={{ padding: '4px 14px 2px', fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Change Status</div>
                            {([
                              { api: 'Enquiry', label: 'Enquiry', color: '#5D78FF' },
                              { api: 'ProspectiveLead', label: 'Prospective Lead', color: '#FF9B52' },
                              { api: 'ProjectHold', label: 'Project Hold', color: '#8B5CF6' },
                              { api: 'Hibernated', label: 'Hibernated', color: '#8C8C8C' },
                              { api: 'OrderWon', label: 'Order Won', color: '#2BC155' },
                              { api: 'OrderLost', label: 'Order Lost', color: '#FF5353' },
                            ]).filter(s => s.api !== lead.status).map(s => (
                              <button key={s.api} onClick={() => {
                                setMenuOpen(null)
                                changeStatus.mutate({ id: lead.id, status: s.api }, {
                                  onSuccess: (data: any) => { if (s.api === 'OrderWon' && data?.promotedDeal) navigate('/deals') },
                                })
                              }} style={{ ...menuItemStyle, color: s.color }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 8, flexShrink: 0, display: 'inline-block' }} />
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No leads found.</td></tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 20px', borderTop: '1px solid #F4F5F9', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...pagBtn, color: page === 1 ? '#D5D5D5' : '#374557', cursor: page === 1 ? 'default' : 'pointer' }}>
              <ChevronLeft size={13} /> Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(pg => (
              <button key={pg} onClick={() => setPage(pg)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...pagBtn, color: page === totalPages ? '#D5D5D5' : '#374557', cursor: page === totalPages ? 'default' : 'pointer' }}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail slide-in panel */}
      {detailLead && (
        <LeadDetailPanel
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onEdit={lead => { openEdit(lead); setDetailLead(null) }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Lead?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '12px' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 1100, height: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>{editId ? 'Edit Lead' : 'New Lead'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>

            {/* Body — 2 columns, no scroll */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* ── LEFT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Lead title */}
              <Field label="Lead Title *" error={errors.title}>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Heat Pump Installation — Acme Corp" style={inp(!!errors.title)} />
              </Field>

              {/* Company */}
              <Field label="Client Account (Company) *" error={errors.company}>
                <div ref={companyRef} style={{ position: 'relative' }}>
                  <input value={companyName} onChange={e => handleCompanyChange(e.target.value)} onFocus={() => companyName && handleCompanyChange(companyName)} placeholder="Company name" style={inp(!!errors.company)} />
                  {companySuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200, overflow: 'hidden' }}>
                      {companySuggestions.map(s => (
                        <div key={s} onMouseDown={() => { setCompanyName(s); setCompanySuggestions([]) }}
                          style={{ padding: '9px 14px', fontSize: 12, cursor: 'pointer', color: '#374557' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{s}</div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              {/* Industry */}
              <Field label="Industry Type">
                <IndustryInput value={form.companyIndustry} onChange={v => setForm(f => ({ ...f, companyIndustry: v }))} />
              </Field>

              {/* Client type */}
              <div>
                <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 6 }}>Client Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['Indian', 'International'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, customerType: t }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid', cursor: 'pointer', background: form.customerType === t ? (t === 'Indian' ? '#E7FAF0' : '#E8EDFF') : '#fff', color: form.customerType === t ? (t === 'Indian' ? '#2BC155' : '#5D78FF') : '#374557', borderColor: form.customerType === t ? (t === 'Indian' ? '#2BC155' : '#5D78FF') : '#E0E0E0' }}>
                      {t === 'Indian' ? <MapPin size={11} /> : <Globe size={11} />} {t === 'Indian' ? 'India' : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location fields */}
              {form.customerType === 'Indian' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Region">
                    <select value={form.companyRegion} onChange={e => setForm(f => ({ ...f, companyRegion: e.target.value }))} style={inp(false)}>
                      {['North', 'West', 'South', 'East'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="State">
                    <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} style={inp(false)}>
                      {INDIA_STATES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="City">
                    <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City name" style={inp(false)} />
                  </Field>
                  <Field label="Area">
                    <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Area / locality" style={inp(false)} />
                  </Field>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Country *">
                    <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. UAE, UK, USA" style={inp(false)} />
                  </Field>
                  <Field label="City">
                    <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City name" style={inp(false)} />
                  </Field>
                  <Field label="Area">
                    <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Area / district" style={inp(false)} />
                  </Field>
                </div>
              )}

              {/* Contacts section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>People / Contacts {errors.contacts && <span style={{ color: '#FF5353', fontWeight: 400 }}> — {errors.contacts}</span>}</label>
                  <button type="button" onClick={() => setContacts(c => [...c, blankContact()])}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 8, background: '#F0F4FF', color: '#5D78FF', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    <Plus size={11} /> Add person
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contacts.map((c, idx) => (
                    <div key={idx} style={{ background: '#F8F9FF', borderRadius: 8, padding: '8px 10px', border: '1px solid #E8EDFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>Person {idx + 1}</span>
                          <button type="button" onClick={() => setContacts(cs => cs.map((x, i) => i === idx ? { ...x, isPrimary: true } : { ...x, isPrimary: false }))}
                            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '1px solid', cursor: 'pointer', background: c.isPrimary ? '#E8EDFF' : '#fff', color: c.isPrimary ? '#5D78FF' : '#B1B1BE', borderColor: c.isPrimary ? '#5D78FF' : '#E0E0E0' }}>
                            Primary
                          </button>
                        </div>
                        {contacts.length > 1 && (
                          <button type="button" onClick={() => setContacts(cs => cs.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353' }}><X size={12} /></button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input value={c.name} onChange={e => setContacts(cs => cs.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} placeholder="Full name *" style={inp(false)} />
                        <DesignationInput value={c.designation} onChange={v => setContacts(cs => cs.map((x, i) => i === idx ? { ...x, designation: v } : x))} placeholder="Designation" />
                        <input value={c.email} onChange={e => setContacts(cs => cs.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))} placeholder="Email" style={inp(false)} />
                        <input value={c.phone} onChange={e => setContacts(cs => cs.map((x, i) => i === idx ? { ...x, phone: e.target.value } : x))} placeholder="Phone" style={inp(false)} />
                        <input value={c.whatsapp} onChange={e => setContacts(cs => cs.map((x, i) => i === idx ? { ...x, whatsapp: e.target.value } : x))} placeholder="WhatsApp (if diff)" style={inp(false)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div></div>{/* end left column inner + outer */}

            {/* ── RIGHT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderLeft: '1px solid #F4F5F9', paddingLeft: 20, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Sources section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>Sources</label>
                  <button type="button" onClick={() => setSources(s => [...s, blankSource()])}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 8, background: '#F0F4FF', color: '#5D78FF', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    <Plus size={11} /> Add Source
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sources.map((s, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <select value={s.source} onChange={e => setSources(ss => ss.map((x, i) => i === idx ? { ...x, source: e.target.value } : x))} style={inp(false)}>
                        {['Direct', 'Channel Partner', 'WLB Partner', 'Business Partner'].map(o => <option key={o}>{o}</option>)}
                      </select>
                      <input value={s.sourceName} onChange={e => setSources(ss => ss.map((x, i) => i === idx ? { ...x, sourceName: e.target.value } : x))} placeholder="Source name / referrer" style={inp(false)} />
                      {sources.length > 1 && (
                        <button type="button" onClick={() => setSources(ss => ss.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353' }}><X size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lead details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp(false)}>
                    {UI_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Lead Date">
                  <input type="date" value={form.leadDate} onChange={e => setForm({ ...form, leadDate: e.target.value })} style={inp(false)} />
                </Field>
                <Field label="Region (Lead)">
                  <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={inp(false)}>
                    {['North', 'West', 'South', 'East'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Commercial Type">
                  <select value={form.commercialType} onChange={e => setForm({ ...form, commercialType: e.target.value })} style={inp(false)}>
                    {['Capex', 'Opex', 'Deferred', 'Esco', 'Rental'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label={`Est. Value (${symbol})`}>
                  <input value={form.estimatedValue} onChange={e => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0" type="number" min="0" style={inp(false)} />
                </Field>
                <Field label="Est. Close Date">
                  <input type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} style={inp(false)} />
                </Field>
              </div>

              {/* Sales Persons */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>Sales Person(s)</label>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: formOwners.length ? 8 : 0 }}>
                  {formOwners.map(o => (
                    <span key={o.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#EEF2FF', color: '#5D78FF', fontSize: 11, fontWeight: 600, border: '1px solid #C7D2FE' }}>
                      {o.name}
                      <button type="button" onClick={() => setFormOwners(prev => prev.filter(x => x.id !== o.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8', padding: 0, display: 'flex', alignItems: 'center' }}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <select
                  value=""
                  onChange={e => {
                    const user = allUsers.find(u => u.id === e.target.value)
                    if (user && !formOwners.some(o => o.id === user.id)) {
                      setFormOwners(prev => [...prev, { id: user.id, name: user.name }])
                    }
                  }}
                  style={{ ...inp(false), color: formOwners.length ? '#6B7280' : '#9CA3AF' }}>
                  <option value="">+ Add sales person…</option>
                  {allUsers.filter(u => !formOwners.some(o => o.id === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <Field label="Description">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Add description..." rows={1} style={{ ...inp(false), resize: 'none' }} />
              </Field>
              <Field label="Month-on-Month Remarks">
                <textarea value={form.monthlyRemarks} onChange={e => setForm({ ...form, monthlyRemarks: e.target.value })} placeholder="Monthly progress remarks..." rows={1} style={{ ...inp(false), resize: 'none' }} />
              </Field>

              {/* Company Ref Number fields */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Account Ref Fields <span style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 400 }}>(used in lead reference number)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={form.companyNickname} onChange={e => setForm({ ...form, companyNickname: e.target.value })} placeholder="Account nickname (e.g. HMML)" style={inp(false)} />
                  <input value={form.companyStateCode} onChange={e => setForm({ ...form, companyStateCode: e.target.value })} placeholder="State code override (e.g. TN)" style={inp(false)} />
                  <input value={form.companyAreaCode} onChange={e => setForm({ ...form, companyAreaCode: e.target.value })} placeholder="Area code (e.g. SR)" style={inp(false)} />
                  <input value={form.companyCityCode} onChange={e => setForm({ ...form, companyCityCode: e.target.value })} placeholder="City code (e.g. CH)" style={inp(false)} />
                </div>
              </div>
            </div></div>{/* end right column inner + outer */}

            </div>{/* end 2-col grid body */}

            {/* Footer */}
            <div style={{ display: 'flex', gap: 12, padding: '12px 24px', borderTop: '1px solid #F0F1F5', flexShrink: 0 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #E8EAED', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleSave()} style={{ flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{editId ? 'Save Changes' : 'Create Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', borderRadius: 8,
  border: '1px solid #F0F1F5', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 170, overflow: 'hidden', padding: '4px 0',
}
const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
  padding: '8px 14px', fontSize: 12, color: '#374557', background: 'none', border: 'none', cursor: 'pointer',
}
const pagBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
  padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', background: '#fff',
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
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
