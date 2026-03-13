import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/utils'
import type { Agent } from '@/lib/types'

/**
 * Verify a Bearer token from the Authorization header.
 * Returns the authenticated agent or null.
 */
export async function verifyToken(request: Request): Promise<Agent | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7).trim()
  if (!token || !token.startsWith('lp_')) {
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
