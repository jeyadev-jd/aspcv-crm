import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type PunchAction = 'CheckIn' | 'CheckOut' | 'BreakIn' | 'BreakOut' | 'TravelIn' | 'TravelOut'

export interface AttendanceLog {
  id: string
  action: PunchAction
  timestamp: string
  lat?: number | null
  lng?: number | null
  locationName?: string | null
  notes?: string | null
}

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
  isHoliday: boolean
  isOvertime: boolean
  totalWorkingHours: number
  totalTravelHours: number
  overtimeHours: number
  notes?: string
  createdAt: string
  logs?: AttendanceLog[]
  user?: { id: string; name: string; role: string; department?: string }
}

export interface AttendanceCalendar {
  user?: { id: string; name: string; role: string; department?: string }
  month: number
  year: number
  records: AttendanceRecord[]
  holidays: { id: string; name: string; date: string; type: string; isOptional: boolean }[]
  summary: { present: number; late: number; workingHours: number; travelHours: number; overtimeHours: number; breakHours: number }
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

// Per-employee month view: records with their punch trail, plus holidays and totals.
export function useAttendanceCalendar(userId?: string, month?: number, year?: number) {
  return useQuery<AttendanceCalendar>({
    queryKey: ['attendance', 'calendar', userId, month, year],
    queryFn: () => api.get(`/attendance/calendar/${userId}`, { params: { month, year } }).then(r => r.data),
    enabled: Boolean(userId),
  })
}

/**
 * One mutation for every punch type. Coordinates are optional — the server only
 * enforces the geofence on CheckIn.
 */
export function usePunch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ action, lat, lng, notes }: { action: PunchAction; lat?: number; lng?: number; notes?: string }) =>
      api.post('/attendance/punch', { action, lat, lng, notes }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

export function useManualPresent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { userId: string; date: string; notes?: string }) =>
      api.post('/attendance/manual-present', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}

/** HR direct correction of a day's status and/or punch times (no approval). */
export function useManualEditAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { userId: string; date: string; status?: string; checkIn?: string | null; checkOut?: string | null; breakStart?: string | null; breakEnd?: string | null; totalTravelHours?: number; notes?: string }) =>
      api.patch('/attendance/manual-edit', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}
