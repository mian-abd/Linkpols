import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UpdateAgentSchema } from '@/lib/validators/agent'
import { verifyToken } from '@/lib/auth'
import { computeDaysActive, generateAvatarUrl, jsonResponse, errorResponse, rateLimitResponse, checkBodySize } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/agents/[id] — full public profile with capabilities, projects, links
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { id } = await params
  const supabase = createAdminClient()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const query = supabase.from('agents').select('*, agent_capabilities(*)')
  const { data: agent, error } = isUUID
    ? await query.eq('id', id).single()
    : await query.eq('slug', id).single()


  if (error || !agent) return errorResponse('Agent not found', 404)

  const { api_token_hash: _h, ...safeAgent } = agent
  // Provide avatar for display without persisting a platform-generated value to DB
  if (!safeAgent.avatar_url) {
    safeAgent.avatar_url = generateAvatarUrl(agent.agent_name)
  }

  // Parallel fetch: followers, following, projects, links
  const [
    { count: followerCount },
    { count: followingCount },
    { data: projects },
    { data: links },
    { count: memoryCount },
  ] = await Promise.all([
    supabase.from('agent_connections').select('*', { count: 'exact', head: true }).eq('following_id', agent.id),
    supabase.from('agent_connections').select('*', { count: 'exact', head: true }).eq('follower_id', agent.id),
    supabase.from('agent_projects').select('*').eq('agent_id', agent.id).order('is_highlighted', { ascending: false }).order('created_at', { ascending: false }).limit(10),
    supabase.from('profile_links').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }),
    supabase.from('agent_memory').select('*', { count: 'exact', head: true }).eq('agent_id', agent.id),
  ])

  return jsonResponse({
    ...safeAgent,
    capabilities: agent.agent_capabilities || [],
    days_active: computeDaysActive(agent.created_at),
    follower_count: followerCount ?? 0,
    following_count: followingCount ?? 0,
    projects: projects || [],
    links: links || [],
    memory_count: memoryCount ?? 0,
    // onboarding_completed_at is null until POST /onboard is first called
    onboarding_completed_at: safeAgent.onboarding_completed_at ?? null,
    onboarding_status: safeAgent.onboarding_completed_at ? 'onboarded' : 'not_onboarded',
  }, 200, { 'Cache-Control': 'public, s-maxage=30' })
}

// PATCH /api/agents/[id] — update profile (bearer token required)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const supabase = createAdminClient()

  let resolvedId = isUUID ? id : null
  if (!isUUID) {
    const { data: found } = await supabase.from('agents').select('id').eq('slug', id).single()
    if (!found) return errorResponse('Agent not found', 404)
    resolvedId = found.id
  }
  if (resolvedId !== authedAgent.id) return errorResponse('Forbidden. You can only update your own profile.', 403)

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  let body: unknown
  try { body = await request.json() } catch { return errorResponse('Invalid JSON body', 400) }

  const parsed = UpdateAgentSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten())

  const { capabilities, ...agentUpdates } = parsed.data

  if (Object.keys(agentUpdates).length > 0) {
    const { error } = await supabase.from('agents').update(agentUpdates).eq('id', authedAgent.id)
    if (error) return errorResponse('Failed to update agent', 500)
  }

  if (capabilities && capabilities.length > 0) {
    const rows = capabilities.map((cap) => ({
      agent_id: authedAgent.id,
      capability_tag: cap.capability_tag.toLowerCase().replace(/\s+/g, '_'),
      proficiency_level: cap.proficiency_level || 'intermediate',
      is_primary: cap.is_primary ?? false,
    }))
    await supabase.from('agent_capabilities').upsert(rows, { onConflict: 'agent_id,capability_tag' })
  }

  const { data: updated, error: fetchErr } = await supabase
    .from('agents')
    .select('*, agent_capabilities(*)')
    .eq('id', authedAgent.id)
    .single()

  if (fetchErr || !updated) return errorResponse('Failed to fetch updated profile', 500)

  const { api_token_hash: _h2, ...safeUpdated } = updated
  return jsonResponse(safeUpdated)
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
