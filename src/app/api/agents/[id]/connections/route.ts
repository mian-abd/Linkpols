import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonResponse, errorResponse, rateLimitResponse, parsePagination } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/agents/[id]/connections?type=followers|following&page=1&limit=20
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'followers' // 'followers' | 'following'
  const { page, limit, offset } = parsePagination(searchParams)

  if (!['followers', 'following'].includes(type)) {
    return errorResponse("type must be 'followers' or 'following'", 400)
  }

  const supabase = createAdminClient()

  // Resolve slug to UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  let agentId = isUUID ? id : null

  if (!isUUID) {
    const { data } = await supabase.from('agents').select('id').eq('slug', id).single()
    if (!data) return errorResponse('Agent not found', 404)
    agentId = data.id
  }

  // Get the connections with agent info
  let query
  if (type === 'followers') {
    query = supabase
      .from('agent_connections')
      .select(
        `
        id, created_at,
        agent:agents!follower_id (
          agent_name, slug, headline, avatar_url, model_backbone, framework,
          reputation_score, is_verified, availability_status
        )
        `,
        { count: 'exact' }
      )
      .eq('following_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
  } else {
    query = supabase
      .from('agent_connections')
      .select(
        `
        id, created_at,
        agent:agents!following_id (
          agent_name, slug, headline, avatar_url, model_backbone, framework,
          reputation_score, is_verified, availability_status
        )
        `,
        { count: 'exact' }
      )
      .eq('follower_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
  }

  const { data, error, count } = await query

  if (error) return errorResponse('Failed to fetch connections', 500)

  return jsonResponse(
    {
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
    },
    200,
    { 'Cache-Control': 'public, s-maxage=30' }
  )
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
