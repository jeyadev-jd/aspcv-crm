import Pagination from '@/components/shared/Pagination'
import RowMenu from '@/components/shared/RowMenu'
import Spinner from '@/components/shared/Spinner'
import FilterPanel, { applyFilters, emptyFilters } from '@/components/shared/FilterPanel'
import type { FilterDef, FilterValues } from '@/components/shared/FilterPanel'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currencyContext'
import { X, Plus, Briefcase, Trash2, Edit2, CheckCircle2, XCircle, ArrowRightCircle, ExternalLink, AlertTriangle, RotateCcw } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData } from '@/lib/crmDataContext'
import { useDeals, useCreateDeal, useUpdateDeal, useUpdateDealStage, useDeleteDeal, useBulkDeleteDeals, useCloseWonDeal, useAssignDealPM, useRevertDealToLead, stageToUI } from '@/hooks/useDeals'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import BulkActionBar from '@/components/shared/BulkActionBar'
import BulkDeleteDialog from '@/components/shared/BulkDeleteDialog'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'
import { Link } from 'lucide-react'
import { useDepartments } from '@/hooks/useDepartments'
import { useLead } from '@/hooks/useLeads'
import LeadDetailPanel from '@/components/shared/LeadDetailPanel'
import DealDetailPanel from '@/components/shared/DealDetailPanel'
import { CsvImportExport } from '@/components/shared/CsvImportExport'
import type { CsvColDef } from '@/components/shared/CsvImportExport'
import type { DealAPI } from '@/hooks/useDeals'
import { useQuotations } from '@/hooks/useSales'
import { useQueryClient } from '@tanstack/react-query'
import { handleVersionConflict } from '@/lib/conflict'

type UIStage = 'Lead In' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'

// Any shareable link is accepted — Google Drive, Dropbox, internal file server, etc.
const HANDOVER_URL = /^https?:\/\/.+/i

const DEAL_CSV_COLS: CsvColDef<DealAPI>[] = [
  { header: 'Title',       accessor: r => r.title },
  { header: 'Company',     accessor: r => r.company?.name ?? '' },
  { header: 'Stage',       accessor: r => stageToUI(r.stage) },
  { header: 'Value',       accessor: r => r.value != null ? String(r.value) : '' },
  { header: 'Probability', accessor: r => r.probability != null ? String(r.probability) : '' },
  { header: 'CloseDate',   accessor: r => r.closeDate ?? '' },
  { header: 'Notes',       accessor: r => r.notes ?? '' },
]
const DEAL_STAGE_MAP: Record<string, DealAPI['stage']> = {
  'lead in': 'LeadIn', 'leadin': 'LeadIn',
  'proposal': 'Proposal',
  'negotiation': 'Negotiation',
  'closed won': 'OrderWon', 'orderwon': 'OrderWon',
  'closed lost': 'OrderLost', 'orderlost': 'OrderLost',
}
const DEAL_CSV_TEMPLATE = { Title: 'Heat Pump Project', Company: 'Acme Corp', Stage: 'Proposal', Value: '500000', Probability: '60', CloseDate: '2026-12-31', Notes: '' }

const stageStyle: Record<UIStage, { bg: string; color: string }> = {
  'Lead In':     { bg: '#E8EDFF', color: '#5D78FF' },
  Proposal:      { bg: '#FFF5EE', color: '#FF9B52' },
  Negotiation:   { bg: '#FFF8E0', color: '#F59E0B' },
  'Closed Won':  { bg: '#E7FAF0', color: '#2BC155' },
  'Closed Lost': { bg: '#FFF3F3', color: '#FF5353' },
}

const apiStageToUI: Record<string, UIStage> = {
  LeadIn: 'Lead In', Proposal: 'Proposal', Negotiation: 'Negotiation',
  OrderWon: 'Closed Won', OrderLost: 'Closed Lost',
}
const uiStageToAPI: Record<UIStage, string> = {
  'Lead In': 'LeadIn', Proposal: 'Proposal', Negotiation: 'Negotiation',
  'Closed Won': 'OrderWon', 'Closed Lost': 'OrderLost',
}

const uiStages: UIStage[] = ['Lead In', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const blankForm = { name: '', account: '', contact: '', stage: 'Proposal' as UIStage, amount: '', closeDate: '', probability: '', product: '', departmentId: '' }
const PAGE_SIZE = 5

export default function Deals() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { accounts } = useCrmData()

  const { data: rawDeals = [], isLoading, isError, refetch } = useDeals()
  const { data: departments = [] } = useDepartments()
  const createDeal = useCreateDeal()

  async function importDeals(rows: Record<string, string>[]) {
    let success = 0; const errors: string[] = []
    for (const row of rows) {
      const co = accounts.find(a => a.name.toLowerCase() === (row.Company ?? '').toLowerCase())
      if (!co) { errors.push(`"${row.Title}": company "${row.Company}" not found`); continue }
      try {
        await createDeal.mutateAsync({ title: row.Title, companyId: co.id, stage: DEAL_STAGE_MAP[(row.Stage ?? '').toLowerCase()] ?? 'Proposal', value: row.Value ? Number(row.Value) : undefined, probability: row.Probability ? Number(row.Probability) : undefined, closeDate: row.CloseDate || undefined, notes: row.Notes || undefined })
        success++
      } catch (e: unknown) { errors.push(`"${row.Title}": ${e instanceof Error ? e.message : 'Error'}`) }
    }
    return { total: rows.length, success, errors }
  }
  const updateDeal = useUpdateDeal()
  const updateStage = useUpdateDealStage()
  const deleteDeal = useDeleteDeal()
  const bulkDeleteDeals = useBulkDeleteDeals()
  const revertToLead = useRevertDealToLead()
  const closeWon = useCloseWonDeal()
  const assignPM = useAssignDealPM()
  const authUser = useAuthStore(s => s.user)
  const can = useAuthStore(s => s.can)
  const { data: allUsers = [] } = useUsers(can('hr_user', 'read_all'))
  const isManager = ['Manager', 'ProjectHead', 'SuperAdmin', 'BusinessHead', 'SalesHead'].includes(authUser?.role ?? '')
  const salesManagers = allUsers.filter((u: any) => ['Manager', 'ProjectHead', 'SuperAdmin', 'BusinessHead'].includes(u.role))
  // Handover assigns the project owner, so it lists Project Heads (plus admins
  // so there is always somebody assignable).
  const projectHeads = allUsers.filter((u: any) => ['ProjectHead', 'SuperAdmin', 'BusinessHead'].includes(u.role))

  // Handover modal state
  const [handoverDealId, setHandoverDealId] = useState<string | null>(null)
  const [handoverNotes, setHandoverNotes] = useState('')
  const [handoverUrl, setHandoverUrl] = useState('')
  const [selectedPMId, setSelectedPMId] = useState('')
  const [handoverBudget, setHandoverBudget] = useState('')
  const [handoverQuotationId, setHandoverQuotationId] = useState('')
  // Reassign Sales Manager modal state
  const [reassignDealId, setReassignDealId] = useState<string | null>(null)
  const [reassignManagerId, setReassignManagerId] = useState('')

  const [filter, setFilter] = useState<'All' | UIStage>('All')
  // Stage stays its own state because the sidebar and chips both drive it;
  // everything else lives in the shared multi-filter panel.
  const [adv, setAdv] = useState<FilterValues>(emptyFilters)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [revertConfirm, setRevertConfirm] = useState<string | null>(null)
  const [viewLeadId, setViewLeadId] = useState<string | null>(null)
  const [viewDeal, setViewDeal] = useState<(typeof deals)[0] | null>(null)
  // Stage transition warning: holds deal id + target stage when user clicks Closed Lost
  const [stageConfirm, setStageConfirm] = useState<{ id: string; uiStage: UIStage } | null>(null)

  const { data: viewLead } = useLead(viewLeadId ?? '')

  const deals = rawDeals.map(d => ({
    ...d,
    uiStage: apiStageToUI[d.stage] ?? 'Proposal' as UIStage,
    accountName: d.company?.name ?? '',
    amount: d.value ?? 0,
    prob: d.probability ?? 0,
  }))

  // Filter options are derived from the loaded deals so a dimension only
  // appears when it actually has values to slice by.
  const dealFilters: FilterDef[] = useMemo(() => {
    const uniq = (pairs: [string, string][]) => {
      const m = new Map<string, string>()
      for (const [v, l] of pairs) if (v) m.set(v, l)
      return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
    }
    const defs: FilterDef[] = [
      { kind: 'select', key: 'company', label: 'Company', options: uniq(deals.map(d => [d.companyId, d.accountName])) },
      { kind: 'select', key: 'owner', label: 'Owner',
        options: uniq(deals.flatMap(d => d.owners?.map(o => [o.user.id, o.user.name] as [string, string]) ?? [])),
        emptyOption: { value: '', label: 'Owner: Unassigned' } },
    ]
    const departments = uniq(deals.map(d => [d.departmentId ?? '', d.department?.name ?? '']))
    if (departments.length) defs.push({ kind: 'select', key: 'department', label: 'Department', options: departments })
    const regions = uniq(deals.map(d => [d.regionId ?? '', d.region?.name ?? '']))
    if (regions.length) defs.push({ kind: 'select', key: 'region', label: 'Region', options: regions })
    const models = uniq(deals.map(d => [d.commercialModelId ?? '', d.commercialModel?.name ?? '']))
    if (models.length) defs.push({ kind: 'select', key: 'model', label: 'Model', options: models })
    defs.push(
      { kind: 'toggle', key: 'hasProject', label: 'Handed over' },
      { kind: 'toggle', key: 'closingSoon', label: 'Closing ≤30d' },
      { kind: 'range', key: 'value', label: 'Deal Value', type: 'number' },
      { kind: 'range', key: 'probability', label: 'Probability %', type: 'number' },
      { kind: 'range', key: 'closeDate', label: 'Close Date', type: 'date' },
      { kind: 'range', key: 'createdAt', label: 'Created', type: 'date' },
    )
    return defs
  }, [deals])

  const byStage = filter === 'All' ? deals : deals.filter(d => d.uiStage === filter)
  const filtered = applyFilters(byStage, adv, {
    search: d => [d.title, d.accountName, d.leadNumber, d.notes],
    select: {
      company: d => d.companyId,
      owner: d => d.owners?.map(o => o.user.id) ?? [],
      department: d => d.departmentId ?? '',
      region: d => d.regionId ?? '',
      model: d => d.commercialModelId ?? '',
    },
    range: {
      value: d => d.amount,
      probability: d => d.prob,
      closeDate: d => d.closeDate ?? null,
      createdAt: d => d.createdAt,
    },
    toggle: {
      hasProject: d => (d.projects?.length ?? 0) > 0,
      closingSoon: d => {
        if (!d.closeDate) return false
        const days = (new Date(d.closeDate).getTime() - Date.now()) / 86_400_000
        return days >= 0 && days <= 30
      },
    },
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Scoped to the visible page so "select all" never picks up hidden rows.
  const bulk = useBulkSelect(paginated.map(d => d.id))
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  async function handleBulkDelete() {
    try {
      const res = await bulkDeleteDeals.mutateAsync(bulk.selectedIds)
      if (res.blocked?.length) {
        toast.error(`${res.deleted} archived · ${res.blocked.length} need approval`)
      } else {
        toast.success(`Archived ${res.deleted} deal${res.deleted === 1 ? '' : 's'}`)
      }
      bulk.clear()
      setPage(1)
    } catch {
      toast.error('Bulk delete failed')
    }
    setShowBulkDelete(false)
  }

  const pipelineValue = deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.uiStage)).reduce((s, d) => s + d.amount, 0)
  const wonValue = deals.filter(d => d.uiStage === 'Closed Won').reduce((s, d) => s + d.amount, 0)

  function openCreate() {
    setEditId(null)
    setForm({ ...blankForm, account: accounts[0]?.name ?? '' })
    setErrors({}); setShowModal(true)
  }

  function openEdit(deal: (typeof deals)[0]) {
    setEditId(deal.id)
    setForm({
      name: deal.title,
      account: deal.accountName,
      contact: '',
      stage: deal.uiStage,
      amount: String(deal.amount || ''),
      closeDate: deal.closeDate ? deal.closeDate.slice(0, 10) : '',
      probability: String(deal.prob || ''),
      product: deal.productId ?? '',
      departmentId: deal.departmentId ?? deal.department?.id ?? '',
    })
    setErrors({}); setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditId(null); setForm(blankForm); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Deal name is required'
    if (!form.account.trim()) e.account = 'Account is required'
    if (form.amount && (isNaN(Number(form.amount)) || Number(form.amount) < 0)) e.amount = 'Valid amount required'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const matchedCompany = accounts.find(a => a.name.toLowerCase() === form.account.toLowerCase())
    if (!matchedCompany) { setErrors({ account: 'Company not found — create it in Accounts first' }); return }
    const payload = {
      companyId: matchedCompany.id,
      title: form.name,
      stage: uiStageToAPI[form.stage],
      value: form.amount ? Number(form.amount) : undefined,
      probability: form.probability ? Number(form.probability) : undefined,
      closeDate: form.closeDate || undefined,
      notes: undefined,
      departmentId: form.departmentId || undefined,
    }
    if (editId) {
      const editing = deals.find(d => d.id === editId)
      try {
        // Echo the loaded version so a concurrent edit is rejected, not clobbered.
        await updateDeal.mutateAsync({ id: editId, ...payload, expectedUpdatedAt: editing?.updatedAt })
      } catch (e) {
        // Leave the modal open on conflict so the user's input is not thrown away.
        if (handleVersionConflict(e, () => qc.invalidateQueries({ queryKey: ['deals'] }))) return
        throw e
      }
    } else {
      await createDeal.mutateAsync(payload)
    }
    closeModal()
  }

  async function handleDelete(id: string) {
    await deleteDeal.mutateAsync(id)
    setMenuOpen(null); setDeleteConfirm(null); setPage(1)
  }

  async function quickStage(id: string, uiStage: UIStage) {
    setMenuOpen(null)
    if (uiStage === 'Closed Won') {
      // Seed the budget from the deal value; the handover can still override it.
      const dealValue = deals.find(d => d.id === id)?.value
      setHandoverNotes(''); setHandoverUrl(''); setSelectedPMId('')
      setHandoverBudget(dealValue != null ? String(dealValue) : '')
      setHandoverQuotationId(''); setHandoverDealId(id)
      return
    }
    // All other stage changes (forward and backward, including Closed Lost) show a confirm
    setStageConfirm({ id, uiStage })
  }

  const handoverUrlValid = !handoverUrl.trim() || HANDOVER_URL.test(handoverUrl.trim())
  const handoverBudgetValid = handoverBudget.trim() !== '' && Number.isFinite(Number(handoverBudget)) && Number(handoverBudget) >= 0
  const handoverReady = Boolean(
    handoverNotes.trim() && selectedPMId && handoverBudgetValid && handoverUrl.trim() && handoverUrlValid
  )
  const { data: handoverQuotations = [] } = useQuotations(handoverDealId ?? undefined)

  async function submitHandover() {
    if (!handoverDealId || !handoverNotes.trim()) { toast.error('Handover description required'); return }
    if (!selectedPMId) { toast.error('Please assign a Project Head'); return }
    if (!handoverBudget.trim()) { toast.error('Project budget required'); return }
    if (!Number.isFinite(Number(handoverBudget)) || Number(handoverBudget) < 0) {
      toast.error('Budget must be a positive number'); return
    }
    if (!handoverUrl.trim()) { toast.error('Handover document link required'); return }
    if (!HANDOVER_URL.test(handoverUrl.trim())) { toast.error('Handover link must be a valid URL'); return }
    const result = await closeWon.mutateAsync({
      id: handoverDealId,
      handoverNotes,
      handoverOneDriveUrl: handoverUrl.trim(),
      assignedPMId: selectedPMId,
      budget: Number(handoverBudget),
      quotationId: handoverQuotationId || undefined,
    })
    toast.success('Quotation accepted — Deal marked Closed Won, Project created for engineering')
    setHandoverDealId(null)
    if (result?.promotedProject) navigate('/projects')
  }

  async function doRevertToLead(id: string) {
    try {
      await revertToLead.mutateAsync(id)
      toast.success('Deal reverted — Lead is back to Prospective status')
      setRevertConfirm(null)
    } catch (e: any) {
      if (e?.response?.status === 409 && e.response.data?.message) {
        toast.error(e.response.data.message)
      } else {
        toast.error(e?.response?.data?.error ?? 'Failed to revert deal')
      }
      setRevertConfirm(null)
    }
  }

  async function submitReassignManager() {
    if (!reassignDealId) return
    await assignPM.mutateAsync({ id: reassignDealId, assignedPMId: reassignManagerId || null })
    toast.success('Sales Manager assigned')
    setReassignDealId(null)
  }

  function changeFilter(f: typeof filter) { setFilter(f); setPage(1) }

  if (isLoading) return <Spinner />
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load deals" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: isMobile ? 'stretch' : 'flex-start', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

      {/* Sidebar */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>Active Pipeline</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#374557' }}>{symbol}{(pipelineValue / 1000).toFixed(0)}k</p>
          <p style={{ fontSize: 10, color: '#2BC155', marginTop: 2 }}>+{symbol}{(wonValue / 1000).toFixed(0)}k closed won</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 12 }}>Pipeline Stages</p>
          {uiStages.map(stage => {
            const count = deals.filter(d => d.uiStage === stage).length
            const val = deals.filter(d => d.uiStage === stage).reduce((s, d) => s + d.amount, 0)
            return (
              <div key={stage} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => changeFilter(filter === stage ? 'All' : stage)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: stageStyle[stage].bg, color: stageStyle[stage].color }}>{stage}</span>
                  <p style={{ fontSize: 10, color: '#B1B1BE' }}>{count}</p>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>{symbol}{val.toLocaleString()}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => changeFilter('All')} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === 'All' ? '#5D78FF' : '#F4F5F9', color: filter === 'All' ? '#fff' : '#B1B1BE' }}>All</button>
            {uiStages.map(s => <button key={s} onClick={() => changeFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === s ? '#5D78FF' : '#F4F5F9', color: filter === s ? '#fff' : '#B1B1BE' }}>{s}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CsvImportExport data={rawDeals} columns={DEAL_CSV_COLS} filename="deals.csv" templateRow={DEAL_CSV_TEMPLATE} onImport={importDeals} compact={isMobile} />
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={14} /> New Deal
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <FilterPanel
            filters={dealFilters}
            values={adv}
            onChange={v => { setAdv(v); setPage(1) }}
            searchPlaceholder="Search deals by title, company, lead number, notes…"
          />
          <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 8 }}>
            Showing <strong style={{ color: '#374557' }}>{filtered.length}</strong> of {deals.length} deals
            {filtered.length > 0 && <> · Value <strong style={{ color: '#374557' }}>{symbol}{filtered.reduce((s, d) => s + d.amount, 0).toLocaleString()}</strong></>}
          </p>
        </div>

        <div className="crm-table-wrap" style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto', flex: 1, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map(deal => (
                <div key={deal.id} onClick={() => setViewDeal(deal)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: stageStyle[deal.uiStage].bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Briefcase size={14} style={{ color: stageStyle[deal.uiStage].color }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.title}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{deal.accountName}</p>
                        {deal.leadId && <span style={{ fontSize: 10, color: '#5D78FF', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}><ExternalLink size={9} />Origin Lead</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: stageStyle[deal.uiStage].bg, color: stageStyle[deal.uiStage].color, whiteSpace: 'nowrap' }}>{deal.uiStage}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Amount</p><p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{symbol}{deal.amount.toLocaleString()}</p></div>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Close Date</p><p style={{ fontSize: 11, color: '#374557' }}>{deal.closeDate?.slice(0, 10) ?? '—'}</p></div>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Probability</p><p style={{ fontSize: 11, color: '#374557' }}>{deal.prob}%</p></div>
                  </div>
                </div>
              ))}
              {paginated.length === 0 && <p style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 24 }}>No deals found.</p>}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  <th style={{ padding: '10px 0 10px 16px', width: 32 }}>
                    <input type="checkbox" checked={bulk.allSelected}
                      ref={el => { if (el) el.indeterminate = bulk.someSelected }}
                      onChange={bulk.toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {['Deal', 'Account', 'Stage', 'Value', 'Close Date', 'Prob.', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((deal, i) => (
                  <tr key={deal.id} onClick={() => setViewDeal(deal)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 0 12px 16px' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={bulk.isSelected(deal.id)} onChange={() => bulk.toggle(deal.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: stageStyle[deal.uiStage].bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Briefcase size={14} style={{ color: stageStyle[deal.uiStage].color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.title}</p>
                          {deal.leadNumber && (
                            <p style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: '#2BC155', marginTop: 1 }}>{deal.leadNumber}</p>
                          )}
                          {deal.leadId
                            ? <span style={{ fontSize: 10, color: '#5D78FF', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}><ExternalLink size={9} />Origin Lead</span>
                            : <p style={{ fontSize: 10, color: '#B1B1BE' }}>No origin lead</p>
                          }
                          {(deal.region || deal.commercialModel) && (
                            <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1 }}>
                              {[deal.region?.name, deal.commercialModel?.name].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 11, color: '#374557' }}>{deal.accountName}</p></td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: stageStyle[deal.uiStage].bg, color: stageStyle[deal.uiStage].color, whiteSpace: 'nowrap' }}>{deal.uiStage}</span>
                      {deal.uiStage === 'Closed Won' && deal.assignedPM && (
                        <p style={{ fontSize: 10, color: '#5D78FF', marginTop: 3 }}>Sales Manager: {deal.assignedPM.name}</p>
                      )}
                      {deal.uiStage === 'Closed Won' && !deal.assignedPM && (
                        <p style={{ fontSize: 10, color: '#F59E0B', marginTop: 3 }}>⚠ Sales Manager unassigned</p>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#374557' }}>{deal.amount ? `${symbol}${deal.amount.toLocaleString()}` : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{deal.closeDate?.slice(0, 10) ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 50, height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                          <div style={{ height: '100%', borderRadius: 2, width: `${deal.prob}%`, background: deal.uiStage === 'Closed Won' ? '#2BC155' : deal.uiStage === 'Closed Lost' ? '#FF5353' : '#5D78FF' }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#B1B1BE' }}>{deal.prob}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <RowMenu open={menuOpen === deal.id} onOpenChange={o => setMenuOpen(o ? deal.id : null)}>
                            <button onClick={e => { e.stopPropagation(); openEdit(deal); setMenuOpen(null) }} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                            {deal.leadId && <button onClick={() => { setViewLeadId(deal.leadId!); setMenuOpen(null) }} style={menuItem}><ExternalLink size={12} style={{ marginRight: 8 }} />View Origin Lead</button>}
                            {deal.uiStage !== 'Closed Won' && <button onClick={() => quickStage(deal.id, 'Closed Won')} style={menuItem}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Mark Closed Won</button>}
                            {deal.uiStage === 'Closed Won' && isManager && <button onClick={() => { setReassignManagerId(deal.assignedPM?.id ?? ''); setReassignDealId(deal.id); setMenuOpen(null) }} style={menuItem}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Reassign Sales Manager</button>}
                            <button onClick={() => quickStage(deal.id, 'Closed Lost')} style={menuItem}><XCircle size={12} style={{ marginRight: 6 }} />Mark Closed Lost</button>
                            <button onClick={() => quickStage(deal.id, 'Negotiation')} style={menuItem}><ArrowRightCircle size={12} style={{ marginRight: 6 }} />Move to Negotiation</button>
                            {deal.leadId && <button onClick={() => { setRevertConfirm(deal.id); setMenuOpen(null) }} style={menuItem}><RotateCcw size={12} style={{ marginRight: 8 }} />Revert to Lead</button>}
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <button onClick={() => { setDeleteConfirm(deal.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                      </RowMenu>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No deals found.</td></tr>}
              </tbody>
            </table>
          )}
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>

        <BulkActionBar count={bulk.count} entityLabel="deals" onDelete={() => setShowBulkDelete(true)} onClear={bulk.clear} />

        {showBulkDelete && (
          <BulkDeleteDialog
            count={bulk.count}
            entityLabel="deals"
            archive
            isPending={bulkDeleteDeals.isPending}
            onCancel={() => setShowBulkDelete(false)}
            onConfirm={handleBulkDelete}
          />
        )}
      </div>

      {/* Deal detail panel */}
      {viewDeal && (
        <DealDetailPanel
          deal={viewDeal}
          symbol={symbol}
          onClose={() => setViewDeal(null)}
          onEdit={() => { openEdit(viewDeal); setViewDeal(null) }}
        />
      )}

      {/* Lead detail panel */}
      {viewLeadId && viewLead && (
        <LeadDetailPanel
          lead={viewLead}
          onClose={() => setViewLeadId(null)}
          onEdit={() => setViewLeadId(null)}
        />
      )}

      {/* Stage transition warning modal — Closed Lost */}
      {stageConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 65 }}>
          <div role="dialog" aria-modal="true" aria-label="Confirm Stage Change" style={{ background: '#fff', borderRadius: 16, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Mark as Closed Lost?</p>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
              This will mark the deal as <strong>Closed Lost</strong>. The deal will be archived from the active pipeline. It can be re-opened by an admin if needed. Consider adding a note about why this deal was lost before confirming.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setStageConfirm(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { id, uiStage } = stageConfirm
                  setStageConfirm(null)
                  await updateStage.mutateAsync({ id, stage: uiStageToAPI[uiStage] })
                }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>
                ⚠️ Confirm Closed Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Archive this deal?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>
              The deal is hidden from the pipeline but its history is kept. An admin can restore it later.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}


      {/* Revert-to-Lead confirm */}
      {revertConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Revert to Lead?</p>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>
              This <strong>permanently deletes this Deal</strong> and reopens the originating Lead as Prospective.
              Only allowed while the deal has no Project or Quotation — if either exists, this will be refused.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setRevertConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => doRevertToLead(revertConfirm)} disabled={revertToLead.isPending} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>
                {revertToLead.isPending ? 'Reverting…' : 'Revert to Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handover Modal — Closed Won */}
      {handoverDealId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>Project Handover</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Accept the quotation and hand this off to the project team</p>
              </div>
              <button onClick={() => setHandoverDealId(null)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {handoverQuotations.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Accept Quotation (optional)</label>
                  <select
                    value={handoverQuotationId}
                    onChange={e => setHandoverQuotationId(e.target.value)}
                    style={{ width: '100%', border: '1.5px solid #E8E9F0', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">— No quotation —</option>
                    {handoverQuotations.map(q => (
                      <option key={q.id} value={q.id}>{q.refNumber} — {q.title}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4 }}>Marks the selected quotation as Accepted</p>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Assign Project Head *</label>
                <select
                  value={selectedPMId}
                  onChange={e => setSelectedPMId(e.target.value)}
                  style={{ width: '100%', border: `1.5px solid ${!selectedPMId ? '#FF9B52' : '#E8E9F0'}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">— Select Project Head —</option>
                  {projectHeads.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4 }}>This Project Head will own the project created from this deal</p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>
                  Project Budget ({symbol}) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={handoverBudget}
                  onChange={e => setHandoverBudget(e.target.value)}
                  placeholder="Defaults to the deal value"
                  style={{ width: '100%', border: `1.5px solid ${!handoverBudget.trim() ? '#FF9B52' : '#E8E9F0'}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4 }}>
                  Caps procurement — purchase orders raised on this project cannot exceed it
                </p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Handover Description *</label>
                <textarea
                  rows={4}
                  value={handoverNotes}
                  onChange={e => setHandoverNotes(e.target.value)}
                  placeholder="Describe scope, client requirements, key commitments, timeline, any special notes for the project team…"
                  style={{ width: '100%', border: '1.5px solid #E8E9F0', borderRadius: 10, padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>
                  <Link size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Signed PDF Link *
                </label>
                <input
                  type="url"
                  value={handoverUrl}
                  onChange={e => setHandoverUrl(e.target.value)}
                  placeholder="https://... (OneDrive, Google Drive, Dropbox, or any shareable link)"
                  style={{ width: '100%', border: `1.5px solid ${!handoverUrlValid ? '#FF5353' : '#E8E9F0'}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                {!handoverUrlValid ? (
                  <p style={{ fontSize: 10, color: '#FF5353', marginTop: 4, fontWeight: 600 }}>Must be a valid link (https://…)</p>
                ) : (
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4 }}>Paste a link to the signed PDF for the project team — editable later from the project</p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setHandoverDealId(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={submitHandover}
                disabled={closeWon.isPending || !handoverReady}
                style={{ flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: !handoverReady ? '#D1FAE5' : '#2BC155', color: '#fff', cursor: !handoverReady ? 'not-allowed' : 'pointer', opacity: closeWon.isPending ? 0.7 : 1 }}
              >
                <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 6 }} />
                {closeWon.isPending ? 'Submitting…' : 'Accept & Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Sales Manager Modal — Manager only */}
      {reassignDealId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>Reassign Sales Manager</p>
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Pick the sales manager responsible for this deal</p>
              </div>
              <button onClick={() => setReassignDealId(null)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <select
              value={reassignManagerId}
              onChange={e => setReassignManagerId(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #E8E9F0', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
            >
              <option value="">— No manager assigned —</option>
              {salesManagers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setReassignDealId(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={submitReassignManager}
                disabled={assignPM.isPending}
                style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer', opacity: assignPM.isPending ? 0.7 : 1 }}
              >
                {assignPM.isPending ? 'Saving…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="crm-modal" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Deal' : 'New Deal'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div className="crm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Deal Name *" error={errors.name}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ASHP Phase 1" style={inp(!!errors.name)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Account *" error={errors.account}>
                  <input value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} placeholder="Company name" style={inp(!!errors.account)}
                    list="deal-accounts-list" />
                  <datalist id="deal-accounts-list">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                </Field>
                <Field label="Stage">
                  <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as UIStage })} style={inp(false)}>
                    {uiStages.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label={`Value (${symbol})`} error={errors.amount}>
                  <input value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" type="number" min="0" style={inp(!!errors.amount)} />
                </Field>
                <Field label="Probability (%)">
                  <input value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} placeholder="0–100" type="number" min="0" max="100" style={inp(false)} />
                </Field>
              </div>
              <Field label="Expected Close Date">
                <input value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} type="date" style={inp(false)} />
              </Field>
              <Field label="Department">
                <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} style={inp(false)}>
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="crm-modal-footer">
              <button onClick={closeModal} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={createDeal.isPending || updateDeal.isPending} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {(createDeal.isPending || updateDeal.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Create Deal'}
              </button>
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
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
