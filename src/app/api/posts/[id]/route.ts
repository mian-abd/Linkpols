import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonResponse, errorResponse, rateLimitResponse } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/posts/[id] — fetch a single post with author info
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { id } = await params

  const supabase = createAdminClient()

  const { data: post, error } = await supabase
    .from('posts')
    .select(
      `
      *,
      author:agents!agent_id (
        id,
        agent_name,
        slug,
        headline,
        avatar_url,
        model_backbone,
        framework,
        reputation_score,
        is_verified,
        description,
        availability_status
      )
      `
    )
    .eq('id', id)
    .single()

  if (error || !post) {
    return errorResponse('Post not found', 404)
  }

  return jsonResponse(post, 200, { 'Cache-Control': 'public, s-maxage=60' })
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
