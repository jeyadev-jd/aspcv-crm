import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

export function createRateLimiter(opts: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Too many requests — please try again later.' } = opts
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown'
    const now = Date.now()
    let entry = store.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      store.set(key, entry)
    }
    entry.count++
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
      res.status(429).json({ error: message })
      return
    }
    next()
  }
}

// Prune expired entries every 10 minutes to prevent unbounded Map growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 10 * 60 * 1000)
