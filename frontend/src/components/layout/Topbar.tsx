import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Settings, AlignJustify, UserCheck, Building2, Users, Briefcase, FolderOpen, LifeBuoy, X, AlertTriangle, Trash2 } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useLocation, useNavigate } from 'react-router-dom'
import { searchRecords, typeColor } from '@/lib/searchData'
import type { SearchResult } from '@/lib/searchData'
import { useNotifications, useMarkNotificationRead, useMarkAllRead, useDeleteNotification } from '@/hooks/useNotifications'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Yesterday' : `${d} days ago`
}

const sevColor: Record<string, string> = { info: '#5D78FF', warning: '#FF9B52', critical: '#FF5353' }

const titles: Record<string, string> = {
  '/':          'Dashboard',
  '/leads':     'Leads',
  '/accounts':  'Accounts',
  '/contacts':  'Contacts',
  '/deals':     'Deals',
  '/projects':  'Projects & Installations',
  '/tasks':     'Tasks',
  '/kanban':    'Kanban Board',
  '/calendar':  'Calendar',
  '/invoices':  'Invoices',
  '/support':   'Support Tickets',
  '/reports':   'Reports & Analytics',
  '/settings':  'Settings',
}

const typeIcon: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  Lead:    UserCheck,
  Contact: Users,
  Account: Building2,
  Deal:    Briefcase,
  Project: FolderOpen,
  Ticket:  LifeBuoy,
}

interface TopbarProps { onToggleSidebar: () => void }

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const title = titles[pathname] ?? 'ASPCV CRM'
  const isMobile = useIsMobile()
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const { data: notifData } = useNotifications()
  const notifs = notifData?.notifications ?? []
  const unread = notifData?.unread ?? 0
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()
  const deleteNotif = useDeleteNotification()

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setQuery(''); setResults([])
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSearch(q: string) {
    setQuery(q)
    setSelectedIdx(-1)
    if (q.trim()) {
      setResults(searchRecords(q))
      setSearchOpen(true)
    } else {
      setResults([])
      setSearchOpen(false)
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const target = selectedIdx >= 0 ? results[selectedIdx] : results[0]
      if (target) goToResult(target)
    }
    if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); setResults([]) }
  }

  function goToResult(r: SearchResult) {
    navigate(r.route)
    setSearchOpen(false); setQuery(''); setResults([])
  }

  function openNotif(n: { id: string; read: boolean; entityType?: string | null; entityId?: string | null }) {
    if (!n.read) markRead.mutate(n.id)
    if (n.entityType === 'Project') { setNotifOpen(false); navigate('/projects') }
  }

  return (
    <header style={{
      height: 64, background: '#fff', borderBottom: '1px solid #F0F1F5',
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px',
      position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
      width: '100%', boxSizing: 'border-box',
    }}>
      <button
        onClick={onToggleSidebar}
        style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F4F5F9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <AlignJustify size={20} />
      </button>

      <p style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 140 : 'none' }}>{title}</p>

      <div style={{ flex: 1 }} />

      {/* Mobile: search icon that expands inline */}
      {isMobile && !mobileSearchOpen && (
        <button
          onClick={() => setMobileSearchOpen(true)}
          style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
        >
          <Search size={20} />
        </button>
      )}

      {/* Search */}
      <div ref={searchRef} style={{ position: 'relative', display: isMobile && !mobileSearchOpen ? 'none' : 'block' }}>
        {isMobile && mobileSearchOpen && (
          <button
            onClick={() => { setMobileSearchOpen(false); setQuery(''); setResults([]); setSearchOpen(false) }}
            style={{ position: 'absolute', left: -32, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', padding: 4 }}
          >
            <X size={16} />
          </button>
        )}
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE', pointerEvents: 'none' }} />
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => query && setSearchOpen(true)}
          placeholder="Search leads, deals, contacts..."
          autoFocus={isMobile && mobileSearchOpen}
          style={{
            paddingLeft: 36, paddingRight: query ? 32 : 14, paddingTop: 8, paddingBottom: 8,
            background: '#F4F5F9', border: '1px solid transparent', borderRadius: 10,
            fontSize: 12, color: '#374557', width: isMobile ? '100%' : 240, outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#E0E1E6')}
          onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'transparent' }}
          onFocusCapture={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#5D78FF' }}
          onBlur={e => { e.currentTarget.style.background = '#F4F5F9'; e.currentTarget.style.borderColor = 'transparent' }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setSearchOpen(false) }}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', padding: 0 }}
          >
            <X size={12} />
          </button>
        )}

        {/* Search dropdown */}
        {searchOpen && results.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
            background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden',
            minWidth: 360,
          }}>
            <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #F4F5F9' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#B1B1BE', letterSpacing: 0.5 }}>
                {results.length} RESULT{results.length !== 1 ? 'S' : ''} FOR "{query.toUpperCase()}"
              </p>
            </div>
            {results.map((r, i) => {
              const Icon = typeIcon[r.type] ?? Search
              const style = typeColor[r.type]
              return (
                <div
                  key={r.id}
                  onClick={() => goToResult(r)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    cursor: 'pointer', transition: 'background 0.1s',
                    background: selectedIdx === i ? '#F4F5F9' : 'transparent',
                    borderBottom: i < results.length - 1 ? '1px solid #F9F9FB' : 'none',
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={13} style={{ color: style.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: style.bg, color: style.color, flexShrink: 0 }}>{r.type}</span>
                </div>
              )
            })}
            <div style={{ padding: '8px 12px', borderTop: '1px solid #F4F5F9', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Press Enter to open first result · Esc to close</p>
            </div>
          </div>
        )}
        {searchOpen && query && results.length === 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
            background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100,
            padding: '20px', textAlign: 'center', minWidth: 360,
          }}>
            <Search size={24} style={{ color: '#D5D5D5', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>No results found</p>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>Try searching for a name, company, or deal</p>
          </div>
        )}
      </div>

      {/* Notification bell */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setNotifOpen(o => !o)}
          style={{ position: 'relative', color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'background 0.15s', display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F4F5F9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <Bell size={20} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#FF5353', color: '#fff', fontSize: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
              border: '2px solid #fff',
            }}>{unread}</span>
          )}
        </button>

        {notifOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100,
            width: 340, overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F4F5F9' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>Notifications</p>
              {unread > 0 && (
                <button onClick={() => markAll.mutate()} style={{ fontSize: 11, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {notifs.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center' }}>
                  <Bell size={22} style={{ color: '#D5D5D5', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: '#B1B1BE' }}>No notifications</p>
                </div>
              )}
              {notifs.map(n => {
                const color = sevColor[n.severity] ?? '#5D78FF'
                return (
                  <div
                    key={n.id}
                    onClick={() => openNotif(n)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                      background: n.read ? 'transparent' : '#FAFBFF',
                      borderBottom: '1px solid #F4F5F9', cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F4F5F9')}
                    onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : '#FAFBFF')}
                  >
                    {n.severity === 'critical' || n.severity === 'warning'
                      ? <AlertTriangle size={14} style={{ color, marginTop: 3, flexShrink: 0 }} />
                      : <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : color, marginTop: 5, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: n.read ? 500 : 600, color: '#374557' }}>{n.title}</p>
                      <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{n.message}</p>
                      <p style={{ fontSize: 10, color: '#C4C4CF', marginTop: 4 }}>{relativeTime(n.createdAt)}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteNotif.mutate(n.id) }} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Settings icon */}
      <button
        onClick={() => navigate('/settings')}
        style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'background 0.15s', display: 'flex' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F4F5F9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <Settings size={20} />
      </button>

      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#5D78FF,#8B5CF6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>J</span>
      </div>
    </header>
  )
}
