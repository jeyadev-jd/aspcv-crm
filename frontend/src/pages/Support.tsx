import Pagination from '@/components/shared/Pagination'
import RowMenu from '@/components/shared/RowMenu'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import { useState, useMemo } from 'react'
import {
  X, Plus, LifeBuoy, Trash2, Edit2, CheckCircle2, RefreshCw, Lock, AlertTriangle,
  Search, UserPlus, FolderKanban, Timer, Filter,
} from 'lucide-react'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData } from '@/lib/crmDataContext'
import {
  useTickets, useTicketStats, useCreateTicket, useUpdateTicket, useUpdateTicketStatus,
  useAssignTicket, useDeleteTicket, useBulkDeleteTickets, TICKET_CATEGORIES, isOverdue, hoursToDue,
} from '@/hooks/useSupport'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import BulkActionBar from '@/components/shared/BulkActionBar'
import BulkDeleteDialog from '@/components/shared/BulkDeleteDialog'
import { toast } from '@/lib/toast'
import type { TicketAPI, TicketCategory } from '@/hooks/useSupport'
import { useProjects } from '@/hooks/useProjects'
import { useInstallations } from '@/hooks/useInstallations'
import { useUsers } from '@/hooks/useUsers'

type UIStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed'

const priorityStyle: Record<string, { bg: string; color: string }> = {
  High:     { bg: '#FFF3F3', color: '#FF5353' },
  Critical: { bg: '#FFF3F3', color: '#cc0000' },
  Medium:   { bg: '#FFF5EE', color: '#FF9B52' },
  Low:      { bg: '#E7FAF0', color: '#2BC155' },
}

const statusStyle: Record<UIStatus, { bg: string; color: string }> = {
  'Open':        { bg: '#E8EDFF', color: '#5D78FF' },
  'In Progress': { bg: '#FFF5EE', color: '#FF9B52' },
  'Resolved':    { bg: '#E7FAF0', color: '#2BC155' },
  'Closed':      { bg: '#F4F5F9', color: '#8C8C8C' },
}

const apiToUI: Record<TicketAPI['status'], UIStatus> = {
  Open: 'Open', InProgress: 'In Progress', Resolved: 'Resolved', Closed: 'Closed',
}
const uiToAPI: Record<UIStatus, TicketAPI['status']> = {
  'Open': 'Open', 'In Progress': 'InProgress', 'Resolved': 'Resolved', 'Closed': 'Closed',
}

const uiStatuses: UIStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed']
const priorities = ['Critical', 'High', 'Medium', 'Low'] as const

const blankForm = {
  title: '', client: '', projectId: '', installationId: '', assignedToId: '',
  category: '' as '' | TicketCategory, description: '',
  priority: 'Medium' as TicketAPI['priority'], status: 'Open' as UIStatus, dueDate: '',
}
const PAGE_SIZE = 10

/** "in 6h" / "3d overdue" — the compact SLA read used in the table. */
function slaLabel(t: TicketAPI): { text: string; color: string } | null {
  if (t.status === 'Resolved' || t.status === 'Closed') {
    if (!t.dueDate || !t.resolvedAt) return null
    const met = new Date(t.resolvedAt) <= new Date(t.dueDate)
    return met
      ? { text: 'Met SLA', color: '#2BC155' }
      : { text: 'Breached', color: '#FF5353' }
  }
  const hrs = hoursToDue(t)
  if (hrs == null) return null
  if (hrs < 0) {
    const over = Math.abs(hrs)
    return { text: over >= 24 ? `${Math.floor(over / 24)}d overdue` : `${Math.floor(over)}h overdue`, color: '#FF5353' }
  }
  if (hrs < 24) return { text: `${Math.max(1, Math.floor(hrs))}h left`, color: '#FF9B52' }
  return { text: `${Math.floor(hrs / 24)}d left`, color: '#B1B1BE' }
}

export default function Support() {
  const isMobile = useIsMobile()
  const { accounts } = useCrmData()

  const { data: rawTickets = [], isLoading, isError, refetch } = useTickets()
  const { data: stats } = useTicketStats()
  const { data: projects = [] } = useProjects()
  const { data: installations = [] } = useInstallations()
  const { data: users = [] } = useUsers()

  const createTicket = useCreateTicket()
  const updateTicket = useUpdateTicket()
  const updateStatus = useUpdateTicketStatus()
  const assignTicket = useAssignTicket()
  const deleteTicket = useDeleteTicket()
  const bulkDelete = useBulkDeleteTickets()

  const [filter, setFilter] = useState<'All' | UIStatus>('All')
  const [priorityFilter, setPriorityFilter] = useState<'All' | TicketAPI['priority']>('All')
  const [categoryFilter, setCategoryFilter] = useState<'All' | TicketCategory>('All')
  const [projectFilter, setProjectFilter] = useState<'All' | 'none' | string>('All')
  const [assigneeFilter, setAssigneeFilter] = useState<'All' | 'unassigned' | string>('All')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  const tickets = useMemo(() => rawTickets.map(t => ({
    ...t,
    uiStatus: apiToUI[t.status] ?? 'Open',
    clientName: t.company?.name ?? '',
    contactName: t.contact?.name ?? '',
    overdue: isOverdue(t),
  })), [rawTickets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter(t => {
      if (filter !== 'All' && t.uiStatus !== filter) return false
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false
      if (projectFilter === 'none' && t.projectId) return false
      if (projectFilter !== 'All' && projectFilter !== 'none' && t.projectId !== projectFilter) return false
      if (assigneeFilter === 'unassigned' && t.assignedToId) return false
      if (assigneeFilter !== 'All' && assigneeFilter !== 'unassigned' && t.assignedToId !== assigneeFilter) return false
      if (overdueOnly && !t.overdue) return false
      if (q && !(
        t.title.toLowerCase().includes(q) ||
        (t.ticketNumber ?? '').toLowerCase().includes(q) ||
        t.clientName.toLowerCase().includes(q) ||
        (t.project?.title ?? '').toLowerCase().includes(q)
      )) return false
      return true
    })
  }, [tickets, filter, priorityFilter, categoryFilter, projectFilter, assigneeFilter, overdueOnly, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Header checkbox governs the visible page, not the whole filtered set, so
  // "select all" never silently picks up rows the user cannot see.
  const bulk = useBulkSelect(paginated.map(t => t.id))

  const activeFilterCount =
    (filter !== 'All' ? 1 : 0) + (priorityFilter !== 'All' ? 1 : 0) + (categoryFilter !== 'All' ? 1 : 0) +
    (projectFilter !== 'All' ? 1 : 0) + (assigneeFilter !== 'All' ? 1 : 0) + (overdueOnly ? 1 : 0) + (search ? 1 : 0)

  function resetFilters() {
    setFilter('All'); setPriorityFilter('All'); setCategoryFilter('All')
    setProjectFilter('All'); setAssigneeFilter('All'); setOverdueOnly(false); setSearch('')
    setPage(1)
  }

  // Company resolved from the typed client name — drives which projects and
  // installations may be attached, so a ticket can never point across accounts.
  const formCompanyId = accounts.find(a => a.name.toLowerCase() === form.client.trim().toLowerCase())?.id ?? ''
  const formProjects = projects.filter(p => p.companyId === formCompanyId)
  const formInstallations = installations.filter(
    i => i.companyId === formCompanyId && (!form.projectId || i.projectId === form.projectId),
  )

  function openCreate() {
    setEditId(null)
    setForm({ ...blankForm, client: accounts[0]?.name ?? '' })
    setErrors({}); setShowModal(true)
  }

  function openEdit(t: (typeof tickets)[0]) {
    setEditId(t.id)
    setForm({
      title: t.title,
      client: t.clientName,
      projectId: t.projectId ?? '',
      installationId: t.installationId ?? '',
      assignedToId: t.assignedToId ?? '',
      category: (t.category ?? '') as '' | TicketCategory,
      description: t.description ?? '',
      priority: t.priority,
      status: t.uiStatus,
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
    })
    setErrors({}); setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditId(null); setForm(blankForm); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Issue title is required'
    if (!form.client.trim()) e.client = 'Client is required'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    if (!formCompanyId) { setErrors({ client: 'Company not found — create it in Accounts first' }); return }
    const payload = {
      companyId: formCompanyId,
      title: form.title,
      description: form.description || undefined,
      projectId: form.projectId || null,
      installationId: form.installationId || null,
      assignedToId: form.assignedToId || null,
      category: form.category || null,
      priority: form.priority,
      status: uiToAPI[form.status],
      // Left blank on create, the server derives the due date from priority.
      ...(form.dueDate ? { dueDate: form.dueDate } : {}),
    }
    if (editId) await updateTicket.mutateAsync({ id: editId, ...payload })
    else await createTicket.mutateAsync(payload)
    closeModal()
  }

  async function handleDelete(id: string) {
    await deleteTicket.mutateAsync(id)
    setMenuOpen(null); setDeleteConfirm(null); setPage(1)
  }

  async function quickStatus(id: string, uiStatus: UIStatus) {
    await updateStatus.mutateAsync({ id, status: uiToAPI[uiStatus] })
    setMenuOpen(null)
  }

  async function quickAssign(id: string, assignedToId: string | null) {
    await assignTicket.mutateAsync({ id, assignedToId })
    setMenuOpen(null)
  }

  async function handleBulkDelete() {
    try {
      const res = await bulkDelete.mutateAsync(bulk.selectedIds)
      toast.success(`Archived ${res.deleted} ticket${res.deleted === 1 ? '' : 's'}`)
      bulk.clear()
      setPage(1)
    } catch {
      toast.error('Bulk delete failed')
    }
    setShowBulkDelete(false)
  }

  if (isLoading) return <Spinner />
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load support tickets" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={btnPrimary}>Retry</button>} />
  )

  const openCount = tickets.filter(t => t.uiStatus === 'Open').length
  const inProgressCount = tickets.filter(t => t.uiStatus === 'In Progress').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

      {/* KPI strip — the numbers that decide what an engineer works on next. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Kpi label="Open" value={openCount} color="#5D78FF" icon={LifeBuoy} />
        <Kpi label="In Progress" value={inProgressCount} color="#FF9B52" icon={RefreshCw} />
        <Kpi label="Overdue" value={stats?.overdue ?? 0} color="#FF5353" icon={Timer}
          hint={(stats?.overdue ?? 0) > 0 ? 'Past SLA due date' : 'All within SLA'} />
        <Kpi label="Unassigned" value={stats?.unassigned ?? 0} color="#8B5CF6" icon={UserPlus}
          hint={(stats?.unassigned ?? 0) > 0 ? 'Needs an owner' : 'All owned'} />
        <Kpi
          label="SLA Compliance"
          value={stats?.slaCompliancePct != null ? `${stats.slaCompliancePct}%` : '—'}
          color="#2BC155"
          icon={CheckCircle2}
          hint={stats?.slaCompliancePct == null
            ? 'Not enough resolved tickets yet'
            : `Based on ${stats.slaSampleSize} resolved`}
        />
        <Kpi
          label="Avg Resolution"
          value={stats?.avgResolutionHours != null
            ? (stats.avgResolutionHours >= 24 ? `${(stats.avgResolutionHours / 24).toFixed(1)}d` : `${stats.avgResolutionHours}h`)
            : '—'}
          color="#374557"
          icon={Timer}
          hint={stats?.avgResolutionHours == null ? 'No tickets resolved yet' : 'Open to resolved'}
        />
      </div>

      {/* Filter bar */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search ticket no, title, client, project…"
            style={{ ...inp(false), paddingLeft: 30 }} />
        </div>
        <select value={filter} onChange={e => { setFilter(e.target.value as any); setPage(1) }} style={selectStyle}>
          <option value="All">All statuses</option>
          {uiStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value as any); setPage(1) }} style={selectStyle}>
          <option value="All">All priorities</option>
          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value as any); setPage(1) }} style={selectStyle}>
          <option value="All">All categories</option>
          {TICKET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1) }} style={selectStyle}>
          <option value="All">All projects</option>
          <option value="none">No project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setPage(1) }} style={selectStyle}>
          <option value="All">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button onClick={() => { setOverdueOnly(v => !v); setPage(1) }}
          style={{ ...chipStyle, background: overdueOnly ? '#FFF3F3' : '#F4F5F9', color: overdueOnly ? '#FF5353' : '#8C8C8C', borderColor: overdueOnly ? '#FF5353' : 'transparent' }}>
          <Timer size={12} /> Overdue only
        </button>
        {activeFilterCount > 0 && (
          <button onClick={resetFilters} style={{ ...chipStyle, background: '#fff', color: '#5D78FF', borderColor: '#E8EDFF' }}>
            <Filter size={12} /> Clear ({activeFilterCount})
          </button>
        )}
        <button onClick={openCreate} style={{ ...btnPrimary, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {/* Table / cards */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 8 }}>
            <EmptyState
              icon={tickets.length === 0 ? LifeBuoy : Filter}
              title={tickets.length === 0 ? 'No support tickets yet' : 'No tickets match these filters'}
              subtitle={tickets.length === 0
                ? 'Raise a ticket against a project or installation to start tracking service work.'
                : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} exist, but none match the current filters.`}
              action={tickets.length === 0
                ? <button onClick={openCreate} style={btnPrimary}>New Ticket</button>
                : <button onClick={resetFilters} style={btnPrimary}>Clear filters</button>}
            />
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
            {paginated.map(t => {
              const sla = slaLabel(t)
              return (
                <div key={t.id} onClick={() => openEdit(t)} style={{ background: '#FAFBFF', borderRadius: 12, border: `1px solid ${t.overdue ? '#FFD9D9' : '#F0F1F5'}`, padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{t.title}</p>
                    <span style={{ ...pill, background: (priorityStyle[t.priority] ?? priorityStyle.Medium).bg, color: (priorityStyle[t.priority] ?? priorityStyle.Medium).color }}>{t.priority}</span>
                  </div>
                  <p style={{ fontSize: 10, color: '#B1B1BE' }}>
                    {t.ticketNumber ? `${t.ticketNumber} · ` : ''}{t.clientName}
                    {t.project ? ` · ${t.project.title}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ ...pill, background: statusStyle[t.uiStatus].bg, color: statusStyle[t.uiStatus].color }}>{t.uiStatus}</span>
                    {sla && <span style={{ fontSize: 10, fontWeight: 600, color: sla.color }}>{sla.text}</span>}
                    <span style={{ fontSize: 10, color: '#B1B1BE', marginLeft: 'auto' }}>{t.assignedTo?.name ?? 'Unassigned'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9', background: '#FAFBFF' }}>
                  <th style={{ padding: '10px 0 10px 16px', width: 32 }}>
                    <input type="checkbox" checked={bulk.allSelected}
                      ref={el => { if (el) el.indeterminate = bulk.someSelected }}
                      onChange={bulk.toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {['Ticket', 'Client', 'Project / Installation', 'Assignee', 'Priority', 'Status', 'SLA', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#B1B1BE', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((t, i) => {
                  const sla = slaLabel(t)
                  return (
                    <tr key={t.id} onClick={() => openEdit(t)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer', background: t.overdue ? '#FFFCFC' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                      onMouseLeave={e => (e.currentTarget.style.background = t.overdue ? '#FFFCFC' : 'transparent')}>
                      <td style={{ padding: '12px 0 12px 16px' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={bulk.isSelected(t.id)} onChange={() => bulk.toggle(t.id)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: (priorityStyle[t.priority] ?? priorityStyle.Medium).bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <LifeBuoy size={13} style={{ color: (priorityStyle[t.priority] ?? priorityStyle.Medium).color }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{t.title}</p>
                            <p style={{ fontSize: 10, color: '#B1B1BE' }}>
                              {t.ticketNumber ?? '—'}{t.category ? ` · ${t.category}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{t.clientName}</td>
                      <td style={{ padding: '12px 16px', fontSize: 11 }}>
                        {t.project ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FolderKanban size={12} style={{ color: '#5D78FF', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ color: '#374557' }}>{t.project.title}</p>
                              {t.installation && <p style={{ fontSize: 10, color: '#B1B1BE' }}>{t.installation.title}</p>}
                            </div>
                          </div>
                        ) : <span style={{ color: '#C4C4CF' }}>Not linked</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: t.assignedTo ? '#374557' : '#C4C4CF' }}>
                        {t.assignedTo?.name ?? 'Unassigned'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...pill, background: (priorityStyle[t.priority] ?? priorityStyle.Medium).bg, color: (priorityStyle[t.priority] ?? priorityStyle.Medium).color }}>{t.priority}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...pill, background: statusStyle[t.uiStatus].bg, color: statusStyle[t.uiStatus].color }}>{t.uiStatus}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: sla?.color ?? '#C4C4CF', whiteSpace: 'nowrap' }}>
                        {sla?.text ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        <RowMenu open={menuOpen === t.id} onOpenChange={o => setMenuOpen(o ? t.id : null)}>
                          <button onClick={() => { openEdit(t); setMenuOpen(null) }} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                          <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                          <button onClick={() => quickStatus(t.id, 'In Progress')} style={menuItem}><RefreshCw size={12} style={{ marginRight: 6 }} />Mark In Progress</button>
                          <button onClick={() => quickStatus(t.id, 'Resolved')} style={menuItem}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Mark Resolved</button>
                          <button onClick={() => quickStatus(t.id, 'Closed')} style={menuItem}><Lock size={12} style={{ marginRight: 6 }} />Close Ticket</button>
                          {t.assignedToId && (
                            <>
                              <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                              <button onClick={() => quickAssign(t.id, null)} style={menuItem}><UserPlus size={12} style={{ marginRight: 6 }} />Unassign</button>
                            </>
                          )}
                          <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                          <button onClick={() => { setDeleteConfirm(t.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                        </RowMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />}
      </div>

      <BulkActionBar count={bulk.count} entityLabel="tickets" onDelete={() => setShowBulkDelete(true)} onClear={bulk.clear} />

      {showBulkDelete && (
        <BulkDeleteDialog
          count={bulk.count}
          entityLabel="tickets"
          archive
          isPending={bulkDelete.isPending}
          onCancel={() => setShowBulkDelete(false)}
          onConfirm={handleBulkDelete}
        />
      )}

      {deleteConfirm && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Ticket?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>The ticket is archived and hidden from this list.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={btnGhost}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ ...btnPrimary, flex: 1, background: '#FF5353' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Ticket' : 'New Support Ticket'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Issue Title *" error={errors.title}>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. ASHP unit not heating" style={inp(!!errors.title)} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Client *" error={errors.client}>
                  {/* Changing client clears project/installation — they belong to the old company. */}
                  <input value={form.client}
                    onChange={e => setForm({ ...form, client: e.target.value, projectId: '', installationId: '' })}
                    list="ticket-accounts-list" placeholder="Company name" style={inp(!!errors.client)} />
                  <datalist id="ticket-accounts-list">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as TicketCategory | '' })} style={inp(false)}>
                    <option value="">— None —</option>
                    {TICKET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Project" hint={!formCompanyId ? 'Pick a client first' : formProjects.length === 0 ? 'No projects for this client' : undefined}>
                  <select value={form.projectId} disabled={formProjects.length === 0}
                    onChange={e => setForm({ ...form, projectId: e.target.value, installationId: '' })} style={inp(false)}>
                    <option value="">— Not linked —</option>
                    {formProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </Field>
                <Field label="Installation" hint={formInstallations.length === 0 ? 'None available' : undefined}>
                  <select value={form.installationId} disabled={formInstallations.length === 0}
                    onChange={e => setForm({ ...form, installationId: e.target.value })} style={inp(false)}>
                    <option value="">— Not linked —</option>
                    {formInstallations.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="Priority">
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TicketAPI['priority'] })} style={inp(false)}>
                    {priorities.map(p => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as UIStatus })} style={inp(false)}>
                    {uiStatuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Assignee">
                  <select value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })} style={inp(false)}>
                    <option value="">— Unassigned —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Due Date" hint={editId ? undefined : 'Leave blank to derive from priority'}>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={inp(false)} />
              </Field>

              <Field label="Description">
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue…" rows={4} style={{ ...inp(false), resize: 'vertical' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={closeModal} style={btnGhost}>Cancel</button>
              <button onClick={handleSave} disabled={createTicket.isPending || updateTicket.isPending} style={{ ...btnPrimary, flex: 1 }}>
                {(createTicket.isPending || updateTicket.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color, icon: Icon, hint }: {
  label: string; value: number | string; color: string
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>; hint?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 500 }}>{label}</p>
          <p style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          {hint && <p style={{ fontSize: 9, color: '#C4C4CF', marginTop: 2 }}>{hint}</p>}
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const pill: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }
const menuItem: React.CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }
const chipStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid transparent', cursor: 'pointer' }
const selectStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none', background: '#fff', cursor: 'pointer' }

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{error}</p>}
      {!error && hint && <p style={{ fontSize: 10, color: '#C4C4CF', marginTop: 3 }}>{hint}</p>}
    </div>
  )
}

function inp(hasError: boolean): React.CSSProperties {
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
