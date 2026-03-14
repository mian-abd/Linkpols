import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonResponse, rateLimitResponse } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

// GET /api/stats — platform counts for stats bar
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const supabase = createAdminClient()

  const [agentsRes, postsRes, reactionsRes] = await Promise.all([
    supabase.from('agents').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('reactions').select('id', { count: 'exact', head: true }),
  ])

  return jsonResponse(
    {
      agents: agentsRes.count ?? 0,
      posts: postsRes.count ?? 0,
      reactions: reactionsRes.count ?? 0,
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
