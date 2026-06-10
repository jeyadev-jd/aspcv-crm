import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, UserCheck,
  Trash2, Edit2, CheckCircle2, Phone, Loader2, Users, MessageSquare, Globe, MapPin,
  SlidersHorizontal, ChevronDown,
} from 'lucide-react'
import { useCrmData } from '@/lib/crmDataContext'
import { api } from '@/lib/api'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useChangeLeadStatus } from '@/hooks/useLeads'
import DesignationInput from '@/components/shared/DesignationInput'
import IndustryInput from '@/components/shared/IndustryInput'
import DiscussionPanel from '@/components/shared/DiscussionPanel'
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
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const changeStatus = useChangeLeadStatus()

  const [filters, setFilters] = useState({ status: '', source: '', region: '', commercialType: '', salesPerson: '', clientType: '' })
  const [sort, setSort] = useState('')
  const [sources, setSources] = useState<SourceRow[]>([blankSource()])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [contacts, setContacts] = useState<ContactRow[]>([blankContact()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
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
    if (filters.status && STATUS_LABEL[l.status] !== filters.status) return false
    if (filters.source && !l.sources?.some(s => s.source === filters.source) && l.source !== filters.source) return false
    if (filters.region && l.region !== filters.region) return false
    if (filters.commercialType && l.commercialType !== filters.commercialType) return false
    if (filters.salesPerson && !l.owners?.some(o => o.user?.name?.toLowerCase().includes(filters.salesPerson.toLowerCase()))) return false
    if (filters.clientType) {
      const ct = l.company?.customerType
      // 'India' maps to DB value 'Indian', 'International' stays same
      const match = filters.clientType === 'India' ? (ct === 'Indian' || ct === 'India') : ct === filters.clientType
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
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (sort ? 1 : 0)

  function openCreate() {
    setEditId(null); setForm(blankForm); setCompanyName(''); setContacts([blankContact()]); setSources([blankSource()]); setErrors({}); setShowModal(true)
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
    setErrors({}); setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditId(null); setForm(blankForm); setContacts([blankContact()]); setSources([blankSource()]); setErrors({}) }

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
    if (editId) await updateLead.mutateAsync({ id: editId, ...payload })
    else await createLead.mutateAsync(payload)
    closeModal()
  }

  async function handleDelete(id: string) {
    await deleteLead.mutateAsync(id)
    setMenuOpen(null); setDeleteConfirm(null); setPage(1)
  }

  function changeFilter(f: string) { setFilters(prev => ({ ...prev, status: f === 'All' ? '' : f })); setPage(1) }
  function setFilter(key: keyof typeof filters, val: string) { setFilters(prev => ({ ...prev, [key]: val })); setPage(1) }
  function clearFilter(key: keyof typeof filters) { setFilters(prev => ({ ...prev, [key]: '' })); setPage(1) }
  function clearAll() { setFilters({ status: '', source: '', region: '', commercialType: '', salesPerson: '', clientType: '' }); setSort(''); setPage(1) }

  const st = (status: string) => statusStyle[status] ?? statusStyle.Enquiry

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <Loader2 size={24} style={{ color: '#5D78FF', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

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
                const active = s.f === 'All' ? !filters.status : filters.status === s.f
                return (
                <div key={s.label} onClick={() => changeFilter(s.f)}
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
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: '#F4F5F9', fontSize: 11, color: '#8C8C8C', fontWeight: 500 }}>
                <SlidersHorizontal size={12} /> Filters {activeFilterCount > 0 && <span style={{ background: '#5D78FF', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>}
              </div>
              {([
                { key: 'source' as const, label: 'Source', opts: ['Direct', 'Channel Partner', 'WLB Partner', 'Business Partner'] },
                { key: 'region' as const, label: 'Region', opts: ['North', 'West', 'South', 'East'] },
                { key: 'commercialType' as const, label: 'Type', opts: ['Capex', 'Opex', 'Deferred', 'Esco', 'Rental'] },
                { key: 'salesPerson' as const, label: 'Sales Person', opts: salesPersonNames },
                { key: 'clientType' as const, label: 'Client Type', opts: ['India', 'International'] },
              ]).map(({ key, label, opts }) => (
                <div key={key} style={{ position: 'relative' }}>
                  <select
                    value={filters[key]}
                    onChange={e => setFilter(key, e.target.value)}
                    style={{ appearance: 'none', WebkitAppearance: 'none', padding: '6px 28px 6px 10px', borderRadius: 8, fontSize: 11, border: `1px solid ${filters[key] ? '#5D78FF' : '#F0F1F5'}`, background: filters[key] ? '#F0F4FF' : '#fff', color: filters[key] ? '#5D78FF' : '#8C8C8C', fontWeight: filters[key] ? 600 : 400, cursor: 'pointer', outline: 'none' }}>
                    <option value="">{label}</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: filters[key] ? '#5D78FF' : '#8C8C8C' }} />
                </div>
              ))}
              <div style={{ position: 'relative' }}>
                <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}
                  style={{ appearance: 'none', WebkitAppearance: 'none', padding: '6px 28px 6px 10px', borderRadius: 8, fontSize: 11, border: `1px solid ${sort ? '#5D78FF' : '#F0F1F5'}`, background: sort ? '#F0F4FF' : '#fff', color: sort ? '#5D78FF' : '#8C8C8C', fontWeight: sort ? 600 : 400, cursor: 'pointer', outline: 'none' }}>
                  <option value="">Sort by</option>
                  <option value="value_asc">Value: Low → High</option>
                  <option value="value_desc">Value: High → Low</option>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="close_near">Close Date: Nearest</option>
                  <option value="close_far">Close Date: Farthest</option>
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: sort ? '#5D78FF' : '#8C8C8C' }} />
              </div>
            </div>
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={14} /> New Lead
            </button>
          </div>
          {/* Status pill buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            {(['All', ...UI_STATUSES] as const).map(f => {
              const active = f === 'All' ? !filters.status : filters.status === f
              return (
                <button key={f} onClick={() => changeFilter(f)}
                  style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: active ? '#5D78FF' : '#F4F5F9', color: active ? '#fff' : '#8C8C8C', transition: 'all 0.15s' }}>
                  {f}
                </button>
              )
            })}
          </div>
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              {(Object.entries(filters) as [keyof typeof filters, string][]).filter(([, v]) => v).map(([k, v]) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: '#E8EDFF', color: '#5D78FF', fontSize: 10, fontWeight: 600 }}>
                  {v}
                  <button onClick={() => clearFilter(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5D78FF', padding: 0, display: 'flex', alignItems: 'center' }}><X size={10} /></button>
                </span>
              ))}
              {sort && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: '#FFF5EE', color: '#FF9B52', fontSize: 10, fontWeight: 600 }}>
                  {sort === 'value_asc' ? 'Value ↑' : sort === 'value_desc' ? 'Value ↓' : sort === 'newest' ? 'Newest' : sort === 'oldest' ? 'Oldest' : sort === 'close_near' ? 'Close ↑' : 'Close ↓'}
                  <button onClick={() => setSort('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF9B52', padding: 0, display: 'flex', alignItems: 'center' }}><X size={10} /></button>
                </span>
              )}
              <button onClick={clearAll} style={{ fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>Clear all</button>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                {['Lead / Contacts', 'Company', 'Source', 'Region', 'Status', 'Est. Value', 'Owner', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
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
                    <td style={{ padding: '12px 16px' }}>
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
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{lead.company?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#F4F5F9', color: '#374557' }}>{lead.source}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{lead.region}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>
                        {STATUS_LABEL[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#374557' }}>
                      {lead.estimatedValue ? `${symbol}${lead.estimatedValue.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>
                      {lead.owners?.map(o => o.user?.name).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === lead.id ? null : lead.id) }}
                          style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen === lead.id && (
                          <div style={dropdownStyle}>
                            <button onClick={() => { openEdit(lead); setMenuOpen(null) }} style={menuItemStyle}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                            <button onClick={() => { setDeleteConfirm(lead.id); setMenuOpen(null) }} style={{ ...menuItemStyle, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <button onClick={() => {
                              setMenuOpen(null)
                              changeStatus.mutate({ id: lead.id, status: 'OrderWon' }, {
                                onSuccess: (data) => { if (data?.promotedDeal) navigate('/deals') },
                              })
                            }} style={menuItemStyle}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Mark Order Won</button>
                            <button onClick={() => { setMenuOpen(null); changeStatus.mutate({ id: lead.id, status: 'ProspectiveLead' }) }} style={menuItemStyle}>
                              <Phone size={12} style={{ marginRight: 6 }} />Mark Prospective Lead
                            </button>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...pagBtn, color: page === 1 ? '#D5D5D5' : '#374557', cursor: page === 1 ? 'default' : 'pointer' }}>
              <ChevronLeft size={13} /> Prev
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setPage(pg)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
              ))}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...pagBtn, color: page === totalPages ? '#D5D5D5' : '#374557', cursor: page === totalPages ? 'default' : 'pointer' }}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail slide-in panel */}
      {detailLead && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={() => setDetailLead(null)} />
          <div style={{ width: 480, maxWidth: '100vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F0F1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{detailLead.title}</p>
                <p style={{ fontSize: 11, color: '#B1B1BE' }}>{detailLead.company?.name}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => { openEdit(detailLead); setDetailLead(null) }}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#374557', cursor: 'pointer' }}>
                  <Edit2 size={12} style={{ marginRight: 4 }} />Edit
                </button>
                <button onClick={() => setDetailLead(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={16} /></button>
              </div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Ref number */}
              {detailLead.refNumber && (
                <div style={{ background: '#F8F9FF', borderRadius: 8, padding: '8px 14px', border: '1px solid #E8EDFF' }}>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Reference Number</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#5D78FF', fontFamily: 'monospace', letterSpacing: 0.5 }}>{detailLead.refNumber}</p>
                </div>
              )}
              {/* Status + meta */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: st(detailLead.status).bg, color: st(detailLead.status).color }}>
                  {STATUS_LABEL[detailLead.status] ?? detailLead.status}
                </span>
                <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>{detailLead.region}</span>
                <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>{detailLead.commercialType}</span>
                {detailLead.leadDate && (
                  <span style={{ fontSize: 10, color: '#B1B1BE' }}>
                    Age: <strong style={{ color: '#374557' }}>{Math.floor((Date.now() - new Date(detailLead.leadDate).getTime()) / 86400000)} days</strong>
                  </span>
                )}
              </div>
              {/* Sources */}
              {(detailLead.sources?.length > 0 || detailLead.source) && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Sources</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {detailLead.sources?.length > 0
                      ? detailLead.sources.map(s => (
                        <span key={s.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>
                          {s.source}{s.sourceName ? ` · ${s.sourceName}` : ''}
                        </span>
                      ))
                      : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>{detailLead.source}</span>
                    }
                  </div>
                </div>
              )}
              {detailLead.estimatedValue && (
                <div>
                  <p style={{ fontSize: 10, color: '#B1B1BE' }}>Estimated Value</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#2BC155' }}>{symbol}{detailLead.estimatedValue.toLocaleString()}</p>
                </div>
              )}

              {/* Contacts */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} style={{ color: '#5D78FF' }} /> People ({detailLead.contacts?.length ?? 0})
                </p>
                {detailLead.contacts?.length === 0 && <p style={{ fontSize: 11, color: '#B1B1BE' }}>No contacts added.</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detailLead.contacts?.map(c => (
                    <div key={c.id} style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#5D78FF' }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{c.name} {c.isPrimary && <span style={{ fontSize: 9, background: '#E8EDFF', color: '#5D78FF', borderRadius: 6, padding: '1px 6px' }}>Primary</span>}</p>
                          {c.designation && <p style={{ fontSize: 10, color: '#B1B1BE' }}>{c.designation}</p>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginLeft: 36 }}>
                        {c.email && <p style={{ fontSize: 10, color: '#374557' }}>✉ {c.email}</p>}
                        {c.phone && <p style={{ fontSize: 10, color: '#374557' }}>📞 {c.phone}</p>}
                        {c.whatsapp && <p style={{ fontSize: 10, color: '#2BC155' }}>💬 {c.whatsapp}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Owners */}
              {detailLead.owners?.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Handling</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {detailLead.owners.map(o => (
                      <span key={o.userId} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>{o.user?.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Company address */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={13} style={{ color: '#5D78FF' }} /> Company Address
                </p>
                <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detailLead.company?.customerType && (
                    <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: (detailLead.company.customerType === 'Indian' || detailLead.company.customerType === 'India') ? '#E7FAF0' : '#E8EDFF', color: (detailLead.company.customerType === 'Indian' || detailLead.company.customerType === 'India') ? '#2BC155' : '#5D78FF', fontWeight: 600, alignSelf: 'flex-start' }}>{detailLead.company.customerType === 'Indian' ? 'India' : detailLead.company.customerType}</span>
                  )}
                  {[
                    detailLead.company?.region,
                    detailLead.company?.state !== 'None' ? detailLead.company?.state : null,
                    detailLead.company?.city,
                    detailLead.company?.area,
                  ].filter(Boolean).length > 0 ? (
                    <p style={{ fontSize: 11, color: '#374557' }}>
                      {[detailLead.company?.region, detailLead.company?.state !== 'None' ? detailLead.company?.state : null, detailLead.company?.city, detailLead.company?.area].filter(Boolean).join(', ')}
                    </p>
                  ) : <p style={{ fontSize: 11, color: '#B1B1BE' }}>No address on file</p>}
                </div>
              </div>

              {/* Description */}
              {detailLead.notes && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 4 }}>Description</p>
                  <p style={{ fontSize: 11, color: '#374557', lineHeight: 1.6 }}>{detailLead.notes}</p>
                </div>
              )}
              {/* Monthly remarks */}
              {detailLead.monthlyRemarks && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 4 }}>Month-on-Month Remarks</p>
                  <p style={{ fontSize: 11, color: '#374557', lineHeight: 1.6 }}>{detailLead.monthlyRemarks}</p>
                </div>
              )}

              {/* Discussions */}
              <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
                <DiscussionPanel
                  entityType="Lead"
                  entityId={detailLead.id}
                  contacts={detailLead.contacts?.map(c => ({ id: c.id, name: c.name, designation: c.designation }))}
                />
              </div>
            </div>
          </div>
        </div>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 580, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Lead' : 'New Lead'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
                  <Field label="City (manual)">
                    <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City name" style={inp(false)} />
                  </Field>
                  <Field label="Area (manual)">
                    <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Area / locality" style={inp(false)} />
                  </Field>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

              {/* Sources section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp(false)}>
                    {UI_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Lead Date">
                  <input type="date" value={form.leadDate} onChange={e => setForm({ ...form, leadDate: e.target.value })} style={inp(false)} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label={`Est. Value (${symbol})`}>
                  <input value={form.estimatedValue} onChange={e => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0" type="number" min="0" style={inp(false)} />
                </Field>
                <Field label="Est. Close Date">
                  <input type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} style={inp(false)} />
                </Field>
              </div>

              {/* Contacts section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>People / Contacts {errors.contacts && <span style={{ color: '#FF5353', fontWeight: 400 }}> — {errors.contacts}</span>}</label>
                  <button type="button" onClick={() => setContacts(c => [...c, blankContact()])}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 8, background: '#F0F4FF', color: '#5D78FF', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    <Plus size={11} /> Add person
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {contacts.map((c, idx) => (
                    <div key={idx} style={{ background: '#F8F9FF', borderRadius: 10, padding: 12, border: '1px solid #E8EDFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
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

              <Field label="Description">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Add description..." rows={2} style={{ ...inp(false), resize: 'vertical' }} />
              </Field>
              <Field label="Month-on-Month Remarks">
                <textarea value={form.monthlyRemarks} onChange={e => setForm({ ...form, monthlyRemarks: e.target.value })} placeholder="Monthly progress remarks..." rows={2} style={{ ...inp(false), resize: 'vertical' }} />
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
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleSave()} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{editId ? 'Save Changes' : 'Create Lead'}</button>
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
