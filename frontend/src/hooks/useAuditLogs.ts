import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AuditLogEntry {
  id: string
  userId?: string | null
  userName?: string | null
  roleName?: string | null
  action: string
  module: string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface AuditLogFilters {
  module?: string
  action?: string
  userId?: string
  q?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery<PaginatedAuditLogs>({
    queryKey: ['audit-logs', filters],
    queryFn: () => api.get('/audit-logs', { params: filters }).then(r => r.data),
  })
}

export function useAuditLogModules() {
  return useQuery<string[]>({
    queryKey: ['audit-logs', 'modules'],
    queryFn: () => api.get('/audit-logs/modules').then(r => r.data),
  })
}

export async function downloadAuditLogsCsv(filters: AuditLogFilters) {
  const res = await api.get('/audit-logs/export', { params: filters, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = 'audit-log.csv'; a.click()
  URL.revokeObjectURL(url)
}
