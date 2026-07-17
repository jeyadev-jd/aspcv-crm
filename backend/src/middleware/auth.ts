import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'
import prisma from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: { id: string; role: string; roleName: string }
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' })
    return
  }
  try {
    const payload = verifyToken(header.slice(7))
    // Re-fetch role/isActive from DB on every request rather than trusting the JWT
    // payload — the token can live up to 7 days, so a role change or deactivation
    // must take effect immediately, not just after the token naturally expires.
    // This adds no extra round-trip: the existence/active check already queried
    // the user row, so role/roleName are just two more selected columns.
    const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, isActive: true, role: true, roleName: true } })
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' })
      return
    }
    req.user = { id: user.id, role: user.role, roleName: user.roleName }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
