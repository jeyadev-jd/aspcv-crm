import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currencyContext'
import { MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, Briefcase, Trash2, Edit2, CheckCircle2, XCircle, ArrowRightCircle, Loader2, ExternalLink } from 'lucide-react'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData } from '@/lib/crmDataContext'
import { useDeals, useCreateDeal, useUpdateDeal, useUpdateDealStage, useDeleteDeal, DEAL_STAGES, stageToUI } from '@/hooks/useDeals'
import { useLead } from '@/hooks/useLeads'
import LeadDetailPanel from '@/components/shared/LeadDetailPanel'
import { CsvImportExport } from '@/components/shared/CsvImportExport'
import type { CsvColDef } from '@/components/shared/CsvImportExport'
import type { DealAPI } from '@/hooks/useDeals'

type UIStage = 'Lead In' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'

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

const blankForm = { name: '', account: '', contact: '', stage: 'Proposal' as UIStage, amount: '', closeDate: '', probability: '', product: '' }
const PAGE_SIZE = 5

export default function Deals() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { accounts } = useCrmData()

  const { data: rawDeals = [], isLoading } = useDeals()
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

  const [filter, setFilter] = useState<'All' | UIStage>('All')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [viewLeadId, setViewLeadId] = useState<string | null>(null)

  const { data: viewLead } = useLead(viewLeadId ?? '')

  const deals = rawDeals.map(d => ({
    ...d,
    uiStage: apiStageToUI[d.stage] ?? 'Proposal' as UIStage,
    accountName: d.company?.name ?? '',
    amount: d.value ?? 0,
    prob: d.probability ?? 0,
  }))

  const filtered = filter === 'All' ? deals : deals.filter(d => d.uiStage === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
      contact: deal.contact?.name ?? '',
      stage: deal.uiStage,
      amount: String(deal.amount || ''),
      closeDate: deal.closeDate ? deal.closeDate.slice(0, 10) : '',
      probability: String(deal.prob || ''),
      product: deal.productId ?? '',
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
    }
    if (editId) {
      await updateDeal.mutateAsync({ id: editId, ...payload })
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
    const result = await updateStage.mutateAsync({ id, stage: uiStageToAPI[uiStage] })
    setMenuOpen(null)
    if (uiStage === 'Closed Won' && result?.promotedProject) navigate('/projects')
  }

  function changeFilter(f: typeof filter) { setFilter(f); setPage(1) }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <Loader2 size={24} style={{ color: '#5D78FF', animation: 'spin 1s linear infinite' }} />
    </div>
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

        <div className="crm-table-wrap" style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflowX: 'auto', flex: 1, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map(deal => (
                <div key={deal.id} onClick={() => deal.leadId ? setViewLeadId(deal.leadId) : openEdit(deal)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  {['Deal', 'Account', 'Stage', 'Value', 'Close Date', 'Prob.', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((deal, i) => (
                  <tr key={deal.id} onClick={() => deal.leadId ? setViewLeadId(deal.leadId) : openEdit(deal)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: stageStyle[deal.uiStage].bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Briefcase size={14} style={{ color: stageStyle[deal.uiStage].color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.title}</p>
                          {deal.leadId
                            ? <span style={{ fontSize: 10, color: '#5D78FF', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}><ExternalLink size={9} />Origin Lead</span>
                            : <p style={{ fontSize: 10, color: '#B1B1BE' }}>No origin lead</p>
                          }
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 11, color: '#374557' }}>{deal.accountName}</p></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: stageStyle[deal.uiStage].bg, color: stageStyle[deal.uiStage].color, whiteSpace: 'nowrap' }}>{deal.uiStage}</span></td>
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
                      <div style={{ position: 'relative' }}>
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === deal.id ? null : deal.id) }} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen === deal.id && (
                          <div style={dropdownStyle}>
                            <button onClick={() => { openEdit(deal); setMenuOpen(null) }} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                            {deal.leadId && <button onClick={() => { setViewLeadId(deal.leadId!); setMenuOpen(null) }} style={menuItem}><ExternalLink size={12} style={{ marginRight: 8 }} />View Origin Lead</button>}
                            <button onClick={() => quickStage(deal.id, 'Closed Won')} style={menuItem}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Mark Closed Won</button>
                            <button onClick={() => quickStage(deal.id, 'Closed Lost')} style={menuItem}><XCircle size={12} style={{ marginRight: 6 }} />Mark Closed Lost</button>
                            <button onClick={() => quickStage(deal.id, 'Negotiation')} style={menuItem}><ArrowRightCircle size={12} style={{ marginRight: 6 }} />Move to Negotiation</button>
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <button onClick={() => { setDeleteConfirm(deal.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No deals found.</td></tr>}
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

      {/* Lead detail panel */}
      {viewLeadId && viewLead && (
        <LeadDetailPanel
          lead={viewLead}
          onClose={() => setViewLeadId(null)}
          onEdit={() => setViewLeadId(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Deal?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="crm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="crm-modal" style={{ width: '100%', maxWidth: 520 }}>
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

const dropdownStyle: React.CSSProperties = { position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', borderRadius: 8, border: '1px solid #F0F1F5', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 170, overflow: 'hidden', padding: '4px 0' }
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
