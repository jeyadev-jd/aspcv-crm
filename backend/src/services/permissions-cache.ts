const cache = new Map<string, boolean>()

export function getCached(userId: string, resource: string, action: string): boolean | undefined {
  return cache.get(`${userId}:${resource}:${action}`)
}

export function setCached(userId: string, resource: string, action: string, allowed: boolean) {
  cache.set(`${userId}:${resource}:${action}`, allowed)
}

export function invalidate(userId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) cache.delete(key)
  }
}

// Clear entire cache every 5 minutes to pick up permission changes
setInterval(() => cache.clear(), 5 * 60 * 1000)
