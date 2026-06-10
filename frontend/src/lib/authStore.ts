import { create } from 'zustand'
import { api } from './api'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  designation?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('crm_token'),

  hydrate() {
    const token = localStorage.getItem('crm_token')
    const userStr = localStorage.getItem('crm_user')
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr) })
    }
  },

  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('crm_token', data.token)
    localStorage.setItem('crm_user', JSON.stringify(data.user))
    set({ token: data.token, user: data.user })
  },

  logout() {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    set({ token: null, user: null })
  },
}))
