import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Expense {
  id: string
  title: string
  amount: number
  category: string
  entityType?: string
  entityId?: string
  date: string
  notes?: string
  createdAt: string
}

export function useExpenses(params?: { category?: string; from?: string; to?: string }) {
  return useQuery<Expense[]>({
    queryKey: ['expenses', params],
    queryFn: () => api.get('/expenses', { params }).then(r => r.data),
  })
}

export function useExpenseSummary(months?: number) {
  return useQuery<Array<{ amount: number; category: string; date: string }>>({
    queryKey: ['expenses', 'summary', months],
    queryFn: () => api.get('/expenses/summary', { params: { months: months ?? 6 } }).then(r => r.data),
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Expense, 'id' | 'createdAt'>) =>
      api.post('/expenses', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
