import { useState } from 'react'
import { Plus, X, ChevronDown, ChevronUp, Trash2, MessageSquare } from 'lucide-react'
import { useDiscussions, useCreateDiscussion, useDeleteDiscussion, DISCUSSION_TYPES } from '@/hooks/useDiscussions'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'

// Stage categories per entity type
const DEAL_CATEGORIES = [
  { value: 'LeadIn',      label: 'Lead In',     color: '#5D78FF', bg: '#E8EDFF' },
  { value: 'Proposal',    label: 'Proposal',    color: '#FF9B52', bg: '#FFF5EE' },
  { value: 'Negotiation', label: 'Negotiation', color: '#F59E0B', bg: '#FFF8E0' },
  { value: 'OrderWon',    label: 'Closed Won',  color: '#2BC155', bg: '#E7FAF0' },
  { value: 'OrderLost',   label: 'Closed Lost', color: '#FF5353', bg: '#FFEEEE' },
  { value: 'General',     label: 'General',     color: '#8C8C8C', bg: '#F4F5F9' },
]

const LEAD_CATEGORIES = [
  { value: 'Enquiry',         label: 'Enquiry',          color: '#5D78FF', bg: '#E8EDFF' },
  { value: 'ProspectiveLead', label: 'Prospective Lead', color: '#FF9B52', bg: '#FFF5EE' },
  { value: 'ProjectHold',     label: 'Project Hold',     color: '#8B5CF6', bg: '#F3EEFF' },
  { value: 'Hibernated',      label: 'Hibernated',       color: '#8C8C8C', bg: '#F4F5F9' },
  { value: 'OrderWon',        label: 'Order Won',        color: '#2BC155', bg: '#E7FAF0' },
  { value: 'OrderLost',       label: 'Order Lost',       color: '#FF5353', bg: '#FFEEEE' },
  { value: 'General',         label: 'General',          color: '#8C8C8C', bg: '#F4F5F9' },
]

const blankForm = {
  type: 'VoiceCall' as string,
  category: '' as string,
  title: '',
  scheduledAt: '',
  summary: '',
  decisions: '',
  nextActions: '',
  participantContactIds: [] as string[],
}

interface Props {
  entityType: string
  entityId: string
  contacts?: { id: string; name: string; designation?: string }[]
  readOnly?: boolean
}

export default function DiscussionPanel({ entityType, entityId, contacts = [], readOnly = false }: Props) {
  const { data: discussions = [] } = useDiscussions(entityType, entityId)
  const createDiscussion = useCreateDiscussion()
  const deleteDiscussion = useDeleteDiscussion()
  const user = useAuthStore(s => s.user)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [filterCat, setFilterCat] = useState('')

  const categories = entityType === 'Deal' ? DEAL_CATEGORIES : LEAD_CATEGORIES

  async function handleCreate() {
    if (!form.title.trim()) { toast.error('Title required'); return }
    if (!form.category) { toast.error('Please select a stage tag'); return }
    if (form.scheduledAt && new Date(form.scheduledAt) > new Date()) {
      toast.error('Cannot schedule discussion for future date')
      return
    }
    await createDiscussion.mutateAsync({
      entityType, entityId,
      type: form.type,
      category: form.category,
      title: form.title.trim(),
      scheduledAt: form.scheduledAt || undefined,
      summary: form.summary || undefined,
      decisions: form.decisions || undefined,
      nextActions: form.nextActions || undefined,
      participantContactIds: form.participantContactIds,
    })
    toast.success('Discussion saved')
    setForm(blankForm)
    setShowForm(false)
  }

  function toggleContact(id: string) {
    setForm(f => ({
      ...f,
      participantContactIds: f.participantContactIds.includes(id)
        ? f.participantContactIds.filter(x => x !== id)
        : [...f.participantContactIds, id],
    }))
  }

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  const filtered = filterCat ? discussions.filter(d => d.category === filterCat) : discussions

  const canDelete = (discussionId: string) => {
    if (readOnly) return false
    const d = discussions.find(x => x.id === discussionId)
    if (!d) return false
    // own discussion or manager+
    const isOwn = d.participants?.some(p => p.userId === user?.id)
    const isAdmin = ['SuperAdmin', 'Manager', 'ProjectHead', 'BusinessHead'].includes(user?.role ?? '')
    return isOwn || isAdmin
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={14} style={{ color: '#5D78FF' }} /> Discussions ({discussions.length})
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Stage filter */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              style={{ padding: '5px 24px 5px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none', appearance: 'none', background: '#FAFBFF', cursor: 'pointer' }}
            >
              <option value="">All stages</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#B1B1BE' }} />
          </div>
          {!readOnly && (
            <button onClick={() => setShowForm(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={12} /> Add
            </button>
          )}
        </div>
      </div>

      {showForm && !readOnly && (
        <div style={{ background: '#F8F9FF', borderRadius: 10, border: '1px solid #E8EDFF', padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>New Discussion</p>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Stage Tag *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inpStyle, borderColor: !form.category ? '#FF9B52' : '#E8EDFF' }}>
                  <option value="">— Select stage —</option>
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inpStyle}>
                  {DISCUSSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title / subject *" style={inpStyle} />
            <div>
              <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>Discussion Date (past or present only)</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inpStyle} />
              <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 3 }}>Leave blank for today's date. Cannot schedule for future.</p>
            </div>
            <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Summary / notes…" rows={2} style={{ ...inpStyle, resize: 'vertical' }} />
            <textarea value={form.decisions} onChange={e => setForm(f => ({ ...f, decisions: e.target.value }))} placeholder="Decisions taken…" rows={2} style={{ ...inpStyle, resize: 'vertical' }} />
            <textarea value={form.nextActions} onChange={e => setForm(f => ({ ...f, nextActions: e.target.value }))} placeholder="Next actions / follow-up…" rows={2} style={{ ...inpStyle, resize: 'vertical' }} />
            {contacts.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: '#374557', marginBottom: 6 }}>Participants</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {contacts.map(c => (
                    <button key={c.id} onClick={() => toggleContact(c.id)}
                      style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, border: '1px solid', cursor: 'pointer', background: form.participantContactIds.includes(c.id) ? '#5D78FF' : '#fff', color: form.participantContactIds.includes(c.id) ? '#fff' : '#374557', borderColor: form.participantContactIds.includes(c.id) ? '#5D78FF' : '#E0E0E0' }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#374557', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreate} disabled={!form.title.trim() || !form.category || createDiscussion.isPending}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', background: (!form.title.trim() || !form.category) ? '#D1D5DB' : '#5D78FF', color: '#fff', cursor: 'pointer', opacity: createDiscussion.isPending ? 0.7 : 1 }}>
                {createDiscussion.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 && !showForm && (
        <p style={{ fontSize: 11, color: '#B1B1BE', textAlign: 'center', padding: '16px 0' }}>No discussions yet.{!readOnly && ' Click + Add to log one.'}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(d => {
          const typeInfo = DISCUSSION_TYPES.find(t => t.value === d.type)
          const catInfo = categories.find(c => c.value === d.category) ?? { color: '#8C8C8C', bg: '#F4F5F9', label: d.category ?? 'General' }
          const isOpen = expanded === d.id
          return (
            <div key={d.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : d.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: catInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: catInfo.color, flexShrink: 0 }}>
                    {typeInfo?.label?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{d.title}</p>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: catInfo.bg, color: catInfo.color, fontWeight: 600 }}>{catInfo.label}</span>
                    </div>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>{typeInfo?.label} · {fmtDate(d.scheduledAt || d.createdAt)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {d.participants.length > 0 && (
                    <span style={{ fontSize: 10, color: '#5D78FF', background: '#E8EDFF', padding: '2px 8px', borderRadius: 10 }}>
                      {d.participants.length} ppl
                    </span>
                  )}
                  {canDelete(d.id) && (
                    <button onClick={e => { e.stopPropagation(); deleteDiscussion.mutate({ id: d.id, entityType, entityId }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: 2 }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                  {isOpen ? <ChevronUp size={14} style={{ color: '#B1B1BE' }} /> : <ChevronDown size={14} style={{ color: '#B1B1BE' }} />}
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F4F5F9' }}>
                  {d.summary && <p style={{ fontSize: 11, color: '#374557', marginTop: 10 }}><strong>Summary:</strong> {d.summary}</p>}
                  {d.decisions && <p style={{ fontSize: 11, color: '#374557', marginTop: 6 }}><strong>Decisions:</strong> {d.decisions}</p>}
                  {d.nextActions && <p style={{ fontSize: 11, color: '#374557', marginTop: 6 }}><strong>Next actions:</strong> {d.nextActions}</p>}
                  {d.participants.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Participants</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {d.participants.map(p => (
                          <span key={p.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#F4F5F9', color: '#374557' }}>
                            {p.user?.name ?? p.contact?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const inpStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8EDFF',
  fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box',
}
