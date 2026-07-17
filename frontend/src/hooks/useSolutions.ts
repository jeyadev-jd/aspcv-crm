import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { createMasterDataHooks } from './useMasterData'

export interface Solution {
  id: string
  name: string
  categoryId: string
  category: { id: string; name: string }
}

export const { useList: useSolutionCategories, useCreate: useCreateSolutionCategory, useDelete: useDeleteSolutionCategory } = createMasterDataHooks('solutions/categories', 'solution-categories')
export const { useList: useSolutionAccessories, useCreate: useCreateSolutionAccessory, useDelete: useDeleteSolutionAccessory } = createMasterDataHooks('solutions/accessories', 'solution-accessories')

export function useSolutions(categoryId?: string) {
  return useQuery<Solution[]>({
    queryKey: ['solutions', categoryId],
    queryFn: () => api.get('/solutions', { params: categoryId ? { categoryId } : {} }).then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useCreateSolution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { categoryId: string; name: string }) => api.post('/solutions', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solutions'] }),
  })
}
