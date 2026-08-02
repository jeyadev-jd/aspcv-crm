import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Every report reads the same window so the tabs cannot disagree. Either a
 * rolling `months` count or an explicit inclusive `from`/`to` month pair
 * (YYYY-MM) selected in the custom range picker.
 */
export type ReportRange =
  | { months: number; from?: undefined; to?: undefined }
  | { months?: undefined; from: string; to: string }

export function rangeParams(range: ReportRange): Record<string, string> {
  return range.months != null
    ? { months: String(range.months) }
    : { from: range.from!, to: range.to! }
}

/** Stable cache key for a window. */
function rangeKey(range: ReportRange): string {
  return range.months != null ? `m${range.months}` : `${range.from}..${range.to}`
}

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

export interface PipelineValueReport {
  openCount: number
  openValue: number
  /** Probability-weighted — the figure a forecast should use. */
  weightedValue: number
  wonValue: number
  lostValue: number
  /** Null when there is no open pipeline to average over. */
  avgDealSize: number | null
  byStage: { stage: string; count: number; value: number; weighted: number; sharePct: number }[]
  trend: { label: string; created: number; won: number; lost: number }[]
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

export interface TicketTrendPoint {
  label: string
  week: string
  opened: number
  open: number
  resolved: number
}

export interface TicketReport {
  coverage: { count: number; sufficient: boolean }
  total: number
  resolvedCount: number
  overdue: number
  unassigned: number
  /** Null when nothing measurable was resolved — render "not enough data". */
  slaCompliancePct: number | null
  slaSampleSize: number
  avgResolutionHours: number | null
  byStatus: { status: string; count: number }[]
  byPriority: { priority: string; count: number }[]
  byCategory: { category: string; count: number }[]
  byAssignee: { userId: string; name: string; total: number; resolved: number; breached: number }[]
  byProject: { projectId: string; title: string; total: number; open: number }[]
}

export interface ProjectReport {
  coverage: { count: number; sufficient: boolean }
  total: number
  completedCount: number
  activeCount: number
  byStatus: { status: string; count: number }[]
  /** Null when no completed project carried an expected completion date. */
  onTimePct: number | null
  onTimeSampleSize: number
  totalBudget: number
  totalSpend: number
  totalProfit: number
  overBudgetCount: number
  budgetedCount: number
  avgProgress: number | null
  topOverBudget: { id: string; title: string; budget: number; spend: number; overBy: number }[]
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
  /** Null when no deal was created in the window. */
  winRate: number | null
  dealCount: number
  invoiceCount: number
  rangeStart: string
  rangeEnd: string
}

export function useRevenueReport(range: ReportRange) {
  return useQuery<RevenueMonth[]>({
    queryKey: ['reports', 'revenue', rangeKey(range)],
    queryFn: () => api.get('/reports/revenue', { params: rangeParams(range) }).then(r => r.data),
  })
}

export function useSetRevenueTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { month: number; year: number; targetAmount: number }) =>
      api.put('/reports/revenue/target', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function usePipelineReport(range: ReportRange, departmentId?: string) {
  return useQuery<PipelineStage[]>({
    queryKey: ['reports', 'pipeline', rangeKey(range), departmentId],
    queryFn: () => api.get('/reports/pipeline', {
      params: { ...rangeParams(range), ...(departmentId ? { departmentId } : {}) },
    }).then(r => r.data),
  })
}

export function usePipelineValueReport(range: ReportRange, departmentId?: string) {
  return useQuery<PipelineValueReport>({
    queryKey: ['reports', 'pipeline-value', rangeKey(range), departmentId],
    queryFn: () => api.get('/reports/pipeline-value', {
      params: { ...rangeParams(range), ...(departmentId ? { departmentId } : {}) },
    }).then(r => r.data),
  })
}

export function useFunnelReport(range: ReportRange, departmentId?: string) {
  return useQuery<FunnelStatus[]>({
    queryKey: ['reports', 'funnel', rangeKey(range), departmentId],
    queryFn: () => api.get('/reports/funnel', {
      params: { ...rangeParams(range), ...(departmentId ? { departmentId } : {}) },
    }).then(r => r.data),
  })
}

export function useLeaderboardReport(range: ReportRange) {
  return useQuery<LeaderboardRow[]>({
    queryKey: ['reports', 'leaderboard', rangeKey(range)],
    queryFn: () => api.get('/reports/leaderboard', { params: rangeParams(range) }).then(r => r.data),
  })
}

export function useProductPerformanceReport(range: ReportRange) {
  return useQuery<ProductPerf[]>({
    queryKey: ['reports', 'product-performance', rangeKey(range)],
    queryFn: () => api.get('/reports/product-performance', { params: rangeParams(range) }).then(r => r.data),
  })
}

export function useTicketsTrendReport(range: ReportRange) {
  return useQuery<TicketTrendPoint[]>({
    queryKey: ['reports', 'tickets-trend', rangeKey(range)],
    queryFn: () => api.get('/reports/tickets-trend', { params: rangeParams(range) }).then(r => r.data),
  })
}

export function useTicketReport(range: ReportRange) {
  return useQuery<TicketReport>({
    queryKey: ['reports', 'tickets', rangeKey(range)],
    queryFn: () => api.get('/reports/tickets', { params: rangeParams(range) }).then(r => r.data),
  })
}

export function useProjectReport(range: ReportRange) {
  return useQuery<ProjectReport>({
    queryKey: ['reports', 'projects', rangeKey(range)],
    queryFn: () => api.get('/reports/projects', { params: rangeParams(range) }).then(r => r.data),
  })
}

export function useDepartmentsReport(range: ReportRange) {
  return useQuery<DepartmentBreakdown[]>({
    queryKey: ['reports', 'departments', rangeKey(range)],
    queryFn: () => api.get('/reports/departments', { params: rangeParams(range) }).then(r => r.data),
  })
}

export function useReportsSummary(range: ReportRange) {
  return useQuery<ReportsSummary>({
    queryKey: ['reports', 'summary', rangeKey(range)],
    queryFn: () => api.get('/reports/summary', { params: rangeParams(range) }).then(r => r.data),
  })
}
