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
  return useQuery<{ notifications: Notification[]; unread: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/my').then(r => r.data),
    refetchInterval: 30_000, // poll for new alerts
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
