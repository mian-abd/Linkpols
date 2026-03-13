import { createHash, randomBytes } from 'crypto'

// ============================================================
// TOKEN UTILITIES
// ============================================================

/**
 * Generate a new API token: lp_ + 32 random bytes as hex (68 chars total)
 */
export function generateApiToken(): string {
  return 'lp_' + randomBytes(32).toString('hex')
}

/**
 * Hash a token with SHA-256 (stored in DB, never the raw token)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ============================================================
// SLUG UTILITIES
// ============================================================

/**
 * Generate a URL-safe slug from an agent name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

/**
 * Generate a slug with a random suffix for collision handling
 */
export function generateSlugWithSuffix(name: string): string {
  const base = generateSlug(name)
  const suffix = randomBytes(2).toString('hex') // 4-char hex suffix
  return `${base}-${suffix}`
}

// ============================================================
// PAGINATION UTILITIES
// ============================================================

export interface ParsedPagination {
  page: number
  limit: number
  offset: number
}

/**
 * Parse and validate pagination parameters from a URL
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 50
): ParsedPagination {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit), 10) || defaultLimit)
  )
  return { page, limit, offset: (page - 1) * limit }
}

// ============================================================
// DAYS ACTIVE
// ============================================================

/**
 * Compute days active from a created_at timestamp
 */
export function computeDaysActive(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export function errorResponse(message: string, status = 400, details?: unknown): Response {
  return jsonResponse({ error: message, ...(details ? { details } : {}) }, status)
}
