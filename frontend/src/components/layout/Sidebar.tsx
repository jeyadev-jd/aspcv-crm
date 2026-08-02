import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, UserCheck, Briefcase,
  Package, FolderOpen, CheckSquare, Calendar,
  FileText, LifeBuoy, BarChart2, Settings, Bell, HelpCircle, Wrench,
  ClipboardList, Boxes, UserCircle, Clock, Wallet,
  ShieldCheck, ClipboardCheck, Store, Archive, PieChart, ShieldAlert, Zap,
  Target, Award, BarChart3, UserPlus,
} from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'

interface NavItem {
  icon: React.ElementType
  to: string
  label: string
  permission?: [string, string]
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'SALES',
    items: [
      { icon: LayoutDashboard, to: '/',         label: 'Dashboard' },
      { icon: UserCheck,       to: '/leads',    label: 'Leads',    permission: ['lead', 'read_own'] },
      { icon: Briefcase,       to: '/deals',    label: 'Deals',    permission: ['deal', 'read_own'] },
      { icon: Building2,       to: '/accounts', label: 'Accounts', permission: ['company', 'read_all'] },
      { icon: Users,           to: '/contacts', label: 'Contacts', permission: ['contact', 'read_own'] },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      // ESCO contracts live as a tab inside /projects.
      { icon: FolderOpen,   to: '/projects',          label: 'Projects' },
      { icon: CheckSquare,  to: '/tasks',             label: 'Tasks' },
      { icon: Calendar,     to: '/calendar',          label: 'Calendar' },
    ],
  },
  {
    label: 'HR',
    items: [
      // Directory, Payroll, Salary Structure, Recruitment,
      // Onboarding and HR Settings all live as tabs inside /hr.
      { icon: UserCircle, to: '/hr',         label: 'Employees' },
      { icon: Clock,      to: '/attendance', label: 'Attendance' },
      { icon: Calendar,   to: '/leave',      label: 'Leave' },
      { icon: Wallet,     to: '/reimbursements', label: 'Reimbursements' },
      { icon: BarChart3, to: '/hr-reports',  label: 'HR Reports', permission: ['hr_user', 'read_all'] },
      { icon: UserCircle, to: '/profile',    label: 'My Profile' },
    ],
  },
  {
    label: 'WAREHOUSE',
    items: [
      { icon: ClipboardList, to: '/warehouse',          label: 'Warehouse' },
      { icon: Boxes,         to: '/raw-components',     label: 'Inventory',    permission: ['component', 'read_all'] },
      { icon: Store,         to: '/dealers',            label: 'Dealers' },
      { icon: Package,       to: '/items',              label: 'Items' },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { icon: FileText,  to: '/invoices',   label: 'Invoices',       permission: ['invoice', 'read_all'] },
      // Budget moved into the Projects module as a tab.
    ],
  },
  {
    label: 'SUPPORT',
    items: [
      { icon: LifeBuoy, to: '/support', label: 'Tickets', permission: ['support', 'create'] },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { icon: BarChart2,      to: '/reports',    label: 'Reports' },
      { icon: Settings,       to: '/settings',   label: 'Settings' },
      { icon: ShieldCheck,    to: '/roles',      label: 'Roles & Perms', permission: ['role_admin', 'manage'] },
      { icon: Users,          to: '/users',      label: 'Users',          permission: ['role_admin', 'manage'] },
      { icon: ShieldAlert,    to: '/audit-logs', label: 'Audit Log',      permission: ['audit_log', 'read_all'] },
      { icon: Zap,            to: '/business-rules', label: 'Business Rules', permission: ['business_rule', 'read_all'] },
      { icon: ClipboardCheck, to: '/approvals',  label: 'Approvals',     permission: ['approval_request', 'review'] },
    ],
  },
]

interface SidebarProps { collapsed: boolean; mobileOpen?: boolean }

export default function Sidebar({ collapsed, mobileOpen }: SidebarProps) {
  const can = useAuthStore((s) => s.can)
  const user = useAuthStore((s) => s.user)
  const isMobile = mobileOpen !== undefined
  const w = isMobile ? 224 : collapsed ? 60 : 224
  const showLabels = isMobile ? true : !collapsed

  const transform = isMobile
    ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
    : 'translateX(0)'

  const initials = user?.name ? user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : 'U'

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100%',
      width: w, background: '#fff',
      borderRight: '1px solid #F0F1F5',
      display: 'flex', flexDirection: 'column',
      zIndex: 30,
      transition: isMobile ? 'transform 0.25s cubic-bezier(.4,0,.2,1)' : 'width 0.2s',
      transform,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: showLabels ? '14px 16px' : '14px 12px',
        borderBottom: '1px solid #F0F1F5', height: 64, flexShrink: 0,
      }}>
        {showLabels ? (
          <img
            src="/aspcv-logo.png"
            alt="ASPCV — Aspiration Cleantech"
            style={{ height: 34, maxWidth: 168, objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <img
            src="/aspcv-logo1.png"
            alt="ASPCV"
            style={{ width: 34, height: 34, objectFit: 'cover', display: 'block', margin: '0 auto', borderRadius: '50%' }}
          />
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px' }}>
        {navGroups.map(group => {
          const visibleItems = group.items.filter(item =>
            !item.permission || can(item.permission[0], item.permission[1])
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label} style={{ marginBottom: 4 }}>
              {showLabels && (
                <p style={{
                  fontSize: 9, fontWeight: 700, color: '#C4C4CF', letterSpacing: 0.8,
                  padding: '10px 12px 4px', whiteSpace: 'nowrap',
                }}>
                  {group.label}
                </p>
              )}
              {!showLabels && <div style={{ height: 8 }} />}
              {visibleItems.map(({ icon: Icon, to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center',
                    gap: 10, padding: showLabels ? '9px 12px' : '9px 11px',
                    borderRadius: 10, textDecoration: 'none',
                    marginBottom: 2,
                    background: isActive ? '#5D78FF' : 'transparent',
                    color: isActive ? '#fff' : '#B1B1BE',
                    fontSize: 12, fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    transition: 'background 0.15s',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} style={{ flexShrink: 0, color: isActive ? '#fff' : '#B1B1BE' }} />
                      {showLabels && <span>{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid #F0F1F5', padding: '8px 8px', flexShrink: 0 }}>
        {/* Notifications routes to the full history page; Help has no target yet. */}
        <NavLink
          to="/notifications"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: showLabels ? '9px 12px' : '9px 11px',
            borderRadius: 10, textDecoration: 'none', marginBottom: 2,
            background: isActive ? '#5D78FF' : 'transparent',
            color: isActive ? '#fff' : '#B1B1BE',
            fontSize: 12, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden',
          })}
        >
          {({ isActive }) => (
            <>
              <Bell size={16} style={{ flexShrink: 0, color: isActive ? '#fff' : '#B1B1BE' }} />
              {showLabels && <span>Notifications</span>}
            </>
          )}
        </NavLink>
        <NavLink
          to="/help"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: showLabels ? '9px 12px' : '9px 11px',
            borderRadius: 10, textDecoration: 'none', marginBottom: 2,
            background: isActive ? '#5D78FF' : 'transparent',
            color: isActive ? '#fff' : '#B1B1BE',
            fontSize: 12, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden',
          })}
        >
          {({ isActive }) => (
            <>
              <HelpCircle size={16} style={{ flexShrink: 0, color: isActive ? '#fff' : '#B1B1BE' }} />
              {showLabels && <span>Help</span>}
            </>
          )}
        </NavLink>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: showLabels ? '8px 12px' : '8px 11px', marginTop: 4,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#5D78FF,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials}</span>
          </div>
          {showLabels && (
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap' }}>{user?.name ?? 'User'}</p>
              <p style={{ fontSize: 11, color: '#B1B1BE', whiteSpace: 'nowrap' }}>{user?.roleName ?? user?.role ?? ''}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
