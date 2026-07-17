import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type KanbanPriority = 'High' | 'Medium' | 'Low'

export interface KanbanUserRef {
  id: string
  name: string
  role: string
}

export interface KanbanCardAssignee {
  id: string
  userId: string
  user: KanbanUserRef
}

export interface KanbanLabel {
  id: string
  boardId: string
  name: string
  color: string
}

export interface KanbanCardLabel {
  id: string
  labelId: string
  label: KanbanLabel
}

export interface KanbanChecklistItem {
  id: string
  cardId: string
  text: string
  done: boolean
  order: number
}

export interface KanbanCard {
  id: string
  columnId: string
  title: string
  description?: string | null
  priority: KanbanPriority
  status: string
  dueDate?: string | null
  startDate?: string | null
  estimatedHours?: number | null
  actualHours?: number | null
  progress: number
  total: number
  color: string
  order: number
  isArchived: boolean
  projectId?: string | null
  project?: { id: string; title: string } | null
  taskId?: string | null
  task?: { id: string; title: string } | null
  companyId?: string | null
  company?: { id: string; name: string } | null
  leadId?: string | null
  lead?: { id: string; title: string } | null
  dealId?: string | null
  deal?: { id: string; title: string } | null
  departmentId?: string | null
  department?: { id: string; name: string } | null
  createdById?: string | null
  createdBy?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
  assignees: KanbanCardAssignee[]
  labels: KanbanCardLabel[]
  checklist: KanbanChecklistItem[]
}

export interface KanbanColumn {
  id: string
  boardId: string
  title: string
  color: string
  order: number
  wipLimit?: number | null
  isDoneColumn: boolean
  isArchived: boolean
  cards: KanbanCard[]
}

export interface KanbanBoard {
  id: string
  name: string
  description?: string | null
  boardType: string
  isArchived: boolean
  isDefault: boolean
  departmentId?: string | null
  department?: { id: string; name: string } | null
  createdById?: string | null
  createdAt: string
  updatedAt: string
  columns: KanbanColumn[]
  labels: KanbanLabel[]
}

const BOARDS_KEY = ['kanban', 'boards'] as const

export function useKanbanBoards() {
  return useQuery<KanbanBoard[]>({
    queryKey: BOARDS_KEY,
    queryFn: () => api.get('/kanban/boards').then(r => r.data),
  })
}

export function useCreateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; boardType?: string; departmentId?: string }) =>
      api.post('/kanban/boards', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useUpdateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      api.patch(`/kanban/boards/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useArchiveBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/kanban/boards/${id}/archive`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

// ── Columns ───────────────────────────────────────────────────────────────────

export function useCreateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { boardId: string; title: string; color?: string }) =>
      api.post('/kanban/columns', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useUpdateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; color?: string; wipLimit?: number | null }) =>
      api.patch(`/kanban/columns/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useDeleteColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/kanban/columns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export interface CardInput {
  columnId: string
  title: string
  description?: string
  priority?: KanbanPriority
  dueDate?: string | null
  progress?: number
  total?: number
  color?: string
  projectId?: string | null
  taskId?: string | null
  companyId?: string | null
  leadId?: string | null
  dealId?: string | null
  departmentId?: string | null
  assigneeIds?: string[]
  labelIds?: string[]
}

export function useCreateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CardInput) => api.post('/kanban/cards', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CardInput> & { id: string }) =>
      api.patch(`/kanban/cards/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

// Optimistic drag-and-drop move: updates the cached board tree immediately,
// persists to the server, and rolls back the cache if the request fails.
export function useMoveCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, columnId, order }: { id: string; columnId: string; order: number }) =>
      api.post(`/kanban/cards/${id}/move`, { columnId, order }).then(r => r.data),
    onMutate: async ({ id, columnId, order }) => {
      await qc.cancelQueries({ queryKey: BOARDS_KEY })
      const previous = qc.getQueryData<KanbanBoard[]>(BOARDS_KEY)
      qc.setQueryData<KanbanBoard[]>(BOARDS_KEY, boards => {
        if (!boards) return boards
        return boards.map(board => {
          let movedCard: KanbanCard | undefined
          const columnsWithoutCard = board.columns.map(col => {
            const found = col.cards.find(c => c.id === id)
            if (found) movedCard = found
            return { ...col, cards: col.cards.filter(c => c.id !== id) }
          })
          if (!movedCard) return { ...board, columns: columnsWithoutCard }
          return {
            ...board,
            columns: columnsWithoutCard.map(col => {
              if (col.id !== columnId) return col
              const cards = [...col.cards]
              cards.splice(order, 0, { ...movedCard!, columnId, order })
              return { ...col, cards }
            }),
          }
        })
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(BOARDS_KEY, context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useArchiveCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/kanban/cards/${id}/archive`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/kanban/cards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export function useAddChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, text }: { cardId: string; text: string }) =>
      api.post(`/kanban/cards/${cardId}/checklist`, { text }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; text?: string; done?: boolean }) =>
      api.patch(`/kanban/checklist/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/kanban/checklist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

// ── Labels ────────────────────────────────────────────────────────────────────

export function useCreateLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { boardId: string; name: string; color?: string }) =>
      api.post('/kanban/labels', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}

export function useDeleteLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/kanban/labels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARDS_KEY }),
  })
}
