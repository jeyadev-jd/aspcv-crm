import { useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { Plus, MessageSquare, Paperclip, MoreHorizontal, AlignLeft } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar, XAxis } from 'recharts'

interface KanbanCard {
  id: string
  title: string
  category: string
  progress: number
  total: number
  date: string
  comments: number
  attachments: number
  color: string
  avatars?: number
}

interface Column {
  id: string
  title: string
  cards: KanbanCard[]
}

const sparkData = [{ v: 2 }, { v: 5 }, { v: 3 }, { v: 8 }, { v: 4 }, { v: 9 }, { v: 5 }]
const barData = [
  { v: 3 }, { v: 6 }, { v: 4 }, { v: 8 }, { v: 5 }, { v: 9 },
  { v: 4 }, { v: 7 }, { v: 6 }, { v: 8 }, { v: 5 }, { v: 10 },
]

const overviewStats = [
  { label: 'All tasks', value: '1.345', pct: 75, color: '#5D78FF' },
  { label: 'Pending', value: '840', pct: 30, color: '#FFAE00' },
  { label: 'Done', value: '1.084', pct: 60, color: '#2BC155' },
]

const initialColumns: Column[] = [
  {
    id: 'todo', title: 'To Do',
    cards: [
      { id: 'c1', title: 'Design new UI presentation', category: 'Website Development', progress: 7, total: 14, date: '24 Aug 2019', comments: 2, attachments: 1, color: '#5D78FF', avatars: 3 },
      { id: 'c2', title: 'Add more UI/UX mockups', category: 'Pinterest Promotion', progress: 8, total: 16, date: '24 Sep 2019', comments: 3, attachments: 2, color: '#2BC155', avatars: 2 },
      { id: 'c3', title: 'Design few mobile screens', category: 'Dropbox Mobile App', progress: 3, total: 14, date: '24 Jan 2019', comments: 0, attachments: 1, color: '#FF9B52' },
    ],
  },
  {
    id: 'inprogress', title: 'In Progress',
    cards: [
      { id: 'c4', title: 'Create a new wireframe', category: 'Website Development', progress: 6, total: 12, date: '27 May 2019', comments: 4, attachments: 2, color: '#FF9B52', avatars: 4 },
      { id: 'c5', title: 'Create a twit and promote', category: 'Twitter Marketing', progress: 4, total: 8, date: '04 Aug 2019', comments: 2, attachments: 1, color: '#5D78FF' },
    ],
  },
  {
    id: 'done', title: 'Done',
    cards: [
      { id: 'c6', title: 'Add product to the market', category: 'Product Design', progress: 4, total: 4, date: '31 Aug 2019', comments: 3, attachments: 1, color: '#2BC155', avatars: 2 },
      { id: 'c7', title: 'Run and manage campaign', category: 'Adwords Campaign', progress: 6, total: 6, date: '27 Nov 2019', comments: 2, attachments: 1, color: '#5D78FF', avatars: 1 },
      { id: 'c8', title: 'Launch product promotion', category: 'Adwords Campaign', progress: 7, total: 8, date: '07 Sep 2019', comments: 2, attachments: 1, color: '#FF5353' },
    ],
  },
]

const avatarColors = ['#5D78FF', '#FF9B52', '#2BC155', '#FF5353', '#8B5CF6']

function Avatars({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex' }}>
      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
        <div key={i} style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid #fff',
          background: avatarColors[i % avatarColors.length],
          marginLeft: i === 0 ? 0 : -5,
        }} />
      ))}
      {count > 4 && (
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid #fff', background: '#B1B1BE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 8, marginLeft: -5,
        }}>+{count - 4}</div>
      )}
    </div>
  )
}

export default function Kanban() {
  const isMobile = useIsMobile()
  const [columns, setColumns] = useState(initialColumns)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')

  function addCard(colId: string) {
    if (!newCardTitle.trim()) { setAddingTo(null); return }
    const card: KanbanCard = {
      id: `c${Date.now()}`, title: newCardTitle, category: 'New Task',
      progress: 0, total: 1, date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      comments: 0, attachments: 0, color: '#5D78FF',
    }
    setColumns(prev => prev.map(col => col.id === colId ? { ...col, cards: [...col.cards, card] } : col))
    setNewCardTitle('')
    setAddingTo(null)
  }

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const { source, destination } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const srcCol = columns.find(c => c.id === source.droppableId)!
    const card = srcCol.cards[source.index]

    setColumns(prev => prev.map(col => {
      if (col.id === source.droppableId && col.id === destination.droppableId) {
        const cards = [...col.cards]
        cards.splice(source.index, 1)
        cards.splice(destination.index, 0, card)
        return { ...col, cards }
      }
      if (col.id === source.droppableId) {
        const cards = [...col.cards]; cards.splice(source.index, 1); return { ...col, cards }
      }
      if (col.id === destination.droppableId) {
        const cards = [...col.cards]; cards.splice(destination.index, 0, card); return { ...col, cards }
      }
      return col
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start', height: '100%' }}>
      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        {/* Tasks overview */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Tasks overview</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Overall tasks performance</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {overviewStats.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <p style={{ fontSize: 11, color: '#374557' }}>{s.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{s.value}</p>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#F4F5F9' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion history */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Conversion history</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 12 }}>Week to week performance</p>
          <ResponsiveContainer width="100%" height={70}>
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
          <ResponsiveContainer width="100%" height={50}>
            <BarChart data={barData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={6}>
              <XAxis dataKey="" hide />
              <Bar dataKey="v" fill="#5D78FF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>$342,000</p>
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Total sales</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>$200,000</p>
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Earnings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'start' }}>
            {columns.map(col => (
              <div key={col.id} style={{ background: '#F4F5F9', borderRadius: 12, minHeight: 400 }}>
                {/* column header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{col.title}</p>
                  <button onClick={() => { setAddingTo(col.id); setNewCardTitle('') }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Plus size={13} /> ADD NEW TASK
                  </button>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        padding: '0 12px 12px',
                        display: 'flex', flexDirection: 'column', gap: 12,
                        minHeight: 64,
                        borderRadius: '0 0 12px 12px',
                        background: snapshot.isDraggingOver ? '#EEF0FF' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      {col.cards.map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={{
                                ...prov.draggableProps.style,
                                background: '#fff',
                                borderRadius: 12,
                                padding: 16,
                                border: '1px solid #F0F1F5',
                                boxShadow: snap.isDragging ? '0 10px 30px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                                transform: snap.isDragging ? `${prov.draggableProps.style?.transform} rotate(1deg)` : prov.draggableProps.style?.transform,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', lineHeight: 1.3, flex: 1 }}>{card.title}</p>
                                <button style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}><MoreHorizontal size={13} /></button>
                              </div>
                              <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 12 }}>{card.category}</p>

                              {/* Progress */}
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#B1B1BE' }}>
                                    <AlignLeft size={10} /> Progress
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{card.progress}/{card.total}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: '#F4F5F9' }}>
                                  <div style={{ height: '100%', borderRadius: 3, width: `${(card.progress / card.total) * 100}%`, background: card.color }} />
                                </div>
                              </div>

                              {/* Footer */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: '#FFF5EE', color: '#FF9B52' }}>
                                  {card.date}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {card.avatars ? <Avatars count={card.avatars} /> : null}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#B1B1BE' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><MessageSquare size={11} />{card.comments}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Paperclip size={11} />{card.attachments}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {addingTo === col.id && (
                        <div style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #E8EDFF', marginTop: 4 }}>
                          <input
                            autoFocus
                            value={newCardTitle}
                            onChange={e => setNewCardTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addCard(col.id); if (e.key === 'Escape') setAddingTo(null) }}
                            placeholder="Task title..."
                            style={{ width: '100%', fontSize: 12, color: '#374557', border: 'none', outline: 'none', background: 'transparent', marginBottom: 8 }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => addCard(col.id)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
                            <button onClick={() => setAddingTo(null)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'transparent', color: '#B1B1BE', border: 'none', cursor: 'pointer' }}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}
