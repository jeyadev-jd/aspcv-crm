import { useState } from 'react'
import { Plus, X, Check, Clock, Upload, Trash2, CheckCircle2 } from 'lucide-react'
import { useTasks, useCreateTask, useSubmitTask, useCompleteTask, useDeleteTask, type Task } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'
import type React from 'react'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  Pending:    { bg: '#FFF5EE', color: '#FF9B52', label: 'Pending' },
  InProgress: { bg: '#E8EDFF', color: '#5D78FF', label: 'In Progress' },
  Submitted:  { bg: '#F3E8FF', color: '#A855F7', label: 'Submitted' },
  Done:       { bg: '#E7FAF0', color: '#2BC155', label: 'Done' },
  OnHold:     { bg: '#F4F5F9', color: '#8C8C8C', label: 'On Hold' },
}

/**
 * Reusable task list, keyed by an optional entity (project/lead/deal/installation/invoice/…).
 * Pass entityType+entityId to scope a task list to that record; omit both for the global page.
 */
export default function TaskPanel({ entityType, entityId, title = 'Tasks', compact }: {
  entityType?: string; entityId?: string; title?: string; compact?: boolean
}) {
  const can = useAuthStore(s => s.can)
  const me = useAuthStore(s => s.user)
  const { data: tasks = [], isLoading } = useTasks(entityType && entityId ? { entityType, entityId } : {})
  const { data: users = [] } = useUsers(can('hr_user', 'read_all'))
  const { data: departments = [] } = useDepartments()
  const createTask = useCreateTask()
  const submitTask = useSubmitTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', assigneeId: '', departmentId: '', startDate: '', dueDate: '' })
  const [submitFor, setSubmitFor] = useState<string | null>(null)
  const [submitUrl, setSubmitUrl] = useState('')

  const canCreate = can('task', 'create')
  const canEdit = can('task', 'edit')
  const canDelete = can('task', 'delete')

  async function add() {
    if (!form.title.trim()) { toast.error('Title required'); return }
    await createTask.mutateAsync({
      title: form.title.trim(), description: form.description || undefined,
      assigneeId: form.assigneeId || undefined, departmentId: form.departmentId || undefined,
      startDate: form.startDate || undefined, dueDate: form.dueDate || undefined,
      entityType, entityId,
    })
    setForm({ title: '', description: '', assigneeId: '', departmentId: '', startDate: '', dueDate: '' })
    setShowForm(false)
    toast.success('Task created')
  }

  async function doSubmit(id: string) {
    await submitTask.mutateAsync({ id, submissionUrl: submitUrl })
    setSubmitFor(null); setSubmitUrl('')
    toast.success('Submitted')
  }

  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', boxSizing: 'border-box', background: '#fff' }

  function dueTone(t: Task) {
    if (!t.dueDate || t.status === 'Done') return '#B1B1BE'
    return new Date(t.dueDate) < new Date() ? '#FF5353' : '#374557'
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: compact ? 14 : 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{title} <span style={{ color: '#B1B1BE', fontWeight: 500 }}>({tasks.length})</span></p>
        {canCreate && (
          <button onClick={() => setShowForm(s => !s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
            <Plus size={13} /> {showForm ? 'Cancel' : 'New Task'}
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#FAFBFF', borderRadius: 10, border: '1px solid #F0F1F5', padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title *" style={inp} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} style={{ ...inp, resize: 'vertical' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))} style={inp}>
              <option value="">Assign to user…</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} style={inp}>
              <option value="">Team / department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div><label style={{ fontSize: 10, color: '#B1B1BE' }}>Start</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 10, color: '#B1B1BE' }}>Due</label><input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inp} /></div>
          </div>
          <button onClick={add} disabled={createTask.isPending} style={{ padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
            {createTask.isPending ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      )}

      {isLoading ? <p style={{ fontSize: 12, color: '#B1B1BE' }}>Loading…</p>
        : tasks.length === 0 ? <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 16 }}>No tasks yet.</p>
        : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(t => {
            const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.Pending
            const mine = t.assigneeId === me?.id
            return (
              <div key={t.id} style={{ border: '1px solid #F0F1F5', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374557', textDecoration: t.status === 'Done' ? 'line-through' : 'none' }}>{t.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>{ss.label}</span>
                    </div>
                    {t.description && <p style={{ fontSize: 11, color: '#8A8FA8', marginTop: 3 }}>{t.description}</p>}
                    <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                      {t.assignee && <span style={{ fontSize: 11, color: '#5D78FF' }}>@{t.assignee.name}</span>}
                      {t.department && <span style={{ fontSize: 11, color: '#A855F7' }}>{t.department.name}</span>}
                      {t.dueDate && <span style={{ fontSize: 11, color: dueTone(t), display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{t.dueDate.slice(0, 10)}</span>}
                      {t.submissionUrl && <a href={t.submissionUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2BC155' }}>submission ↗</a>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {mine && t.status !== 'Done' && t.status !== 'Submitted' && (
                      <button title="Submit work" onClick={() => { setSubmitFor(t.id); setSubmitUrl(t.submissionUrl ?? '') }} style={{ border: 'none', background: '#F3E8FF', color: '#A855F7', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Upload size={11} />Submit</button>
                    )}
                    {canEdit && t.status !== 'Done' && (
                      <button title="Mark done" onClick={() => completeTask.mutate(t.id)} style={{ border: 'none', background: '#E7FAF0', color: '#2BC155', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><CheckCircle2 size={13} /></button>
                    )}
                    {canDelete && (
                      <button title="Delete" onClick={() => { if (confirm('Delete task?')) deleteTask.mutate(t.id) }} style={{ border: 'none', background: 'none', color: '#FF5353', cursor: 'pointer', padding: 4 }}><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
                {submitFor === t.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input value={submitUrl} onChange={e => setSubmitUrl(e.target.value)} placeholder="Paste submission link (file/doc URL)…" style={inp} />
                    <button onClick={() => doSubmit(t.id)} style={{ border: 'none', background: '#5D78FF', color: '#fff', borderRadius: 8, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Check size={13} /></button>
                    <button onClick={() => setSubmitFor(null)} style={{ border: 'none', background: '#F4F5F9', color: '#374557', borderRadius: 8, padding: '0 10px', cursor: 'pointer' }}><X size={13} /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
