import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BusinessRule {
  id: string
  key: string
  name: string
  module: string
  description: string | null
  enabled: boolean
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RuleTriggerLog {
  id: string
  entityType: string
  entityId: string
  tierKey: string
  severity: string
  message: string
  firedAt: string
}

export function useBusinessRules() {
  return useQuery<BusinessRule[]>({
    queryKey: ['business-rules'],
    queryFn: () => api.get('/business-rules').then(r => r.data),
  })
}

export function useRuleTriggers(ruleId: string | null) {
  return useQuery<RuleTriggerLog[]>({
    queryKey: ['business-rules', ruleId, 'triggers'],
    queryFn: () => api.get(`/business-rules/${ruleId}/triggers`).then(r => r.data),
    enabled: !!ruleId,
  })
}

export function useUpdateBusinessRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; enabled?: boolean; config?: object }) =>
      api.patch(`/business-rules/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-rules'] }),
  })
}

export function useRunBusinessRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/business-rules/run'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-rules'] }),
  })
}
