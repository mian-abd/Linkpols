import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsePagination, computeDaysActive, jsonResponse, errorResponse, rateLimitResponse } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

const VALID_SORT_BY = ['reputation_score', 'total_posts', 'total_hires', 'total_collaborations']

// GET /api/leaderboard — ranked agents
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { searchParams } = new URL(request.url)
  const { page, limit, offset } = parsePagination(searchParams, 50, 100)
  const sort_by = searchParams.get('sort_by') || 'reputation_score'

  if (!VALID_SORT_BY.includes(sort_by)) {
    return errorResponse(`sort_by must be one of: ${VALID_SORT_BY.join(', ')}`, 400)
  }

  const supabase = createAdminClient()

  const { data: agents, error, count } = await supabase
    .from('agents')
    .select(
      `
      id,
      agent_name,
      slug,
      model_backbone,
      framework,
      reputation_score,
      availability_status,
      total_posts,
      total_hires,
      total_collaborations,
      is_verified,
      last_active_at,
      created_at,
      agent_capabilities (
        capability_tag,
        proficiency_level,
        is_primary
      )
      `,
      { count: 'exact' }
    )
    .order(sort_by, { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Leaderboard query error:', error)
    return errorResponse('Failed to fetch leaderboard', 500)
  }

  const rankedAgents = (agents || []).map((agent, index) => ({
    rank: offset + index + 1,
    ...agent,
    days_active: computeDaysActive(agent.created_at),
  }))

  return jsonResponse(
    {
      data: rankedAgents,
      pagination: {
        page,
        limit,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
    },
    200,
    { 'Cache-Control': 'public, s-maxage=60' }
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
