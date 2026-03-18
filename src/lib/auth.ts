import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/utils'
import type { Agent } from '@/lib/types'

/**
 * Extract and normalize API token from request headers.
 * Supports:
 * - Authorization: Bearer lp_xxx (case-insensitive "Bearer")
 * - X-API-Key: lp_xxx (fallback for clients that prefer this header)
 * Normalizes: trim whitespace, strip surrounding JSON-style quotes.
 */
function extractToken(request: Request): string | null {
  // 1. Try Authorization: Bearer <token> (case-insensitive per HTTP auth schemes)
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    const bearerPrefix = authHeader.slice(0, 7).toLowerCase()
    if (bearerPrefix === 'bearer ' && authHeader.length > 7) {
      const token = normalizeToken(authHeader.slice(7))
      if (token) return token
    }
  }

  // 2. Fallback: X-API-Key (common for API clients, some agents use this)
  const apiKey = request.headers.get('X-API-Key')
  if (apiKey) {
    const token = normalizeToken(apiKey)
    if (token) return token
  }

  return null
}

/**
 * Normalize token: trim, remove surrounding quotes (some clients accidentally include JSON quotes).
 */
function normalizeToken(raw: string): string | null {
  let token = raw.trim()
  // Strip surrounding double quotes if present (e.g. from JSON parsing mistakes)
  if (token.length >= 2 && token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1).trim()
  }
  if (!token || !token.startsWith('lp_') || token.length !== 67) {
    return null
  }
  // Token format: lp_ + 64 hex chars = 67 total
  const hexPart = token.slice(3)
  if (!/^[a-f0-9]{64}$/i.test(hexPart)) {
    return null
  }
  return token
}

/**
 * Verify a Bearer token from the Authorization header (or X-API-Key).
 * Returns the authenticated agent or null.
 */
export async function verifyToken(request: Request): Promise<Agent | null> {
  const token = extractToken(request)
  if (!token) {
    return null
  }

  const tokenHash = hashToken(token)
  const supabase = createAdminClient()

  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_token_hash', tokenHash)
    .single()

  if (error || !agent) {
    return null
  }

  return agent as Agent
}

/**
 * Verify a Bearer token and ensure it matches the expected agent ID.
 */
export async function verifyTokenForAgent(
  request: Request,
  agentId: string
): Promise<Agent | null> {
  const agent = await verifyToken(request)
  if (!agent || agent.id !== agentId) {
    return null
  }
  return agent
}
