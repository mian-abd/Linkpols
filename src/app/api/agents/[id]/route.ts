import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UpdateAgentSchema } from '@/lib/validators/agent'
import { verifyToken } from '@/lib/auth'
import { computeDaysActive, jsonResponse, errorResponse } from '@/lib/utils'
import type { AgentPublicProfile } from '@/lib/types'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/agents/[id] — accepts UUID or slug
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = createAdminClient()

  // Try UUID first, then slug
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const query = supabase
    .from('agents')
    .select('*, agent_capabilities(*)')

  const { data: agent, error } = isUUID
    ? await query.eq('id', id).single()
    : await query.eq('slug', id).single()

  if (error || !agent) {
    return errorResponse('Agent not found', 404)
  }

  // Strip api_token_hash from public response
  const { api_token_hash, ...safeAgent } = agent

  const profile: AgentPublicProfile = {
    ...safeAgent,
    capabilities: agent.agent_capabilities || [],
    days_active: computeDaysActive(agent.created_at),
  }

  return jsonResponse(profile)
}

// PATCH /api/agents/[id] — update agent profile (bearer token required)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  // Verify auth
  const authedAgent = await verifyToken(request)
  if (!authedAgent) {
    return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)
  }

  // Must be the agent themselves
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const targetId = isUUID ? id : null

  if (targetId && targetId !== authedAgent.id) {
    return errorResponse('Forbidden. You can only update your own profile.', 403)
  }

  if (!isUUID) {
    // Resolve slug to id
    const supabase = createAdminClient()
    const { data: found } = await supabase
      .from('agents')
      .select('id')
      .eq('slug', id)
      .single()

    if (!found || found.id !== authedAgent.id) {
      return errorResponse('Forbidden. You can only update your own profile.', 403)
    }
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const parsed = UpdateAgentSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 400, parsed.error.flatten())
  }

  const { capabilities, ...agentUpdates } = parsed.data
  const supabase = createAdminClient()

  // Update agent fields
  if (Object.keys(agentUpdates).length > 0) {
    const { error } = await supabase
      .from('agents')
      .update(agentUpdates)
      .eq('id', authedAgent.id)

    if (error) {
      return errorResponse('Failed to update agent', 500)
    }
  }

  // Update capabilities (upsert)
  if (capabilities && capabilities.length > 0) {
    const rows = capabilities.map((cap) => ({
      agent_id: authedAgent.id,
      capability_tag: cap.capability_tag.toLowerCase().replace(/\s+/g, '_'),
      proficiency_level: cap.proficiency_level || 'intermediate',
      is_primary: cap.is_primary ?? false,
    }))

    await supabase
      .from('agent_capabilities')
      .upsert(rows, { onConflict: 'agent_id,capability_tag' })
  }

  // Return updated profile
  const { data: updated, error: fetchErr } = await supabase
    .from('agents')
    .select('*, agent_capabilities(*)')
    .eq('id', authedAgent.id)
    .single()

  if (fetchErr || !updated) {
    return errorResponse('Failed to fetch updated profile', 500)
  }

  const { api_token_hash, ...safeAgent } = updated
  return jsonResponse({
    ...safeAgent,
    capabilities: updated.agent_capabilities || [],
    days_active: computeDaysActive(updated.created_at),
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
