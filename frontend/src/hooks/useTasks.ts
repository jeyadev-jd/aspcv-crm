import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Task {
  id: string
  title: string
  description?: string | null
  status: 'Pending' | 'InProgress' | 'Submitted' | 'Done' | 'OnHold'
  // Primary owner, kept in sync with the first entry of `assignees`.
  assignee?: { id: string; name: string; role: string } | null
  assigneeId?: string | null
  department?: { id: string; name: string } | null
  departmentId?: string | null
  // Full assignment sets — a task can go to several people and teams at once.
  assignees?: { userId: string; user: { id: string; name: string; role: string } }[]
  departments?: { departmentId: string; department: { id: string; name: string } }[]
  entityType?: string | null
  entityId?: string | null
  startDate?: string | null
  dueDate?: string | null
  submissionUrl?: string | null
  submittedAt?: string | null
  completedAt?: string | null
  /** Free-text note recorded by whoever marked the task done — required from assignees, optional for managers. */
  completionNote?: string | null
  /** Name of the user who marked the task done (resolved by the API). */
  completedBy?: string | null
  checked: boolean
  createdAt: string
}

export type TaskFilter = { assigneeId?: string; entityType?: string; entityId?: string; status?: string; mine?: boolean }

export function useTasks(filter?: TaskFilter) {
  return useQuery<Task[]>({
    queryKey: ['tasks', filter],
    queryFn: () => api.get('/tasks', { params: filter }).then(r => r.data),
    staleTime: 15_000,
  })
}

function inval(qc: ReturnType<typeof useQueryClient>) { qc.invalidateQueries({ queryKey: ['tasks'] }) }

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (data: Record<string, unknown>) => api.post('/tasks', data).then(r => r.data), onSuccess: () => inval(qc) })
}
export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => api.put(`/tasks/${id}`, data).then(r => r.data), onSuccess: () => inval(qc) })
}
export function useSubmitTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, submissionUrl }: { id: string; submissionUrl: string }) => api.post(`/tasks/${id}/submit`, { submissionUrl }).then(r => r.data), onSuccess: () => inval(qc) })
}
export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completionNote }: { id: string; completionNote: string }) =>
      api.post(`/tasks/${id}/complete`, { completionNote }).then(r => r.data),
    onSuccess: () => inval(qc),
  })
}
export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.delete(`/tasks/${id}`).then(r => r.data), onSuccess: () => inval(qc) })
}
