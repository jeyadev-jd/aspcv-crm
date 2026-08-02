import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

const isProd = process.env.NODE_ENV === 'production'

/**
 * Prisma error messages embed table names, column names and full query text.
 * Known codes are mapped to something a user can act on; everything else falls
 * through to a generic message so the schema is not described to the caller.
 */
function fromPrisma(err: unknown): { status: number; message: string } | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Deliberately does not name the field: on an email column that answers
        // "does an account exist with this address?" for anyone probing.
        return { status: 409, message: 'A record with these details already exists.' }
      case 'P2025':
        return { status: 404, message: 'Record not found.' }
      case 'P2003':
        return { status: 409, message: 'This record is still referenced by other data.' }
      case 'P2000':
        return { status: 400, message: 'A value is too long for its field.' }
      default:
        return { status: 400, message: 'The request could not be completed.' }
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: 'Invalid request data.' }
  }
  return null
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Full detail always goes to the server log - masking is for the response only.
  console.error(`[error] ${req.method} ${req.originalUrl}`, err)

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.issues })
    return
  }

  const prismaMapped = fromPrisma(err)
  if (prismaMapped) {
    res.status(prismaMapped.status).json({ error: prismaMapped.message })
    return
  }

  const e = err as { status?: number; statusCode?: number; message?: string }
  const status = e.status || e.statusCode || 500

  // Errors thrown deliberately by a route carry an explicit 4xx status and a
  // message written for the user, so those are passed through unchanged. Only
  // unhandled failures (500s) are masked, since their text is an internal
  // exception string that may describe the database or filesystem.
  if (status >= 500) {
    res.status(status).json({
      error: 'Internal server error',
      ...(isProd ? {} : { detail: e.message }),
    })
    return
  }

  res.status(status).json({ error: e.message || 'Request failed' })
}
