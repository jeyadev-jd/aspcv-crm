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
    const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, isActive: true, role: true, roleName: true, tokenVersion: true } })
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' })
      return
    }
    // Token version check — if the stored version is higher than the one in the JWT,
    // the token was issued before a password change and must be rejected.
    if ((payload.tv ?? 0) < (user.tokenVersion ?? 0)) {
      res.status(401).json({ error: 'Session expired — please log in again' })
      return
    }
    req.user = { id: user.id, role: user.role, roleName: user.roleName }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
