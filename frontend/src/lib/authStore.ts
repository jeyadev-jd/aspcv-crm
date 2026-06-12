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
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
  fetchPermissions: () => Promise<void>
  can: (resource: string, action: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('crm_token'),
  permissions: {},

  hydrate() {
    const token = localStorage.getItem('crm_token')
    const userStr = localStorage.getItem('crm_user')
    const permStr = localStorage.getItem('crm_permissions')
    if (token && userStr) {
      set({
        token,
        user: JSON.parse(userStr),
        permissions: permStr ? JSON.parse(permStr) : {},
      })
    }
  },

  async fetchPermissions() {
    try {
      const { data } = await api.get('/auth/my-permissions')
      localStorage.setItem('crm_permissions', JSON.stringify(data))
      set({ permissions: data })
    } catch {
      // silently fail — SuperAdmin won't be blocked
    }
  },

  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('crm_token', data.token)
    localStorage.setItem('crm_user', JSON.stringify(data.user))
    set({ token: data.token, user: data.user })
    await get().fetchPermissions()
  },

  logout() {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    localStorage.removeItem('crm_permissions')
    set({ token: null, user: null, permissions: {} })
  },

  can(resource, action) {
    const { permissions } = get()
    if (permissions['*']) return true
    return permissions[`${resource}:${action}`] === true
  },
}))
