import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  ifscCode: string
  isDefault: boolean
  createdAt: string
}

export function useBankAccounts() {
  return useQuery<BankAccount[]>({
    queryKey: ['bankAccounts'],
    queryFn: () => api.get('/bank-accounts').then(r => r.data),
    staleTime: 60_000,
  })
}

export function useCreateBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<BankAccount>) => api.post('/bank-accounts', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bankAccounts'] }),
  })
}

export function useUpdateBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<BankAccount> & { id: string }) =>
      api.patch(`/bank-accounts/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bankAccounts'] }),
  })
}

export function useDeleteBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/bank-accounts/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bankAccounts'] }),
  })
}
