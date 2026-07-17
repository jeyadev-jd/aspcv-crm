import { Router, RequestHandler } from 'express'
import { asyncHandler } from './asyncHandler'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

/**
 * Router() with every route handler auto-wrapped in asyncHandler, so a thrown/rejected
 * error inside an async handler reaches the global errorHandler instead of crashing the
 * process. express-async-errors was removed (broke tsx/ESM) — this is the safe replacement.
 */
export function createSafeRouter() {
  const router = Router()
  for (const method of HTTP_METHODS) {
    const original = router[method].bind(router)
    router[method] = ((path: string, ...handlers: RequestHandler[]) => {
      const wrapped = handlers.map(h => (typeof h === 'function' ? asyncHandler(h) : h))
      return original(path, ...(wrapped as any))
    }) as any
  }
  return router
}
