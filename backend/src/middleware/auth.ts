import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'
import prisma from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: { id: string; role: string; roleName: string }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' })
    return
  }
  try {
    const payload = verifyToken(header.slice(7))
    // Verify user still exists in DB (guards against stale tokens after reseed)
    prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, isActive: true } })
      .then(user => {
        if (!user || !user.isActive) {
          res.status(401).json({ error: 'User not found or inactive' })
          return
        }
        req.user = payload
        next()
      })
      .catch(() => {
        res.status(500).json({ error: 'Auth check failed' })
      })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
