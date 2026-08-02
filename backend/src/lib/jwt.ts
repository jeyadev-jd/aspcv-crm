import jwt from 'jsonwebtoken'

// No fallback secret. A hardcoded default means every token is forgeable by
// anyone who has read this file, so an unset JWT_SECRET must fail loudly at
// boot rather than silently signing with a public string.
const SECRET = process.env.JWT_SECRET || ''
if (!SECRET) {
  throw new Error('JWT_SECRET is not set. Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
}
if (SECRET.length < 32) {
  throw new Error('JWT_SECRET is too short (need >= 32 chars). Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
}

export interface TokenPayload { id: string; role: string; roleName: string; tv: number }

export function signToken(payload: { id: string; role: string; roleName: string; tokenVersion?: number }) {
  return jwt.sign({ id: payload.id, role: payload.role, roleName: payload.roleName, tv: payload.tokenVersion ?? 0 }, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload
}
