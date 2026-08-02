import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { useIsMobile } from '@/lib/useIsMobile'

export default function AppLayout() {
  const isMobile = useIsMobile()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sideW = isMobile ? 0 : collapsed ? 60 : 220

  function toggleSidebar() {
    if (isMobile) setDrawerOpen(o => !o)
    else setCollapsed(c => !c)
  }

  return (
    <div style={{ minHeight: '100vh', height: '100%', background: '#F4F5F9', display: 'flex', flex: 1, minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Mobile drawer overlay */}
      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 29, backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.18s ease',
          }}
        />
      )}

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        mobileOpen={isMobile ? drawerOpen : undefined}
      />

      <div style={{
        marginLeft: sideW,
        width: isMobile ? '100%' : `calc(100vw - ${sideW}px)`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-left 0.2s, width 0.2s',
        minHeight: '100vh',
        flex: 1,
        minWidth: 0,
      }}>
        <Topbar onToggleSidebar={toggleSidebar} />
        <main style={{ flex: 1, padding: isMobile ? '14px' : '24px 28px', minWidth: 0, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Keyed on pathname so navigating away clears a crashed page's
              error state instead of showing the fallback on the next route. */}
          <ErrorBoundary key={location.pathname} label="this page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
