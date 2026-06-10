import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, UserCheck, Briefcase,
  Package, FolderOpen, CheckSquare, KanbanSquare, Calendar,
  FileText, LifeBuoy, BarChart2, Settings, Bell, HelpCircle, Wrench,
} from 'lucide-react'

const navGroups = [
  {
    label: 'SALES',
    items: [
      { icon: LayoutDashboard, to: '/',          label: 'Dashboard' },
      { icon: UserCheck,       to: '/leads',     label: 'Leads' },
      { icon: Building2,       to: '/accounts',  label: 'Accounts' },
      { icon: Users,           to: '/contacts',  label: 'Contacts' },
      { icon: Briefcase,       to: '/deals',     label: 'Deals' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { icon: Package,      to: '/products',  label: 'Products' },
      { icon: FolderOpen,   to: '/projects',       label: 'Projects' },
      { icon: Wrench,       to: '/installations',  label: 'Installation' },
      { icon: CheckSquare,  to: '/tasks',     label: 'Tasks' },
      { icon: KanbanSquare, to: '/kanban',    label: 'Kanban' },
      { icon: Calendar,     to: '/calendar',  label: 'Calendar' },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { icon: FileText, to: '/invoices', label: 'Invoices' },
    ],
  },
  {
    label: 'SUPPORT',
    items: [
      { icon: LifeBuoy, to: '/support', label: 'Tickets' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { icon: BarChart2, to: '/reports',  label: 'Reports' },
      { icon: Settings,  to: '/settings', label: 'Settings' },
    ],
  },
]

interface SidebarProps { collapsed: boolean; mobileOpen?: boolean }

export default function Sidebar({ collapsed, mobileOpen }: SidebarProps) {
  const isMobile = mobileOpen !== undefined
  const w = isMobile ? 224 : collapsed ? 60 : 224
  const showLabels = isMobile ? true : !collapsed

  const transform = isMobile
    ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
    : 'translateX(0)'

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
        <img
          src="/aspcv-logo.png"
          alt="ASPCV"
          style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }}
        />
        {showLabels && (
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#374557', lineHeight: 1.2, whiteSpace: 'nowrap', letterSpacing: -0.2 }}>ASPCV</p>
            <p style={{ fontSize: 9, color: '#22C55E', whiteSpace: 'nowrap', fontWeight: 600 }}>Aspiration Cleantech</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px' }}>
        {navGroups.map(group => (
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
            {group.items.map(({ icon: Icon, to, label }) => (
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
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid #F0F1F5', padding: '8px 8px', flexShrink: 0 }}>
        {[{ icon: Bell, label: 'Notifications' }, { icon: HelpCircle, label: 'Help' }]
          .map(({ icon: Icon, label }) => (
            <button key={label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: showLabels ? '9px 12px' : '9px 11px',
              borderRadius: 10, border: 'none', background: 'transparent',
              cursor: 'pointer', width: '100%', marginBottom: 2,
              color: '#B1B1BE', fontSize: 12, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              {showLabels && <span>{label}</span>}
            </button>
          ))}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: showLabels ? '8px 12px' : '8px 11px', marginTop: 4,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#5D78FF,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>J</span>
          </div>
          {showLabels && (
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap' }}>Jeyadev</p>
              <p style={{ fontSize: 11, color: '#B1B1BE', whiteSpace: 'nowrap' }}>Admin</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
