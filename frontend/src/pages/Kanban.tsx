import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import {
  Plus, MessageSquare, Paperclip, MoreHorizontal, AlignLeft, X, Edit2, Trash2,
  ArrowRight, Check, Search, Tag, Users, ChevronDown, ChevronRight, Layers,
  AlertCircle, Clock, LayoutGrid, List, Settings, Flag
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar } from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = 'High' | 'Medium' | 'Low'

interface Member {
  id: string
  name: string
  initials: string
  color: string
}

interface Label {
  id: string
  name: string
  color: string
}

interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

interface KanbanCard {
  id: string
  title: string
  category: string
  description: string
  priority: Priority
  dueDate: string       // ISO YYYY-MM-DD or ''
  progress: number
  total: number
  color: string
  comments: number
  attachments: number
  assignees: string[]   // Member IDs
  labels: string[]      // Label IDs
  checklist: ChecklistItem[]
}

interface Column {
  id: string
  title: string
  color: string
  cards: KanbanCard[]
  wipLimit?: number
  collapsed?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PALETTE = ['#5D78FF', '#2BC155', '#FF9B52', '#FF5353', '#8B5CF6', '#FFAE00', '#EC4899', '#06B6D4']

const PRIORITY_STYLE: Record<Priority, { bg: string; color: string }> = {
  High:   { bg: '#FFEEEE', color: '#FF5353' },
  Medium: { bg: '#FFF5EE', color: '#FF9B52' },
  Low:    { bg: '#E7FAF0', color: '#2BC155' },
}

const INITIAL_MEMBERS: Member[] = [
  { id: 'm1', name: 'Arjun Mehta',    initials: 'AM', color: '#5D78FF' },
  { id: 'm2', name: 'Priya Singh',    initials: 'PS', color: '#FF9B52' },
  { id: 'm3', name: 'Rohit Kumar',    initials: 'RK', color: '#2BC155' },
  { id: 'm4', name: 'Sneha Iyer',     initials: 'SI', color: '#FF5353' },
  { id: 'm5', name: 'Vikram Nair',    initials: 'VN', color: '#8B5CF6' },
]

const INITIAL_LABELS: Label[] = [
  { id: 'l1', name: 'Design',    color: '#8B5CF6' },
  { id: 'l2', name: 'Dev',       color: '#5D78FF' },
  { id: 'l3', name: 'Marketing', color: '#FF9B52' },
  { id: 'l4', name: 'Bug',       color: '#FF5353' },
  { id: 'l5', name: 'Research',  color: '#2BC155' },
]

function mkCard(overrides: Partial<KanbanCard> & { id: string; title: string }): KanbanCard {
  return {
    category: '', description: '', priority: 'Medium', dueDate: '',
    progress: 0, total: 1, color: '#5D78FF', comments: 0, attachments: 0,
    assignees: [], labels: [], checklist: [],
    ...overrides,
  }
}

const INITIAL_COLUMNS: Column[] = [
  {
    id: 'todo', title: 'To Do', color: '#5D78FF', cards: [
      mkCard({ id: 'c1', title: 'Design new UI presentation', category: 'Website Development', progress: 7, total: 14, dueDate: '2026-08-24', comments: 2, attachments: 1, color: '#5D78FF', assignees: ['m1', 'm3'], labels: ['l1', 'l2'], priority: 'High', checklist: [{ id: 'ci1', text: 'Wireframes', done: true }, { id: 'ci2', text: 'Mockups', done: false }] }),
      mkCard({ id: 'c2', title: 'Add more UI/UX mockups', category: 'Pinterest Promotion', progress: 8, total: 16, dueDate: '2026-09-24', comments: 3, attachments: 2, color: '#2BC155', assignees: ['m2'], labels: ['l1'], priority: 'Medium' }),
      mkCard({ id: 'c3', title: 'Design few mobile screens', category: 'Dropbox Mobile App', progress: 3, total: 14, dueDate: '2026-01-24', comments: 0, attachments: 1, color: '#FF9B52', assignees: ['m4'], labels: ['l1', 'l2'], priority: 'Low' }),
    ],
  },
  {
    id: 'inprogress', title: 'In Progress', color: '#FF9B52', cards: [
      mkCard({ id: 'c4', title: 'Create a new wireframe', category: 'Website Development', progress: 6, total: 12, dueDate: '2026-05-27', comments: 4, attachments: 2, color: '#FF9B52', assignees: ['m1', 'm2', 'm5'], labels: ['l2'], priority: 'High' }),
      mkCard({ id: 'c5', title: 'Create a tweet and promote', category: 'Twitter Marketing', progress: 4, total: 8, dueDate: '2026-08-04', comments: 2, attachments: 1, color: '#5D78FF', assignees: ['m3'], labels: ['l3'], priority: 'Medium' }),
    ],
  },
  {
    id: 'done', title: 'Done', color: '#2BC155', cards: [
      mkCard({ id: 'c6', title: 'Add product to the market', category: 'Product Design', progress: 4, total: 4, dueDate: '2026-08-31', comments: 3, attachments: 1, color: '#2BC155', assignees: ['m2', 'm4'], labels: ['l3'], priority: 'Low' }),
      mkCard({ id: 'c7', title: 'Run and manage campaign', category: 'Adwords Campaign', progress: 6, total: 6, dueDate: '2026-11-27', comments: 2, attachments: 1, color: '#5D78FF', assignees: ['m1'], labels: ['l3'], priority: 'Medium' }),
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function dueMeta(iso: string): { color: string; bg: string; label: string } | null {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(iso); due.setHours(0, 0, 0, 0)
  const diff = (due.getTime() - today.getTime()) / 86400000
  if (diff < 0)  return { color: '#FF5353', bg: '#FFEEEE', label: `${Math.abs(Math.floor(diff))}d overdue` }
  if (diff === 0) return { color: '#FF9B52', bg: '#FFF5EE', label: 'Due today' }
  if (diff <= 3)  return { color: '#FFAE00', bg: '#FFFBEE', label: `${Math.ceil(diff)}d left` }
  return { color: '#6B7280', bg: '#F4F5F9', label: fmtDate(iso) }
}

function blankForm(): Omit<KanbanCard, 'id'> {
  return { title: '', category: '', description: '', priority: 'Medium', dueDate: '', progress: 0, total: 1, color: '#5D78FF', comments: 0, attachments: 0, assignees: [], labels: [], checklist: [] }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Avatar({ member, size = 22 }: { member: Member; size?: number }) {
  return (
    <div title={member.name} style={{ width: size, height: size, borderRadius: '50%', background: member.color, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {member.initials}
    </div>
  )
}

function AvatarStack({ memberIds, members, max = 3 }: { memberIds: string[]; members: Member[]; max?: number }) {
  const list = memberIds.map(id => members.find(m => m.id === id)).filter(Boolean) as Member[]
  if (!list.length) return null
  return (
    <div style={{ display: 'flex' }}>
      {list.slice(0, max).map((m, i) => (
        <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar member={m} size={20} />
        </div>
      ))}
      {list.length > max && (
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #fff', background: '#B1B1BE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', marginLeft: -6 }}>+{list.length - max}</div>
      )}
    </div>
  )
}

function LabelDots({ labelIds, labels }: { labelIds: string[]; labels: Label[] }) {
  const list = labelIds.map(id => labels.find(l => l.id === id)).filter(Boolean) as Label[]
  if (!list.length) return null
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {list.map(l => (
        <span key={l.id} title={l.name} style={{ display: 'inline-block', width: 28, height: 6, borderRadius: 3, background: l.color }} />
      ))}
    </div>
  )
}

const mItem: React.CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 5 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }

const sparkData = [{ v: 2 }, { v: 5 }, { v: 3 }, { v: 8 }, { v: 4 }, { v: 9 }, { v: 5 }]
const barData = [{ v: 3 }, { v: 6 }, { v: 4 }, { v: 8 }, { v: 5 }, { v: 9 }, { v: 4 }, { v: 7 }, { v: 6 }, { v: 8 }, { v: 5 }, { v: 10 }]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Kanban() {
  const isMobile = useIsMobile()

  // Core state
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS)
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS)
  const [labels, setLabels] = useState<Label[]>(INITIAL_LABELS)
  const [boardTitle, setBoardTitle] = useState('Project Board')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState('Project Board')

  // Filters / view
  const [searchQ, setSearchQ] = useState('')
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('')
  const [filterMember, setFilterMember] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [compactView, setCompactView] = useState(false)

  // Card modal
  const [cardModal, setCardModal] = useState<{ card: KanbanCard; colId: string } | null>(null)
  const [cardForm, setCardForm] = useState<Omit<KanbanCard, 'id'>>(blankForm())
  const [isNewCard, setIsNewCard] = useState(false)
  const [newCardColId, setNewCardColId] = useState('')

  // Quick-add
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')

  // Card menu
  const [menuCard, setMenuCard] = useState<{ cardId: string; colId: string; x: number; y: number } | null>(null)

  // Column ops
  const [renamingCol, setRenamingCol] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [addColMode, setAddColMode] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [deleteColConfirm, setDeleteColConfirm] = useState<string | null>(null)
  const [colSettings, setColSettings] = useState<string | null>(null)
  const [colSettingsWip, setColSettingsWip] = useState('')

  // Modals
  const [showMembers, setShowMembers] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#5D78FF')

  useEffect(() => {
    function close(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (!t.closest('[data-card-menu]') && !t.closest('[data-menu-trigger]')) setMenuCard(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // ── Drag ──────────────────────────────────────────────────────────────────

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const { source, destination } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    const srcCard = columns.find(c => c.id === source.droppableId)!.cards[source.index]
    setColumns(prev => prev.map(col => {
      if (col.id === source.droppableId && col.id === destination.droppableId) {
        const cards = [...col.cards]; cards.splice(source.index, 1); cards.splice(destination.index, 0, srcCard); return { ...col, cards }
      }
      if (col.id === source.droppableId) { const cards = [...col.cards]; cards.splice(source.index, 1); return { ...col, cards } }
      if (col.id === destination.droppableId) { const cards = [...col.cards]; cards.splice(destination.index, 0, srcCard); return { ...col, cards } }
      return col
    }))
  }

  // ── Card ops ──────────────────────────────────────────────────────────────

  function openNewCard(colId: string) {
    setIsNewCard(true); setNewCardColId(colId); setCardForm(blankForm())
    setCardModal({ card: { id: '', ...blankForm() }, colId })
  }

  function openEditCard(card: KanbanCard, colId: string) {
    setIsNewCard(false)
    setCardForm({ title: card.title, category: card.category, description: card.description, priority: card.priority, dueDate: card.dueDate, progress: card.progress, total: card.total, color: card.color, comments: card.comments, attachments: card.attachments, assignees: [...card.assignees], labels: [...card.labels], checklist: card.checklist.map(i => ({ ...i })) })
    setCardModal({ card, colId })
  }

  function saveCard() {
    if (!cardForm.title.trim()) return
    if (isNewCard) {
      const c: KanbanCard = { id: `c${Date.now()}`, ...cardForm }
      setColumns(prev => prev.map(col => col.id === newCardColId ? { ...col, cards: [...col.cards, c] } : col))
    } else if (cardModal) {
      setColumns(prev => prev.map(col => col.id === cardModal.colId ? { ...col, cards: col.cards.map(c => c.id === cardModal.card.id ? { ...c, ...cardForm } : c) } : col))
    }
    setCardModal(null)
  }

  function deleteCard(cardId: string, colId: string) {
    setColumns(prev => prev.map(col => col.id === colId ? { ...col, cards: col.cards.filter(c => c.id !== cardId) } : col))
    setMenuCard(null)
    if (cardModal?.card.id === cardId) setCardModal(null)
  }

  function moveCard(cardId: string, fromColId: string, toColId: string) {
    const card = columns.find(c => c.id === fromColId)!.cards.find(c => c.id === cardId)!
    setColumns(prev => prev.map(col => {
      if (col.id === fromColId) return { ...col, cards: col.cards.filter(c => c.id !== cardId) }
      if (col.id === toColId) return { ...col, cards: [...col.cards, card] }
      return col
    }))
    setMenuCard(null)
  }

  function quickAdd(colId: string) {
    if (!quickTitle.trim()) { setAddingTo(null); return }
    const c: KanbanCard = { id: `c${Date.now()}`, title: quickTitle, category: '', description: '', priority: 'Medium', dueDate: '', progress: 0, total: 1, color: '#5D78FF', comments: 0, attachments: 0, assignees: [], labels: [], checklist: [] }
    setColumns(prev => prev.map(col => col.id === colId ? { ...col, cards: [...col.cards, c] } : col))
    setQuickTitle(''); setAddingTo(null)
  }

  // ── Column ops ────────────────────────────────────────────────────────────

  function addColumn() {
    if (!newColTitle.trim()) { setAddColMode(false); return }
    setColumns(prev => [...prev, { id: `col${Date.now()}`, title: newColTitle.trim(), color: PALETTE[prev.length % PALETTE.length], cards: [] }])
    setNewColTitle(''); setAddColMode(false)
  }

  function renameColumn(colId: string) {
    if (!renameVal.trim()) { setRenamingCol(null); return }
    setColumns(prev => prev.map(col => col.id === colId ? { ...col, title: renameVal.trim() } : col))
    setRenamingCol(null)
  }

  function deleteColumn(colId: string) {
    setColumns(prev => prev.filter(col => col.id !== colId))
    setDeleteColConfirm(null)
  }

  function toggleCollapse(colId: string) {
    setColumns(prev => prev.map(col => col.id === colId ? { ...col, collapsed: !col.collapsed } : col))
  }

  function saveColSettings(colId: string, color: string) {
    const wip = parseInt(colSettingsWip) || undefined
    setColumns(prev => prev.map(col => col.id === colId ? { ...col, color, wipLimit: wip } : col))
    setColSettings(null)
  }

  // ── Members ───────────────────────────────────────────────────────────────

  function addMember() {
    const name = newMemberName.trim()
    if (!name) return
    const words = name.split(' ')
    const initials = (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
    const color = PALETTE[members.length % PALETTE.length]
    setMembers(prev => [...prev, { id: `m${Date.now()}`, name, initials, color }])
    setNewMemberName('')
  }

  function removeMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id))
    setColumns(prev => prev.map(col => ({ ...col, cards: col.cards.map(c => ({ ...c, assignees: c.assignees.filter(a => a !== id) })) })))
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  function addLabel() {
    const name = newLabelName.trim()
    if (!name) return
    setLabels(prev => [...prev, { id: `l${Date.now()}`, name, color: newLabelColor }])
    setNewLabelName('')
  }

  function removeLabel(id: string) {
    setLabels(prev => prev.filter(l => l.id !== id))
    setColumns(prev => prev.map(col => ({ ...col, cards: col.cards.map(c => ({ ...c, labels: c.labels.filter(l => l !== id) })) })))
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  function visibleCards(cards: KanbanCard[]) {
    return cards.filter(card => {
      if (searchQ && !card.title.toLowerCase().includes(searchQ.toLowerCase()) && !card.category.toLowerCase().includes(searchQ.toLowerCase())) return false
      if (filterPriority && card.priority !== filterPriority) return false
      if (filterMember && !card.assignees.includes(filterMember)) return false
      if (filterLabel && !card.labels.includes(filterLabel)) return false
      return true
    })
  }

  const activeFilters = [filterPriority, filterMember, filterLabel].filter(Boolean).length

  // ── Stats ─────────────────────────────────────────────────────────────────

  const allCards = columns.flatMap(c => c.cards)
  const totalCards = allCards.length
  const highCount = allCards.filter(c => c.priority === 'High').length
  const medCount = allCards.filter(c => c.priority === 'Medium').length
  const lowCount = allCards.filter(c => c.priority === 'Low').length
  const overdueCount = allCards.filter(c => c.dueDate && new Date(c.dueDate) < new Date()).length
  const doneCol = columns.find(c => c.id === 'done')
  const doneCount = doneCol?.cards.length ?? 0

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start' }}>

      {/* ── Left panel ── */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>

        {/* Board title */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 16px' }}>
          {editingTitle ? (
            <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onBlur={() => { setBoardTitle(titleVal.trim() || boardTitle); setEditingTitle(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { setBoardTitle(titleVal.trim() || boardTitle); setEditingTitle(false) } if (e.key === 'Escape') setEditingTitle(false) }}
              style={{ width: '100%', fontSize: 13, fontWeight: 700, color: '#374557', border: 'none', outline: 'none', background: 'transparent', boxSizing: 'border-box' }} />
          ) : (
            <div onClick={() => { setTitleVal(boardTitle); setEditingTitle(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Layers size={14} color="#5D78FF" />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374557', flex: 1 }}>{boardTitle}</p>
              <Edit2 size={11} color="#B1B1BE" />
            </div>
          )}
          <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4 }}>{totalCards} tasks · {columns.length} columns</p>
        </div>

        {/* Live stats */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 12 }}>Task Overview</p>
          {[
            { label: 'Total', value: totalCards, pct: 100, color: '#5D78FF' },
            { label: 'Done', value: doneCount, pct: totalCards ? (doneCount / totalCards) * 100 : 0, color: '#2BC155' },
            { label: 'Overdue', value: overdueCount, pct: totalCards ? (overdueCount / totalCards) * 100 : 0, color: '#FF5353' },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#374557' }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>{s.value}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: '#F4F5F9' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${s.pct}%`, background: s.color }} />
              </div>
            </div>
          ))}
          {/* Priority split */}
          <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4, marginBottom: 6 }}>By Priority</p>
          <div style={{ display: 'flex', gap: 0, height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ flex: highCount, background: '#FF5353' }} />
            <div style={{ flex: medCount, background: '#FF9B52' }} />
            <div style={{ flex: lowCount, background: '#2BC155' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {[{ label: 'H', count: highCount, color: '#FF5353' }, { label: 'M', count: medCount, color: '#FF9B52' }, { label: 'L', count: lowCount, color: '#2BC155' }].map(p => (
              <span key={p.label} style={{ fontSize: 10, color: p.color, fontWeight: 600 }}>{p.label} {p.count}</span>
            ))}
          </div>
        </div>

        {/* Sparkline */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Throughput</p>
          <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 10 }}>Week-over-week</p>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="kspk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5D78FF" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#5D78FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#5D78FF" fill="url(#kspk)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={40}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="v" fill="#5D78FF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Columns summary */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 10 }}>Columns</p>
          {columns.map(col => (
            <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#374557', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: col.wipLimit && col.cards.length >= col.wipLimit ? '#FF5353' : '#374557' }}>{col.cards.length}{col.wipLimit ? `/${col.wipLimit}` : ''}</span>
            </div>
          ))}
        </div>

        {/* Members */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>Members ({members.length})</p>
            <button onClick={() => setShowMembers(true)} style={{ fontSize: 10, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Manage</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {members.map(m => (
              <button key={m.id} onClick={() => setFilterMember(filterMember === m.id ? '' : m.id)}
                title={m.name}
                style={{ border: filterMember === m.id ? `2px solid ${m.color}` : '2px solid transparent', borderRadius: '50%', padding: 0, cursor: 'pointer', background: 'none' }}>
                <Avatar member={m} size={28} />
              </button>
            ))}
          </div>
          {filterMember && <button onClick={() => setFilterMember('')} style={{ marginTop: 6, fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}>Clear filter</button>}
        </div>

        {/* Labels */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>Labels</p>
            <button onClick={() => setShowLabels(true)} style={{ fontSize: 10, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Manage</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {labels.map(l => (
              <button key={l.id} onClick={() => setFilterLabel(filterLabel === l.id ? '' : l.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${filterLabel === l.id ? l.color : 'transparent'}`, background: filterLabel === l.id ? l.color + '18' : '#F4F5F9', cursor: 'pointer' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#374557' }}>{l.name}</span>
              </button>
            ))}
          </div>
          {filterLabel && <button onClick={() => setFilterLabel('')} style={{ marginTop: 6, fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}>Clear filter</button>}
        </div>
      </div>

      {/* ── Board ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Board toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 120 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE', pointerEvents: 'none' }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search tasks…"
              style={{ ...inp, paddingLeft: 30, fontSize: 11, height: 34 }} />
            {searchQ && <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={12} /></button>}
          </div>

          {/* Priority filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['', 'High', 'Medium', 'Low'] as (Priority | '')[]).map(p => {
              const style = p ? PRIORITY_STYLE[p] : null
              const active = filterPriority === p && p !== ''
              return (
                <button key={p || 'all'} onClick={() => setFilterPriority(p === filterPriority ? '' : p)}
                  style={{ padding: '5px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: `1.5px solid ${active ? style!.color : '#E8EAED'}`, background: active ? style!.bg : '#fff', color: active ? style!.color : '#9CA3AF', cursor: 'pointer' }}>
                  {p || 'All'}
                </button>
              )
            })}
          </div>

          {/* View toggle */}
          <button onClick={() => setCompactView(v => !v)} title={compactView ? 'Detailed view' : 'Compact view'}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1.5px solid #E8EAED', background: compactView ? '#EEF2FF' : '#fff', color: compactView ? '#5D78FF' : '#9CA3AF', cursor: 'pointer' }}>
            {compactView ? <List size={13} /> : <LayoutGrid size={13} />}
            {!isMobile && (compactView ? 'Compact' : 'Detailed')}
          </button>

          {activeFilters > 0 && (
            <button onClick={() => { setFilterPriority(''); setFilterMember(''); setFilterLabel('') }}
              style={{ padding: '5px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: '1.5px solid #FF5353', background: '#FFEEEE', color: '#FF5353', cursor: 'pointer' }}>
              Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Columns */}
        <div className="crm-board">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="crm-board-grid" style={{ gridTemplateColumns: `repeat(${columns.length + (addColMode ? 1 : 0)}, ${isMobile ? '280px' : '1fr'})`, gap: 14, alignItems: 'start' }}>
              {columns.map(col => {
                const visible = visibleCards(col.cards)
                const isOverWip = !!col.wipLimit && col.cards.length >= col.wipLimit
                return (
                  <div key={col.id} style={{ background: '#F4F5F9', borderRadius: 12 }}>
                    {/* Column header */}
                    <div style={{ padding: '10px 12px 8px', borderTop: `3px solid ${col.color}`, borderRadius: '12px 12px 0 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {/* Collapse toggle */}
                        <button onClick={() => toggleCollapse(col.id)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                          {col.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {renamingCol === col.id ? (
                          <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id); if (e.key === 'Escape') setRenamingCol(null) }}
                            onBlur={() => renameColumn(col.id)}
                            style={{ fontSize: 12, fontWeight: 600, color: '#374557', border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 0 }} />
                        ) : (
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</p>
                        )}

                        <span style={{ fontSize: 10, background: isOverWip ? '#FFEEEE' : '#E8EAED', color: isOverWip ? '#FF5353' : '#6B7280', borderRadius: 10, padding: '1px 6px', fontWeight: 600, flexShrink: 0 }}>
                          {col.cards.length}{col.wipLimit ? `/${col.wipLimit}` : ''}
                        </span>

                        <button data-menu-trigger onClick={e => { e.stopPropagation() }} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px', flexShrink: 0, display: 'flex' }}>
                          <MoreHorizontal size={13} onClick={() => setColSettings(colSettings === col.id ? null : col.id)} />
                        </button>
                      </div>

                      {isOverWip && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 9, color: '#FF5353', fontWeight: 600 }}>
                          <AlertCircle size={9} /> WIP limit reached
                        </div>
                      )}

                      {/* Column settings dropdown */}
                      {colSettings === col.id && (
                        <ColSettingsPanel
                          col={col} wipVal={colSettingsWip} setWipVal={setColSettingsWip}
                          onSave={color => saveColSettings(col.id, color)}
                          onRename={() => { setRenamingCol(col.id); setRenameVal(col.title); setColSettings(null) }}
                          onDelete={() => { setDeleteColConfirm(col.id); setColSettings(null) }}
                          onClose={() => setColSettings(null)}
                        />
                      )}
                    </div>

                    {/* Cards */}
                    {!col.collapsed && (
                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.droppableProps}
                            style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60, background: snapshot.isDraggingOver ? col.color + '15' : 'transparent', transition: 'background 0.15s', borderRadius: '0 0 12px 12px' }}>
                            {visible.map((card, index) => {
                              const due = dueMeta(card.dueDate)
                              const pri = PRIORITY_STYLE[card.priority]
                              const doneItems = card.checklist.filter(i => i.done).length
                              return (
                                <Draggable key={card.id} draggableId={card.id} index={index}>
                                  {(prov, snap) => (
                                    <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                                      onClick={() => openEditCard(card, col.id)}
                                      style={{
                                        ...prov.draggableProps.style,
                                        background: '#fff', borderRadius: 10,
                                        borderLeft: `3px solid ${card.color}`,
                                        border: `1px solid #F0F1F5`, borderLeftWidth: 3, borderLeftColor: card.color,
                                        padding: compactView ? '10px 12px' : 12,
                                        cursor: 'pointer',
                                        boxShadow: snap.isDragging ? '0 10px 30px rgba(0,0,0,0.14)' : '0 1px 4px rgba(0,0,0,0.04)',
                                        transform: snap.isDragging ? `${prov.draggableProps.style?.transform} rotate(1.5deg)` : prov.draggableProps.style?.transform,
                                      }}>

                                      {/* Label strips */}
                                      {!compactView && card.labels.length > 0 && (
                                        <div style={{ marginBottom: 7 }}>
                                          <LabelDots labelIds={card.labels} labels={labels} />
                                        </div>
                                      )}

                                      {/* Title row */}
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: compactView ? 0 : 4 }}>
                                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', lineHeight: 1.35, flex: 1 }}>{card.title}</p>
                                        <button data-menu-trigger
                                          onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuCard({ cardId: card.id, colId: col.id, x: r.left, y: r.bottom + 4 }) }}
                                          style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '0 1px' }}>
                                          <MoreHorizontal size={13} />
                                        </button>
                                      </div>

                                      {/* Category */}
                                      {!compactView && card.category && <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 8 }}>{card.category}</p>}

                                      {/* Compact view: priority + due in one line */}
                                      {compactView ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: pri.bg, color: pri.color }}>{card.priority[0]}</span>
                                          {due && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: due.bg, color: due.color, fontWeight: 600 }}>{due.label}</span>}
                                          {card.assignees.length > 0 && <div style={{ marginLeft: 'auto' }}><AvatarStack memberIds={card.assignees} members={members} max={2} /></div>}
                                        </div>
                                      ) : (
                                        <>
                                          {/* Priority badge */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: pri.bg, color: pri.color, textTransform: 'uppercase' }}>{card.priority}</span>
                                            <Flag size={9} color={pri.color} />
                                          </div>

                                          {/* Progress */}
                                          <div style={{ marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                              <span style={{ fontSize: 10, color: '#B1B1BE', display: 'flex', alignItems: 'center', gap: 3 }}><AlignLeft size={9} /> Progress</span>
                                              <span style={{ fontSize: 10, fontWeight: 600, color: '#374557' }}>{card.progress}/{card.total}</span>
                                            </div>
                                            <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                                              <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (card.progress / card.total) * 100)}%`, background: card.color }} />
                                            </div>
                                          </div>

                                          {/* Checklist mini */}
                                          {card.checklist.length > 0 && (
                                            <div style={{ marginBottom: 8 }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                <span style={{ fontSize: 10, color: '#B1B1BE', display: 'flex', alignItems: 'center', gap: 3 }}><Check size={9} /> Checklist</span>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: doneItems === card.checklist.length ? '#2BC155' : '#374557' }}>{doneItems}/{card.checklist.length}</span>
                                              </div>
                                              <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                                                <div style={{ height: '100%', borderRadius: 2, width: `${(doneItems / card.checklist.length) * 100}%`, background: '#2BC155' }} />
                                              </div>
                                            </div>
                                          )}

                                          {/* Footer */}
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            {due
                                              ? <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: due.bg, color: due.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                  <Clock size={9} />{due.label}
                                                </span>
                                              : <span />
                                            }
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <AvatarStack memberIds={card.assignees} members={members} />
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#B1B1BE' }}>
                                                {card.comments > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><MessageSquare size={9} />{card.comments}</span>}
                                                {card.attachments > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Paperclip size={9} />{card.attachments}</span>}
                                              </div>
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              )
                            })}
                            {provided.placeholder}

                            {/* Quick-add */}
                            {addingTo === col.id ? (
                              <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #E8EDFF' }}>
                                <input autoFocus value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') quickAdd(col.id); if (e.key === 'Escape') setAddingTo(null) }}
                                  placeholder="Task title..."
                                  style={{ width: '100%', fontSize: 12, color: '#374557', border: 'none', outline: 'none', background: 'transparent', marginBottom: 8, boxSizing: 'border-box' }} />
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => quickAdd(col.id)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
                                  <button onClick={() => openNewCard(col.id)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: '#EEF2FF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}>Full form</button>
                                  <button onClick={() => setAddingTo(null)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: 'transparent', color: '#B1B1BE', border: 'none', cursor: 'pointer' }}>✕</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => { setAddingTo(col.id); setQuickTitle('') }}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '7px 4px', fontSize: 11, fontWeight: 500, color: '#9CA3AF', background: 'none', border: '1.5px dashed #E0E3EE', borderRadius: 8, cursor: 'pointer' }}>
                                <Plus size={11} /> Add task
                              </button>
                            )}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                )
              })}

              {/* Add column */}
              {addColMode ? (
                <div style={{ background: '#F4F5F9', borderRadius: 12, padding: 14, minWidth: isMobile ? 220 : undefined }}>
                  <input autoFocus value={newColTitle} onChange={e => setNewColTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddColMode(false) }}
                    placeholder="Column name..."
                    style={{ width: '100%', fontSize: 13, fontWeight: 600, color: '#374557', border: 'none', outline: 'none', background: 'transparent', marginBottom: 10, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={addColumn} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Create</button>
                    <button onClick={() => setAddColMode(false)} style={{ padding: '5px 8px', borderRadius: 7, fontSize: 12, background: 'transparent', color: '#B1B1BE', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddColMode(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 18px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#9CA3AF', background: 'rgba(244,245,249,0.7)', border: '2px dashed #E0E3EE', cursor: 'pointer', whiteSpace: 'nowrap', minWidth: isMobile ? '140px' : undefined }}>
                  <Plus size={14} /> Add Column
                </button>
              )}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* ── Card context menu ── */}
      {menuCard && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 198 }} onClick={() => setMenuCard(null)} />
          <div data-card-menu style={{ position: 'fixed', top: menuCard.y, left: Math.min(menuCard.x, window.innerWidth - 200), zIndex: 199, background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 190 }}>
            <button onClick={() => { const col = columns.find(c => c.id === menuCard.colId); const card = col?.cards.find(c => c.id === menuCard.cardId); if (card) openEditCard(card, menuCard.colId); setMenuCard(null) }} style={mItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit card</button>
            <div style={{ borderTop: '1px solid #F4F5F9', margin: '2px 0', padding: '2px 0' }}>
              <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 12px', fontWeight: 600 }}>Move to</p>
              {columns.filter(c => c.id !== menuCard.colId).map(c => (
                <button key={c.id} onClick={() => moveCard(menuCard.cardId, menuCard.colId, c.id)} style={mItem}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, marginRight: 8 }} />{c.title}
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #F4F5F9', margin: '2px 0' }} />
            <button onClick={() => deleteCard(menuCard.cardId, menuCard.colId)} style={{ ...mItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
          </div>
        </>
      )}

      {/* ── Card modal ── */}
      {cardModal && (
        <CardModal
          isNew={isNewCard} form={cardForm} setForm={setCardForm}
          members={members} labels={labels} isMobile={isMobile}
          onSave={saveCard}
          onDelete={!isNewCard ? () => deleteCard(cardModal.card.id, cardModal.colId) : undefined}
          onClose={() => setCardModal(null)}
        />
      )}

      {/* ── Delete column confirm ── */}
      {deleteColConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 320 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 6 }}>Delete column?</p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
              {(columns.find(c => c.id === deleteColConfirm)?.cards.length ?? 0) > 0
                ? `${columns.find(c => c.id === deleteColConfirm)?.cards.length} card(s) will be deleted.`
                : 'Column is empty.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteColConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #E8EAED', background: '#fff', color: '#374557', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteColumn(deleteColConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Members modal ── */}
      {showMembers && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setShowMembers(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Board Members</p>
              <button onClick={() => setShowMembers(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F4F5F9' }}>
                  <Avatar member={m} size={32} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{m.name}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>{allCards.filter(c => c.assignees.includes(m.id)).length} tasks</p>
                  </div>
                  <button onClick={() => removeMember(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353' }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addMember() }}
                placeholder="Full name..."
                style={{ ...inp, flex: 1 }} />
              <button onClick={addMember} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Labels modal ── */}
      {showLabels && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setShowLabels(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 340, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Manage Labels</p>
              <button onClick={() => setShowLabels(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {labels.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F4F5F9' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#374557', flex: 1 }}>{l.name}</span>
                  <button onClick={() => removeLabel(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353' }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLabel() }} placeholder="Label name..." style={{ ...inp, flex: 1 }} />
              <input type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} style={{ width: 36, height: 34, padding: 2, border: '1px solid #F0F1F5', borderRadius: 8, cursor: 'pointer' }} />
              <button onClick={addLabel} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Column Settings Panel ────────────────────────────────────────────────────

function ColSettingsPanel({ col, wipVal, setWipVal, onSave, onRename, onDelete, onClose }: {
  col: Column; wipVal: string; setWipVal: (v: string) => void
  onSave: (color: string) => void; onRename: () => void; onDelete: () => void; onClose: () => void
}) {
  const [color, setColor] = useState(col.color)
  useEffect(() => { setWipVal(col.wipLimit ? String(col.wipLimit) : '') }, [col.id])

  return (
    <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 10, padding: 12, marginTop: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#374557', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Column Settings</p>
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 5 }}>Accent Color</p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: `2px solid ${color === c ? '#374557' : 'transparent'}`, cursor: 'pointer', flexShrink: 0 }} />
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>WIP Limit (0 = off)</p>
        <input type="number" min={0} value={wipVal} onChange={e => setWipVal(e.target.value)}
          style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button onClick={() => { onSave(color) }} style={{ padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
        <button onClick={onRename} style={{ padding: '5px 0', borderRadius: 7, fontSize: 11, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }}>Rename column</button>
        <button onClick={onDelete} style={{ padding: '5px 0', borderRadius: 7, fontSize: 11, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}>Delete column</button>
        <button onClick={onClose} style={{ padding: '5px 0', borderRadius: 7, fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Card Modal ───────────────────────────────────────────────────────────────

function CardModal({ isNew, form, setForm, members, labels, isMobile, onSave, onDelete, onClose }: {
  isNew: boolean; form: Omit<KanbanCard, 'id'>; setForm: React.Dispatch<React.SetStateAction<Omit<KanbanCard, 'id'>>>
  members: Member[]; labels: Label[]; isMobile: boolean
  onSave: () => void; onDelete?: () => void; onClose: () => void
}) {
  const [newCheckItem, setNewCheckItem] = useState('')

  function toggleAssignee(id: string) {
    setForm(f => ({ ...f, assignees: f.assignees.includes(id) ? f.assignees.filter(a => a !== id) : [...f.assignees, id] }))
  }

  function toggleLabel(id: string) {
    setForm(f => ({ ...f, labels: f.labels.includes(id) ? f.labels.filter(l => l !== id) : [...f.labels, id] }))
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setForm(f => ({ ...f, checklist: [...f.checklist, { id: `ci${Date.now()}`, text: newCheckItem.trim(), done: false }] }))
    setNewCheckItem('')
  }

  function toggleCheckItem(id: string) {
    setForm(f => ({ ...f, checklist: f.checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) }))
  }

  function removeCheckItem(id: string) {
    setForm(f => ({ ...f, checklist: f.checklist.filter(i => i.id !== id) }))
  }

  const doneItems = form.checklist.filter(i => i.done).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : 16, width: '100%', maxWidth: isMobile ? '100%' : 560, maxHeight: isMobile ? '92vh' : '88vh', display: 'flex', flexDirection: 'column', paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{isNew ? 'New Task' : 'Edit Task'}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={lbl}>Task Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" style={inp} />
          </div>

          {/* Category + Due date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Project or team" style={inp} />
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inp} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add details…" rows={2} style={{ ...inp, resize: 'none' }} />
          </div>

          {/* Priority */}
          <div>
            <label style={lbl}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['High', 'Medium', 'Low'] as Priority[]).map(p => {
                const ps = PRIORITY_STYLE[p]; const active = form.priority === p
                return <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${active ? ps.color : '#E8EAED'}`, background: active ? ps.bg : '#fff', color: active ? ps.color : '#9CA3AF', cursor: 'pointer' }}>{p}</button>
              })}
            </div>
          </div>

          {/* Progress */}
          <div>
            <label style={lbl}>Progress ({form.progress}/{form.total})</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={0} max={form.total} value={form.progress}
                onChange={e => setForm(f => ({ ...f, progress: Math.min(Number(e.target.value), f.total) }))} style={{ ...inp, width: 64 }} />
              <span style={{ color: '#B1B1BE', fontSize: 12 }}>of</span>
              <input type="number" min={1} value={form.total}
                onChange={e => setForm(f => ({ ...f, total: Math.max(1, Number(e.target.value)) }))} style={{ ...inp, width: 64 }} />
            </div>
            <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9', marginTop: 7 }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (form.progress / form.total) * 100)}%`, background: form.color }} />
            </div>
          </div>

          {/* Card color */}
          <div>
            <label style={lbl}>Card Color</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PALETTE.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? '#374557' : 'transparent'}`, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {form.color === c && <Check size={11} color="#fff" />}
                </button>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label style={lbl}>Assignees</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {members.map(m => {
                const active = form.assignees.includes(m.id)
                return (
                  <button key={m.id} onClick={() => toggleAssignee(m.id)} title={m.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${active ? m.color : '#E8EAED'}`, background: active ? m.color + '18' : '#fff', cursor: 'pointer' }}>
                    <Avatar member={m} size={18} />
                    <span style={{ fontSize: 11, color: active ? m.color : '#9CA3AF', fontWeight: active ? 600 : 400 }}>{m.name.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Labels */}
          <div>
            <label style={lbl}>Labels</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {labels.map(l => {
                const active = form.labels.includes(l.id)
                return (
                  <button key={l.id} onClick={() => toggleLabel(l.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${active ? l.color : '#E8EAED'}`, background: active ? l.color + '22' : '#fff', cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                    <span style={{ fontSize: 11, color: active ? l.color : '#9CA3AF', fontWeight: active ? 600 : 400 }}>{l.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label style={lbl}>Checklist {form.checklist.length > 0 && <span style={{ color: '#B1B1BE', fontWeight: 400 }}>({doneItems}/{form.checklist.length})</span>}</label>
            {form.checklist.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9', marginBottom: 8 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${form.checklist.length ? (doneItems / form.checklist.length) * 100 : 0}%`, background: '#2BC155' }} />
                </div>
                {form.checklist.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <button onClick={() => toggleCheckItem(item.id)}
                      style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${item.done ? '#2BC155' : '#E8EAED'}`, background: item.done ? '#2BC155' : '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {item.done && <Check size={9} color="#fff" />}
                    </button>
                    <span style={{ fontSize: 12, color: item.done ? '#B1B1BE' : '#374557', flex: 1, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                    <button onClick={() => removeCheckItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D5D5D5' }}><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCheckItem() }}
                placeholder="Add checklist item…" style={{ ...inp, flex: 1 }} />
              <button onClick={addCheckItem} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F1F5', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #E8EAED', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          {onDelete && (
            <button onClick={onDelete} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, border: 'none', background: '#FFEEEE', color: '#FF5353', cursor: 'pointer' }}><Trash2 size={14} /></button>
          )}
          <button onClick={onSave} style={{ flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{isNew ? 'Create Task' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}
