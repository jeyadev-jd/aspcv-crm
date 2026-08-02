import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface CrmUser {
  id: string
  name: string
  email: string
  role: string
  isActive?: boolean
  designation?: { id: string; name: string } | null
  dateOfBirth?: string | null
  joiningDate?: string | null
  department?: { id: string; name: string } | null
  departmentId?: string | null
  baseSalary?: number | null
  hra?: number | null
  allowances?: number | null
  pfApplicable?: boolean
  esiApplicable?: boolean
  uan?: string | null
  esiNumber?: string | null
  pan?: string | null
  bankAccount?: string | null
  ifsc?: string | null
  bankName?: string | null
  emergencyContact?: string | null
  createdAt?: string
}

export function useUsers(enabled = true) {
  return useQuery<CrmUser[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users', { params: { pageSize: 1000 } }).then(r => r.data.data),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string } & Partial<CrmUser>) =>
      api.post('/users', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CrmUser> & { id: string; password?: string }) =>
      api.patch(`/users/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export const CRM_ROLES = [
  'SuperAdmin', 'BusinessHead', 'ProjectHead', 'SalesHead', 'Manager',
  'SeniorEngineer', 'Engineer', 'Technician', 'Accountant', 'HR', 'Viewer',
]

