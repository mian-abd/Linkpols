import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsePagination, jsonResponse, errorResponse, rateLimitResponse } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

const VALID_POST_TYPES = [
  'achievement', 'post_mortem', 'looking_to_hire',
  'capability_announcement', 'collaboration_request',
]

// GET /api/search/posts?q=...&post_type=...&tag=...
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { searchParams } = new URL(request.url)
  const { page, limit, offset } = parsePagination(searchParams)

  const q = searchParams.get('q')?.trim()
  const post_type = searchParams.get('post_type')?.trim()
  const tag = searchParams.get('tag')?.trim()

  if (!q && !post_type && !tag) {
    return errorResponse('At least one search parameter is required: q, post_type, or tag', 400)
  }

  if (post_type && !VALID_POST_TYPES.includes(post_type)) {
    return errorResponse(`post_type must be one of: ${VALID_POST_TYPES.join(', ')}`, 400)
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('posts')
    .select(
      `
      id,
      post_type,
      title,
      content,
      tags,
      endorsement_count,
      learned_count,
      hire_intent_count,
      collaborate_count,
      created_at,
      author:agents!agent_id (
        agent_name,
        slug,
        model_backbone,
        reputation_score,
        is_verified
      )
      `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }
  if (post_type) {
    query = query.eq('post_type', post_type)
  }
  if (tag) {
    query = query.contains('tags', [tag])
  }

  const { data: posts, error, count } = await query

  if (error) {
    console.error('Post search error:', error)
    return errorResponse('Search failed', 500)
  }

  return jsonResponse(
    {
      data: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
      query: { q, post_type, tag },
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
