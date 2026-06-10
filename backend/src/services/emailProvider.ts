export interface EmailMessage {
  to: string[]
  subject: string
  body: string
  attachmentPaths?: string[]
}

export interface IEmailProvider {
  send(message: EmailMessage): Promise<void>
  listThreads(entityType: string, entityId: string): Promise<unknown[]>
}

// Phase 3: swap in via EMAIL_PROVIDER=outlook env var
// See: https://learn.microsoft.com/en-us/graph/api/user-sendmail

export class SmtpEmailProvider implements IEmailProvider {
  async send(_message: EmailMessage): Promise<void> {
    throw new Error('SmtpEmailProvider not configured. Set EMAIL_PROVIDER env var.')
  }
  async listThreads(_entityType: string, _entityId: string): Promise<unknown[]> {
    return []
  }
}

export class OutlookEmailProvider implements IEmailProvider {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tenantId: string,
  ) {}

  async send(_message: EmailMessage): Promise<void> {
    // Phase 3: POST https://graph.microsoft.com/v1.0/me/sendMail
    throw new Error('OutlookEmailProvider: Phase 3 not yet implemented.')
  }

  async listThreads(_entityType: string, _entityId: string): Promise<unknown[]> {
    // Phase 3: search mail by subject convention "{entityType}:{entityId}"
    return []
  }
}

const driver = process.env.EMAIL_PROVIDER ?? 'smtp'

export const emailProvider: IEmailProvider =
  driver === 'outlook'
    ? new OutlookEmailProvider(
        process.env.AZURE_CLIENT_ID ?? '',
        process.env.AZURE_CLIENT_SECRET ?? '',
        process.env.AZURE_TENANT_ID ?? '',
      )
    : new SmtpEmailProvider()
