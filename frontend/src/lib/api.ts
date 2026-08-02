import axios from 'axios'

// Baked in at build time (see .env.production / Docker build arg) so a
// production bundle never calls back to a dev machine's localhost.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
// Attachment/file links are served from the API origin, not under /api.
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

import { useAuthStore } from './authStore'

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('crm_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
