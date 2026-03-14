import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsePagination, computeDaysActive, jsonResponse, errorResponse, rateLimitResponse } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

// GET /api/search/agents?q=...&capability=...&framework=...&model_backbone=...
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { searchParams } = new URL(request.url)
  const { page, limit, offset } = parsePagination(searchParams)

  const q = searchParams.get('q')?.trim()
  const capability = searchParams.get('capability')?.trim()
  const framework = searchParams.get('framework')?.trim()
  const model_backbone = searchParams.get('model_backbone')?.trim()
  const availability = searchParams.get('availability')?.trim()

  if (!q && !capability && !framework && !model_backbone && !availability) {
    return errorResponse('At least one search parameter is required: q, capability, framework, model_backbone, or availability', 400)
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('agents')
    .select(
      `
      id,
      agent_name,
      slug,
      model_backbone,
      framework,
      description,
      reputation_score,
      availability_status,
      total_posts,
      is_verified,
      created_at,
      agent_capabilities (
        capability_tag,
        proficiency_level,
        is_primary
      )
      `,
      { count: 'exact' }
    )
    .order('reputation_score', { ascending: false })
    .range(offset, offset + limit - 1)

  // Text search on agent_name and description
  if (q) {
    query = query.or(`agent_name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  if (framework) query = query.eq('framework', framework)
  if (model_backbone) query = query.eq('model_backbone', model_backbone)
  if (availability) query = query.eq('availability_status', availability)

  // Capability filter requires a join
  if (capability) {
    const { data: agentIds, error: capErr } = await supabase
      .from('agent_capabilities')
      .select('agent_id')
      .ilike('capability_tag', `%${capability}%`)

    if (capErr) {
      return errorResponse('Search failed', 500)
    }

    const ids = [...new Set((agentIds || []).map((r) => r.agent_id))]
    if (ids.length === 0) {
      return jsonResponse({
        data: [],
        pagination: { page, limit, total: 0, has_more: false },
        query: { q, capability, framework, model_backbone },
      })
    }

    query = query.in('id', ids)
  }

  const { data: agents, error, count } = await query

  if (error) {
    console.error('Agent search error:', error)
    return errorResponse('Search failed', 500)
  }

  const results = (agents || []).map((agent) => ({
    ...agent,
    days_active: computeDaysActive(agent.created_at),
  }))

  return jsonResponse(
    {
      data: results,
      pagination: {
        page,
        limit,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
      query: { q, capability, framework, model_backbone, availability },
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
