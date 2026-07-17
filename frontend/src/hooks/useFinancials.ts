import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface FinancialEntry {
  id: string
  type: 'asset' | 'liability'
  name: string
  amount: number
  category?: string
  asOf: string
  notes?: string
  createdAt: string
}

export interface FinancialSummary {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

export function useFinancials(type?: 'asset' | 'liability') {
  return useQuery<FinancialEntry[]>({
    queryKey: ['financials', type],
    queryFn: () => api.get('/financials', { params: { pageSize: 1000, ...(type ? { type } : {}) } }).then(r => r.data.data),
  })
}

export function useFinancialSummary() {
  return useQuery<FinancialSummary>({
    queryKey: ['financials', 'summary'],
    queryFn: () => api.get('/financials/summary').then(r => r.data),
  })
}

export function useCreateFinancialEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<FinancialEntry, 'id' | 'createdAt'>) =>
      api.post('/financials', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financials'] }),
  })
}

export function useDeleteFinancialEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/financials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financials'] }),
  })
}
