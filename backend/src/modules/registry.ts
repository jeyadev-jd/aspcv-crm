export interface ModuleConfig {
  key: string
  label: string
  routePrefix: string
  nav: { group: string; icon: string; path: string }
  active: boolean
}

export const MODULE_REGISTRY: ModuleConfig[] = [
  { key: 'lead',         label: 'Leads',        routePrefix: '/api/leads',         nav: { group: 'SALES',      icon: 'UserCheck',    path: '/leads' },         active: true  },
  { key: 'deal',         label: 'Deals',         routePrefix: '/api/deals',         nav: { group: 'SALES',      icon: 'Handshake',    path: '/deals' },         active: true  },
  { key: 'project',      label: 'Projects',      routePrefix: '/api/projects',      nav: { group: 'OPERATIONS', icon: 'FolderKanban', path: '/projects' },      active: true  },
  { key: 'installation', label: 'Installation',  routePrefix: '/api/installations', nav: { group: 'OPERATIONS', icon: 'Wrench',       path: '/installations' }, active: false },
  { key: 'support',      label: 'Support',       routePrefix: '/api/support',       nav: { group: 'SUPPORT',    icon: 'Headphones',   path: '/support' },       active: true  },
  { key: 'quotation',    label: 'Quotations',    routePrefix: '/api/quotations',    nav: { group: 'SALES',      icon: 'FileText',     path: '/quotations' },    active: false },
  { key: 'amc',          label: 'AMC',           routePrefix: '/api/amc',           nav: { group: 'SUPPORT',    icon: 'Shield',       path: '/amc' },           active: false },
]

export const activeModules = () => MODULE_REGISTRY.filter(m => m.active)
