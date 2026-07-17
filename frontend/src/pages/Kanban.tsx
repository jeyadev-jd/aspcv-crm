import { useState, useEffect, useMemo } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import {
  Plus, MessageSquare, Paperclip, MoreHorizontal, AlignLeft, X, Edit2, Trash2,
  Search, ChevronDown, ChevronRight, Layers, AlertCircle, Clock, LayoutGrid, List, Flag, ChevronLeft as ChevronLeftIcon,
} from 'lucide-react'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useAuthStore } from '@/lib/authStore'
import { useUsers } from '@/hooks/useUsers'
import {
  useKanbanBoards, useCreateBoard, useArchiveBoard,
  useCreateColumn, useUpdateColumn, useDeleteColumn,
  useCreateCard, useUpdateCard, useMoveCard, useArchiveCard,
  useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  useCreateLabel, useDeleteLabel,
} from '@/hooks/useKanban'
import type { KanbanBoard, KanbanCard, KanbanColumn, KanbanPriority, CardInput } from '@/hooks/useKanban'

const PALETTE = ['#5D78FF', '#2BC155', '#FF9B52', '#FF5353', '#8B5CF6', '#FFAE00', '#EC4899', '#06B6D4']

const PRIORITY_STYLE: Record<KanbanPriority, { bg: string; color: string }> = {
  High:   { bg: '#FFEEEE', color: '#FF5353' },
  Medium: { bg: '#FFF5EE', color: '#FF9B52' },
  Low:    { bg: '#E7FAF0', color: '#2BC155' },
}

const mItem: React.CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#374557', display: 'block', marginBottom: 5 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }

function fmtDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function dueMeta(iso?: string | null): { color: string; bg: string; label: string } | null {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(iso); due.setHours(0, 0, 0, 0)
  const diff = (due.getTime() - today.getTime()) / 86400000
  if (diff < 0)  return { color: '#FF5353', bg: '#FFEEEE', label: `${Math.abs(Math.floor(diff))}d overdue` }
  if (diff === 0) return { color: '#FF9B52', bg: '#FFF5EE', label: 'Due today' }
  if (diff <= 3)  return { color: '#FFAE00', bg: '#FFFBEE', label: `${Math.ceil(diff)}d left` }
  return { color: '#6B7280', bg: '#F4F5F9', label: fmtDate(iso) }
}

interface Avatar { id: string; name: string; initials: string; color: string }
function avatarFor(id: string, name: string): Avatar {
  const words = name.split(' ')
  const initials = (words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')
  const idx = [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length
  return { id, name, initials: initials.toUpperCase(), color: PALETTE[idx] }
}

function Avatar({ av, size = 22 }: { av: Avatar; size?: number }) {
  return (
    <div title={av.name} style={{ width: size, height: size, borderRadius: '50%', background: av.color, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {av.initials}
    </div>
  )
}

function AvatarStack({ people, max = 3 }: { people: Avatar[]; max?: number }) {
  if (!people.length) return null
  return (
    <div style={{ display: 'flex' }}>
      {people.slice(0, max).map((a, i) => (
        <div key={a.id} style={{ marginLeft: i === 0 ? 0 : -6 }}><Avatar av={a} size={20} /></div>
      ))}
      {people.length > max && (
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #fff', background: '#B1B1BE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', marginLeft: -6 }}>+{people.length - max}</div>
      )}
    </div>
  )
}

export default function Kanban() {
  const isMobile = useIsMobile()
  const can = useAuthStore(s => s.can)
  const canCreate = can('kanban', 'create')
  const canEdit = can('kanban', 'edit')
  const canDelete = can('kanban', 'delete')

  const { data: boards, isLoading, isError, refetch } = useKanbanBoards()
  const { data: users = [] } = useUsers(can('hr_user', 'read_all'))
  const createBoard = useCreateBoard()
  const archiveBoard = useArchiveBoard()
  const createColumn = useCreateColumn()
  const updateColumn = useUpdateColumn()
  const deleteColumn = useDeleteColumn()
  const createCard = useCreateCard()
  const updateCard = useUpdateCard()
  const moveCard = useMoveCard()
  const archiveCard = useArchiveCard()
  const addChecklistItem = useAddChecklistItem()
  const updateChecklistItem = useUpdateChecklistItem()
  const deleteChecklistItem = useDeleteChecklistItem()
  const createLabel = useCreateLabel()
  const deleteLabel = useDeleteLabel()

  const people: Avatar[] = useMemo(() => users.map(u => avatarFor(u.id, u.name)), [users])

  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [filterPriority, setFilterPriority] = useState<KanbanPriority | ''>('')
  const [filterMember, setFilterMember] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [compactView, setCompactView] = useState(false)

  const [cardModal, setCardModal] = useState<{ card: KanbanCard | null; columnId: string } | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [menuCard, setMenuCard] = useState<{ card: KanbanCard; x: number; y: number } | null>(null)
  const [renamingCol, setRenamingCol] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [addColMode, setAddColMode] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [deleteColConfirm, setDeleteColConfirm] = useState<string | null>(null)
  const [deleteCardConfirm, setDeleteCardConfirm] = useState<string | null>(null)
  const [colSettings, setColSettings] = useState<string | null>(null)
  const [colSettingsWip, setColSettingsWip] = useState('')
  const [showNewBoard, setShowNewBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [showLabels, setShowLabels] = useState(false)
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

  const activeBoards = (boards ?? []).filter(b => !b.isArchived)
  const board: KanbanBoard | undefined = activeBoards.find(b => b.id === activeBoardId) ?? activeBoards[0]

  useEffect(() => {
    if (!activeBoardId && activeBoards.length) setActiveBoardId(activeBoards[0].id)
  }, [activeBoards.length])

  if (isLoading) return <Spinner label="Loading boards…" />
  if (isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Failed to load Kanban boards"
        subtitle="Something went wrong reaching the server."
        action={<button onClick={() => refetch()} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Retry</button>}
      />
    )
  }
  if (!activeBoards.length) {
    return (
      <>
        <EmptyState
          icon={Layers}
          title="No Kanban boards yet"
          subtitle="Create your first board to start tracking work."
          action={canCreate && (
            <button onClick={() => setShowNewBoard(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={14} /> New Board
            </button>
          )}
        />
        {showNewBoard && (
          <NewBoardModal
            value={newBoardName} onChange={setNewBoardName}
            onCancel={() => setShowNewBoard(false)}
            onCreate={async () => {
              if (!newBoardName.trim()) return
              const created = await createBoard.mutateAsync({ name: newBoardName.trim() })
              setActiveBoardId(created.id)
              setNewBoardName(''); setShowNewBoard(false)
            }}
            isPending={createBoard.isPending}
          />
        )}
      </>
    )
  }
  if (!board) return <Spinner label="Loading board…" />

  const columns = board.columns
  const labels = board.labels

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    moveCard.mutate({ id: draggableId, columnId: destination.droppableId, order: destination.index })
  }

  function visibleCards(cards: KanbanCard[]) {
    return cards.filter(card => {
      if (searchQ && !card.title.toLowerCase().includes(searchQ.toLowerCase())) return false
      if (filterPriority && card.priority !== filterPriority) return false
      if (filterMember && !card.assignees.some(a => a.userId === filterMember)) return false
      if (filterLabel && !card.labels.some(l => l.labelId === filterLabel)) return false
      return true
    })
  }

  const activeFilters = [filterPriority, filterMember, filterLabel].filter(Boolean).length
  const allCards = columns.flatMap(c => c.cards)
  const totalCards = allCards.length
  const highCount = allCards.filter(c => c.priority === 'High').length
  const medCount = allCards.filter(c => c.priority === 'Medium').length
  const lowCount = allCards.filter(c => c.priority === 'Low').length
  const overdueCount = allCards.filter(c => c.dueDate && new Date(c.dueDate) < new Date()).length
  const doneCount = columns.filter(c => c.isDoneColumn).reduce((s, c) => s + c.cards.length, 0)

  async function quickAdd(columnId: string) {
    if (!quickTitle.trim()) { setAddingTo(null); return }
    await createCard.mutateAsync({ columnId, title: quickTitle.trim() })
    setQuickTitle(''); setAddingTo(null)
  }

  async function addColumn() {
    if (!newColTitle.trim() || !board) { setAddColMode(false); return }
    await createColumn.mutateAsync({ boardId: board.id, title: newColTitle.trim(), color: PALETTE[columns.length % PALETTE.length] })
    setNewColTitle(''); setAddColMode(false)
  }

  async function renameColumn(columnId: string) {
    if (!renameVal.trim()) { setRenamingCol(null); return }
    await updateColumn.mutateAsync({ id: columnId, title: renameVal.trim() })
    setRenamingCol(null)
  }

  async function saveColSettings(columnId: string, color: string) {
    const wip = colSettingsWip ? parseInt(colSettingsWip) : null
    await updateColumn.mutateAsync({ id: columnId, color, wipLimit: wip })
    setColSettings(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start' }}>
      {/* ── Left panel ── */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>

        {/* Board selector */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Layers size={14} color="#5D78FF" />
            <select value={board.id} onChange={e => setActiveBoardId(e.target.value)} style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#374557', border: 'none', outline: 'none', background: 'transparent' }}>
              {activeBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {canCreate && (
              <button onClick={() => setShowNewBoard(true)} title="New board" style={{ color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><Plus size={14} /></button>
            )}
          </div>
          <p style={{ fontSize: 10, color: '#B1B1BE' }}>{totalCards} tasks · {columns.length} columns</p>
          {canDelete && !board.isDefault && (
            <button onClick={() => archiveBoard.mutate(board.id)} style={{ marginTop: 6, fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Archive board</button>
          )}
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
          <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4, marginBottom: 6 }}>By Priority</p>
          <div style={{ display: 'flex', gap: 0, height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ flex: highCount || 0.001, background: '#FF5353' }} />
            <div style={{ flex: medCount || 0.001, background: '#FF9B52' }} />
            <div style={{ flex: lowCount || 0.001, background: '#2BC155' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {[{ label: 'H', count: highCount, color: '#FF5353' }, { label: 'M', count: medCount, color: '#FF9B52' }, { label: 'L', count: lowCount, color: '#2BC155' }].map(p => (
              <span key={p.label} style={{ fontSize: 10, color: p.color, fontWeight: 600 }}>{p.label} {p.count}</span>
            ))}
          </div>
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
          <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 10 }}>Members ({people.length})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {people.map(a => (
              <button key={a.id} onClick={() => setFilterMember(filterMember === a.id ? '' : a.id)}
                title={a.name}
                style={{ border: filterMember === a.id ? `2px solid ${a.color}` : '2px solid transparent', borderRadius: '50%', padding: 0, cursor: 'pointer', background: 'none' }}>
                <Avatar av={a} size={28} />
              </button>
            ))}
          </div>
          {filterMember && <button onClick={() => setFilterMember('')} style={{ marginTop: 6, fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}>Clear filter</button>}
        </div>

        {/* Labels */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>Labels</p>
            {canEdit && <button onClick={() => setShowLabels(true)} style={{ fontSize: 10, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Manage</button>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {labels.map(l => (
              <button key={l.id} onClick={() => setFilterLabel(filterLabel === l.id ? '' : l.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${filterLabel === l.id ? l.color : 'transparent'}`, background: filterLabel === l.id ? l.color + '18' : '#F4F5F9', cursor: 'pointer' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#374557' }}>{l.name}</span>
              </button>
            ))}
            {labels.length === 0 && <p style={{ fontSize: 10, color: '#B1B1BE' }}>No labels yet.</p>}
          </div>
          {filterLabel && <button onClick={() => setFilterLabel('')} style={{ marginTop: 6, fontSize: 10, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}>Clear filter</button>}
        </div>
      </div>

      {/* ── Board ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 120 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE', pointerEvents: 'none' }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search tasks…"
              style={{ ...inp, paddingLeft: 30, fontSize: 11, height: 34 }} />
            {searchQ && <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={12} /></button>}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {(['', 'High', 'Medium', 'Low'] as (KanbanPriority | '')[]).map(p => {
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

        <div className="crm-board">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="crm-board-grid" style={{ gridTemplateColumns: `repeat(${columns.length + (addColMode ? 1 : 0)}, ${isMobile ? '280px' : '1fr'})`, gap: 14, alignItems: 'start' }}>
              {columns.map(col => {
                const visible = visibleCards(col.cards)
                const isOverWip = !!col.wipLimit && col.cards.length >= col.wipLimit
                return (
                  <div key={col.id} style={{ background: '#F4F5F9', borderRadius: 12 }}>
                    <div style={{ padding: '10px 12px 8px', borderTop: `3px solid ${col.color}`, borderRadius: '12px 12px 0 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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
                        {canEdit && (
                          <button data-menu-trigger onClick={() => setColSettings(colSettings === col.id ? null : col.id)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px', flexShrink: 0, display: 'flex' }}>
                            <MoreHorizontal size={13} />
                          </button>
                        )}
                      </div>
                      {isOverWip && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 9, color: '#FF5353', fontWeight: 600 }}>
                          <AlertCircle size={9} /> WIP limit reached
                        </div>
                      )}
                      {colSettings === col.id && (
                        <ColSettingsPanel
                          col={col} wipVal={colSettingsWip} setWipVal={setColSettingsWip}
                          onSave={color => saveColSettings(col.id, color)}
                          onRename={() => { setRenamingCol(col.id); setRenameVal(col.title); setColSettings(null) }}
                          onDelete={() => { setDeleteColConfirm(col.id); setColSettings(null) }}
                          canDelete={canDelete}
                        />
                      )}
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}
                          style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60, background: snapshot.isDraggingOver ? col.color + '15' : 'transparent', transition: 'background 0.15s', borderRadius: '0 0 12px 12px' }}>
                          {visible.map((card, index) => {
                            const due = dueMeta(card.dueDate)
                            const pri = PRIORITY_STYLE[card.priority]
                            const doneItems = card.checklist.filter(i => i.done).length
                            const assigneeAvatars = card.assignees.map(a => avatarFor(a.userId, a.user.name))
                            return (
                              <Draggable key={card.id} draggableId={card.id} index={index} isDragDisabled={!canEdit}>
                                {(prov, snap) => (
                                  <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                                    onClick={() => setCardModal({ card, columnId: col.id })}
                                    style={{
                                      ...prov.draggableProps.style,
                                      background: '#fff', borderRadius: 10,
                                      border: `1px solid #F0F1F5`, borderLeftWidth: 3, borderLeftColor: card.color,
                                      padding: compactView ? '10px 12px' : 12,
                                      cursor: 'pointer',
                                      boxShadow: snap.isDragging ? '0 10px 30px rgba(0,0,0,0.14)' : '0 1px 4px rgba(0,0,0,0.04)',
                                    }}>
                                    {!compactView && card.labels.length > 0 && (
                                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 7 }}>
                                        {card.labels.map(cl => <span key={cl.id} title={cl.label.name} style={{ display: 'inline-block', width: 28, height: 6, borderRadius: 3, background: cl.label.color }} />)}
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: compactView ? 0 : 4 }}>
                                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', lineHeight: 1.35, flex: 1 }}>{card.title}</p>
                                      <button data-menu-trigger
                                        onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuCard({ card, x: r.left, y: r.bottom + 4 }) }}
                                        style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '0 1px' }}>
                                        <MoreHorizontal size={13} />
                                      </button>
                                    </div>
                                    {compactView ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: pri.bg, color: pri.color }}>{card.priority[0]}</span>
                                        {due && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: due.bg, color: due.color, fontWeight: 600 }}>{due.label}</span>}
                                        {assigneeAvatars.length > 0 && <div style={{ marginLeft: 'auto' }}><AvatarStack people={assigneeAvatars} max={2} /></div>}
                                      </div>
                                    ) : (
                                      <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: pri.bg, color: pri.color, textTransform: 'uppercase' }}>{card.priority}</span>
                                          <Flag size={9} color={pri.color} />
                                        </div>
                                        <div style={{ marginBottom: 8 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                            <span style={{ fontSize: 10, color: '#B1B1BE', display: 'flex', alignItems: 'center', gap: 3 }}><AlignLeft size={9} /> Progress</span>
                                            <span style={{ fontSize: 10, fontWeight: 600, color: '#374557' }}>{card.progress}/{card.total}</span>
                                          </div>
                                          <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                                            <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (card.progress / card.total) * 100)}%`, background: card.color }} />
                                          </div>
                                        </div>
                                        {card.checklist.length > 0 && (
                                          <div style={{ marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                              <span style={{ fontSize: 10, color: '#B1B1BE' }}>Checklist</span>
                                              <span style={{ fontSize: 10, fontWeight: 600, color: doneItems === card.checklist.length ? '#2BC155' : '#374557' }}>{doneItems}/{card.checklist.length}</span>
                                            </div>
                                            <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                                              <div style={{ height: '100%', borderRadius: 2, width: `${(doneItems / card.checklist.length) * 100}%`, background: '#2BC155' }} />
                                            </div>
                                          </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          {due
                                            ? <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: due.bg, color: due.color, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />{due.label}</span>
                                            : <span />}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AvatarStack people={assigneeAvatars} />
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

                          {addingTo === col.id ? (
                            <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #E8EDFF' }}>
                              <input autoFocus value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') quickAdd(col.id); if (e.key === 'Escape') setAddingTo(null) }}
                                placeholder="Task title..."
                                style={{ width: '100%', fontSize: 12, color: '#374557', border: 'none', outline: 'none', background: 'transparent', marginBottom: 8, boxSizing: 'border-box' }} />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => quickAdd(col.id)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
                                <button onClick={() => { setCardModal({ card: null, columnId: col.id }); setAddingTo(null) }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: '#EEF2FF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}>Full form</button>
                                <button onClick={() => setAddingTo(null)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: 'transparent', color: '#B1B1BE', border: 'none', cursor: 'pointer' }}>✕</button>
                              </div>
                            </div>
                          ) : canCreate ? (
                            <button onClick={() => { setAddingTo(col.id); setQuickTitle('') }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '7px 4px', fontSize: 11, fontWeight: 500, color: '#9CA3AF', background: 'none', border: '1.5px dashed #E0E3EE', borderRadius: 8, cursor: 'pointer' }}>
                              <Plus size={11} /> Add task
                            </button>
                          ) : null}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}

              {canCreate && (addColMode ? (
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
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* ── Card context menu ── */}
      {menuCard && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 198 }} onClick={() => setMenuCard(null)} />
          <div data-card-menu style={{ position: 'fixed', top: menuCard.y, left: Math.min(menuCard.x, window.innerWidth - 200), zIndex: 199, background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 190 }}>
            <button onClick={() => { setCardModal({ card: menuCard.card, columnId: menuCard.card.columnId }); setMenuCard(null) }} style={mItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit card</button>
            {columns.length > 1 && (
              <div style={{ borderTop: '1px solid #F4F5F9', margin: '2px 0', padding: '2px 0' }}>
                <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 12px', fontWeight: 600 }}>Move to</p>
                {columns.filter(c => c.id !== menuCard.card.columnId).map(c => (
                  <button key={c.id} onClick={() => { moveCard.mutate({ id: menuCard.card.id, columnId: c.id, order: c.cards.length }); setMenuCard(null) }} style={mItem}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, marginRight: 8 }} />{c.title}
                  </button>
                ))}
              </div>
            )}
            {canDelete && (
              <>
                <div style={{ borderTop: '1px solid #F4F5F9', margin: '2px 0' }} />
                <button onClick={() => { setDeleteCardConfirm(menuCard.card.id); setMenuCard(null) }} style={{ ...mItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Card modal ── */}
      {cardModal && (
        <CardModal
          card={cardModal.card} columnId={cardModal.columnId}
          people={people} labels={labels} isMobile={isMobile}
          canEdit={canEdit} canDelete={canDelete}
          onSave={async (data) => {
            if (cardModal.card) await updateCard.mutateAsync({ id: cardModal.card.id, ...data })
            else await createCard.mutateAsync({ columnId: cardModal.columnId, ...data } as CardInput)
            setCardModal(null)
          }}
          onDelete={cardModal.card ? () => { setDeleteCardConfirm(cardModal.card!.id); setCardModal(null) } : undefined}
          onClose={() => setCardModal(null)}
          onAddChecklistItem={text => cardModal.card && addChecklistItem.mutate({ cardId: cardModal.card.id, text })}
          onToggleChecklistItem={(id, done) => updateChecklistItem.mutate({ id, done })}
          onDeleteChecklistItem={id => deleteChecklistItem.mutate(id)}
        />
      )}

      {/* ── Delete column confirm ── */}
      {deleteColConfirm && (
        <ConfirmDialog
          title="Delete column?"
          message={(columns.find(c => c.id === deleteColConfirm)?.cards.length ?? 0) > 0 ? 'Move or delete its cards first.' : 'This column is empty and will be permanently removed.'}
          onCancel={() => setDeleteColConfirm(null)}
          onConfirm={async () => { await deleteColumn.mutateAsync(deleteColConfirm); setDeleteColConfirm(null) }}
          isPending={deleteColumn.isPending}
        />
      )}

      {/* ── Delete card confirm (archive) ── */}
      {deleteCardConfirm && (
        <ConfirmDialog
          title="Delete this card?"
          message="The card will be archived and removed from the board."
          onCancel={() => setDeleteCardConfirm(null)}
          onConfirm={async () => { await archiveCard.mutateAsync(deleteCardConfirm); setDeleteCardConfirm(null) }}
          isPending={archiveCard.isPending}
        />
      )}

      {/* ── New board modal ── */}
      {showNewBoard && (
        <NewBoardModal
          value={newBoardName} onChange={setNewBoardName}
          onCancel={() => setShowNewBoard(false)}
          onCreate={async () => {
            if (!newBoardName.trim()) return
            const created = await createBoard.mutateAsync({ name: newBoardName.trim() })
            setActiveBoardId(created.id)
            setNewBoardName(''); setShowNewBoard(false)
          }}
          isPending={createBoard.isPending}
        />
      )}

      {/* ── Labels modal ── */}
      {showLabels && board && (
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
                  <button onClick={() => deleteLabel.mutate(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353' }}><Trash2 size={13} /></button>
                </div>
              ))}
              {labels.length === 0 && <p style={{ fontSize: 12, color: '#B1B1BE' }}>No labels yet.</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newLabelName.trim()) { createLabel.mutate({ boardId: board.id, name: newLabelName.trim(), color: newLabelColor }); setNewLabelName('') } }}
                placeholder="Label name..." style={{ ...inp, flex: 1 }} />
              <input type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} style={{ width: 36, height: 34, padding: 2, border: '1px solid #F0F1F5', borderRadius: 8, cursor: 'pointer' }} />
              <button onClick={() => { if (newLabelName.trim()) { createLabel.mutate({ boardId: board.id, name: newLabelName.trim(), color: newLabelColor }); setNewLabelName('') } }} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New Board Modal ──────────────────────────────────────────────────────────

function NewBoardModal({ value, onChange, onCancel, onCreate, isPending }: {
  value: string; onChange: (v: string) => void; onCancel: () => void; onCreate: () => void; isPending: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 14 }}>New Board</p>
        <input autoFocus value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onCreate() }}
          placeholder="Board name…" style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #E8EAED', background: '#fff', color: '#374557', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onCreate} disabled={isPending || !value.trim()} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Column Settings Panel ────────────────────────────────────────────────────

function ColSettingsPanel({ col, wipVal, setWipVal, onSave, onRename, onDelete, canDelete }: {
  col: KanbanColumn; wipVal: string; setWipVal: (v: string) => void
  onSave: (color: string) => void; onRename: () => void; onDelete: () => void; canDelete: boolean
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
        <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>WIP Limit (blank = off)</p>
        <input type="number" min={0} value={wipVal} onChange={e => setWipVal(e.target.value)}
          style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button onClick={() => onSave(color)} style={{ padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
        <button onClick={onRename} style={{ padding: '5px 0', borderRadius: 7, fontSize: 11, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }}>Rename column</button>
        {canDelete && <button onClick={onDelete} style={{ padding: '5px 0', borderRadius: 7, fontSize: 11, color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}>Delete column</button>}
      </div>
    </div>
  )
}

// ─── Card Modal ───────────────────────────────────────────────────────────────

interface CardFormState {
  title: string
  description: string
  priority: KanbanPriority
  dueDate: string
  progress: number
  total: number
  color: string
  assigneeIds: string[]
  labelIds: string[]
}

function CardModal({ card, people, labels, isMobile, canEdit, canDelete, onSave, onDelete, onClose, onAddChecklistItem, onToggleChecklistItem, onDeleteChecklistItem }: {
  card: KanbanCard | null; columnId: string
  people: Avatar[]; labels: { id: string; name: string; color: string }[]; isMobile: boolean
  canEdit: boolean; canDelete: boolean
  onSave: (data: Partial<CardInput>) => void
  onDelete?: () => void
  onClose: () => void
  onAddChecklistItem: (text: string) => void
  onToggleChecklistItem: (id: string, done: boolean) => void
  onDeleteChecklistItem: (id: string) => void
}) {
  const isNew = !card
  const [form, setForm] = useState<CardFormState>({
    title: card?.title ?? '',
    description: card?.description ?? '',
    priority: card?.priority ?? 'Medium',
    dueDate: card?.dueDate?.slice(0, 10) ?? '',
    progress: card?.progress ?? 0,
    total: card?.total ?? 1,
    color: card?.color ?? '#5D78FF',
    assigneeIds: card?.assignees.map(a => a.userId) ?? [],
    labelIds: card?.labels.map(l => l.labelId) ?? [],
  })
  const [newCheckItem, setNewCheckItem] = useState('')
  const readOnly = !canEdit

  function toggleAssignee(id: string) {
    setForm(f => ({ ...f, assigneeIds: f.assigneeIds.includes(id) ? f.assigneeIds.filter(a => a !== id) : [...f.assigneeIds, id] }))
  }
  function toggleLabel(id: string) {
    setForm(f => ({ ...f, labelIds: f.labelIds.includes(id) ? f.labelIds.filter(l => l !== id) : [...f.labelIds, id] }))
  }

  const checklist = card?.checklist ?? []
  const doneItems = checklist.filter(i => i.done).length

  function handleSave() {
    if (!form.title.trim()) return
    onSave({
      title: form.title.trim(),
      description: form.description || undefined,
      priority: form.priority,
      dueDate: form.dueDate || null,
      progress: form.progress,
      total: form.total,
      color: form.color,
      assigneeIds: form.assigneeIds,
      labelIds: form.labelIds,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : 16, width: '100%', maxWidth: isMobile ? '100%' : 560, maxHeight: isMobile ? '92vh' : '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{isNew ? 'New Task' : 'Edit Task'}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Task Title *</label>
            <input disabled={readOnly} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" style={inp} />
          </div>

          <div>
            <label style={lbl}>Due Date</label>
            <input disabled={readOnly} type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inp} />
          </div>

          <div>
            <label style={lbl}>Description</label>
            <textarea disabled={readOnly} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add details…" rows={2} style={{ ...inp, resize: 'none' }} />
          </div>

          <div>
            <label style={lbl}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['High', 'Medium', 'Low'] as KanbanPriority[]).map(p => {
                const ps = PRIORITY_STYLE[p]; const active = form.priority === p
                return <button key={p} disabled={readOnly} onClick={() => setForm(f => ({ ...f, priority: p }))}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${active ? ps.color : '#E8EAED'}`, background: active ? ps.bg : '#fff', color: active ? ps.color : '#9CA3AF', cursor: readOnly ? 'default' : 'pointer' }}>{p}</button>
              })}
            </div>
          </div>

          <div>
            <label style={lbl}>Progress ({form.progress}/{form.total})</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input disabled={readOnly} type="number" min={0} max={form.total} value={form.progress}
                onChange={e => setForm(f => ({ ...f, progress: Math.min(Number(e.target.value), f.total) }))} style={{ ...inp, width: 64 }} />
              <span style={{ color: '#B1B1BE', fontSize: 12 }}>of</span>
              <input disabled={readOnly} type="number" min={1} value={form.total}
                onChange={e => setForm(f => ({ ...f, total: Math.max(1, Number(e.target.value)) }))} style={{ ...inp, width: 64 }} />
            </div>
            <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9', marginTop: 7 }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (form.progress / form.total) * 100)}%`, background: form.color }} />
            </div>
          </div>

          <div>
            <label style={lbl}>Assignees</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {people.map(a => {
                const active = form.assigneeIds.includes(a.id)
                return (
                  <button key={a.id} disabled={readOnly} onClick={() => toggleAssignee(a.id)} title={a.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${active ? a.color : '#E8EAED'}`, background: active ? a.color + '18' : '#fff', cursor: readOnly ? 'default' : 'pointer' }}>
                    <Avatar av={a} size={18} />
                    <span style={{ fontSize: 11, color: active ? a.color : '#9CA3AF', fontWeight: active ? 600 : 400 }}>{a.name.split(' ')[0]}</span>
                  </button>
                )
              })}
              {people.length === 0 && <p style={{ fontSize: 11, color: '#B1B1BE' }}>No users found.</p>}
            </div>
          </div>

          <div>
            <label style={lbl}>Labels</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {labels.map(l => {
                const active = form.labelIds.includes(l.id)
                return (
                  <button key={l.id} disabled={readOnly} onClick={() => toggleLabel(l.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${active ? l.color : '#E8EAED'}`, background: active ? l.color + '22' : '#fff', cursor: readOnly ? 'default' : 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                    <span style={{ fontSize: 11, color: active ? l.color : '#9CA3AF', fontWeight: active ? 600 : 400 }}>{l.name}</span>
                  </button>
                )
              })}
              {labels.length === 0 && <p style={{ fontSize: 11, color: '#B1B1BE' }}>No labels on this board yet.</p>}
            </div>
          </div>

          {!isNew && (
            <div>
              <label style={lbl}>Checklist {checklist.length > 0 && <span style={{ color: '#B1B1BE', fontWeight: 400 }}>({doneItems}/{checklist.length})</span>}</label>
              {checklist.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9', marginBottom: 8 }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${checklist.length ? (doneItems / checklist.length) * 100 : 0}%`, background: '#2BC155' }} />
                  </div>
                  {checklist.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <button disabled={readOnly} onClick={() => onToggleChecklistItem(item.id, !item.done)}
                        style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${item.done ? '#2BC155' : '#E8EAED'}`, background: item.done ? '#2BC155' : '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: readOnly ? 'default' : 'pointer' }}>
                        {item.done && <X size={9} color="#fff" />}
                      </button>
                      <span style={{ fontSize: 12, color: item.done ? '#B1B1BE' : '#374557', flex: 1, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                      {!readOnly && <button onClick={() => onDeleteChecklistItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D5D5D5' }}><X size={11} /></button>}
                    </div>
                  ))}
                </div>
              )}
              {!readOnly && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newCheckItem.trim()) { onAddChecklistItem(newCheckItem.trim()); setNewCheckItem('') } }}
                    placeholder="Add checklist item…" style={{ ...inp, flex: 1 }} />
                  <button onClick={() => { if (newCheckItem.trim()) { onAddChecklistItem(newCheckItem.trim()); setNewCheckItem('') } }} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}>Add</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F1F5', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #E8EAED', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          {onDelete && canDelete && (
            <button onClick={onDelete} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, border: 'none', background: '#FFEEEE', color: '#FF5353', cursor: 'pointer' }}><Trash2 size={14} /></button>
          )}
          {!readOnly && (
            <button onClick={handleSave} style={{ flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{isNew ? 'Create Task' : 'Save Changes'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
