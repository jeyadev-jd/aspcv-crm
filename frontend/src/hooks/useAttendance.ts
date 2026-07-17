import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface AttendanceRecord {
  id: string
  userId: string
  date: string
  checkIn?: string
  checkOut?: string
  breakStart?: string | null
  breakEnd?: string | null
  breakMinutes: number
  lat?: number
  lng?: number
  locationName?: string
  status: 'present' | 'late' | 'absent' | 'half_day' | 'leave'
  minutesLate: number
  notes?: string
  createdAt: string
  user?: { id: string; name: string; role: string; department?: string }
}

export function useMyAttendance(month?: number, year?: number) {
  return useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', 'my', month, year],
    queryFn: () => api.get('/attendance/my', { params: { month, year } }).then(r => r.data),
  })
}

export function useTodayAttendance() {
  return useQuery<AttendanceRecord | null>({
    queryKey: ['attendance', 'today'],
    queryFn: () => api.get('/attendance/today').then(r => r.data),
    refetchInterval: 60000,
  })
}

export function useAllAttendance(month?: number, year?: number, userId?: string) {
  return useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', 'all', month, year, userId],
    queryFn: () => api.get('/attendance/all', { params: { month, year, userId } }).then(r => r.data),
  })
}

export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (coords: { lat: number; lng: number }) =>
      api.post('/attendance/checkin', coords).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'today'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'my'] })
    },
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/attendance/checkout').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'today'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'my'] })
    },
  })
}

export function useBreakStart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/attendance/break-start').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'today'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'my'] })
    },
  })
}

export function useBreakEnd() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/attendance/break-end').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'today'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'my'] })
    },
  })
}
