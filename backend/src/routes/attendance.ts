import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { notifyRoles } from '../services/notify'
import {
  IST_OFFSET_MS, dayStartIST, isNonWorkingDay, recomputeDayTotals, grantCompOff,
  LOG_ACTIONS, LogAction,
} from '../services/attendanceCalc'

const router = createSafeRouter()
router.use(authenticate)

function todayIST() {
  return dayStartIST()
}

async function getAttendanceConfig() {
  const settings = await prisma.attendanceSettings.findFirst({ where: { isActive: true } })
  const startTime = settings?.officeStartTime || '09:00'
  const grace = settings?.gracePeriodMinutes ?? 0
  const [h, m] = startTime.split(':').map(Number)
  return { startHour: h, startMinute: m, graceMinutes: grace, settings }
}

async function minutesLateCalc(checkInTime: Date) {
  const config = await getAttendanceConfig()
  const ist = new Date(checkInTime.getTime() + IST_OFFSET_MS)
  const startMinutes = config.startHour * 60 + config.startMinute + config.graceMinutes
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

const EARTH_RADIUS_M = 6371000

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

// Checks the given coordinates against whichever location applies to this user today:
// an admin-assigned override (e.g. a technician on a site visit) takes priority over
// the pool of default active locations. Returns null when the check passes, or an
// error message when it fails. If no locations are configured at all, enforcement is
// skipped entirely so orgs that haven't set up geofencing aren't blocked.
async function checkGeofence(userId: string, lat?: number, lng?: number): Promise<string | null> {
  const override = await prisma.attendanceLocationOverride.findFirst({
    where: { userId, validFrom: { lte: new Date() }, validUntil: { gte: new Date() } },
    include: { location: true },
    orderBy: { createdAt: 'desc' },
  })

  const candidateLocations = override
    ? [override.location]
    : await prisma.attendanceLocation.findMany({ where: { isActive: true } })

  if (candidateLocations.length === 0) return null // geofencing not configured — allow

  if (lat == null || lng == null) {
    return 'Location is required to check in for your assigned site.'
  }

  const withinAny = candidateLocations.some(
    loc => distanceMeters(lat, lng, loc.lat, loc.lng) <= loc.radiusM
  )
  if (withinAny) return null

  const names = candidateLocations.map(l => l.name).join(', ')
  return `You must be within range of an authorized location to check in (${names}).`
}

// Rejects a punch that doesn't make sense given what's already been logged today,
// e.g. a second BreakIn before the first break was closed. Returns an error
// message or null when the punch is allowed.
function validatePunch(action: LogAction, logs: { action: string }[]): string | null {
  const last = (a: LogAction) => logs.filter(l => l.action === a).length
  const checkedIn = last('CheckIn') > last('CheckOut')
  const onBreak = last('BreakIn') > last('BreakOut')
  const travelling = last('TravelIn') > last('TravelOut')

  switch (action) {
    case 'CheckIn':
      if (checkedIn) return 'Already checked in — check out first'
      // Once the day is closed it stays closed; reopening it would silently
      // restart the clock. HR can correct the trail if a punch was wrong.
      if (last('CheckOut') > 0) return 'Already checked out for today'
      return null
    case 'CheckOut':
      if (!checkedIn) return 'No open check-in to close'
      if (onBreak) return 'Please end your break before checking out'
      if (travelling) return 'Please end travel before checking out'
      return null
    case 'BreakIn':
      if (!checkedIn) return 'Please check in before starting a break'
      return onBreak ? 'Break already in progress' : null
    case 'BreakOut':
      return onBreak ? null : 'No break in progress'
    case 'TravelIn':
      if (!checkedIn) return 'Please check in before starting travel'
      return travelling ? 'Travel already in progress' : null
    case 'TravelOut':
      return travelling ? null : 'No travel in progress'
    default:
      return 'Unknown action'
  }
}

/**
 * Refreshes the rollup for today's row inside a month list, so a day still in
 * progress reports hours accrued up to now rather than the figure frozen at the
 * last punch. Past days are already final and are left untouched.
 */
async function refreshTodayIn(records: { id: string; date: Date }[]) {
  const today = dayStartIST().getTime()
  const current = records.find(r => r.date.getTime() === today)
  if (current) await recomputeDayTotals(current.id)
}

/**
 * Rewrites the legacy checkIn/checkOut/breakStart/breakEnd columns from the log
 * trail. Needed after HR edits a log, since those columns feed older screens and
 * would otherwise still show the uncorrected times.
 */
async function syncLegacyColumns(attendanceRecordId: string) {
  const logs = await prisma.attendanceLog.findMany({
    where: { attendanceRecordId },
    orderBy: { timestamp: 'asc' },
    select: { action: true, timestamp: true },
  })
  const first = (a: string) => logs.find(l => l.action === a)?.timestamp ?? null
  const last = (a: string) => [...logs].reverse().find(l => l.action === a)?.timestamp ?? null

  await prisma.attendanceRecord.update({
    where: { id: attendanceRecordId },
    data: {
      checkIn: first('CheckIn'),
      checkOut: last('CheckOut'),
      breakStart: last('BreakIn'),
      breakEnd: last('BreakOut'),
    },
  })
}

/**
 * Single entry point for every punch. Appends to the day's log trail, keeps the
 * legacy checkIn/checkOut/breakStart/breakEnd columns in sync for existing
 * screens, and recomputes the day's hour rollup.
 */
async function recordPunch(req: AuthRequest, res: any, action: LogAction) {
  const userId = req.user!.id
  const { lat, lng, notes } = req.body as { lat?: number; lng?: number; notes?: string }
  const date = todayIST()
  const now = new Date()

  // Geofence only gates entering work/travel, not closing an open interval —
  // an employee who has walked off-site must still be able to check out.
  if (action === 'CheckIn' || action === 'TravelIn') {
    const geofenceError = await checkGeofence(userId, lat, lng)
    if (geofenceError && action === 'CheckIn') {
      res.status(403).json({ error: geofenceError })
      return
    }
  }

  const nonWorking = await isNonWorkingDay(date)
  const late = action === 'CheckIn' ? await minutesLateCalc(now) : 0
  const locationName = lat != null && lng != null ? await reverseGeocode(lat, lng) : null

  let record = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date } } })
  const firstCheckInToday = action === 'CheckIn' && !record?.checkIn

  if (!record) {
    if (action !== 'CheckIn') {
      res.status(400).json({ error: 'Please check in first' })
      return
    }
    record = await prisma.attendanceRecord.create({
      data: {
        userId, date, checkIn: now, lat: lat ?? null, lng: lng ?? null, locationName,
        minutesLate: late, status: late > 0 ? 'late' : 'present',
        notes: notes ?? null, isHoliday: nonWorking,
      },
    })
  } else {
    const existingLogs = await prisma.attendanceLog.findMany({
      where: { attendanceRecordId: record.id }, orderBy: { timestamp: 'asc' }, select: { action: true },
    })
    const invalid = validatePunch(action, existingLogs)
    if (invalid) { res.status(400).json({ error: invalid }); return }

    record = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        ...(action === 'CheckIn' && {
          checkIn: record.checkIn ?? now,
          minutesLate: record.checkIn ? record.minutesLate : late,
          status: record.checkIn ? record.status : late > 0 ? 'late' : 'present',
          lat: lat ?? record.lat, lng: lng ?? record.lng, locationName: locationName ?? record.locationName,
        }),
        ...(action === 'CheckOut' && { checkOut: now }),
        ...(action === 'BreakIn' && { breakStart: now, breakEnd: null }),
        ...(action === 'BreakOut' && { breakEnd: now }),
        ...(notes ? { notes } : {}),
      },
    })
  }

  await prisma.attendanceLog.create({
    data: {
      attendanceRecordId: record.id, action, timestamp: now,
      lat: lat ?? null, lng: lng ?? null, locationName, notes: notes ?? null,
    },
  })

  // Working a holiday or weekly off earns a comp-off, credited once on first check-in.
  if (firstCheckInToday && nonWorking) {
    await grantCompOff(userId, date, 'holiday / weekly off')
  }

  const totals = await recomputeDayTotals(record.id)
  const fresh = await prisma.attendanceRecord.findUnique({
    where: { id: record.id },
    include: { logs: { orderBy: { timestamp: 'asc' } } },
  })
  res.json({ ...fresh, totals })
}

// Generic punch endpoint — action in the body
router.post('/punch', requirePermission('attendance', 'checkin'), async (req: AuthRequest, res) => {
  const { action } = req.body as { action?: string }
  if (!action || !LOG_ACTIONS.includes(action as LogAction)) {
    res.status(400).json({ error: `action must be one of ${LOG_ACTIONS.join(', ')}` })
    return
  }
  await recordPunch(req, res, action as LogAction)
})

// Named aliases, kept so existing clients keep working
router.post('/checkin', requirePermission('attendance', 'checkin'), (req: AuthRequest, res) => recordPunch(req, res, 'CheckIn'))
router.post('/checkout', requirePermission('attendance', 'checkin'), (req: AuthRequest, res) => recordPunch(req, res, 'CheckOut'))
router.post('/break-start', requirePermission('attendance', 'checkin'), (req: AuthRequest, res) => recordPunch(req, res, 'BreakIn'))
router.post('/break-end', requirePermission('attendance', 'checkin'), (req: AuthRequest, res) => recordPunch(req, res, 'BreakOut'))
router.post('/travel-start', requirePermission('attendance', 'checkin'), (req: AuthRequest, res) => recordPunch(req, res, 'TravelIn'))
router.post('/travel-end', requirePermission('attendance', 'checkin'), (req: AuthRequest, res) => recordPunch(req, res, 'TravelOut'))

// My attendance (own records)
router.get('/my', requirePermission('attendance', 'read_own'), async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const { month, year } = req.query as Record<string, string>
  const m = month ? parseInt(month) : new Date().getMonth() + 1
  const y = year ? parseInt(year) : new Date().getFullYear()
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))

  const stale = await prisma.attendanceRecord.findMany({
    where: { userId, date: { gte: start, lt: end } },
    select: { id: true, date: true },
  })
  await refreshTodayIn(stale)

  const records = await prisma.attendanceRecord.findMany({
    where: { userId, date: { gte: start, lt: end } },
    include: { logs: { orderBy: { timestamp: 'asc' } } },
    orderBy: { date: 'asc' },
  })
  res.json(records)
})

// Month calendar for one employee — powers the per-employee calendar modal.
router.get('/calendar/:userId', async (req: AuthRequest, res) => {
  const targetId = req.params.userId as string
  if (targetId !== req.user!.id) {
    const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'attendance', 'read_all')
    if (!canReadAll) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  }

  const { month, year } = req.query as Record<string, string>
  const m = month ? parseInt(month) : new Date().getMonth() + 1
  const y = year ? parseInt(year) : new Date().getFullYear()
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))

  const stale = await prisma.attendanceRecord.findMany({
    where: { userId: targetId, date: { gte: start, lt: end } },
    select: { id: true, date: true },
  })
  await refreshTodayIn(stale)

  const [records, holidays, user] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId: targetId, date: { gte: start, lt: end } },
      include: { logs: { orderBy: { timestamp: 'asc' } } },
      orderBy: { date: 'asc' },
    }),
    prisma.holidayCalendar.findMany({
      where: { isActive: true, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    }),
    prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, role: true, department: true } }),
  ])

  const summary = records.reduce(
    (acc, r) => ({
      present: acc.present + (r.status === 'present' || r.status === 'late' ? 1 : 0),
      late: acc.late + (r.status === 'late' ? 1 : 0),
      workingHours: acc.workingHours + r.totalWorkingHours,
      travelHours: acc.travelHours + r.totalTravelHours,
      overtimeHours: acc.overtimeHours + r.overtimeHours,
      breakHours: acc.breakHours + r.breakMinutes / 60,
    }),
    { present: 0, late: 0, workingHours: 0, travelHours: 0, overtimeHours: 0, breakHours: 0 }
  )

  res.json({ user, month: m, year: y, records, holidays, summary })
})

// ─── HR manual log correction ────────────────────────────────────────────────
// Employees forget to punch, or punch at the wrong time. HR can insert, retime
// or drop a log; the day's rollup is recomputed from the corrected trail so
// hours and overtime stay consistent with what the logs actually say.

router.post('/records/:recordId/logs', requirePermission('attendance', 'edit'), async (req: AuthRequest, res) => {
  const { action, timestamp, notes } = req.body as { action?: string; timestamp?: string; notes?: string }
  if (!action || !LOG_ACTIONS.includes(action as LogAction)) {
    res.status(400).json({ error: `action must be one of ${LOG_ACTIONS.join(', ')}` })
    return
  }
  const at = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(at.getTime())) { res.status(400).json({ error: 'Invalid timestamp' }); return }

  const record = await prisma.attendanceRecord.findUnique({ where: { id: req.params.recordId as string } })
  if (!record) { res.status(404).json({ error: 'Attendance record not found' }); return }

  await prisma.attendanceLog.create({
    data: {
      attendanceRecordId: record.id,
      action,
      timestamp: at,
      notes: notes ?? `Added by HR (${req.user!.roleName ?? req.user!.role})`,
    },
  })
  await syncLegacyColumns(record.id)
  const totals = await recomputeDayTotals(record.id)
  const fresh = await prisma.attendanceRecord.findUnique({
    where: { id: record.id },
    include: { logs: { orderBy: { timestamp: 'asc' } } },
  })
  res.status(201).json({ ...fresh, totals })
})

router.put('/logs/:logId', requirePermission('attendance', 'edit'), async (req: AuthRequest, res) => {
  const { action, timestamp, notes } = req.body as { action?: string; timestamp?: string; notes?: string }
  if (action && !LOG_ACTIONS.includes(action as LogAction)) {
    res.status(400).json({ error: `action must be one of ${LOG_ACTIONS.join(', ')}` })
    return
  }
  const existing = await prisma.attendanceLog.findUnique({ where: { id: req.params.logId as string } })
  if (!existing) { res.status(404).json({ error: 'Log not found' }); return }

  let at: Date | undefined
  if (timestamp) {
    at = new Date(timestamp)
    if (Number.isNaN(at.getTime())) { res.status(400).json({ error: 'Invalid timestamp' }); return }
  }

  await prisma.attendanceLog.update({
    where: { id: existing.id },
    data: {
      ...(action && { action }),
      ...(at && { timestamp: at }),
      ...(notes !== undefined && { notes }),
    },
  })
  await syncLegacyColumns(existing.attendanceRecordId)
  const totals = await recomputeDayTotals(existing.attendanceRecordId)
  const fresh = await prisma.attendanceRecord.findUnique({
    where: { id: existing.attendanceRecordId },
    include: { logs: { orderBy: { timestamp: 'asc' } } },
  })
  res.json({ ...fresh, totals })
})

router.delete('/logs/:logId', requirePermission('attendance', 'edit'), async (req: AuthRequest, res) => {
  const existing = await prisma.attendanceLog.findUnique({ where: { id: req.params.logId as string } })
  if (!existing) { res.status(404).json({ error: 'Log not found' }); return }
  await prisma.attendanceLog.delete({ where: { id: existing.id } })
  await syncLegacyColumns(existing.attendanceRecordId)
  await recomputeDayTotals(existing.attendanceRecordId)
  res.status(204).end()
})

// HR can also correct the day's status/notes directly (e.g. marking a leave day).
router.patch('/records/:recordId', requirePermission('attendance', 'edit'), async (req: AuthRequest, res) => {
  const { status, notes, minutesLate } = req.body as { status?: string; notes?: string; minutesLate?: number }
  const VALID = ['present', 'late', 'absent', 'half_day', 'leave']
  if (status && !VALID.includes(status)) {
    res.status(400).json({ error: `status must be one of ${VALID.join(', ')}` })
    return
  }
  const record = await prisma.attendanceRecord.update({
    where: { id: req.params.recordId as string },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(minutesLate !== undefined && { minutesLate: Math.max(0, Number(minutesLate) || 0) }),
    },
    include: { logs: { orderBy: { timestamp: 'asc' } } },
  })
  res.json(record)
})

// HR marks a day Present manually. A future date needs Business Head sign-off,
// so it is raised as an ApprovalRequest instead of being written straight through.
router.post('/manual-present', requirePermission('attendance', 'edit'), async (req: AuthRequest, res) => {
  const { userId, date, notes } = req.body as { userId?: string; date?: string; notes?: string }
  if (!userId || !date) { res.status(400).json({ error: 'userId and date required' }); return }

  const target = new Date(date)
  if (Number.isNaN(target.getTime())) { res.status(400).json({ error: 'Invalid date' }); return }
  const day = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()))

  if (day.getTime() > dayStartIST().getTime()) {
    const approval = await prisma.approvalRequest.create({
      data: {
        entityType: 'AttendanceRecord',
        entityId: `${userId}:${day.toISOString().slice(0, 10)}`,
        action: 'manual_present',
        requestedById: req.user!.id,
        status: 'pending',
        payload: { userId, date: day.toISOString(), notes: notes ?? null } as any,
        reason: notes ?? 'Manual present for a future date (event/off-site)',
      },
    })
    await notifyRoles(['BusinessHead', 'SuperAdmin'], {
      type: 'approval_request',
      severity: 'warning',
      title: 'Manual attendance approval needed',
      message: `HR marked a future date (${day.toISOString().slice(0, 10)}) as Present. Approval required.`,
      entityType: 'ApprovalRequest',
      entityId: approval.id,
    })
    res.status(202).json({ status: 'approval_required', approvalId: approval.id })
    return
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { userId_date: { userId, date: day } },
    update: { status: 'present', notes: notes ?? 'Marked present by HR' },
    create: { userId, date: day, status: 'present', notes: notes ?? 'Marked present by HR' },
  })
  res.json(record)
})

// Direct HR correction of a day's status and/or punch times. No approval step —
// HR owns attendance data. Upserts the day so a missing record can be created.
router.patch('/manual-edit', requirePermission('attendance', 'edit'), async (req: AuthRequest, res) => {
  const { userId, date, status, checkIn, checkOut, breakStart, breakEnd, totalTravelHours, notes } = req.body as {
    userId?: string; date?: string; status?: string; checkIn?: string; checkOut?: string
    breakStart?: string; breakEnd?: string; totalTravelHours?: number; notes?: string
  }
  if (!userId || !date) { res.status(400).json({ error: 'userId and date required' }); return }

  const VALID_STATUS = ['present', 'late', 'absent', 'half_day', 'leave']
  if (status !== undefined && !VALID_STATUS.includes(status)) {
    res.status(400).json({ error: `status must be one of ${VALID_STATUS.join(', ')}` }); return
  }

  const target = new Date(date)
  if (Number.isNaN(target.getTime())) { res.status(400).json({ error: 'Invalid date' }); return }
  const day = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()))

  const ci = checkIn ? new Date(checkIn) : undefined
  const co = checkOut ? new Date(checkOut) : undefined
  const bs = breakStart ? new Date(breakStart) : undefined
  const be = breakEnd ? new Date(breakEnd) : undefined
  if (ci && Number.isNaN(ci.getTime())) { res.status(400).json({ error: 'Invalid checkIn' }); return }
  if (co && Number.isNaN(co.getTime())) { res.status(400).json({ error: 'Invalid checkOut' }); return }
  if (bs && Number.isNaN(bs.getTime())) { res.status(400).json({ error: 'Invalid breakStart' }); return }
  if (be && Number.isNaN(be.getTime())) { res.status(400).json({ error: 'Invalid breakEnd' }); return }
  if (totalTravelHours !== undefined && (typeof totalTravelHours !== 'number' || totalTravelHours < 0)) {
    res.status(400).json({ error: 'totalTravelHours must be a non-negative number' }); return
  }

  // Only fields the caller actually sent are written, so a status-only edit
  // doesn't wipe existing punch/break times and vice-versa.
  const data: Record<string, unknown> = { notes: notes ?? `Edited by ${req.user!.roleName ?? 'HR'}` }
  if (status !== undefined) data.status = status
  if (checkIn !== undefined) data.checkIn = ci ?? null
  if (checkOut !== undefined) data.checkOut = co ?? null
  if (breakStart !== undefined) data.breakStart = bs ?? null
  if (breakEnd !== undefined) data.breakEnd = be ?? null
  if (totalTravelHours !== undefined) data.totalTravelHours = totalTravelHours

  const existing = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date: day } } })
  const finalBreakStart = (data.breakStart as Date | null | undefined) ?? existing?.breakStart ?? null
  const finalBreakEnd = (data.breakEnd as Date | null | undefined) ?? existing?.breakEnd ?? null
  // Break minutes is the derived column the rest of the app reads (e.g. worked-hours
  // math below) — recompute it whenever either edge of the break changes.
  if (breakStart !== undefined || breakEnd !== undefined) {
    data.breakMinutes = (finalBreakStart && finalBreakEnd && finalBreakEnd > finalBreakStart)
      ? Math.round((finalBreakEnd.getTime() - finalBreakStart.getTime()) / 60000)
      : 0
  }

  const finalIn = (data.checkIn as Date | null | undefined) ?? existing?.checkIn ?? null
  const finalOut = (data.checkOut as Date | null | undefined) ?? existing?.checkOut ?? null
  // Keep the derived worked-hours consistent with the corrected punches/break.
  if (finalIn && finalOut && finalOut > finalIn) {
    const breakMin = (data.breakMinutes as number | undefined) ?? existing?.breakMinutes ?? 0
    data.totalWorkingHours = Math.max(0, (finalOut.getTime() - finalIn.getTime()) / 3600000 - breakMin / 60)
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { userId_date: { userId, date: day } },
    update: data,
    create: {
      userId, date: day, status: status ?? 'present', checkIn: ci ?? null, checkOut: co ?? null,
      breakStart: bs ?? null, breakEnd: be ?? null, breakMinutes: (data.breakMinutes as number) ?? 0,
      totalTravelHours: totalTravelHours ?? 0,
      notes: (data.notes as string), totalWorkingHours: (data.totalWorkingHours as number) ?? 0,
    },
  })
  res.json(record)
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
    include: {
      user: { select: { id: true, name: true, role: true, department: true } },
      logs: { orderBy: { timestamp: 'asc' } },
    },
    orderBy: [{ date: 'desc' }, { userId: 'asc' }],
  })
  res.json(records)
})

// Today summary
router.get('/today', async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const date = todayIST()
  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId, date } },
    select: { id: true },
  })
  if (!existing) { res.json(null); return }

  // Recompute on read so an open interval (still checked in / on break / travelling)
  // shows time accrued up to now, not the total frozen at the last punch.
  const totals = await recomputeDayTotals(existing.id)
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: existing.id },
    include: { logs: { orderBy: { timestamp: 'asc' } } },
  })
  res.json({ ...record, totals })
})

export default router
