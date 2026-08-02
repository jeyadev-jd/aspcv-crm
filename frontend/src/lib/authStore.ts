import { create } from 'zustand'
import { api } from './api'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  roleName: string
  designation?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  permissions: Record<string, boolean>
  mustChangePassword: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
  fetchPermissions: () => Promise<void>
  can: (resource: string, action: string) => boolean
  setToken: (token: string) => void
  clearMustChangePassword: () => void
  initCrossTabSync: () => void
}

// Build a fresh `can` closure over a specific permissions map. Regenerating this
// function whenever permissions change gives it a NEW identity, so components that
// subscribe via `useAuthStore(s => s.can)` re-render when permissions load — without
// this they hold a stable reference and stay stuck on their first (empty-perms)
// render after a hard page reload, falsely showing "no access".
function makeCan(permissions: Record<string, boolean>) {
  return (resource: string, action: string) => {
    if (permissions['*']) return true
    return permissions[`${resource}:${action}`] === true
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('crm_token'),
  permissions: {},
  mustChangePassword: false,

  hydrate() {
    const token = localStorage.getItem('crm_token')
    const userStr = localStorage.getItem('crm_user')
    const permStr = localStorage.getItem('crm_permissions')
    const mustChange = localStorage.getItem('crm_must_change_password') === 'true'
    if (token && userStr) {
      const permissions = permStr ? JSON.parse(permStr) : {}
      set({
        token,
        user: JSON.parse(userStr),
        permissions,
        can: makeCan(permissions),
        mustChangePassword: mustChange,
      })
    }
  },

  async fetchPermissions() {
    try {
      const { data } = await api.get('/auth/my-permissions')
      localStorage.setItem('crm_permissions', JSON.stringify(data))
      set({ permissions: data, can: makeCan(data) })
    } catch {
      // silently fail — SuperAdmin won't be blocked
    }
  },

  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('crm_token', data.token)
    localStorage.setItem('crm_user', JSON.stringify(data.user))
    localStorage.setItem('crm_must_change_password', String(!!data.mustChangePassword))
    set({ token: data.token, user: data.user, mustChangePassword: !!data.mustChangePassword })
    if (!data.mustChangePassword) await get().fetchPermissions()
  },

  logout() {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    localStorage.removeItem('crm_permissions')
    localStorage.removeItem('crm_must_change_password')
    set({ token: null, user: null, permissions: {}, can: makeCan({}), mustChangePassword: false })
  },

  setToken(token) {
    localStorage.setItem('crm_token', token)
    set({ token })
  },

  clearMustChangePassword() {
    localStorage.setItem('crm_must_change_password', 'false')
    set({ mustChangePassword: false })
    get().fetchPermissions()
  },

  initCrossTabSync() {
    window.addEventListener('storage', (e) => {
      if (e.key === 'crm_token') {
        if (!e.newValue) {
          // Logged out in another tab
          get().logout()
          window.location.href = '/login'
        } else if (e.newValue !== get().token) {
          // Different user logged in, or token refreshed
          window.location.reload()
        }
      }
    })
  },

  // Replaced with a fresh closure (makeCan) on every permissions change so its
  // identity updates and `s.can` subscribers re-render. This default handles the
  // brief window before hydrate()/fetchPermissions() runs.
  can: makeCan({}),
}))
