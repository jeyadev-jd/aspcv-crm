import prisma from '../lib/prisma'
import { appendEvent } from './timeline'
import { createNotification } from './notify'
import { CalendarEventCategory } from '@prisma/client'

// Phase 2a: keeps CalendarEvent in sync with the business object that owns a given
// (entityType, entityId, category) slot — Installation's scheduled date, Project's
// warranty end, etc. `dedupe: true` means "one event per slot" (upsert-by-find);
// dedupe: false always creates a new row (repeatable categories like ServiceVisit/Meeting).
export async function syncCalendarEvent(opts: {
  entityType: string
  entityId: string
  category: CalendarEventCategory
  title: string
  date: Date
  startTime?: string
  endTime?: string
  description?: string
  color?: string
  actorId?: string
  notifyUserIds?: string[]
  dedupe?: boolean
}) {
  const { entityType, entityId, category, title, date, startTime = '00:00', endTime = '00:00', description, color, actorId, notifyUserIds, dedupe = true } = opts

  let event
  if (dedupe) {
    const existing = await prisma.calendarEvent.findFirst({ where: { entityType, entityId, category, source: 'Auto' } })
    event = existing
      ? await prisma.calendarEvent.update({ where: { id: existing.id }, data: { title, date, startTime, endTime, description, color } })
      : await prisma.calendarEvent.create({ data: { entityType, entityId, category, title, date, startTime, endTime, description, color: color || 'blue', source: 'Auto', createdById: actorId } })
  } else {
    event = await prisma.calendarEvent.create({ data: { entityType, entityId, category, title, date, startTime, endTime, description, color: color || 'blue', source: 'Auto', createdById: actorId } })
  }

  await appendEvent(entityType, entityId, 'CALENDAR_SYNCED', `Calendar event "${title}" synced (${category})`, actorId)
  if (notifyUserIds?.length) {
    await createNotification({ userIds: notifyUserIds, type: 'calendar', severity: 'info', title: `Calendar: ${title}`, message: description || title, entityType, entityId })
  }
  return event
}

// Removes the Auto-synced calendar event for a slot — called when the owning business
// object is deleted or the triggering condition no longer applies (e.g. installation
// rescheduled to "no date").
export async function removeCalendarEvent(entityType: string, entityId: string, category: CalendarEventCategory) {
  await prisma.calendarEvent.deleteMany({ where: { entityType, entityId, category, source: 'Auto' } })
}
