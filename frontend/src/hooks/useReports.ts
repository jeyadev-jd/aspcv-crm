import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface RevenueMonth {
  year: number
  month: number
  label: string
  actual: number
  target: number | null
}

export interface PipelineStage {
  stage: string
  value: number
  count: number
}

export interface FunnelStatus {
  status: string
  count: number
}

export interface LeaderboardRow {
  userId: string
  name: string
  role: string
  wonCount: number
  wonValue: number
  totalDeals: number
}

export interface ProductPerf {
  name: string
  revenue: number
}

export interface TicketWeek {
  week: string
  open: number
  resolved: number
}

export interface DepartmentBreakdown {
  departmentId: string
  departmentName: string
  leadCount: number
  dealCount: number
  pipelineValue: number
  projectCount: number
  wonDealCount: number
  wonValue: number
}

export interface ReportsSummary {
  revenueTotal: number
  pipelineValue: number
  wonValue: number
  winRate: number
}

export function useRevenueReport(months = 6) {
  return useQuery<RevenueMonth[]>({
    queryKey: ['reports', 'revenue', months],
    queryFn: () => api.get('/reports/revenue', { params: { months } }).then(r => r.data),
  })
}

export function useSetRevenueTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { month: number; year: number; targetAmount: number }) =>
      api.put('/reports/revenue/target', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'revenue'] }),
  })
}

export function usePipelineReport(departmentId?: string) {
  return useQuery<PipelineStage[]>({
    queryKey: ['reports', 'pipeline', departmentId],
    queryFn: () => api.get('/reports/pipeline', { params: departmentId ? { departmentId } : {} }).then(r => r.data),
  })
}

export function useFunnelReport(departmentId?: string) {
  return useQuery<FunnelStatus[]>({
    queryKey: ['reports', 'funnel', departmentId],
    queryFn: () => api.get('/reports/funnel', { params: departmentId ? { departmentId } : {} }).then(r => r.data),
  })
}

export function useLeaderboardReport() {
  return useQuery<LeaderboardRow[]>({
    queryKey: ['reports', 'leaderboard'],
    queryFn: () => api.get('/reports/leaderboard').then(r => r.data),
  })
}

export function useProductPerformanceReport() {
  return useQuery<ProductPerf[]>({
    queryKey: ['reports', 'product-performance'],
    queryFn: () => api.get('/reports/product-performance').then(r => r.data),
  })
}

export function useTicketsTrendReport(weeks = 6) {
  return useQuery<TicketWeek[]>({
    queryKey: ['reports', 'tickets-trend', weeks],
    queryFn: () => api.get('/reports/tickets-trend', { params: { weeks } }).then(r => r.data),
  })
}

export function useDepartmentsReport() {
  return useQuery<DepartmentBreakdown[]>({
    queryKey: ['reports', 'departments'],
    queryFn: () => api.get('/reports/departments').then(r => r.data),
  })
}

export function useReportsSummary() {
  return useQuery<ReportsSummary>({
    queryKey: ['reports', 'summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
  })
}
