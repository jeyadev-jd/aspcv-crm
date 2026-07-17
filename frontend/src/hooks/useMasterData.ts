import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface MasterDataItem {
  id: string
  name: string
  code?: string | null
  description?: string | null
  displayOrder: number
  isActive: boolean
}

/**
 * Generic list/create/delete hooks for the flat ERP Phase 1 master-data endpoints
 * (Region/Country/CommercialModel/LeadSourceMaster/ReasonCode/CapacityUnit/
 * SolutionCategory/SolutionAccessory) — mirrors useDepartments.ts, kept generic so
 * 7+ near-identical hook files don't get hand-duplicated.
 */
export function createMasterDataHooks(endpoint: string, key: string) {
  function useList() {
    return useQuery<MasterDataItem[]>({
      queryKey: [key],
      queryFn: () => api.get(`/${endpoint}`).then(r => r.data),
      staleTime: 5 * 60_000,
    })
  }
  function useCreate() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (data: { name: string; code?: string; description?: string; displayOrder?: number }) =>
        api.post(`/${endpoint}`, data).then(r => r.data),
      onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
    })
  }
  function useDelete() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (id: string) => api.delete(`/${endpoint}/${id}`).then(r => r.data),
      onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
    })
  }
  return { useList, useCreate, useDelete }
}
