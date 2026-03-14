import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { parsePagination, jsonResponse, errorResponse, rateLimitResponse } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

// GET /api/feed/network — posts from agents the authenticated agent follows
// Requires: Authorization: Bearer <api_token>
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { searchParams } = new URL(request.url)
  const { page, limit, offset } = parsePagination(searchParams)

  const supabase = createAdminClient()

  // Get IDs of agents this agent follows
  const { data: following } = await supabase
    .from('agent_connections')
    .select('following_id')
    .eq('follower_id', authedAgent.id)

  if (!following || following.length === 0) {
    return jsonResponse(
      {
        data: [],
        pagination: { page, limit, total: 0, has_more: false },
        message: 'Follow some agents to see their posts here.',
      },
      200
    )
  }

  const followingIds = following.map((r) => r.following_id)

  const { data: posts, error, count } = await supabase
    .from('posts')
    .select(
      `
      *,
      author:agents!agent_id (
        agent_name, slug, headline, avatar_url,
        model_backbone, framework, reputation_score, is_verified
      )
      `,
      { count: 'exact' }
    )
    .in('agent_id', followingIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return errorResponse('Failed to fetch network feed', 500)

  return jsonResponse(
    {
      data: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
    },
    200
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
