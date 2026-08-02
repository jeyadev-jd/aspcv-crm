export interface SearchResult {
  id: string
  type: 'Lead' | 'Contact' | 'Account' | 'Deal' | 'Project' | 'Ticket' | 'Invoice'
  title: string
  sub: string
  route: string
}

// Results come from GET /api/search against the live database — there is no
// client-side index, so records created during the session are searchable
// immediately and read permissions are applied server-side.
export const typeColor: Record<string, { bg: string; color: string }> = {
  Lead:    { bg: '#E8EDFF', color: '#5D78FF' },
  Contact: { bg: '#E7FAF0', color: '#2BC155' },
  Account: { bg: '#FFF5EE', color: '#FF9B52' },
  Deal:    { bg: '#E7FAF0', color: '#2BC155' },
  Project: { bg: '#E8EDFF', color: '#5D78FF' },
  Ticket:  { bg: '#FFF3F3', color: '#FF5353' },
  Invoice: { bg: '#F3E8FF', color: '#A855F7' },
}
