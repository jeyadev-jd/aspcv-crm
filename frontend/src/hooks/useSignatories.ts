import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Signatory {
  id: string
  name: string
  designation?: string | null
  signatureData?: string | null
  isDefault: boolean
  createdAt: string
}

export function useSignatories() {
  return useQuery<Signatory[]>({
    queryKey: ['signatories'],
    queryFn: () => api.get('/signatories').then(r => r.data),
    staleTime: 60_000,
  })
}

export function useCreateSignatory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Signatory>) => api.post('/signatories', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signatories'] }),
  })
}

export function useUpdateSignatory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Signatory> & { id: string }) =>
      api.patch(`/signatories/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signatories'] }),
  })
}

export function useDeleteSignatory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/signatories/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signatories'] }),
  })
}
