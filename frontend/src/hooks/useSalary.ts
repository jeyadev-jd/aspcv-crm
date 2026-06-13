import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface SalaryRecord {
  id: string
  userId: string
  month: number
  year: number
  baseSalary: number
  hra: number
  allowances: number
  grossSalary: number
  pfEmployee: number
  pfEmployer: number
  esiEmployee: number
  esiEmployer: number
  tds: number
  lateDeduction: number
  otherDeduction: number
  netSalary: number
  daysPresent: number
  daysAbsent: number
  lateDays: number
  halfDayCuts: number
  fullDayCuts: number
  status: 'draft' | 'approved' | 'paid'
  paidAt?: string
  createdAt: string
  user?: { id: string; name: string; role: string; department?: string }
}

export function useMySalary() {
  return useQuery<SalaryRecord[]>({
    queryKey: ['salary', 'my'],
    queryFn: () => api.get('/salary/my').then(r => r.data),
  })
}

export function useAllSalary(month?: number, year?: number, userId?: string) {
  return useQuery<SalaryRecord[]>({
    queryKey: ['salary', 'all', month, year, userId],
    queryFn: () => api.get('/salary/all', { params: { month, year, userId } }).then(r => r.data),
  })
}

export function useGenerateSalary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { userId: string; month: number; year: number }) =>
      api.post('/salary/generate', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary'] }),
  })
}

export function useApproveSalary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/salary/${id}/approve`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary'] }),
  })
}

export function useMarkSalaryPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/salary/${id}/paid`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary'] }),
  })
}
