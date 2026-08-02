import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Plus, X, Check, Clock, Upload, Trash2, CheckCircle2, Edit2, AlertTriangle, ClipboardCheck } from 'lucide-react'
import { useTasks, useCreateTask, useUpdateTask, useSubmitTask, useCompleteTask, useDeleteTask, type Task } from '@/hooks/useTasks'
import { useUsers, type CrmUser } from '@/hooks/useUsers'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import type React from 'react'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  Pending:    { bg: '#FFF5EE', color: '#FF9B52', label: 'Pending' },
  InProgress: { bg: '#E8EDFF', color: '#5D78FF', label: 'In Progress' },
  Submitted:  { bg: '#F3E8FF', color: '#A855F7', label: 'Submitted' },
  Done:       { bg: '#E7FAF0', color: '#2BC155', label: 'Done' },
  OnHold:     { bg: '#F4F5F9', color: '#8C8C8C', label: 'On Hold' },
}

const STATUS_FILTERS = ['Pending', 'InProgress', 'Submitted', 'Done', 'OnHold'] as const

// ─── Role hierarchy ───────────────────────────────────────────────────────────
// Managers and above can mark any task done with an optional note.
// Assignees (engineers / technicians) must provide a mandatory completion note.
const MANAGER_ROLES = new Set([
  'SuperAdmin', 'BusinessHead', 'ProjectHead', 'SalesHead', 'Manager',
])

// Single source of truth for the create/edit form initial & reset state.
const blankForm = {
  title: '', description: '', startDate: '', dueDate: '',
  assigneeIds: [] as string[], departmentIds: [] as string[],
  linkEntityType: '', linkEntityId: '',
}

// Date comparison is done as a string so "today" never flips red at UTC midnight
// for users ahead of UTC (e.g. IST users would see tasks overdue from 5:30 AM otherwise).
function dueTone(t: Task) {
  if (!t.dueDate || t.status === 'Done') return '#B1B1BE'
  return t.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) ? '#FF5353' : '#374557'
}

// ─── Completion Note Modal ────────────────────────────────────────────────────
// Shown whenever a task is being marked "Done".
// • Assignees (non-manager roles): the note field is REQUIRED — they must describe
//   what was done / how the task was completed before the button enables.
// • Managers / editors: the note is OPTIONAL — they can leave it blank and still save,
//   but the field is shown so they can add context if needed.
function CompletionNoteModal({
  task,
  isManager,
  isPending,
  onConfirm,
  onCancel,
}: {
  task: Task
  isManager: boolean
  isPending: boolean
  onConfirm: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState('')
  const noteRequired = !isManager  // assignees must fill this in
  const canSubmit = !noteRequired || note.trim().length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, padding: 24, width: 'min(440px, 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E7FAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClipboardCheck size={17} style={{ color: '#2BC155' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', margin: 0 }}>Mark Task as Done</p>
            <p style={{ fontSize: 12, color: '#8A8FA8', marginTop: 3 }}>{task.title}</p>
          </div>
          <button onClick={onCancel} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        {/* Role-context pill */}
        <div style={{ marginBottom: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: isManager ? '#E8EDFF' : '#FFF5EE',
            color: isManager ? '#5D78FF' : '#FF9B52',
          }}>
            {isManager ? '✓ Manager — completion note optional' : '⚠ Completion note required'}
          </span>
        </div>

        {/* Submission link reminder */}
        {task.submissionUrl && (
          <div style={{ background: '#F3E8FF', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#A855F7' }}>Submission on file:</span>
            <a href={task.submissionUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#A855F7', fontWeight: 600, wordBreak: 'break-all' }}>
              View ↗
            </a>
          </div>
        )}

        {/* Note textarea */}
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 5 }}>
            Completion description {noteRequired ? <span style={{ color: '#FF5353' }}>*</span> : <span style={{ color: '#B1B1BE' }}>(optional)</span>}
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={
              noteRequired
                ? 'Describe how you completed this task — what was done, any issues encountered, final outcome…'
                : 'Add a note about how this was completed (optional)…'
            }
            rows={4}
            autoFocus
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: `1.5px solid ${noteRequired && !note.trim() ? '#FFD0B0' : '#F0F1F5'}`,
              fontSize: 12, color: '#374557', resize: 'vertical',
              boxSizing: 'border-box', outline: 'none', background: '#FAFBFF',
              lineHeight: 1.6,
            }}
          />
          {noteRequired && !note.trim() && (
            <p style={{ fontSize: 10, color: '#FF9B52', marginTop: 3 }}>
              You must describe how the task was completed before marking it done.
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim())}
            disabled={!canSubmit || isPending}
            style={{
              flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600,
              border: 'none', background: canSubmit ? '#2BC155' : '#D1D5DB',
              color: '#fff', cursor: canSubmit && !isPending ? 'pointer' : 'default',
              opacity: isPending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <CheckCircle2 size={13} />
            {isPending ? 'Saving…' : 'Mark as Done'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Reusable task list, keyed by an optional entity (project/lead/deal/installation/invoice/…).
 * Pass entityType+entityId to scope a task list to that record; omit both for the global page.
 * Pass `mine` to scope the global page to the current user's assignments.
 */
export default function TaskPanel({ entityType, entityId, title = 'Tasks', compact, mine: mineOnly }: {
  entityType?: string; entityId?: string; title?: string; compact?: boolean; mine?: boolean
}) {
  const can = useAuthStore(s => s.can)
  const me = useAuthStore(s => s.user)
  const scoped = Boolean(entityType && entityId)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: tasks = [], isLoading, isError } = useTasks(
    scoped ? { entityType, entityId } : mineOnly ? { mine: true } : {}
  )
  const { data: users = [] } = useUsers(can('hr_user', 'read_all'))
  const { data: departments = [] } = useDepartments()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const submitTask = useSubmitTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [submitFor, setSubmitFor] = useState<string | null>(null)
  const [submitUrl, setSubmitUrl] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  // Task queued for completion — shows the CompletionNoteModal
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null)

  // The global Tasks page lets the creator attach a task to any record; inside a
  // Lead/Deal/Project panel the link is fixed to that record.
  const { data: linkOptions = [] } = useQuery<{ id: string; label: string }[]>({
    queryKey: ['task-link-options', form.linkEntityType],
    queryFn: async () => {
      const path = form.linkEntityType === 'Lead' ? '/leads'
        : form.linkEntityType === 'Deal' ? '/deals'
        : '/projects'
      const res = await api.get(path, { params: { pageSize: 200 } })
      const rows = res.data?.data ?? res.data ?? []
      return rows.map((r: { id: string; title?: string; name?: string }) => ({ id: r.id, label: r.title ?? r.name ?? r.id }))
    },
    enabled: !scoped && Boolean(form.linkEntityType),
    staleTime: 60_000,
  })

  function toggle(field: 'assigneeIds' | 'departmentIds', id: string) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id],
    }))
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
    border: `1px solid ${active ? '#5D78FF' : '#E0E0E0'}`,
    background: active ? '#5D78FF' : '#fff',
    color: active ? '#fff' : '#374557',
  })

  const canCreate = can('task', 'create')
  const canEdit = can('task', 'edit')
  const canDelete = can('task', 'delete')

  // Is the current user a manager or above? Managers can close any task with an optional note.
  // Assignees must provide a mandatory completion description.
  const isManager = Boolean(me?.roleName && MANAGER_ROLES.has(me.roleName))

  function openCreate() {
    setEditId(null); setForm(blankForm); setShowForm(true)
  }

  function openEdit(t: Task) {
    setEditId(t.id)
    setForm({
      title: t.title, description: t.description ?? '',
      startDate: t.startDate?.slice(0, 10) ?? '', dueDate: t.dueDate?.slice(0, 10) ?? '',
      assigneeIds: t.assignees?.length ? t.assignees.map(a => a.userId) : t.assigneeId ? [t.assigneeId] : [],
      departmentIds: t.departments?.length ? t.departments.map(d => d.departmentId) : t.departmentId ? [t.departmentId] : [],
      linkEntityType: '', linkEntityId: '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.title.trim()) { toast.error('Title required'); return }
    if (!scoped && !editId && form.linkEntityType && !form.linkEntityId) {
      toast.error(`Pick which ${form.linkEntityType.toLowerCase()} to link`); return
    }
    try {
      if (editId) {
        await updateTask.mutateAsync({
          id: editId, title: form.title.trim(), description: form.description || null,
          assigneeIds: form.assigneeIds, departmentIds: form.departmentIds,
          startDate: form.startDate || null, dueDate: form.dueDate || null,
        })
        toast.success('Task updated')
      } else {
        await createTask.mutateAsync({
          title: form.title.trim(), description: form.description || undefined,
          assigneeIds: form.assigneeIds, departmentIds: form.departmentIds,
          startDate: form.startDate || undefined, dueDate: form.dueDate || undefined,
          entityType: scoped ? entityType : (form.linkEntityType || undefined),
          entityId: scoped ? entityId : (form.linkEntityId || undefined),
        })
        toast.success('Task created')
      }
      setForm(blankForm)
      setEditId(null)
      setShowForm(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? `Failed to ${editId ? 'update' : 'create'} task`)
    }
  }

  async function doSubmit(id: string) {
    if (!submitUrl.trim()) { toast.error('Paste a submission link first'); return }
    try {
      await submitTask.mutateAsync({ id, submissionUrl: submitUrl.trim() })
      setSubmitFor(null); setSubmitUrl('')
      toast.success('Submitted')
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to submit task')
    }
  }

  // Opens the CompletionNoteModal — actual API call happens in handleComplete.
  function requestComplete(t: Task) {
    setCompleteTarget(t)
  }

  // Called by CompletionNoteModal once the user fills in the note and clicks confirm.
  async function handleComplete(note: string) {
    if (!completeTarget) return
    try {
      await completeTask.mutateAsync({ id: completeTarget.id, completionNote: note })
      toast.success('Task marked done')
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to mark task done')
    } finally {
      setCompleteTarget(null)
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    try {
      await deleteTask.mutateAsync(deleteConfirm)
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to delete task')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', boxSizing: 'border-box', background: '#fff' }

  const visibleTasks = tasks
    .filter(t => !statusFilter || t.status === statusFilter)
    .filter(t => !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: compact ? 14 : 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{title} <span style={{ color: '#B1B1BE', fontWeight: 500 }}>({tasks.length})</span></p>
        {canCreate && (
          <button onClick={() => (showForm ? setShowForm(false) : openCreate())} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
            <Plus size={13} /> {showForm ? 'Cancel' : 'New Task'}
          </button>
        )}
      </div>

      {/* Search + status filter */}
      {!showForm && tasks.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" style={{ ...inp, maxWidth: 200 }} />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button onClick={() => setStatusFilter(null)} style={chip(statusFilter === null)}>All</button>
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={chip(statusFilter === s)}>{STATUS_STYLE[s].label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Create / edit form */}
      {showForm && (
        <div style={{ background: '#FAFBFF', borderRadius: 10, border: '1px solid #F0F1F5', padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title *" style={inp} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} style={{ ...inp, resize: 'vertical' }} />
          <div>
            <label style={{ fontSize: 10, color: '#B1B1BE' }}>Assign to {form.assigneeIds.length > 0 && `(${form.assigneeIds.length})`}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4, maxHeight: 96, overflowY: 'auto' }}>
              {users.length === 0 && <span style={{ fontSize: 11, color: '#B1B1BE' }}>No users available</span>}
              {users.map((u: CrmUser) => (
                <button key={u.id} type="button" onClick={() => toggle('assigneeIds', u.id)} style={chip(form.assigneeIds.includes(u.id))}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: '#B1B1BE' }}>Departments {form.departmentIds.length > 0 && `(${form.departmentIds.length})`}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
              {departments.map(d => (
                <button key={d.id} type="button" onClick={() => toggle('departmentIds', d.id)} style={chip(form.departmentIds.includes(d.id))}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {!scoped && !editId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
              <select value={form.linkEntityType}
                onChange={e => setForm(f => ({ ...f, linkEntityType: e.target.value, linkEntityId: '' }))} style={inp}>
                <option value="">Not linked to a record</option>
                {['Lead', 'Deal', 'Project'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {form.linkEntityType && (
                <select value={form.linkEntityId} onChange={e => setForm(f => ({ ...f, linkEntityId: e.target.value }))} style={inp}>
                  <option value="">Select {form.linkEntityType.toLowerCase()}…</option>
                  {linkOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={{ fontSize: 10, color: '#B1B1BE' }}>Start</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 10, color: '#B1B1BE' }}>Due</label><input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inp} /></div>
          </div>
          <button onClick={save} disabled={createTask.isPending || updateTask.isPending} style={{ padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
            {createTask.isPending || updateTask.isPending ? 'Saving…' : editId ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      )}

      {/* Task list */}
      {isLoading ? <p style={{ fontSize: 12, color: '#B1B1BE' }}>Loading…</p>
        : isError ? (
          <p style={{ fontSize: 12, color: '#FF5353', textAlign: 'center', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> Failed to load tasks. Try refreshing.
          </p>
        )
        : visibleTasks.length === 0 ? (
          <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 16 }}>
            {tasks.length === 0 ? 'No tasks yet.' : 'No tasks match this filter.'}
          </p>
        )
        : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleTasks.map(t => {
            const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.Pending
            const isMine = t.assigneeId === me?.id || Boolean(t.assignees?.some(a => a.userId === me?.id))
            const completingThis = completeTask.isPending && (completeTask.variables as any)?.id === t.id
            const deletingThis = deleteTask.isPending && deleteTask.variables === t.id
            const busy = completingThis || deletingThis

            // Who can mark this done:
            // • Users with canEdit can always mark done (manager flow — note optional).
            // • The assignee themselves can also mark their own task done (must add a note).
            const canMarkDone = (canEdit || isMine) && t.status !== 'Done'

            return (
              <div key={t.id} style={{ border: `1.5px solid ${t.status === 'Done' ? '#E7FAF0' : '#F0F1F5'}`, borderRadius: 10, padding: '10px 12px', background: t.status === 'Done' ? '#FAFFFE' : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374557', textDecoration: t.status === 'Done' ? 'line-through' : 'none', opacity: t.status === 'Done' ? 0.6 : 1 }}>{t.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>{ss.label}</span>
                    </div>
                    {t.description && <p style={{ fontSize: 11, color: '#8A8FA8', marginTop: 3 }}>{t.description}</p>}

                    {/* Meta row: assignees, departments, entity link, due date, submission */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                      {(t.assignees?.length ? t.assignees.map(a => a.user) : t.assignee ? [t.assignee] : []).map(u => (
                        <span key={u.id} style={{ fontSize: 11, color: '#5D78FF' }}>@{u.name}</span>
                      ))}
                      {(t.departments?.length ? t.departments.map(d => d.department) : t.department ? [t.department] : []).map(d => (
                        <span key={d.id} style={{ fontSize: 11, color: '#A855F7' }}>{d.name}</span>
                      ))}
                      {!entityType && t.entityType && (
                        <span style={{ fontSize: 11, color: '#8A8B9F' }}>{t.entityType}</span>
                      )}
                      {t.dueDate && <span style={{ fontSize: 11, color: dueTone(t), display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{t.dueDate.slice(0, 10)}</span>}
                      {t.submissionUrl && <a href={t.submissionUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2BC155' }}>submission ↗</a>}
                    </div>

                    {/* ── Completion note (shown only when task is Done) ── */}
                    {t.status === 'Done' && (t.completionNote || t.completedBy) && (
                      <div style={{ marginTop: 8, background: '#F0FDF7', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid #2BC155' }}>
                        {t.completionNote && (
                          <p style={{ fontSize: 11, color: '#374557', lineHeight: 1.5, margin: 0 }}>
                            <span style={{ fontWeight: 600, color: '#2BC155' }}>Completed: </span>
                            {t.completionNote}
                          </p>
                        )}
                        {t.completedBy && (
                          <p style={{ fontSize: 10, color: '#8A8FA8', marginTop: 3, margin: 0 }}>
                            Closed by {t.completedBy}{t.completedAt ? ` · ${t.completedAt.slice(0, 10)}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {/* Submit: only the assignee, only when not yet submitted or done */}
                    {isMine && t.status !== 'Done' && t.status !== 'Submitted' && (
                      <button title="Submit work" onClick={() => { setSubmitFor(t.id); setSubmitUrl(t.submissionUrl ?? '') }}
                        style={{ border: 'none', background: '#F3E8FF', color: '#A855F7', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Upload size={11} />Submit
                      </button>
                    )}
                    {/* Edit: editors only */}
                    {canEdit && (
                      <button title="Edit task" onClick={() => openEdit(t)}
                        style={{ border: 'none', background: '#EEF2FF', color: '#5D78FF', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                        <Edit2 size={12} />
                      </button>
                    )}
                    {/* Mark Done: managers (canEdit) with optional note OR the assignee with required note */}
                    {canMarkDone && (
                      <button
                        title={isManager || canEdit ? 'Mark done (add completion note)' : 'Mark done — completion note required'}
                        disabled={busy}
                        onClick={() => requestComplete(t)}
                        style={{
                          border: 'none', background: '#E7FAF0', color: '#2BC155',
                          borderRadius: 6, padding: '4px 8px',
                          cursor: busy ? 'default' : 'pointer',
                          opacity: busy ? 0.6 : 1,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 size={13} />
                        {completingThis ? '…' : 'Done'}
                      </button>
                    )}
                    {/* Delete */}
                    {canDelete && (
                      <button title="Delete" disabled={busy} onClick={() => setDeleteConfirm(t.id)}
                        style={{ border: 'none', background: 'none', color: '#FF5353', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, padding: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline submit-URL row */}
                {submitFor === t.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input value={submitUrl} onChange={e => setSubmitUrl(e.target.value)} placeholder="Paste submission link (file/doc URL)…" style={inp} />
                    <button onClick={() => doSubmit(t.id)} disabled={submitTask.isPending}
                      style={{ border: 'none', background: '#5D78FF', color: '#fff', borderRadius: 8, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Check size={13} />
                    </button>
                    <button onClick={() => setSubmitFor(null)}
                      style={{ border: 'none', background: '#F4F5F9', color: '#374557', borderRadius: 8, padding: '0 10px', cursor: 'pointer' }}>
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Completion Note Modal ── */}
      {completeTarget && (
        <CompletionNoteModal
          task={completeTarget}
          isManager={isManager || canEdit}
          isPending={completeTask.isPending}
          onConfirm={handleComplete}
          onCancel={() => setCompleteTarget(null)}
        />
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete task?"
          isPending={deleteTask.isPending}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
