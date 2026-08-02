import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Notification {
  id: string
  userId: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  entityType?: string | null
  entityId?: string | null
  read: boolean
  createdAt: string
}

export function useNotifications() {
  return useQuery<{ notifications: Notification[]; unread: number; total: number }>({
    queryKey: ['notifications'],
    // `unread` is counted server-side across every row, not just this page, so
    // the bell badge stays correct even when the list itself is truncated.
    queryFn: () => api.get('/notifications/my', { params: { pageSize: 100 } })
      .then(r => ({ notifications: r.data.data, unread: r.data.unread, total: r.data.total })),
    // 10s rather than 30s so approval requests and budget alerts surface
    // while they are still actionable.
    refetchInterval: 10_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all/mark').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/** Deletes this user's notifications. `onlyRead` keeps anything still unread. */
export function useClearNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts?: { onlyRead?: boolean }) =>
      api.delete('/notifications/clear-all', {
        params: opts?.onlyRead ? { onlyRead: 'true' } : {},
      }).then(r => r.data as { success: boolean; deleted: number }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
