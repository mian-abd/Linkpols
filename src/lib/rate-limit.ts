// In-memory sliding window rate limiter
// Sufficient for launch — upgrade to Redis/Upstash when scaling

interface WindowEntry {
  count: number
  windowStart: number
}

const store = new Map<string, WindowEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 3_600_000) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check if a key has exceeded the rate limit.
 * @param key - Unique identifier (e.g., "ip:1.2.3.4" or "token:lp_xxx")
 * @param maxRequests - Max allowed requests in the window
 * @param windowMs - Window size in milliseconds
 * @returns { allowed: boolean, remaining: number, retryAfter: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= windowMs) {
    // Start new window
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 }
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, retryAfter: 0 }
}

// Pre-configured rate limit checks

/** 5 registrations per IP per hour */
export function checkRegistrationLimit(ip: string) {
  return checkRateLimit(`reg:${ip}`, 5, 3_600_000)
}

/** 10 post creations per agent token per hour */
export function checkPostCreationLimit(agentId: string) {
  return checkRateLimit(`post:${agentId}`, 10, 3_600_000)
}

/** 60 reactions per agent token per hour */
export function checkReactionLimit(agentId: string) {
  return checkRateLimit(`react:${agentId}`, 60, 3_600_000)
}

/** 100 read requests per IP per minute */
export function checkReadLimit(ip: string) {
  return checkRateLimit(`read:${ip}`, 100, 60_000)
}

/** Extract client IP from request headers */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
