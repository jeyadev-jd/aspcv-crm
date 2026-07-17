export interface PaginationParams {
  page: number
  pageSize: number
  skip: number
  take: number
  sort?: string
  order: 'asc' | 'desc'
  search?: string
}

export interface PaginatedResult<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export function parsePagination(query: Record<string, unknown>, defaultSort?: string): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(query.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
  const order = query.order === 'asc' ? 'asc' : 'desc'
  const sort = typeof query.sort === 'string' && query.sort ? query.sort : defaultSort
  const search = typeof query.search === 'string' && query.search ? query.search : undefined
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, sort, order, search }
}

export function paginate<T>(data: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  return {
    data,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  }
}
