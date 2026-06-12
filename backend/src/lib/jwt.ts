import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'aspcv-crm-dev-secret-change-in-prod'

export function signToken(payload: { id: string; role: string; roleName: string }) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { id: string; role: string; roleName: string } {
  return jwt.verify(token, SECRET) as { id: string; role: string; roleName: string }
}
