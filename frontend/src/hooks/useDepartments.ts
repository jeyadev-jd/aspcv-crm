import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Department { id: string; name: string; isActive: boolean }
export interface DepartmentMember { id: string; name: string; email: string; role: string; roleName: string }

const KEY = 'departments'

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: [KEY],
    queryFn: () => api.get('/departments').then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post('/departments', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDepartmentMembers(id: string | null) {
  return useQuery<DepartmentMember[]>({
    queryKey: [KEY, id, 'members'],
    queryFn: () => api.get(`/departments/${id}/members`).then(r => r.data),
    enabled: !!id,
  })
}
