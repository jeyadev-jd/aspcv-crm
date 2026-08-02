import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const isProd = process.env.NODE_ENV === 'production'

/**
 * Prisma's default pool is 5 connections, which is undersized for a multi-user
 * CRM - concurrent requests queue behind each other and eventually time out.
 *
 * Appended with URL parsing rather than string concatenation: DATABASE_URL may
 * already carry a query string (e.g. ?schema=public), where a naive `+ '?...'`
 * produces a malformed URL.
 */
function buildUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', process.env.DB_POOL_SIZE || '20')
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '10')
    }
    return url.toString()
  } catch {
    // Malformed URL - hand it to Prisma unchanged so its own error surfaces.
    return raw
  }
}

const url = buildUrl()

const prisma = new PrismaClient({
  ...(url ? { datasources: { db: { url } } } : {}),
  // Query events are emitted in dev only; in production the I/O cost outweighs
  // the value, and query text can contain personal data.
  log: isProd
    ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
    : [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
})

// Slow-query visibility. Only queries over the threshold are printed - logging
// every query drowns the console and hides the ones that matter.
const SLOW_MS = Number(process.env.SLOW_QUERY_MS || 500)

if (!isProd) {
  prisma.$on('query' as never, (e: Prisma.QueryEvent) => {
    if (e.duration >= SLOW_MS) {
      console.warn(`[slow query] ${e.duration}ms: ${e.query.slice(0, 300)}`)
    }
  })
}

prisma.$on('warn' as never, (e: Prisma.LogEvent) => console.warn('[prisma warn]', e.message))
prisma.$on('error' as never, (e: Prisma.LogEvent) => console.error('[prisma error]', e.message))

export default prisma
