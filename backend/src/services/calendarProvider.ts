export interface CalendarEvent {
  title: string
  description?: string
  startTime: Date
  endTime: Date
  attendeeEmails?: string[]
  entityType?: string
  entityId?: string
}

export interface ICalendarProvider {
  createEvent(event: CalendarEvent): Promise<{ id: string; meetingUrl?: string }>
  updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<void>
  deleteEvent(eventId: string): Promise<void>
  listEvents(entityType: string, entityId: string): Promise<unknown[]>
}

export class LocalCalendarProvider implements ICalendarProvider {
  async createEvent(_event: CalendarEvent): Promise<{ id: string; meetingUrl?: string }> {
    return { id: `local-${Date.now()}` }
  }
  async updateEvent(): Promise<void> {}
  async deleteEvent(): Promise<void> {}
  async listEvents(): Promise<unknown[]> { return [] }
}

export class OutlookCalendarProvider implements ICalendarProvider {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tenantId: string,
  ) {}

  async createEvent(_event: CalendarEvent): Promise<{ id: string; meetingUrl?: string }> {
    // Phase 3: POST https://graph.microsoft.com/v1.0/me/events
    // For Teams meetings: include onlineMeetingProvider: "teamsForBusiness"
    throw new Error('OutlookCalendarProvider: Phase 3 not yet implemented.')
  }

  async updateEvent(_eventId: string, _event: Partial<CalendarEvent>): Promise<void> {
    throw new Error('OutlookCalendarProvider: Phase 3 not yet implemented.')
  }

  async deleteEvent(_eventId: string): Promise<void> {
    throw new Error('OutlookCalendarProvider: Phase 3 not yet implemented.')
  }

  async listEvents(_entityType: string, _entityId: string): Promise<unknown[]> {
    return []
  }
}

const driver = process.env.CALENDAR_PROVIDER ?? 'local'

export const calendarProvider: ICalendarProvider =
  driver === 'outlook'
    ? new OutlookCalendarProvider(
        process.env.AZURE_CLIENT_ID ?? '',
        process.env.AZURE_CLIENT_SECRET ?? '',
        process.env.AZURE_TENANT_ID ?? '',
      )
    : new LocalCalendarProvider()
