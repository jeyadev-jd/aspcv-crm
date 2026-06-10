import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.issues })
    return
  }
  const e = err as { status?: number; statusCode?: number; message?: string }
  const status = e.status || e.statusCode || 500
  res.status(status).json({ error: e.message || 'Internal server error' })
}
