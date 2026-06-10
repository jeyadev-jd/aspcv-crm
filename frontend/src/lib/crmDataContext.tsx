import { createContext, useContext } from 'react'
import type React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

// Kept compatible with existing page code
export interface Account {
  id: string; name: string; industry: string; website: string; phone: string
  email: string; address: string; employees: number
  status: 'Active' | 'Inactive' | 'Prospect'; openDeals: number; revenue: number
}

export interface Contact {
  id: string; firstName: string; lastName: string; title: string
  email: string; phone: string; mobile: string; department: string
  account: string; status: 'Active' | 'Inactive'
}

// Map Company API response → Account interface
function toAccount(c: Record<string, any>): Account {
  return {
    id: c.id,
    name: c.name,
    industry: c.industry ?? 'Other',
    website: c.website ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    address: [c.area?.name, c.city?.name, c.state].filter(Boolean).join(', '),
    employees: 0,
    status: c.isActive ? (c._count?.leads > 0 ? 'Active' : 'Prospect') : 'Inactive',
    openDeals: c._count?.leads ?? 0,
    revenue: 0,
  }
}

// Map Contact API response → Contact interface
function toContact(c: Record<string, any>): Contact {
  const parts = (c.name as string).split(' ')
  return {
    id: c.id,
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    title: c.designation ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    mobile: c.whatsapp ?? '',
    department: '',
    account: c.company?.name ?? '',
    status: c.isActive ? 'Active' : 'Inactive',
  }
}

interface CrmDataContextValue {
  accounts: Account[]
  contacts: Contact[]
  isLoading: boolean
  addAccount: (partial: Partial<Account> & { name: string }) => Promise<Account>
  addContact: (partial: Partial<Contact> & { firstName: string; lastName: string; email: string }) => Promise<Contact>
  // Legacy setters — invalidate queries instead of direct mutation
  setAccounts: (updater: ((prev: Account[]) => Account[]) | Account[]) => void
  setContacts: (updater: ((prev: Contact[]) => Contact[]) | Contact[]) => void
}

const CrmDataContext = createContext<CrmDataContextValue | null>(null)

export function CrmDataProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()

  const hasToken = !!localStorage.getItem('crm_token')

  const { data: rawCompanies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get('/companies').then(r => r.data as Record<string, any>[]),
    enabled: hasToken,
    staleTime: 30_000,
  })

  const { data: rawContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.get('/contacts').then(r => r.data as Record<string, any>[]),
    enabled: hasToken,
    staleTime: 30_000,
  })

  const accounts = rawCompanies.map(toAccount)
  const contacts = rawContacts.map(toContact)

  async function addAccount(partial: Partial<Account> & { name: string }): Promise<Account> {
    const { data } = await api.post('/companies', {
      name: partial.name,
      industry: partial.industry,
      phone: partial.phone,
      email: partial.email,
      website: partial.website,
    })
    await qc.invalidateQueries({ queryKey: ['companies'] })
    return toAccount(data)
  }

  async function addContact(partial: Partial<Contact> & { firstName: string; lastName: string; email: string }): Promise<Contact> {
    // companyId must be resolved by caller — fall back to first matching account
    const name = `${partial.firstName} ${partial.lastName}`.trim()
    const accountName = partial.account ?? ''
    const matchedCompany = rawCompanies.find((c: any) => c.name.toLowerCase() === accountName.toLowerCase())
    if (!matchedCompany) throw new Error(`Company "${accountName}" not found`)
    const { data } = await api.post('/contacts', {
      companyId: matchedCompany.id,
      name,
      designation: partial.title,
      email: partial.email,
      phone: partial.phone,
      whatsapp: partial.mobile,
    })
    await qc.invalidateQueries({ queryKey: ['contacts'] })
    return toContact({ ...data, company: matchedCompany })
  }

  // Legacy setters — no-op (data comes from server); invalidate instead
  function setAccounts(_: any) { qc.invalidateQueries({ queryKey: ['companies'] }) }
  function setContacts(_: any) { qc.invalidateQueries({ queryKey: ['contacts'] }) }

  return (
    <CrmDataContext.Provider value={{
      accounts, contacts,
      isLoading: loadingCompanies || loadingContacts,
      addAccount, addContact, setAccounts, setContacts
    }}>
      {children}
    </CrmDataContext.Provider>
  )
}

export function useCrmData() {
  const ctx = useContext(CrmDataContext)
  if (!ctx) throw new Error('useCrmData must be used within CrmDataProvider')
  return ctx
}
