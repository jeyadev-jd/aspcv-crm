import { useState } from 'react'
import { useCurrency } from '@/lib/currencyContext'
import { MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, FolderOpen, Edit2, Trash2, CheckCircle2, Play, Pause, Loader2 } from 'lucide-react'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData } from '@/lib/crmDataContext'
import { useProjects, useCreateProject, useUpdateProject, useUpdateProjectStatus, useDeleteProject, STATUS_LABEL } from '@/hooks/useProjects'
import type { ProjectAPI } from '@/hooks/useProjects'

type UIStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed'

const statusStyle: Record<UIStatus, { bg: string; color: string }> = {
  Planning:   { bg: '#E8EDFF', color: '#5D78FF' },
  Active:     { bg: '#E7FAF0', color: '#2BC155' },
  'On Hold':  { bg: '#FFF5EE', color: '#FF9B52' },
  Completed:  { bg: '#F4F5F9', color: '#8C8C8C' },
}

const apiToUI: Record<ProjectAPI['status'], UIStatus> = {
  Planning: 'Planning', Active: 'Active', OnHold: 'On Hold', Completed: 'Completed'
}
const uiToAPI: Record<UIStatus, ProjectAPI['status']> = {
  Planning: 'Planning', Active: 'Active', 'On Hold': 'OnHold', Completed: 'Completed'
}

const uiStatuses: UIStatus[] = ['Planning', 'Active', 'On Hold', 'Completed']
const blankForm = { name: '', client: '', startDate: '', endDate: '', status: 'Planning' as UIStatus, budget: '', description: '' }
const PAGE_SIZE = 5

export default function Projects() {
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { accounts } = useCrmData()

  const { data: rawProjects = [], isLoading } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const updateStatus = useUpdateProjectStatus()
  const deleteProject = useDeleteProject()

  const [filter, setFilter] = useState<'All' | UIStatus>('All')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const projects = rawProjects.map(p => ({
    ...p,
    uiStatus: apiToUI[p.status],
    clientName: p.company?.name ?? '',
  }))

  const filtered = filter === 'All' ? projects : projects.filter(p => p.uiStatus === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)

  function openCreate() {
    setEditId(null)
    setForm({ ...blankForm, client: accounts[0]?.name ?? '' })
    setErrors({}); setShowModal(true)
  }

  function openEdit(proj: (typeof projects)[0]) {
    setEditId(proj.id)
    setForm({
      name: proj.title,
      client: proj.clientName,
      startDate: proj.startDate?.slice(0, 10) ?? '',
      endDate: proj.endDate?.slice(0, 10) ?? '',
      status: proj.uiStatus,
      budget: String(proj.budget ?? ''),
      description: proj.notes ?? '',
    })
    setErrors({}); setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditId(null); setForm(blankForm); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Project name required'
    if (!form.client.trim()) e.client = 'Client required'
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = 'End must be after start'
    if (form.budget && (isNaN(Number(form.budget)) || Number(form.budget) < 0)) e.budget = 'Valid budget required'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const matchedCompany = accounts.find(a => a.name.toLowerCase() === form.client.toLowerCase())
    if (!matchedCompany) { setErrors({ client: 'Company not found — create it in Accounts first' }); return }
    const payload = {
      companyId: matchedCompany.id,
      title: form.name,
      status: uiToAPI[form.status],
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budget: form.budget ? Number(form.budget) : undefined,
      notes: form.description || undefined,
    }
    if (editId) {
      await updateProject.mutateAsync({ id: editId, ...payload })
    } else {
      await createProject.mutateAsync(payload)
    }
    closeModal()
  }

  async function handleDelete(id: string) {
    await deleteProject.mutateAsync(id)
    setMenuOpen(null); setDeleteConfirm(null); setPage(1)
  }

  async function quickStatus(id: string, uiStatus: UIStatus) {
    await updateStatus.mutateAsync({ id, status: uiToAPI[uiStatus] })
    setMenuOpen(null)
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

      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>Total Budget</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#374557' }}>{symbol}{(totalBudget / 1000).toFixed(0)}k</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 12 }}>By Status</p>
          {uiStatuses.map(s => {
            const count = projects.filter(p => p.uiStatus === s).length
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, cursor: 'pointer' }} onClick={() => changeFilter(filter === s ? 'All' : s)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusStyle[s].color }} />
                  <p style={{ fontSize: 11, color: '#374557' }}>{s}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{count}</p>
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
            {uiStatuses.map(s => <button key={s} onClick={() => changeFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === s ? '#5D78FF' : '#F4F5F9', color: filter === s ? '#fff' : '#B1B1BE' }}>{s}</button>)}
          </div>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Plus size={14} /> New Project
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map(proj => (
                <div key={proj.id} onClick={() => openEdit(proj)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: statusStyle[proj.uiStatus].bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FolderOpen size={14} style={{ color: statusStyle[proj.uiStatus].color }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{proj.title}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{proj.clientName}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[proj.uiStatus].bg, color: statusStyle[proj.uiStatus].color }}>{proj.uiStatus}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Start</p><p style={{ fontSize: 11, color: '#374557' }}>{proj.startDate?.slice(0, 10) ?? '—'}</p></div>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Budget</p><p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{proj.budget ? `${symbol}${proj.budget.toLocaleString()}` : '—'}</p></div>
                  </div>
                </div>
              ))}
              {paginated.length === 0 && <p style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 24 }}>No projects found.</p>}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  {['Project', 'Client', 'Timeline', 'Budget', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((proj, i) => (
                  <tr key={proj.id} onClick={() => openEdit(proj)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: statusStyle[proj.uiStatus].bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FolderOpen size={14} style={{ color: statusStyle[proj.uiStatus].color }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{proj.title}</p>
                          <p style={{ fontSize: 10, color: '#B1B1BE' }}>{proj.notes ? proj.notes.substring(0, 40) + '…' : proj.deal?.title ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{proj.clientName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 10, color: '#374557' }}>{proj.startDate?.slice(0, 10) ?? '—'}</p>
                      <p style={{ fontSize: 10, color: '#B1B1BE' }}>→ {proj.endDate?.slice(0, 10) ?? '—'}</p>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#374557' }}>
                      {proj.budget ? `${symbol}${proj.budget.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[proj.uiStatus].bg, color: statusStyle[proj.uiStatus].color }}>{proj.uiStatus}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === proj.id ? null : proj.id) }} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen === proj.id && (
                          <div style={dropdownStyle}>
                            <button onClick={() => { openEdit(proj); setMenuOpen(null) }} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <button onClick={() => quickStatus(proj.id, 'Completed')} style={menuItem}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Mark Completed</button>
                            <button onClick={() => quickStatus(proj.id, 'Active')} style={menuItem}><Play size={12} style={{ marginRight: 6 }} />Mark Active</button>
                            <button onClick={() => quickStatus(proj.id, 'On Hold')} style={menuItem}><Pause size={12} style={{ marginRight: 6 }} />Mark On Hold</button>
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <button onClick={() => { setDeleteConfirm(proj.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No projects found.</td></tr>}
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

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Project?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
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
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Project' : 'New Project'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Project Name *" error={errors.name}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ASHP Installation Phase 2" style={inp(!!errors.name)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Client *" error={errors.client}>
                  <input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })}
                    list="proj-accounts-list" placeholder="Company name" style={inp(!!errors.client)} />
                  <datalist id="proj-accounts-list">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as UIStatus })} style={inp(false)}>
                    {uiStatuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Start Date">
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} style={inp(false)} />
                </Field>
                <Field label="End Date" error={errors.endDate}>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} style={inp(!!errors.endDate)} />
                </Field>
              </div>
              <Field label={`Budget (${symbol})`} error={errors.budget}>
                <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder="0" type="number" min="0" style={inp(!!errors.budget)} />
              </Field>
              <Field label="Notes">
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Project description or notes…" rows={3} style={{ ...inp(false), resize: 'vertical' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={createProject.isPending || updateProject.isPending} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {(createProject.isPending || updateProject.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const dropdownStyle: React.CSSProperties = { position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', borderRadius: 8, border: '1px solid #F0F1F5', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, overflow: 'hidden', padding: '4px 0' }
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
