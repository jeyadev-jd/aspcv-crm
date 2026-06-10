import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'

export default function ProtectedRoute() {
  const { hydrate } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const hasToken = !!localStorage.getItem('crm_token')

  useEffect(() => {
    if (!hasToken) {
      navigate('/login', { replace: true })
    }
  }, [hasToken, navigate])

  if (!hasToken) return null
  return <Outlet />
}
