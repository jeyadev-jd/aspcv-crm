import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Designation { id: string; name: string; isActive: boolean }

const KEY = 'designations'

export function useDesignations() {
  return useQuery<Designation[]>({
    queryKey: [KEY],
    queryFn: () => api.get('/designations').then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useCreateDesignation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post('/designations', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
