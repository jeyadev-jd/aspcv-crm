import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const KEY = 'payroll'

/** Mirrors the backend PayrollRecord snapshot columns. */
export interface PayrollRecord {
  id: string
  periodId: string
  userId: string
  version: number
  isCurrent: boolean
  lifecycle: 'Joiner' | 'Leaver' | 'Stayer'

  masterBasic: number
  masterHra: number
  masterOthers: number
  masterSpecial1: number
  masterSpecial2: number
  masterGross: number
  masterPfBasic: number
  masterCoPf: number
  masterForEsi: string
  masterEsiGross: number
  masterCoEsi: number
  masterCtcPm: number
  masterCtcPa: number
  variablePayPa: number
  masterCtcPaTotal: number

  lop: number
  daysForSalary: number
  daysPresent: number
  daysAbsent: number
  lateDays: number
  lateLopDays: number
  approvedLeaveDays: number
  holidayDays: number
  weeklyOffDays: number

  monthlyBasic: number
  monthlyHra: number
  monthlyOthers: number
  monthlySpecial1: number
  monthlySpecial2: number
  monthlyGross: number
  grossHra: number

  employeePf: number
  employeeEsi: number
  employeeTds: number
  employeePt: number
  employeeDeduction1: number
  employeeDeduction2: number
  totalDeduction: number
  tda: number
  adjustmentTotal: number
  netPay: number

  employerPf: number
  adminCharges: number
  edliCharges: number
  employerEsi: number
  totalEmployerCost: number

  configVersion: string | null
  calculatedAt: string
  period?: PayrollPeriod
  user?: { id: string; name: string; employeeCode: string | null; email: string }
}

/** The calculate endpoint returns the same shape plus the period-level day counts. */
export interface PayrollCalculation extends Omit<PayrollRecord, 'id' | 'periodId' | 'isCurrent' | 'calculatedAt'> {
  month: number
  year: number
  calendarDays: number
  daysInMonth: number
}

export interface PayrollPeriod {
  id: string
  month: number
  year: number
  cycleStart: string
  cycleEnd: string
  calendarDays: number
  daysInMonth: number
  status: 'Draft' | 'Approved' | 'Reopened' | 'Paid'
  approvedById: string | null
  approvedAt: string | null
  records?: PayrollRecord[]
  _count?: { records: number }
}

export interface DirectoryRow {
  id: string
  employeeCode: string | null
  name: string
  email: string
  designation: string | null
  department: string | null
  role: string
  isActive: boolean
  dateOfBirth: string | null
  joiningDate: string | null
  probationDays: number | null
  confirmationDate: string | null
  dorLetterDate: string | null
  lastWorkingDate: string | null
  priorExperienceMonths: number
  experienceInAspcvMonths: number
  lifecycle: 'Joiner' | 'Leaver' | 'Stayer' | null
  isJoiner: boolean
  isLeaver: boolean
  // Present only for callers with salary:read_all.
  masterGross?: number | null
  masterBasic?: number | null
  masterHra?: number | null
  masterOthers?: number | null
  pfApplicable?: boolean
  esiApplicable?: boolean
  payroll?: PayrollRecord | null
}

export interface PayrollAdjustment {
  id: string
  userId: string
  month: number
  year: number
  amount: number
  type: string
  reason: string
  createdById: string
  approvedById: string | null
  approvedAt: string | null
  createdAt: string
  createdBy?: { id: string; name: string }
}

interface Paginated<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export function useEmployeeDirectory(params: {
  search?: string
  status?: string
  departmentId?: string
  month: number
  year: number
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: [KEY, 'directory', params],
    queryFn: () => api.get<Paginated<DirectoryRow>>('/payroll/directory', { params }).then((r) => r.data),
  })
}

/** Live calculation preview; does not persist anything. */
export function usePayrollCalculation(userId: string | null, month: number, year: number) {
  return useQuery({
    queryKey: [KEY, 'calculate', userId, month, year],
    queryFn: () =>
      api.get<PayrollCalculation>(`/payroll/calculate/${userId}`, { params: { month, year } }).then((r) => r.data),
    enabled: !!userId,
    retry: false,
  })
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: [KEY, 'periods'],
    queryFn: () => api.get<PayrollPeriod[]>('/payroll/periods').then((r) => r.data),
  })
}

export function usePayrollPeriod(month: number, year: number) {
  return useQuery({
    queryKey: [KEY, 'period', month, year],
    queryFn: () => api.get<PayrollPeriod>(`/payroll/periods/${month}/${year}`).then((r) => r.data),
    retry: false,
  })
}

export function usePayrollHistory(userId: string | null) {
  return useQuery({
    queryKey: [KEY, 'history', userId],
    queryFn: () => api.get<PayrollRecord[]>(`/payroll/history/${userId}`).then((r) => r.data),
    enabled: !!userId,
  })
}

export function useRunPayroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId?: string; month: number; year: number }) =>
      api.post('/payroll/run', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useApprovePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      api.patch(`/payroll/periods/${month}/${year}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useReopenPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      api.patch(`/payroll/periods/${month}/${year}/reopen`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useMarkPeriodPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      api.patch(`/payroll/periods/${month}/${year}/paid`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function usePayrollAdjustments(userId: string | null, month?: number, year?: number) {
  return useQuery({
    queryKey: [KEY, 'adjustments', userId, month, year],
    queryFn: () =>
      api
        .get<PayrollAdjustment[]>(`/payroll/adjustments/${userId}`, { params: { month, year } })
        .then((r) => r.data),
    enabled: !!userId,
  })
}

export function useCreateAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      userId: string
      month: number
      year: number
      amount: number
      type?: string
      reason: string
    }) => api.post('/payroll/adjustments', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useApproveAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/adjustments/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
