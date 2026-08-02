import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import IdleTimeout from './IdleTimeout'

export default function ProtectedRoute() {
  const { hydrate, fetchPermissions, permissions, mustChangePassword } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (localStorage.getItem('crm_token') && !mustChangePassword && Object.keys(permissions).length === 0) {
      fetchPermissions()
    }
  }, [fetchPermissions, permissions, mustChangePassword])

  const hasToken = !!localStorage.getItem('crm_token')

  useEffect(() => {
    if (!hasToken) {
      navigate('/login', { replace: true })
    } else if (mustChangePassword) {
      navigate('/change-password', { replace: true })
    }
  }, [hasToken, mustChangePassword, navigate])

  if (!hasToken) return null
  if (mustChangePassword) return null
  return (
    <>
      <IdleTimeout />
      <Outlet />
    </>
  )
}
