import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Phase 2a: Customer 360 is deliberately NOT one monolithic endpoint — each section below
// is its own small, independently paginated query against the existing resource API
// (leads/deals/projects/invoices/support already support ?companyId=&page=&pageSize=).
// This keeps each panel cheap, cacheable on its own key, and scalable as record counts grow.
export interface Page<T> { data: T[]; page: number; pageSize: number; total: number; totalPages: number }

function useCompanyScoped<T>(resource: string, companyId: string, page: number, pageSize = 5, extraKey?: string) {
  return useQuery<Page<T>>({
    queryKey: ['customer360', resource, companyId, page, pageSize, extraKey],
    queryFn: () => api.get(`/${resource}`, { params: { companyId, page, pageSize, sort: 'createdAt', order: 'desc' } }).then(r => r.data),
    enabled: !!companyId,
    staleTime: 15_000,
  })
}

export function useCompanyContacts(companyId: string, page: number) { return useCompanyScoped('contacts', companyId, page) }
export function useCompanyLeads(companyId: string, page: number) { return useCompanyScoped('leads', companyId, page) }
export function useCompanyDeals(companyId: string, page: number) { return useCompanyScoped('deals', companyId, page) }
export function useCompanyProjects(companyId: string, page: number) { return useCompanyScoped('projects', companyId, page) }
export function useCompanyInvoices(companyId: string, page: number) { return useCompanyScoped('invoices', companyId, page) }
export function useCompanyTickets(companyId: string, page: number) { return useCompanyScoped('support', companyId, page) }
export function useCompanyInstallations(companyId: string, page: number) { return useCompanyScoped('installations', companyId, page) }
