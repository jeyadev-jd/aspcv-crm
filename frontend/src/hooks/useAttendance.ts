import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface AttendanceRecord {
  id: string
  userId: string
  date: string
  checkIn?: string
  checkOut?: string
  lat?: number
  lng?: number
  locationName?: string
  status: 'present' | 'late' | 'absent' | 'half_day' | 'leave'
  minutesLate: number
  notes?: string
  createdAt: string
  user?: { id: string; name: string; role: string; department?: string }
}

export interface AttendanceLocation {
  id: string
  name: string
  lat: number
  lng: number
  radiusM: number
  isDefault: boolean
  isActive: boolean
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

export function useAttendanceLocations() {
  return useQuery<AttendanceLocation[]>({
    queryKey: ['attendance-locations'],
    queryFn: () => api.get('/attendance/locations').then(r => r.data),
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

export function useCreateAttendanceLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<AttendanceLocation, 'id' | 'isActive'>) =>
      api.post('/attendance/locations', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-locations'] }),
  })
}
