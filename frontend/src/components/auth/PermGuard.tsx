import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import type { ReactNode } from 'react'

// Gates a route by a single permission (resource:action). Redirects to dashboard
// if the current user lacks it. SuperAdmin ('*') bypasses via authStore.can().
export default function PermGuard({ resource, action, children }: { resource: string; action: string; children: ReactNode }) {
  const can = useAuthStore(s => s.can)
  const permissions = useAuthStore(s => s.permissions)

  // Permissions still loading → don't flash-redirect; render nothing briefly.
  if (Object.keys(permissions).length === 0) return null

  if (!can(resource, action)) return <Navigate to="/" replace />
  return <>{children}</>
}
