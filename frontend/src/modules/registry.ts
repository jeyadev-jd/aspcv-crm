export interface ModuleConfig {
  key: string
  label: string
  nav: { group: string; icon: string; path: string }
  active: boolean
}

export const MODULE_REGISTRY: ModuleConfig[] = [
  { key: 'lead',         label: 'Leads',        nav: { group: 'SALES',      icon: 'UserCheck',    path: '/leads' },         active: true  },
  { key: 'deal',         label: 'Deals',         nav: { group: 'SALES',      icon: 'Handshake',    path: '/deals' },         active: true  },
  { key: 'project',      label: 'Projects',      nav: { group: 'OPERATIONS', icon: 'FolderKanban', path: '/projects' },      active: true  },
  { key: 'installation', label: 'Installation',  nav: { group: 'OPERATIONS', icon: 'Wrench',       path: '/installations' }, active: false },
  { key: 'support',      label: 'Support',       nav: { group: 'SUPPORT',    icon: 'Headphones',   path: '/support' },       active: true  },
  { key: 'quotation',    label: 'Quotations',    nav: { group: 'SALES',      icon: 'FileText',     path: '/quotations' },    active: false },
  { key: 'amc',          label: 'AMC',           nav: { group: 'SUPPORT',    icon: 'Shield',       path: '/amc' },           active: false },
]

export const activeModules = () => MODULE_REGISTRY.filter(m => m.active)
