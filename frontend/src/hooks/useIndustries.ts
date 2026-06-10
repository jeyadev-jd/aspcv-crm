import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Industry { id: string; name: string; isActive: boolean }

export function useIndustries() {
  return useQuery<Industry[]>({
    queryKey: ['industries'],
    queryFn: () => api.get('/industries').then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useCreateIndustry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post('/industries', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['industries'] }),
  })
}
