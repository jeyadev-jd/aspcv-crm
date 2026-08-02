import { Router } from 'express'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, strongPassword } from '../lib/zod-schemas'
import { authenticate, AuthRequest } from '../middleware/auth'
import { emailProvider } from '../services/emailProvider'
import { createRateLimiter } from '../middleware/rateLimiter'

const router = Router()

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many login attempts — try again in 15 minutes.',
})

// Account-level lockout. The IP limiter above is a first line of defence only:
// it is per-process and per-IP, so it resets on restart and does nothing against
// an attacker rotating addresses. These thresholds follow the account instead.
const MAX_FAILED_LOGINS = 5
const LOCKOUT_MS = 15 * 60 * 1000

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { email }, include: { designation: true } })
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    res.status(429).json({ error: `Account locked after too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    const failed = (user.failedLoginCount ?? 0) + 1
    const lock = failed >= MAX_FAILED_LOGINS
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    })
    if (lock) {
      // Best-effort notice; a failure to send must not leak which accounts exist.
      emailProvider
        .send({
          to: [user.email],
          subject: 'ASPCV CRM — account temporarily locked',
          body: `<p>Hi ${user.name},</p><p>Your account was locked after ${MAX_FAILED_LOGINS} failed sign-in attempts. It unlocks automatically in 15 minutes.</p><p>If this wasn't you, change your password once you regain access.</p>`,
        })
        .catch(err => console.error('[login] lockout email failed:', err?.message))
      res.status(429).json({ error: 'Account locked after too many failed attempts. Try again in 15 minutes.' })
      return
    }
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  // Successful sign-in clears the counters.
  if (user.failedLoginCount || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } })
  }

  const token = signToken({ id: user.id, role: user.role, roleName: user.roleName, tokenVersion: user.tokenVersion })
  res.json({
    token,
    mustChangePassword: user.mustChangePassword,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, roleName: user.roleName, designation: user.designation?.name }
  })
})

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_OTP_ATTEMPTS = 5

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString()
}

// Send an email OTP — used before first-login/forced password change and forgot-password confirmation.
router.post('/send-otp', authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const otp = generateOtp()
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')
  await prisma.user.update({
    where: { id: user.id },
    // Reset the attempt counter with each newly issued code, so a fresh request
    // is not immediately blocked by an earlier round of wrong guesses.
    data: { otpCode: hashedOtp, otpExpiry: new Date(Date.now() + OTP_TTL_MS), otpAttemptCount: 0 },
  })

  await emailProvider.send({
    to: [user.email],
    subject: 'Your ASPCV CRM verification code',
    body: `<p>Hi ${user.name},</p><p>Your verification code is:</p><h2>${otp}</h2><p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>`,
  })

  res.json({ message: 'Verification code sent to your email.' })
})

// Verify OTP + set new password — used for forced first-login / default-password change.
router.post('/verify-otp-change-password', authenticate, async (req: AuthRequest, res) => {
  const { otp, newPassword } = req.body as { otp?: string; newPassword?: string }
  if (!otp || !newPassword) { res.status(400).json({ error: 'otp and newPassword required' }); return }
  const pw = strongPassword.safeParse(newPassword)
  if (!pw.success) { res.status(400).json({ error: pw.error.issues[0]?.message ?? 'Password does not meet requirements' }); return }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user || !user.otpCode || !user.otpExpiry) { res.status(400).json({ error: 'No verification code pending — request one first' }); return }
  if (user.otpExpiry < new Date()) { res.status(400).json({ error: 'Verification code expired — request a new one' }); return }

  // A 6-digit code is only 900k possibilities; without a cap it is guessable in
  // minutes. Burn the code after MAX_OTP_ATTEMPTS so a new one must be issued.
  if ((user.otpAttemptCount ?? 0) >= MAX_OTP_ATTEMPTS) {
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: null, otpExpiry: null, otpAttemptCount: 0 } })
    res.status(429).json({ error: 'Too many incorrect codes — request a new verification code.' })
    return
  }

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')
  if (hashedOtp !== user.otpCode) {
    const attempts = (user.otpAttemptCount ?? 0) + 1
    const exhausted = attempts >= MAX_OTP_ATTEMPTS
    await prisma.user.update({
      where: { id: user.id },
      data: exhausted
        ? { otpCode: null, otpExpiry: null, otpAttemptCount: 0 }
        : { otpAttemptCount: attempts },
    })
    res.status(400).json({
      error: exhausted
        ? 'Too many incorrect codes — request a new verification code.'
        : `Invalid verification code (${MAX_OTP_ATTEMPTS - attempts} attempt${MAX_OTP_ATTEMPTS - attempts === 1 ? '' : 's'} left)`,
    })
    return
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash, otpCode: null, otpExpiry: null, otpAttemptCount: 0,
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
      // A successful password change also clears any standing login lockout.
      failedLoginCount: 0, lockedUntil: null,
    },
  })
  const token = signToken({ id: user.id, role: user.role, roleName: user.roleName, tokenVersion: user.tokenVersion + 1 })
  res.json({ message: 'Password changed successfully', token })
})

// Skip the forced password change for this login session only — the flag stays set,
// so the prompt reappears next login (per business rule: skip doesn't dismiss permanently).
router.post('/skip-password-change', authenticate, async (req: AuthRequest, res) => {
  res.json({ message: 'Skipped for this session. You will be prompted again on next login.' })
})

router.post('/refresh', async (req, res) => {
  const { token } = req.body as { token?: string }
  if (!token) { res.status(400).json({ error: 'Token required' }); return }
  try {
    const { verifyToken } = await import('../lib/jwt')
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user || !user.isActive) { res.status(401).json({ error: 'User not found' }); return }
    // Same revocation check as `authenticate`. Without it a token invalidated by
    // a password change is still accepted here, and the reissued token carried
    // no tokenVersion at all - so it failed every subsequent request, silently
    // breaking refresh for anyone who had ever changed their password.
    if ((payload.tv ?? 0) < (user.tokenVersion ?? 0)) {
      res.status(401).json({ error: 'Session expired — please sign in again' })
      return
    }
    res.json({ token: signToken({ id: user.id, role: user.role, roleName: user.roleName, tokenVersion: user.tokenVersion }) })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

router.post('/forgot-password', async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { email } })

  // Always return 200 regardless of whether the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  if (!user || !user.isActive) {
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' })
    return
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: hashedToken, resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  })

  const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/reset-password?token=${rawToken}`

  await emailProvider.send({
    to: [user.email],
    subject: 'Reset your ASPCV CRM password',
    body: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  })

  res.json({ message: 'If an account exists for that email, a reset link has been sent.' })
})

router.post('/reset-password', async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body)
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const user = await prisma.user.findFirst({
    where: { resetToken: hashedToken, resetTokenExpiry: { gt: new Date() } },
  })
  if (!user) {
    res.status(400).json({ error: 'Reset link is invalid or has expired' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: user.id },
    // Increment tokenVersion to invalidate all existing sessions
    data: { passwordHash, resetToken: null, resetTokenExpiry: null, tokenVersion: { increment: 1 } },
  })

  res.json({ message: 'Password reset successfully' })
})

// GET /api/auth/my-permissions — flat permission map for frontend
router.get('/my-permissions', authenticate, async (req: AuthRequest, res) => {
  const { id: userId, roleName } = req.user!

  const map: Record<string, boolean> = {}

  if (roleName === 'SuperAdmin') {
    map['*'] = true
  } else {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleDefinition: { name: roleName }, allowed: true },
      select: { resource: true, action: true },
    })
    for (const p of rolePerms) {
      map[`${p.resource}:${p.action}`] = true
      // `read_all` is a superset of `read_own` — mirrors the same rule in
      // resolvePermission() so the sidebar/UI doesn't hide things a read_all
      // role can actually access via the API.
      if (p.action === 'read_all') map[`${p.resource}:read_own`] = true
    }
    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId },
      select: { resource: true, action: true, allowed: true },
    })
    for (const o of overrides) {
      map[`${o.resource}:${o.action}`] = o.allowed
    }
  }

  res.json(map)
})

export default router
