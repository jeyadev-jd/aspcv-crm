import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Trash2, CheckCheck, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'
import Pagination from '@/components/shared/Pagination'
import {
  useNotifications, useMarkNotificationRead, useMarkAllRead, useDeleteNotification,
  useClearNotifications,
  type Notification,
} from '@/hooks/useNotifications'
import { toast } from '@/lib/toast'
import { NOTIF_ROUTES } from '@/lib/notificationRoutes'

const SEV = {
  critical: { color: '#FF5353', bg: '#FFF0F0', label: 'Critical', icon: AlertTriangle },
  warning:  { color: '#FF9B52', bg: '#FFF5EE', label: 'Warning',  icon: AlertCircle },
  info:     { color: '#5D78FF', bg: '#E8EDFF', label: 'Info',     icon: Info },
} as const

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d} days ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Filter = 'all' | 'unread' | 'critical' | 'warning' | 'info'

const PAGE_SIZE = 20

export default function Notifications() {
  const navigate = useNavigate()
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()
  const deleteNotif = useDeleteNotification()
  const clearAll = useClearNotifications()

  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [confirmClear, setConfirmClear] = useState(false)

  async function doClearAll() {
    try {
      const res = await clearAll.mutateAsync({})
      toast.success(res.deleted === 0 ? 'Nothing to clear' : `Cleared ${res.deleted} notification${res.deleted === 1 ? '' : 's'}`)
      setPage(1)
    } catch {
      toast.error('Failed to clear notifications')
    }
    setConfirmClear(false)
  }

  const all = data?.notifications ?? []
  const unread = data?.unread ?? 0
  const total = data?.total ?? all.length

  const filtered = all.filter(n => {
    if (filter === 'all') return true
    if (filter === 'unread') return !n.read
    return n.severity === filter
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function open(n: Notification) {
    if (!n.read) markRead.mutate(n.id)
    const route = n.entityType ? NOTIF_ROUTES[n.entityType.toLowerCase()] : undefined
    // System alerts carry no entity — they stay on this page rather than
    // dumping the user somewhere unrelated.
    if (route) navigate(route)
  }

  const TABS: [Filter, string, number][] = [
    ['all', 'All', all.length],
    ['unread', 'Unread', unread],
    ['critical', 'Critical', all.filter(n => n.severity === 'critical').length],
    ['warning', 'Warning', all.filter(n => n.severity === 'warning').length],
    ['info', 'Info', all.filter(n => n.severity === 'info').length],
  ]

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: 0 }}>Notifications</h1>
          <p style={{ fontSize: 12, color: '#8A8FA8', marginTop: 2 }}>
            {unread > 0 ? `${unread} unread` : 'All caught up'}
            {total > all.length && ` · showing the ${all.length} most recent of ${total}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#E8EDFF', color: '#5D78FF', border: 'none', cursor: 'pointer' }}
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {all.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={clearAll.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#FFF0F0', color: '#FF5353', border: 'none', cursor: 'pointer' }}
            >
              <Trash2 size={13} /> {clearAll.isPending ? 'Clearing…' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {confirmClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 380 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Clear all notifications?</p>
            <p style={{ fontSize: 12, color: '#8A8FA8', marginBottom: 20 }}>
              This permanently deletes all {total} of your notifications, including {unread} unread. It cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={doClearAll} disabled={clearAll.isPending} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>
                {clearAll.isPending ? 'Clearing…' : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F0F1F5', marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([key, label, count]) => (
          <button key={key} onClick={() => { setFilter(key); setPage(1) }} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: filter === key ? '2px solid #5D78FF' : '2px solid transparent',
            color: filter === key ? '#5D78FF' : '#8A8B9F', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {label}
            {count > 0 && <span style={{ background: '#F4F5F9', color: '#8A8B9F', fontSize: 11, padding: '2px 6px', borderRadius: 999 }}>{count}</span>}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 40, textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>Loading notifications…</p>
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
            subtitle="Alerts about approvals, budgets and projects will appear here."
          />
        ) : (
          <>
            {pageRows.map(n => {
              const sev = SEV[n.severity] ?? SEV.info
              const Icon = sev.icon
              const clickable = Boolean(n.entityType && NOTIF_ROUTES[n.entityType.toLowerCase()])
              return (
                <div
                  key={n.id}
                  onClick={() => open(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderBottom: '1px solid #F4F5F9',
                    background: n.read ? '#fff' : '#FAFBFF',
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: sev.color }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: '#374557', margin: 0 }}>{n.title}</p>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: sev.bg, color: sev.color }}>{sev.label}</span>
                      {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5D78FF' }} />}
                    </div>
                    <p style={{ fontSize: 12, color: '#8A8FA8', margin: '3px 0 0' }}>{n.message}</p>
                    <p style={{ fontSize: 11, color: '#B1B1BE', margin: '4px 0 0' }}>{relativeTime(n.createdAt)}</p>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); deleteNotif.mutate(n.id) }}
                    title="Delete"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D5D5D5', padding: 4, flexShrink: 0 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
