import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
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
