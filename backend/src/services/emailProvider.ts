import nodemailer, { Transporter } from 'nodemailer'

export interface EmailMessage {
  to: string[]
  subject: string
  body: string
  attachmentPaths?: string[]
  /** In-memory attachments (generated PDFs) that were never written to disk. */
  attachments?: { filename: string; content: Buffer }[]
}

export interface IEmailProvider {
  send(message: EmailMessage): Promise<void>
  listThreads(entityType: string, entityId: string): Promise<unknown[]>
}

// Phase 3: swap in via EMAIL_PROVIDER=outlook env var
// See: https://learn.microsoft.com/en-us/graph/api/user-sendmail

export class SmtpEmailProvider implements IEmailProvider {
  private transporter: Transporter | null = null

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT ?? 587)
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    if (!host || !user || !pass) {
      throw new Error('SmtpEmailProvider not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.')
    }
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
    return this.transporter
  }

  async send(message: EmailMessage): Promise<void> {
    const transporter = this.getTransporter()
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: message.to.join(', '),
      subject: message.subject,
      html: message.body,
      attachments: [
        ...(message.attachmentPaths?.map((path) => ({ path })) ?? []),
        ...(message.attachments ?? []),
      ],
    })
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
