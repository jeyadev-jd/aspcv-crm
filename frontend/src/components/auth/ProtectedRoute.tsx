import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'

export default function ProtectedRoute() {
  const { hydrate, fetchPermissions, permissions } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (localStorage.getItem('crm_token') && Object.keys(permissions).length === 0) {
      fetchPermissions()
    }
  }, [fetchPermissions, permissions])

  const hasToken = !!localStorage.getItem('crm_token')

  useEffect(() => {
    if (!hasToken) {
      navigate('/login', { replace: true })
    }
  }, [hasToken, navigate])

  if (!hasToken) return null
  return <Outlet />
}
