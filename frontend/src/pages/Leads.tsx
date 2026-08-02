import Spinner from '@/components/shared/Spinner'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, UserCheck,
  Trash2, Edit2, Globe, MapPin,
  SlidersHorizontal, ChevronDown, AlertTriangle,
} from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'
import { useCrmData } from '@/lib/crmDataContext'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import ScopeItemsPanel, { saveDraftScopeItems, type ScopeItem } from '@/components/shared/ScopeItemsPanel'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useBulkDeleteLeads, useChangeLeadStatus } from '@/hooks/useLeads'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import BulkActionBar from '@/components/shared/BulkActionBar'
import BulkDeleteDialog from '@/components/shared/BulkDeleteDialog'
import DesignationInput from '@/components/shared/DesignationInput'
import IndustryInput from '@/components/shared/IndustryInput'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/lib/authStore'
import { useDepartments } from '@/hooks/useDepartments'
import { toast } from '@/lib/toast'
import { useRegions } from '@/hooks/useRegions'
import { useCommercialModels } from '@/hooks/useCommercialModels'
import { useLeadSourcesMaster } from '@/hooks/useLeadSourcesMaster'
import LeadDetailPanel from '@/components/shared/LeadDetailPanel'
import type React from 'react'
import { CsvImportExport } from '@/components/shared/CsvImportExport'
import type { CsvColDef } from '@/components/shared/CsvImportExport'
import type { Lead } from '@/hooks/useLeads'
import { handleVersionConflict } from '@/lib/conflict'

const LEAD_CSV_COLS: CsvColDef<Lead>[] = [
  { header: 'RefNumber',        accessor: r => r.refNumber ?? '' },
  { header: 'Title',            accessor: r => r.title },
  { header: 'Company',          accessor: r => r.company?.name ?? '' },
  { header: 'CustomerType',     accessor: r => r.company?.customerType ?? '' },
  { header: 'Status',           accessor: r => r.status },
  { header: 'Stage',            accessor: r => r.stage },
  { header: 'Region',           accessor: r => r.regionRef?.name ?? '' },
  { header: 'CommercialType',   accessor: r => r.commercialModel?.name ?? '' },
  { header: 'EstimatedValue',   accessor: r => r.estimatedValue != null ? String(r.estimatedValue) : '' },
  { header: 'CloseDate',        accessor: r => r.closeDate ?? '' },
  { header: 'LeadDate',         accessor: r => r.leadDate ?? '' },
  { header: 'State',            accessor: r => r.company?.state ?? '' },
  { header: 'City',             accessor: r => r.company?.city ?? '' },
  { header: 'Area',             accessor: r => r.company?.area ?? '' },
  { header: 'PrimaryContact',   accessor: r => r.contacts?.find(c => c.isPrimary)?.name ?? r.contacts?.[0]?.name ?? '' },
  { header: 'ContactEmail',     accessor: r => r.contacts?.find(c => c.isPrimary)?.email ?? r.contacts?.[0]?.email ?? '' },
  { header: 'ContactPhone',     accessor: r => r.contacts?.find(c => c.isPrimary)?.phone ?? r.contacts?.[0]?.phone ?? '' },
  { header: 'Source',           accessor: r => r.sources?.[0]?.source ?? r.leadSourceRef?.name ?? '' },
  { header: 'SourceName',       accessor: r => r.sources?.[0]?.sourceName ?? '' },
  { header: 'MonthlyRemarks',   accessor: r => r.monthlyRemarks ?? '' },
  { header: 'Notes',            accessor: r => r.notes ?? '' },
]
const LEAD_CSV_TEMPLATE = { Title: 'Heat Pump Project', Company: 'Acme Industries', CustomerType: 'India', Status: 'Enquiry', Stage: 'Lead', Region: 'South', CommercialType: 'Capex', EstimatedValue: '1500000', CloseDate: '2026-12-31', LeadDate: '2026-06-01', State: 'Tamil Nadu', City: 'Chennai', Area: 'Anna Nagar', PrimaryContact: 'Raj Kumar', ContactEmail: 'raj@acme.com', ContactPhone: '9876543210', Source: 'Direct', SourceName: '', MonthlyRemarks: '', Notes: '' }


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
  title: '', companyId: '', regionId: '', commercialModelId: '',
  status: 'Enquiry', estimatedValue: '', closeDate: '',
  notes: '', monthlyRemarks: '', departmentId: '',
  leadDate: new Date().toISOString().slice(0, 10),
  // Phase 1: capacity, temperature, ownership tiers
  capacityValue: '', capacityUnitId: '', tempRangeMin: '', tempRangeMax: '',
  primaryOwnerId: '', secondaryOwnerId: '', salesManagerId: '', businessHeadId: '',
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
  const can = useAuthStore(s => s.can)

  const { data: leads = [], isLoading, isError, refetch } = useLeads()
  const { data: allUsers = [] } = useUsers(can('hr_user', 'read_all'))
  const { data: departments = [] } = useDepartments()
  const { data: regions = [] } = useRegions()
  const { data: commercialModels = [] } = useCommercialModels()
  const { data: leadSourcesMaster = [] } = useLeadSourcesMaster()
  const createLead = useCreateLead()

  async function importLeads(rows: Record<string, string>[]) {
    let success = 0; const errors: string[] = []
    for (const row of rows) {
      if (!row.Title || !row.Company) { errors.push(`Row missing Title or Company`); continue }
      const co = accounts.find(a => a.name.toLowerCase() === row.Company.toLowerCase())
      if (!co) { errors.push(`"${row.Title}": company "${row.Company}" not found in accounts`); continue }
      // Strict master-data lookup — region/commercial type/source must already exist as
      // master rows (Admin creates them). No auto-create on import, to preserve integrity.
      const regionName = row.Region || 'North'
      const region = regions.find(r => r.name.toLowerCase() === regionName.toLowerCase())
      if (!region) { errors.push(`"${row.Title}": region "${regionName}" not found in master data — add it under Admin first`); continue }
      const cmName = row.CommercialType || 'Capex'
      const cm = commercialModels.find(m => m.name.toLowerCase() === cmName.toLowerCase())
      if (!cm) { errors.push(`"${row.Title}": commercial type "${cmName}" not found in master data — add it under Admin first`); continue }
      let leadSourceId: string | undefined
      if (row.Source) {
        const src = leadSourcesMaster.find(s => s.name.toLowerCase() === row.Source.toLowerCase())
        if (!src) { errors.push(`"${row.Title}": source "${row.Source}" not found in master data — add it under Admin first`); continue }
        leadSourceId = src.id
      }
      try {
        await createLead.mutateAsync({
          title: row.Title, companyId: co.id,
          status: row.Status || 'Enquiry', stage: row.Stage || 'Lead',
          regionId: region.id, commercialModelId: cm.id, leadSourceId,
          estimatedValue: row.EstimatedValue ? Number(row.EstimatedValue) : undefined,
          closeDate: row.CloseDate || undefined, leadDate: row.LeadDate || undefined,
          monthlyRemarks: row.MonthlyRemarks || undefined, notes: row.Notes || undefined,
          contacts: row.PrimaryContact ? [{ name: row.PrimaryContact, email: row.ContactEmail || undefined, phone: row.ContactPhone || undefined, designation: '', whatsapp: '', isPrimary: true }] : undefined,
          sources: row.Source ? [{ source: row.Source, sourceName: row.SourceName || undefined }] : undefined,
        } as never)
        success++
      } catch (e: unknown) { errors.push(`"${row.Title}": ${e instanceof Error ? e.message : 'Error'}`) }
    }
    return { total: rows.length, success, errors }
  }
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const bulkDeleteLeads = useBulkDeleteLeads()
  const changeStatus = useChangeLeadStatus()

  const [filters, setFilters] = useState<{ status: string[]; source: string[]; region: string[]; commercialType: string[]; salesPerson: string[]; clientType: string[]; stage: string[]; state: string[]; closeDate: string[] }>({ status: [], source: [], region: [], commercialType: [], salesPerson: [], clientType: [], stage: [], state: [], closeDate: [] })
  const [valueMin, setValueMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [sort, setSort] = useState('')
  const [sources, setSources] = useState<SourceRow[]>([blankSource()])
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  // Scope lines collected in the modal. On create there's no lead id yet, so the
  // rows are held here and written once the lead exists.
  const [scopeRows, setScopeRows] = useState<ScopeItem[]>([])
  // Whether the lead already had scope when the modal opened — decides if an
  // empty list on save means "delete them" or "nothing to do".
  const [hadScope, setHadScope] = useState(false)
  const [contacts, setContacts] = useState<ContactRow[]>([blankContact()])
  const [formOwners, setFormOwners] = useState<{ id: string; name: string }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0, openUp: false })
  // Status list + Edit/Delete makes this menu ~230px tall — a static
  // `top: bottom + 4` clips against rows near the bottom of a long table, so
  // flip to opening upward whenever there isn't room below.
  const MENU_EST_HEIGHT = 260
  function openRowMenu(id: string, r: DOMRect) {
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < MENU_EST_HEIGHT && r.top > spaceBelow
    setMenuPos({ x: r.right, y: openUp ? r.top - 4 : r.bottom + 4, openUp })
    setMenuOpen(prev => (prev === id ? null : id))
  }
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  // Status transition warning: { leadId, status } for OrderWon/OrderLost confirmations
  const [statusConfirm, setStatusConfirm] = useState<{ leadId: string; status: string; label: string } | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [statusDropOpen, setStatusDropOpen] = useState(false)
  const statusBtnRef = useRef<HTMLButtonElement>(null)
  const [detailLead, setDetailLead] = useState<typeof leads[0] | null>(null)
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [companyName, setCompanyName] = useState('')
  const companyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setCompanySuggestions([])
      const t = e.target as HTMLElement
      if (!t.closest('[data-status-drop]')) setStatusDropOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => { document.removeEventListener('mousedown', h) }
  }, [])

  function handleCompanyChange(val: string) {
    setCompanyName(val)
    if (val.trim()) setCompanySuggestions(accounts.map(a => a.name).filter(a => a.toLowerCase().includes(val.toLowerCase())))
    else setCompanySuggestions([])
  }

  // Filters
  const filtered = leads.filter(l => {
    if (filters.status.length && !filters.status.includes(STATUS_LABEL[l.status])) return false
    if (filters.source.length && !l.sources?.some(s => filters.source.includes(s.source)) && !filters.source.includes(l.leadSourceRef?.name ?? '')) return false
    if (filters.region.length && !filters.region.includes(l.regionRef?.name ?? '')) return false
    if (filters.commercialType.length && !filters.commercialType.includes(l.commercialModel?.name ?? '')) return false
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

  // Scoped to the visible page so "select all" never picks up hidden rows.
  const bulk = useBulkSelect(paginated.map(l => l.id))
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  async function handleBulkDelete() {
    try {
      const res = await bulkDeleteLeads.mutateAsync(bulk.selectedIds)
      if (res.blocked?.length) {
        toast.error(`${res.deleted} archived · ${res.blocked.length} need approval`)
      } else {
        toast.success(`Archived ${res.deleted} lead${res.deleted === 1 ? '' : 's'}`)
      }
      bulk.clear()
      setPage(1)
    } catch {
      toast.error('Bulk delete failed')
    }
    setShowBulkDelete(false)
  }
  const pipeline = leads.filter(l => l.status !== 'OrderLost' && l.status !== 'Hibernated').reduce((s, l) => s + (l.estimatedValue ?? 0), 0)
  const counts = Object.fromEntries(UI_STATUSES.map(s => [s, leads.filter(l => STATUS_LABEL[l.status] === s).length])) as Record<UIStatus, number>
  const salesPersonNames = Array.from(new Set(leads.flatMap(l => l.owners?.map(o => o.user?.name).filter(Boolean) ?? []))) as string[]
  const activeFilterCount = Object.values(filters).reduce((n, arr) => n + arr.length, 0) + (sort ? 1 : 0) + (valueMin ? 1 : 0) + (valueMax ? 1 : 0)

  function openCreate() {
    setEditId(null); setForm(blankForm); setCompanyName(''); setContacts([blankContact()]); setSources([blankSource()]); setFormOwners([]); setScopeRows([]); setHadScope(false); setErrors({}); setShowModal(true)
  }

  function openEdit(lead: typeof leads[0]) {
    setEditId(lead.id)
    setCompanyName(lead.company?.name ?? '')
    // Pull the saved scope so the modal edits the real list rather than a blank one.
    setScopeRows([]); setHadScope(false)
    api.get('/scope-items', { params: { entityType: 'Lead', entityId: lead.id } })
      .then(r => {
        const rows = (r.data as ScopeItem[]).map(s => ({ ...s, customFields: Array.isArray(s.customFields) ? s.customFields : [] }))
        setScopeRows(rows)
        setHadScope(rows.length > 0)
      })
      .catch(() => setScopeRows([]))
    setForm({
      title: lead.title, companyId: lead.companyId,
      regionId: lead.regionId ?? lead.regionRef?.id ?? '',
      commercialModelId: lead.commercialModelId ?? lead.commercialModel?.id ?? '',
      status: STATUS_LABEL[lead.status] ?? lead.status,
      estimatedValue: lead.estimatedValue ? String(lead.estimatedValue) : '',
      closeDate: lead.closeDate ? lead.closeDate.slice(0, 10) : '',
      notes: lead.notes ?? '',
      monthlyRemarks: lead.monthlyRemarks ?? '',
      departmentId: lead.departmentId ?? lead.department?.id ?? '',
      leadDate: lead.leadDate ? lead.leadDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      capacityValue: lead.capacityValue != null ? String(lead.capacityValue) : '',
      capacityUnitId: lead.capacityUnitId ?? lead.capacityUnit?.id ?? '',
      tempRangeMin: lead.tempRangeMin != null ? String(lead.tempRangeMin) : '',
      tempRangeMax: lead.tempRangeMax != null ? String(lead.tempRangeMax) : '',
      primaryOwnerId: lead.primaryOwnerId ?? lead.primaryOwner?.id ?? '',
      secondaryOwnerId: lead.secondaryOwnerId ?? lead.secondaryOwner?.id ?? '',
      salesManagerId: lead.salesManagerId ?? lead.salesManager?.id ?? '',
      businessHeadId: lead.businessHeadId ?? lead.businessHead?.id ?? '',
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
    else if (!accounts.some(a => a.name.toLowerCase() === companyName.toLowerCase()) && !form.companyId) {
      e.company = `"${companyName}" doesn't match an existing account — select one from the suggestions or create it under Accounts first`
    }
    if (contacts.some(c => !c.name.trim())) e.contacts = 'All contact rows must have a name'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const matchedAccount = accounts.find(a => a.name.toLowerCase() === companyName.toLowerCase())
    const validSources = sources.filter(s => s.source.trim())
    const matchedLeadSource = validSources[0] ? leadSourcesMaster.find(s => s.name.toLowerCase() === validSources[0].source.toLowerCase()) : undefined
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      companyId: matchedAccount?.id ?? form.companyId,
      leadSourceId: matchedLeadSource?.id || undefined,
      regionId: form.regionId || undefined,
      commercialModelId: form.commercialModelId || undefined,
      status: STATUS_TO_API[form.status] ?? form.status,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
      closeDate: form.closeDate || undefined,
      leadDate: form.leadDate || undefined,
      notes: form.notes || undefined,
      monthlyRemarks: form.monthlyRemarks || undefined,
      departmentId: form.departmentId || undefined,
      capacityValue: form.capacityValue ? Number(form.capacityValue) : undefined,
      capacityUnitId: form.capacityUnitId || undefined,
      tempRangeMin: form.tempRangeMin ? Number(form.tempRangeMin) : undefined,
      tempRangeMax: form.tempRangeMax ? Number(form.tempRangeMax) : undefined,
      primaryOwnerId: form.primaryOwnerId || undefined,
      secondaryOwnerId: form.secondaryOwnerId || undefined,
      salesManagerId: form.salesManagerId || undefined,
      businessHeadId: form.businessHeadId || undefined,
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
      const editing = leads.find(l => l.id === editId)
      try {
        // Echo the loaded version so a concurrent edit is rejected, not clobbered.
        await updateLead.mutateAsync({ id: editId, ...payload, expectedUpdatedAt: editing?.updatedAt })
      } catch (e) {
        // Leave the form open on conflict rather than discarding the user's input.
        if (handleVersionConflict(e, () => qc.invalidateQueries({ queryKey: ['leads'] }))) return
        throw e
      }
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

      // Scope lines can only be written once the lead has an id.
      await saveDraftScopeItems('Lead', savedId, scopeRows, { hadExisting: hadScope })
      qc.invalidateQueries({ queryKey: ['scope-items', 'Lead', savedId] })
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

  if (isLoading) return <Spinner />
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load leads" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: isMobile ? 'stretch' : 'flex-start', ...(isMobile ? {} : { minHeight: 'calc(100vh - 120px)', flex: 1 }) }}>
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
            {(leadSourcesMaster.length ? leadSourcesMaster.map(s => s.name) : ['Direct', 'Channel Partner', 'WLB Partner', 'Business Partner']).map(src => {
              const n = leads.filter(l => l.leadSourceRef?.name === src).length
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {isMobile ? (
              <button data-status-drop ref={statusBtnRef}
                onClick={() => setStatusDropOpen(o => !o)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${filters.status.length ? '#5D78FF' : '#E8EAED'}`, background: filters.status.length ? '#EEF2FF' : '#fff', cursor: 'pointer' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: filters.status.length ? '#5D78FF' : '#374557' }}>
                  {filters.status.length === 1 ? `${filters.status[0]} (${counts[filters.status[0] as UIStatus] ?? 0})` : `All (${leads.length})`}
                </span>
                <ChevronDown size={14} color={filters.status.length ? '#5D78FF' : '#9CA3AF'} style={{ transform: statusDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
              </button>
            ) : (
              <div className="crm-pill-row" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
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
            )}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <CsvImportExport data={leads} columns={LEAD_CSV_COLS} filename="leads.csv" templateRow={LEAD_CSV_TEMPLATE} onImport={importLeads} compact={false} label="Leads" />
                <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Plus size={14} /> New Lead
                </button>
              </div>
            )}
          </div>

          {/* Row 2: filter — mobile = icon, desktop = full bar */}
          {isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <button onClick={() => setFilterSheetOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: `1.5px solid ${activeFilterCount > 0 ? '#5D78FF' : '#E8EAED'}`, background: activeFilterCount > 0 ? '#EEF2FF' : '#fff', color: activeFilterCount > 0 ? '#5D78FF' : '#6B7280', cursor: 'pointer' }}>
                <SlidersHorizontal size={13} />
                Filters
                {activeFilterCount > 0 && <span style={{ background: '#5D78FF', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>}
              </button>
              {activeFilterCount > 0 && <button onClick={clearAll} style={{ fontSize: 11, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all</button>}
            </div>
          ) : (
          <div className="crm-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: '#F4F5F9', fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
              <SlidersHorizontal size={12} />
              {activeFilterCount > 0 && <span style={{ background: '#5D78FF', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>}
            </div>
            {([
              { key: 'source' as const, label: 'Source', opts: leadSourcesMaster.map(s => s.name) },
              { key: 'region' as const, label: 'Region', opts: regions.map(r => r.name) },
              { key: 'commercialType' as const, label: 'Type', opts: commercialModels.map(m => m.name) },
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
                          if (key === 'source') return l.sources?.some(s => s.source === opt) || l.leadSourceRef?.name === opt
                          if (key === 'region') return l.regionRef?.name === opt
                          if (key === 'commercialType') return l.commercialModel?.name === opt
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
          )} {/* end desktop filter bar */}

          {/* Active filter chips — desktop only */}
          {!isMobile && activeFilterCount > 0 && (
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

        {/* ── Mobile cards ── */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {paginated.length === 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: '20px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F4F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserCheck size={20} color="#C4C9D4" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', margin: 0 }}>No leads</p>
                  <p style={{ fontSize: 11, color: '#C4C9D4', margin: '2px 0 0' }}>
                    {filters.status.length ? `No ${filters.status[0]} leads yet` : 'No leads match your filters'}
                  </p>
                </div>
              </div>
            )}
            {paginated.map(lead => {
              const s = st(lead.status)
              const primary = lead.contacts?.find(c => c.isPrimary) ?? lead.contacts?.[0]
              return (
                <div key={lead.id} onClick={() => setDetailLead(lead)}
                  style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: '10px 12px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  {/* Row 1: icon + title + menu */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={14} style={{ color: s.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.title}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                        {lead.company?.name ?? '—'}{lead.regionRef?.name ? <span style={{ color: '#D1D5DB' }}> · </span> : ''}{lead.regionRef?.name}
                      </p>
                      {primary && <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 0 }}>{primary.name}{primary.designation ? ` · ${primary.designation}` : ''}</p>}
                    </div>
                    <div onClick={e => e.stopPropagation()} style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); openRowMenu(lead.id, e.currentTarget.getBoundingClientRect()) }}
                        style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                        <MoreHorizontal size={15} />
                      </button>
                      {menuOpen === lead.id && (
                        <div style={{
                          ...dropdownStyle, position: 'fixed', zIndex: 200, right: 'auto',
                          left: Math.min(menuPos.x - 170, window.innerWidth - 180),
                          ...(menuPos.openUp
                            ? { top: 'auto', bottom: window.innerHeight - menuPos.y, maxHeight: menuPos.y - 8, overflowY: 'auto' }
                            : { top: menuPos.y, maxHeight: window.innerHeight - menuPos.y - 8, overflowY: 'auto' }),
                        }}>
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
                              if (s.api === 'OrderWon' || s.api === 'OrderLost') {
                                setStatusConfirm({ leadId: lead.id, status: s.api, label: s.label })
                              } else {
                                changeStatus.mutate({ id: lead.id, status: s.api }, {
                                  onSuccess: (data: any) => { if (s.api === 'OrderWon' && data?.promotedDeal) navigate('/deals') }
                                })
                              }
                            }}
                              style={{ ...menuItemStyle, color: s.color }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 8, flexShrink: 0, display: 'inline-block' }} />{s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Row 2: status + value */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 6, borderTop: '1px solid #F4F5F9' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>{STATUS_LABEL[lead.status] ?? lead.status}</span>
                    {lead.estimatedValue && <span style={{ fontSize: 11, fontWeight: 700, color: '#2BC155', marginLeft: 'auto' }}>{symbol}{lead.estimatedValue.toLocaleString()}</span>}
                    {lead.owners?.[0]?.user?.name && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{lead.owners[0].user.name}</span>}
                  </div>
                </div>
              )
            })}
            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...pagBtn, color: page === 1 ? '#D5D5D5' : '#374557', cursor: page === 1 ? 'default' : 'pointer' }}><ChevronLeft size={13} /> Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setPage(pg)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...pagBtn, color: page === totalPages ? '#D5D5D5' : '#374557', cursor: page === totalPages ? 'default' : 'pointer' }}>Next <ChevronRight size={13} /></button>
            </div>
          </div>
        ) : (

        <div className="crm-table-wrap" style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table className="crm-leads-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F5F9', background: '#FAFBFF' }}>
                <th style={{ padding: '8px 0 8px 10px', width: 30 }}>
                  <input type="checkbox" checked={bulk.allSelected}
                    ref={el => { if (el) el.indeterminate = bulk.someSelected }}
                    onChange={bulk.toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Lead / Contacts', 'Company', 'Source', 'Region', 'Status', 'Est. Value', 'Owner', ''].map(h => (
                  <th key={h} style={{ textAlign: h === 'Est. Value' ? 'center' : 'left', padding: '8px 10px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
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
                    <td style={{ padding: '7px 0 7px 10px' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={bulk.isSelected(lead.id)} onChange={() => bulk.toggle(lead.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserCheck size={14} style={{ color: s.color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{lead.title}</p>
                          {primary && <p style={{ fontSize: 10, color: '#B1B1BE' }}>{primary.name}{primary.designation ? ` · ${primary.designation}` : ''}</p>}
                          {(lead.contacts?.length ?? 0) > 1 && <p style={{ fontSize: 10, color: '#5D78FF' }}>+{(lead.contacts?.length ?? 0) - 1} more</p>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 11, color: '#374557' }}>{lead.company?.name ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: '#F4F5F9', color: '#374557', fontWeight: 500 }}>{lead.sources?.[0]?.source ?? lead.leadSourceRef?.name}</span>
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 11, color: '#374557' }}>{lead.regionRef?.name}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>
                        {STATUS_LABEL[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      {lead.estimatedValue
                        ? <span style={{ fontSize: 12, fontWeight: 700, color: '#2BC155' }}>{symbol}{lead.estimatedValue.toLocaleString()}</span>
                        : <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 11, color: '#374557' }}>
                      {lead.owners?.map(o => o.user?.name).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '7px 10px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button onClick={e => { e.stopPropagation(); openRowMenu(lead.id, e.currentTarget.getBoundingClientRect()) }}
                          style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen === lead.id && (
                          <div style={{
                            ...dropdownStyle, position: 'fixed', zIndex: 200, right: 'auto',
                            left: Math.min(menuPos.x - 170, window.innerWidth - 180),
                            ...(menuPos.openUp
                              ? { top: 'auto', bottom: window.innerHeight - menuPos.y, maxHeight: menuPos.y - 8, overflowY: 'auto' }
                              : { top: menuPos.y, maxHeight: window.innerHeight - menuPos.y - 8, overflowY: 'auto' }),
                          }}>
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
                                if (s.api === 'OrderWon' || s.api === 'OrderLost') {
                                  setStatusConfirm({ leadId: lead.id, status: s.api, label: s.label })
                                } else {
                                  changeStatus.mutate({ id: lead.id, status: s.api }, {
                                    onSuccess: (data: any) => { if (s.api === 'OrderWon' && data?.promotedDeal) navigate('/deals') },
                                  })
                                }
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
                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No leads found.</td></tr>
              )}
            </tbody>
          </table>

          <BulkActionBar count={bulk.count} entityLabel="leads" onDelete={() => setShowBulkDelete(true)} onClear={bulk.clear} />
          {showBulkDelete && (
            <BulkDeleteDialog
              count={bulk.count}
              entityLabel="leads"
              archive
              isPending={bulkDeleteLeads.isPending}
              onCancel={() => setShowBulkDelete(false)}
              onConfirm={handleBulkDelete}
            />
          )}

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
        )} {/* end desktop table */}
      </div>

      {/* Detail slide-in panel */}
      {detailLead && (
        <LeadDetailPanel
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onEdit={lead => { openEdit(lead); setDetailLead(null) }}
        />
      )}

      {/* Status transition confirmation modal */}
      {statusConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div role="dialog" aria-modal="true" aria-label="Confirm Status Change" style={{ background: '#fff', borderRadius: 16, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {statusConfirm.status === 'OrderWon' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🏆</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Mark as Order Won?</p>
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                  This will automatically <strong>create a new Deal</strong> in the Deals module linked to this lead. You will be redirected to Deals on success. Ensure all lead details, contacts and estimated value are complete.
                </p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Mark as Order Lost?</p>
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                  This will mark the lead as <strong>Order Lost</strong>. The lead will remain visible in the list and can be re-activated by changing the status again.
                </p>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setStatusConfirm(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => {
                  const { leadId, status } = statusConfirm
                  setStatusConfirm(null)
                  changeStatus.mutate({ id: leadId, status }, {
                    onSuccess: (data: any) => { if (status === 'OrderWon' && data?.promotedDeal) navigate('/deals') }
                  })
                }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none',
                  background: statusConfirm.status === 'OrderWon' ? '#2BC155' : '#FF5353', color: '#fff', cursor: 'pointer' }}>
                {statusConfirm.status === 'OrderWon' ? '🏆 Confirm Order Won' : '⚠️ Confirm Order Lost'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div role="dialog" aria-modal="true" aria-label="Delete Lead confirmation" style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
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
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="crm-modal" role="dialog" aria-modal="true" aria-label={editId ? 'Edit Lead' : 'New Lead'} style={{ width: '100%', maxWidth: isMobile ? '100%' : 1100, height: isMobile ? '100dvh' : 'calc(100vh - 24px)', borderRadius: isMobile ? 0 : undefined }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>{editId ? 'Edit Lead' : 'New Lead'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>

            {/* Body — 2 columns desktop, single column mobile */}
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '16px 24px', display: isMobile ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 12 : 20 }}>

            {/* ── LEFT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: isMobile ? 'visible' : 'auto', minHeight: isMobile ? 'auto' : 0 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderLeft: isMobile ? 'none' : '1px solid #F4F5F9', paddingLeft: isMobile ? 0 : 20, borderTop: isMobile ? '1px solid #F4F5F9' : 'none', paddingTop: isMobile ? 12 : 0, overflowY: isMobile ? 'visible' : 'auto', minHeight: isMobile ? 'auto' : 0 }}>
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
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp(false)}>
                    {UI_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Lead Date">
                  <input type="date" value={form.leadDate} onChange={e => setForm({ ...form, leadDate: e.target.value })} style={inp(false)} />
                </Field>
                <Field label="Region">
                  <select value={form.regionId} onChange={e => setForm({ ...form, regionId: e.target.value })} style={inp(false)}>
                    <option value="">— Select —</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </Field>
                <Field label="Commercial Model">
                  <select value={form.commercialModelId} onChange={e => setForm({ ...form, commercialModelId: e.target.value })} style={inp(false)}>
                    <option value="">— Select —</option>
                    {commercialModels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Department">
                  <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} style={inp(false)}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label={`Est. Value (${symbol})`}>
                  <input value={form.estimatedValue} onChange={e => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0" type="number" min="0" style={inp(false)} />
                </Field>
                <Field label="Est. Close Date">
                  <input type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} style={inp(false)} />
                </Field>
              </div>

              {/* Scope of supply. Specs are per-product custom fields rather than
                  four lead-level columns, so each item carries what it needs. */}
              <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 12 }}>
                <ScopeItemsPanel
                  entityType="Lead"
                  entityId={editId ?? undefined}
                  value={scopeRows}
                  onChange={setScopeRows}
                />
              </div>

              {/* Ownership tiers */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <Field label="Primary Owner">
                  <select value={form.primaryOwnerId} onChange={e => setForm({ ...form, primaryOwnerId: e.target.value })} style={inp(false)}>
                    <option value="">— None —</option>
                    {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Secondary Owner">
                  <select value={form.secondaryOwnerId} onChange={e => setForm({ ...form, secondaryOwnerId: e.target.value })} style={inp(false)}>
                    <option value="">— None —</option>
                    {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Sales Manager">
                  <select value={form.salesManagerId} onChange={e => setForm({ ...form, salesManagerId: e.target.value })} style={inp(false)}>
                    <option value="">— None —</option>
                    {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Business Head">
                  <select value={form.businessHeadId} onChange={e => setForm({ ...form, businessHeadId: e.target.value })} style={inp(false)}>
                    <option value="">— None —</option>
                    {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
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
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Sales ID Fields <span style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 400 }}>(builds the unique ID shared across this Lead, its Deal, and its Project)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  <input value={form.companyNickname} onChange={e => setForm({ ...form, companyNickname: e.target.value })} placeholder="Account nickname (e.g. HMML)" style={inp(false)} />
                  <input value={form.companyStateCode} onChange={e => setForm({ ...form, companyStateCode: e.target.value })} placeholder="State code override (e.g. TN)" style={inp(false)} />
                  <input value={form.companyAreaCode} onChange={e => setForm({ ...form, companyAreaCode: e.target.value })} placeholder="Area code (e.g. SR)" style={inp(false)} />
                  <input value={form.companyCityCode} onChange={e => setForm({ ...form, companyCityCode: e.target.value })} placeholder="City code (e.g. CH)" style={inp(false)} />
                </div>
              </div>
            </div></div>{/* end right column inner + outer */}

            </div>{/* end 2-col grid body */}

            {/* Footer */}
            <div className="crm-modal-footer" style={{ flexShrink: 0 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #E8EAED', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleSave()} style={{ flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{editId ? 'Save Changes' : 'Create Lead'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile filter bottom sheet */}
      {isMobile && filterSheetOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setFilterSheetOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#374557' }}>Filters</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {activeFilterCount > 0 && <button onClick={() => { clearAll(); }} style={{ fontSize: 12, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all</button>}
                <button onClick={() => setFilterSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px 20px' }}>
              {([
                { key: 'source' as const, label: 'Source', opts: ['Direct', 'Channel Partner', 'WLB Partner', 'Business Partner'] },
                { key: 'region' as const, label: 'Region', opts: ['North', 'West', 'South', 'East'] },
                { key: 'commercialType' as const, label: 'Type', opts: ['Capex', 'Opex', 'Deferred', 'Esco', 'Rental'] },
                { key: 'salesPerson' as const, label: 'Sales Person', opts: salesPersonNames },
                { key: 'clientType' as const, label: 'Client Type', opts: ['India', 'International'] },
                { key: 'stage' as const, label: 'Stage', opts: ['Lead', 'QualifiedLead', 'Deal', 'Project', 'Installation', 'Support'] },
                { key: 'state' as const, label: 'State', opts: INDIA_STATES.filter(s => s !== 'None') },
                { key: 'closeDate' as const, label: 'Close Date', opts: ['Overdue', 'This Month', 'Next Month', 'This Quarter', 'No Close Date'] },
              ]).map(({ key, label, opts }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {opts.map(opt => {
                      const checked = filters[key].includes(opt)
                      return (
                        <button key={opt} onClick={() => toggleFilter(key, opt)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: checked ? 600 : 400, border: `1.5px solid ${checked ? '#5D78FF' : '#E8EAED'}`, background: checked ? '#EEF2FF' : '#fff', color: checked ? '#5D78FF' : '#6B7280', cursor: 'pointer' }}>
                          {key === 'stage' ? ({ QualifiedLead: 'Qualified Lead', Lead: 'Lead', Deal: 'Deal', Project: 'Project', Installation: 'Installation', Support: 'Support' }[opt] ?? opt) : opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Value Range (₹)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="Min" value={valueMin} onChange={e => { setValueMin(e.target.value); setPage(1) }} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E8EAED', fontSize: 14, outline: 'none' }} />
                  <input type="number" placeholder="Max" value={valueMax} onChange={e => { setValueMax(e.target.value); setPage(1) }} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E8EAED', fontSize: 14, outline: 'none' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F1F5', flexShrink: 0 }}>
              <button onClick={() => setFilterSheetOpen(false)} style={{ width: '100%', padding: '13px', borderRadius: 12, background: '#5D78FF', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Show {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Status dropdown portal */}
      {isMobile && statusDropOpen && createPortal(
        <div onMouseDown={() => setStatusDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />,
        document.body
      )}
      {isMobile && statusDropOpen && createPortal(
        <div onClick={() => setStatusDropOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9998, display: 'flex', alignItems: 'flex-end' }}>
          <div data-status-drop onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F0F1F5' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#374557' }}>Filter by Status</span>
              <button onClick={() => setStatusDropOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
            </div>
            <button onMouseDown={e => { e.stopPropagation(); clearFilterKey('status'); setPage(1); setStatusDropOpen(false) }}
              style={{ width: '100%', textAlign: 'left', padding: '16px 20px', fontSize: 14, fontWeight: filters.status.length === 0 ? 700 : 500, color: filters.status.length === 0 ? '#5D78FF' : '#374557', background: filters.status.length === 0 ? '#EEF2FF' : 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid #F4F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>All</span><span style={{ fontSize: 13, background: '#F4F5F9', borderRadius: 20, padding: '2px 10px', color: '#6B7280' }}>{leads.length}</span>
            </button>
            {UI_STATUSES.map(s => {
              const active = filters.status.length === 1 && filters.status[0] === s
              const st2 = statusStyle[STATUS_TO_API[s]] ?? { bg: '#F4F5F9', color: '#8C8C8C' }
              return (
                <button key={s} onMouseDown={e => { e.stopPropagation(); setFilters(f => ({ ...f, status: [s] })); setPage(1); setStatusDropOpen(false) }}
                  style={{ width: '100%', textAlign: 'left', padding: '16px 20px', fontSize: 14, fontWeight: active ? 700 : 500, color: active ? st2.color : '#374557', background: active ? st2.bg : 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid #F4F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{s}</span>
                  <span style={{ fontSize: 13, background: active ? 'rgba(255,255,255,0.6)' : '#F4F5F9', borderRadius: 20, padding: '2px 10px', color: active ? st2.color : '#6B7280' }}>{counts[s] ?? 0}</span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}

      {/* Mobile FAB */}
      {isMobile && !statusDropOpen && !detailLead && (
        <button
          onClick={openCreate}
          style={{
            position: 'fixed', bottom: 24, right: 20, zIndex: 150,
            width: 52, height: 52, borderRadius: '50%',
            background: '#5D78FF', color: '#fff', border: 'none',
            boxShadow: '0 4px 20px rgba(93,120,255,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 28, fontWeight: 300,
          }}
        >
          <Plus size={22} />
        </button>
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
