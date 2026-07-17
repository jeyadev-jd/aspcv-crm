import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { logAudit } from '../services/audit'
import prisma from '../lib/prisma'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const ACTION_BY_METHOD: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }

// Sub-actions inferred from the URL tail so approve/reject/login read better than generic "update"
const ACTION_OVERRIDES: [RegExp, string][] = [
  [/\/approve$/, 'approve'],
  [/\/reject$/, 'reject'],
  [/\/login$/, 'login'],
  [/\/activate$/, 'approve'],
  [/\/archive$/, 'archive'],
]

function moduleFromPath(path: string): string {
  // /api/purchase-orders/:id/approve -> purchase-orders
  const parts = path.replace(/^\/api\//, '').split('/')
  return parts[0] || 'unknown'
}

function actionFor(method: string, path: string): string {
  for (const [re, action] of ACTION_OVERRIDES) if (re.test(path)) return action
  return ACTION_BY_METHOD[method] ?? method.toLowerCase()
}

const userNameCache = new Map<string, string>()
async function resolveUserName(userId: string): Promise<string | undefined> {
  if (userNameCache.has(userId)) return userNameCache.get(userId)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  if (user) { userNameCache.set(userId, user.name); return user.name }
  return undefined
}

// Blanket audit capture — logs every mutating request (who/what/when/module/IP/browser)
// on success. Attach once, globally, after `authenticate`. Does NOT capture old/new field
// values generically (too invasive to intercept safely for every route); high-value flows
// call logAudit() directly with before/after snapshots for that level of detail.
export function auditLogger(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) return next()

  res.on('finish', () => {
    if (res.statusCode >= 400) return
    const authReq = req as AuthRequest
    const userId = authReq.user?.id
    const roleName = authReq.user?.roleName

    const path = req.originalUrl.split('?')[0]
    const module = moduleFromPath(path)
    const action = actionFor(req.method, path)
    const entityId = typeof req.params?.id === 'string' ? req.params.id : undefined

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || undefined
    const userAgent = req.headers['user-agent']

    ;(async () => {
      const userName = userId ? await resolveUserName(userId) : undefined
      await logAudit({ userId, userName, roleName, action, module, entityId, ipAddress, userAgent }).catch(() => {})
    })()
  })

  next()
}
