export interface SearchResult {
  id: string
  type: 'Lead' | 'Contact' | 'Account' | 'Deal' | 'Project' | 'Ticket'
  title: string
  sub: string
  route: string
}

export const searchIndex: SearchResult[] = [
  // Leads
  { id: 'l1', type: 'Lead', title: 'Sarah Mitchell', sub: 'Yorkshire Housing Trust · Qualified', route: '/leads' },
  { id: 'l2', type: 'Lead', title: 'Tom Bradshaw', sub: 'GreenBuild Developers · Contacted', route: '/leads' },
  { id: 'l3', type: 'Lead', title: 'Fiona Clarke', sub: 'Eco Living Solutions · New', route: '/leads' },
  { id: 'l4', type: 'Lead', title: 'Ahmed Hassan', sub: 'Northern Homes Ltd · New', route: '/leads' },
  { id: 'l5', type: 'Lead', title: 'Liz Thornton', sub: 'BioWarm Engineering · Qualified', route: '/leads' },
  { id: 'l6', type: 'Lead', title: 'Oliver Grant', sub: 'Apex Sustainability Ltd · Qualified', route: '/leads' },
  // Accounts
  { id: 'a1', type: 'Account', title: 'Yorkshire Housing Trust', sub: 'Housing · Active', route: '/accounts' },
  { id: 'a2', type: 'Account', title: 'GreenBuild Developers', sub: 'Construction · Active', route: '/accounts' },
  { id: 'a3', type: 'Account', title: 'BioWarm Engineering', sub: 'Engineering · Active', route: '/accounts' },
  { id: 'a4', type: 'Account', title: 'Apex Sustainability Ltd', sub: 'Sustainability · Active', route: '/accounts' },
  { id: 'a5', type: 'Account', title: 'Clean Energy Estates', sub: 'Real Estate · Active', route: '/accounts' },
  { id: 'a6', type: 'Account', title: 'Northern Homes Ltd', sub: 'Housing · Active', route: '/accounts' },
  // Contacts
  { id: 'c1', type: 'Contact', title: 'Sarah Mitchell', sub: 'Procurement Manager · Yorkshire Housing Trust', route: '/contacts' },
  { id: 'c2', type: 'Contact', title: 'Tom Bradshaw', sub: 'Director · GreenBuild Developers', route: '/contacts' },
  { id: 'c3', type: 'Contact', title: 'Oliver Grant', sub: 'Sustainability Dir. · Apex Sustainability Ltd', route: '/contacts' },
  { id: 'c4', type: 'Contact', title: 'Liz Thornton', sub: 'Head of Engineering · BioWarm Engineering', route: '/contacts' },
  // Deals
  { id: 'd1', type: 'Deal', title: 'YHT Phase 1 ASHP', sub: 'Yorkshire Housing Trust · £125,000 · Negotiation', route: '/deals' },
  { id: 'd2', type: 'Deal', title: 'GreenBuild Solar Install', sub: 'GreenBuild Developers · £78,000 · Proposal', route: '/deals' },
  { id: 'd3', type: 'Deal', title: 'BioWarm HRV Contract', sub: 'BioWarm Engineering · £210,000 · Closed Won', route: '/deals' },
  { id: 'd4', type: 'Deal', title: 'Apex GSHP Enterprise', sub: 'Apex Sustainability · £340,000 · Proposal', route: '/deals' },
  { id: 'd5', type: 'Deal', title: 'Northern Homes Battery', sub: 'Northern Homes Ltd · £92,000 · Negotiation', route: '/deals' },
  // Projects
  { id: 'p1', type: 'Project', title: 'YHT Phase 1 – ASHP Installation', sub: 'Yorkshire Housing Trust · Active', route: '/projects' },
  { id: 'p2', type: 'Project', title: 'GreenBuild Solar Rooftop', sub: 'GreenBuild Developers · Active', route: '/projects' },
  { id: 'p3', type: 'Project', title: 'BioWarm HRV Retrofit Programme', sub: 'BioWarm Engineering · Completed', route: '/projects' },
  // Tickets
  { id: 't1', type: 'Ticket', title: 'TKT-001: ASHP unit not heating', sub: 'Yorkshire Housing Trust · High · In Progress', route: '/support' },
  { id: 't2', type: 'Ticket', title: 'TKT-003: Solar inverter offline', sub: 'GreenBuild Developers · High · Open', route: '/support' },
  { id: 't3', type: 'Ticket', title: 'TKT-002: HRV filter blockage', sub: 'BioWarm Engineering · Medium · Open', route: '/support' },
]

export function searchRecords(query: string): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return searchIndex
    .filter(r => r.title.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q) || r.type.toLowerCase().includes(q))
    .slice(0, 8)
}

export const typeColor: Record<string, { bg: string; color: string }> = {
  Lead:    { bg: '#E8EDFF', color: '#5D78FF' },
  Contact: { bg: '#E7FAF0', color: '#2BC155' },
  Account: { bg: '#FFF5EE', color: '#FF9B52' },
  Deal:    { bg: '#E7FAF0', color: '#2BC155' },
  Project: { bg: '#E8EDFF', color: '#5D78FF' },
  Ticket:  { bg: '#FFF3F3', color: '#FF5353' },
}
