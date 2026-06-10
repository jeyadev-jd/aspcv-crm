import { useState } from 'react'
import { MessageSquare, Paperclip, AlignLeft, RefreshCw, Archive, Plus, ChevronDown, X, Check } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts'

interface Task {
  id: number
  title: string
  status: 'Done' | 'Pending' | 'On Hold'
  sub: [number, number]
  comments: number
  attachments: number
  checked: boolean
  dueDate?: string
}

const initTasks: Task[] = [
  { id: 1,  title: 'Budget and contract',   status: 'Done',     sub: [3, 3], comments: 0, attachments: 5, checked: true,  dueDate: '2026-05-10' },
  { id: 2,  title: 'Search for a UI kit',   status: 'Done',     sub: [2, 9], comments: 7, attachments: 3, checked: true,  dueDate: '2026-05-12' },
  { id: 3,  title: 'Design new dashboard',  status: 'Done',     sub: [3, 5], comments: 2, attachments: 2, checked: true,  dueDate: '2026-05-15' },
  { id: 4,  title: 'Design search page',    status: 'Pending',  sub: [4, 6], comments: 8, attachments: 6, checked: false, dueDate: '2026-05-28' },
  { id: 5,  title: 'Prepare HTML & CSS',    status: 'Pending',  sub: [0, 2], comments: 1, attachments: 1, checked: false, dueDate: '2026-06-01' },
  { id: 6,  title: 'Fix issues',            status: 'On Hold',  sub: [5, 9], comments: 2, attachments: 3, checked: false, dueDate: '2026-06-05' },
  { id: 7,  title: 'Budget and contract',   status: 'On Hold',  sub: [4, 4], comments: 3, attachments: 5, checked: false, dueDate: '2026-06-08' },
  { id: 8,  title: 'Search for a UI kit',   status: 'On Hold',  sub: [0, 1], comments: 9, attachments: 2, checked: false, dueDate: '2026-06-10' },
  { id: 9,  title: 'Search for a UI kit',   status: 'On Hold',  sub: [0, 1], comments: 1, attachments: 2, checked: false, dueDate: '2026-06-12' },
  { id: 10, title: 'Budget and contract',   status: 'On Hold',  sub: [4, 4], comments: 3, attachments: 5, checked: false, dueDate: '2026-06-15' },
]

const barData = [3, 5, 4, 7, 6, 9, 8, 5, 7, 6, 8, 5].map((v, i) => ({ v, i }))
const avatarColors = ['#5D78FF', '#FF9B52', '#2BC155', '#FF5353', '#8B5CF6']

const statusStyle: Record<string, { bg: string; color: string }> = {
  Done:      { bg: '#E7FAF0', color: '#2BC155' },
  Pending:   { bg: '#FFF5EE', color: '#FF9B52' },
  'On Hold': { bg: '#F4F5F9', color: '#8C8C8C' },
}

type SortKey = 'az' | 'za' | 'due' | 'status'
const SORT_OPTS: { key: SortKey; label: string }[] = [
  { key: 'az',     label: 'A → Z' },
  { key: 'za',     label: 'Z → A' },
  { key: 'due',    label: 'Due Date' },
  { key: 'status', label: 'Status' },
]

function sortTasks(tasks: Task[], key: SortKey): Task[] {
  return [...tasks].sort((a, b) => {
    if (key === 'az')     return a.title.localeCompare(b.title)
    if (key === 'za')     return b.title.localeCompare(a.title)
    if (key === 'due')    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
    if (key === 'status') {
      const order: Record<string, number> = { Done: 0, Pending: 1, 'On Hold': 2 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    }
    return 0
  })
}

export default function Tasks() {
  const isMobile = useIsMobile()
  const [tasks, setTasks]     = useState(initTasks)
  const [filter, setFilter]   = useState<'All' | 'Done' | 'Pending'>('All')
  const [inlineTask, setInlineTask] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('az')
  const [sortOpen, setSortOpen] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [mTitle, setMTitle]   = useState('')
  const [mStatus, setMStatus] = useState<Task['status']>('Pending')
  const [mDue, setMDue]       = useState('')
  const [mErr, setMErr]       = useState('')

  const base     = filter === 'All' ? tasks : tasks.filter(t => t.status === filter)
  const filtered = sortTasks(base, sortKey)
  const all      = tasks.length
  const pending  = tasks.filter(t => t.status === 'Pending').length
  const complete = tasks.filter(t => t.status === 'Done').length

  const toggle = (id: number) =>
    setTasks(p => p.map(t => t.id === id ? { ...t, checked: !t.checked } : t))

  const addInline = () => {
    if (!inlineTask.trim()) return
    setTasks(p => [...p, { id: Date.now(), title: inlineTask, status: 'Pending', sub: [0, 0], comments: 0, attachments: 0, checked: false }])
    setInlineTask('')
  }

  const openModal  = () => { setMTitle(''); setMStatus('Pending'); setMDue(''); setMErr(''); setModalOpen(true) }
  const closeModal = () => setModalOpen(false)
  const submitModal = () => {
    if (!mTitle.trim()) { setMErr('Task name is required'); return }
    setTasks(p => [...p, { id: Date.now(), title: mTitle.trim(), status: mStatus, sub: [0, 0], comments: 0, attachments: 0, checked: false, dueDate: mDue || undefined }])
    closeModal()
  }

  const filters: { label: 'All' | 'Done' | 'Pending'; dotColor?: string }[] = [
    { label: 'All' },
    { label: 'Done',    dotColor: '#2BC155' },
    { label: 'Pending', dotColor: '#FF9B52' },
  ]

  const currentSortLabel = SORT_OPTS.find(o => o.key === sortKey)?.label ?? 'A → Z'

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start', height: '100%' }}>

      {/* ── Left panel ── */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Tasks overview</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Overall tasks performance</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'All tasks', value: all,      icon: AlignLeft, color: '#5D78FF', bg: '#E8EDFF' },
              { label: 'Pending',   value: pending,   icon: RefreshCw, color: '#FF9B52', bg: '#FFF5EE' },
              { label: 'Complete',  value: complete,  icon: RefreshCw, color: '#2BC155', bg: '#E7FAF0' },
              { label: 'Archived',  value: 380,       icon: Archive,   color: '#B1B1BE', bg: '#F4F5F9' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#374557' }}>{label}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Conversion history</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 12 }}>Week to week performance</p>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={barData} barSize={7} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="i" hide />
              <Bar dataKey="v" fill="#5D78FF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Filter + sort */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {filters.map(f => (
              <button
                key={f.label}
                onClick={() => setFilter(f.label)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: filter === f.label ? '#5D78FF' : '#F4F5F9',
                  color: filter === f.label ? '#fff' : '#B1B1BE',
                  transition: 'all 0.15s',
                }}
              >
                {f.dotColor && <span style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${f.dotColor}`, display: 'inline-block', flexShrink: 0 }} />}
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSortOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: '#374557', background: '#fff',
                border: '1px solid #F0F1F5', borderRadius: 8,
                padding: '6px 12px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              <ChevronDown size={11} style={{ color: '#B1B1BE' }} />
              SORT: {currentSortLabel}
            </button>
            {sortOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 140,
                animation: 'slideUp 0.15s ease', overflow: 'hidden',
              }}>
                {SORT_OPTS.map(o => (
                  <div
                    key={o.key}
                    onClick={() => { setSortKey(o.key); setSortOpen(false) }}
                    style={{
                      padding: '9px 14px', fontSize: 12, cursor: 'pointer',
                      color: o.key === sortKey ? '#5D78FF' : '#374557',
                      fontWeight: o.key === sortKey ? 600 : 400,
                      background: o.key === sortKey ? '#F0F4FF' : 'transparent',
                      transition: 'background 0.1s',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                    onMouseEnter={e => { if (o.key !== sortKey) (e.currentTarget as HTMLElement).style.background = '#F8F9FB' }}
                    onMouseLeave={e => { if (o.key !== sortKey) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {o.label}
                    {o.key === sortKey && <Check size={11} style={{ color: '#5D78FF' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task list */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F4F5F9' }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid #E0E0E0', flexShrink: 0 }} />
            <input
              value={inlineTask}
              onChange={e => setInlineTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInline()}
              placeholder="Type task name and press Enter to add..."
              style={{ flex: 1, fontSize: 12, color: '#374557', background: 'transparent', border: 'none', outline: 'none' }}
            />
            {inlineTask.trim() && (
              <button onClick={addInline} style={{ fontSize: 11, fontWeight: 600, color: '#5D78FF', background: '#E8EDFF', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                Add
              </button>
            )}
          </div>

          {filtered.map((task, i) => (
            <div
              key={task.id}
              className="crm-tr-hover"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid #F4F5F9' : 'none',
              }}
            >
              <button
                onClick={() => toggle(task.id)}
                style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: task.checked ? 'none' : '2px solid #E0E0E0',
                  background: task.checked ? '#5D78FF' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                {task.checked && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <p style={{ flex: 1, fontSize: 12, color: task.checked ? '#B1B1BE' : '#374557', textDecoration: task.checked ? 'line-through' : 'none', transition: 'color 0.15s' }}>
                {task.title}
              </p>

              {task.dueDate && (
                <p style={{ fontSize: 10, color: '#B1B1BE', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#B1B1BE' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><AlignLeft size={11} />{task.sub[0]}/{task.sub[1]}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MessageSquare size={11} />{task.comments}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Paperclip size={11} />{task.attachments}</span>
              </div>

              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[task.status]?.bg, color: statusStyle[task.status]?.color, whiteSpace: 'nowrap' }}>
                {task.status}
              </span>

              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: avatarColors[task.id % avatarColors.length] }} />
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#B1B1BE' }}>No tasks match this filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={openModal}
        style={{
          position: 'fixed', bottom: 32, right: 32,
          width: 48, height: 48, borderRadius: '50%',
          background: '#5D78FF', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(93,120,255,0.45)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
      >
        <Plus size={20} />
      </button>

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          className="crm-modal-backdrop"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
        >
          <div className="crm-modal-card" style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Task</p>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Task Name *</label>
                <input
                  autoFocus
                  value={mTitle}
                  onChange={e => { setMTitle(e.target.value); setMErr('') }}
                  onKeyDown={e => e.key === 'Enter' && submitModal()}
                  placeholder="Enter task name..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${mErr ? '#FF5353' : '#F0F1F5'}`, fontSize: 13, color: '#374557', outline: 'none' }}
                />
                {mErr && <p style={{ fontSize: 11, color: '#FF5353', marginTop: 4 }}>{mErr}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Status</label>
                  <select
                    value={mStatus}
                    onChange={e => setMStatus(e.target.value as Task['status'])}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', background: '#fff' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 6 }}>Due Date</label>
                  <input
                    type="date"
                    value={mDue}
                    onChange={e => setMDue(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={closeModal} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#374557', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitModal} style={{ padding: '9px 24px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(93,120,255,0.3)' }}>
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
