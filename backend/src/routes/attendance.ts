import { Router } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'

const router = Router()
router.use(authenticate)

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const WORK_START_HOUR_IST = 9 // 09:00 IST

function todayIST() {
  const now = new Date()
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()))
}

function minutesLateCalc(checkInTime: Date) {
  const ist = new Date(checkInTime.getTime() + IST_OFFSET_MS)
  const startMinutes = WORK_START_HOUR_IST * 60
  const actualMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return Math.max(0, actualMinutes - startMinutes)
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'ASPCV-CRM/1.0' } }
    )
    if (!resp.ok) return null
    const data = await resp.json() as any
    return data.display_name ?? null
  } catch {
    return null
  }
}

// Check in
router.post('/checkin', requirePermission('attendance', 'checkin'), async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const { lat, lng, notes } = req.body as { lat?: number; lng?: number; notes?: string }
  const date = todayIST()

  const existing = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date } } })
  if (existing?.checkIn) {
    res.status(400).json({ error: 'Already checked in today' })
    return
  }

  const now = new Date()
  const late = minutesLateCalc(now)
  const locationName = lat && lng ? await reverseGeocode(lat, lng) : null

  const record = await prisma.attendanceRecord.upsert({
    where: { userId_date: { userId, date } },
    update: { checkIn: now, lat: lat ?? null, lng: lng ?? null, locationName, minutesLate: late, status: late > 0 ? 'late' : 'present', notes: notes ?? null },
    create: { userId, date, checkIn: now, lat: lat ?? null, lng: lng ?? null, locationName, minutesLate: late, status: late > 0 ? 'late' : 'present', notes: notes ?? null },
  })
  res.json(record)
})

// Check out
router.post('/checkout', async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const date = todayIST()

  const existing = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date } } })
  if (!existing?.checkIn) {
    res.status(400).json({ error: 'No check-in found for today' })
    return
  }

  const record = await prisma.attendanceRecord.update({
    where: { userId_date: { userId, date } },
    data: { checkOut: new Date() },
  })
  res.json(record)
})

// My attendance (own records)
router.get('/my', requirePermission('attendance', 'read_own'), async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const { month, year } = req.query as Record<string, string>
  const m = month ? parseInt(month) : new Date().getMonth() + 1
  const y = year ? parseInt(year) : new Date().getFullYear()
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))

  const records = await prisma.attendanceRecord.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  })
  res.json(records)
})

// All attendance (admin/HR)
router.get('/all', requirePermission('attendance', 'read_all'), async (req: AuthRequest, res) => {
  const { month, year, userId } = req.query as Record<string, string>
  const m = month ? parseInt(month) : new Date().getMonth() + 1
  const y = year ? parseInt(year) : new Date().getFullYear()
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(userId && { userId }),
    },
    include: { user: { select: { id: true, name: true, role: true, department: true } } },
    orderBy: [{ date: 'desc' }, { userId: 'asc' }],
  })
  res.json(records)
})

// Today summary
router.get('/today', async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const date = todayIST()
  const record = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date } } })
  res.json(record ?? null)
})

// Locations (reference — not enforced)
router.get('/locations', async (_req, res) => {
  const locs = await prisma.attendanceLocation.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  res.json(locs)
})

router.post('/locations', requirePermission('hr_user', 'edit'), async (req: AuthRequest, res) => {
  const { name, lat, lng, radiusM, isDefault } = req.body
  const loc = await prisma.attendanceLocation.create({ data: { name, lat, lng, radiusM: radiusM ?? 100, isDefault: isDefault ?? false } })
  res.status(201).json(loc)
})

router.patch('/locations/:id', requirePermission('hr_user', 'edit'), async (req: AuthRequest, res) => {
  const loc = await prisma.attendanceLocation.update({ where: { id: req.params.id as string }, data: req.body })
  res.json(loc)
})

router.delete('/locations/:id', requirePermission('hr_user', 'edit'), async (req: AuthRequest, res) => {
  await prisma.attendanceLocation.update({ where: { id: req.params.id as string }, data: { isActive: false } })
  res.status(204).end()
})

export default router
