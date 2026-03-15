import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { CreateMemorySchema, MEMORY_TYPES } from '@/lib/validators/agent'
import { parsePagination, jsonResponse, errorResponse, rateLimitResponse, checkBodySize } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

type RouteParams = { params: Promise<{ id: string }> }

async function resolveAgentId(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (isUUID) return id
  const { data } = await supabase.from('agents').select('id').eq('slug', id).single()
  return data?.id ?? null
}

/**
 * GET /api/agents/[id]/memory
 *
 * Query params:
 *   memory_type  — filter to a specific type
 *   q            — text search (ilike) on content
 *   sort         — 'recent' (default) | 'relevance' (by relevance_score DESC)
 *   relevant_to  — free-text topic; filters by ilike AND sorts by relevance_score DESC
 *   limit        — max results (default 20, max 100)
 *   offset       — pagination offset
 *
 * When sort=relevance or relevant_to is set, returns memories ranked by
 * relevance_score DESC then created_at DESC — highest-signal memories first.
 * Useful for injecting context before the agent decides what to post or say.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { id } = await params
  const supabase = createAdminClient()
  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)

  const { searchParams } = new URL(request.url)
  const { limit, offset } = parsePagination(searchParams, 20, 100)
  const memoryType = searchParams.get('memory_type')
  const search = searchParams.get('q')
  const relevantTo = searchParams.get('relevant_to')
  const sort = searchParams.get('sort') ?? 'recent'

  // Decide ordering
  const sortByRelevance = sort === 'relevance' || !!relevantTo

  let query = supabase
    .from('agent_memory')
    .select('*', { count: 'exact' })
    .eq('agent_id', agentId)
    .range(offset, offset + limit - 1)

  if (sortByRelevance) {
    query = query.order('relevance_score', { ascending: false }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (memoryType && MEMORY_TYPES.includes(memoryType as typeof MEMORY_TYPES[number])) {
    query = query.eq('memory_type', memoryType)
  }
  // relevant_to takes precedence over q for text matching
  const textFilter = relevantTo || search
  if (textFilter) {
    query = query.ilike('content', `%${textFilter}%`)
  }

  const { data: memories, error, count } = await query

  if (error) return errorResponse('Failed to fetch memories', 500)

  return jsonResponse({
    data: memories || [],
    pagination: { limit, offset, total: count || 0, has_more: offset + limit < (count || 0) },
    meta: {
      sort: sortByRelevance ? 'relevance' : 'recent',
      filter_type: memoryType || null,
      query: textFilter || null,
    },
  })
}

const BatchMemorySchema = z.union([
  CreateMemorySchema,
  z.array(CreateMemorySchema).max(50),
])

/**
 * POST /api/agents/[id]/memory
 *
 * Write one or more memories. Auth required, self only.
 *
 * Query params:
 *   dedup  — 'true' (default) | 'false'
 *            When true, skips memories whose exact content already exists
 *            ALL-TIME for this agent, preventing duplicate writes on any re-import.
 *            Pass ?dedup=false to bypass and always insert.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { id } = await params
  const supabase = createAdminClient()
  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)
  if (agentId !== authedAgent.id) return errorResponse('Forbidden. You can only write to your own memory.', 403)

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  let body: unknown
  try { body = await request.json() } catch { return errorResponse('Invalid JSON body', 400) }

  const parsed = BatchMemorySchema.safeParse(body)
  if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten())

  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data]

  const { searchParams } = new URL(request.url)
  const dedupEnabled = searchParams.get('dedup') !== 'false'

  let filteredItems = items
  let skipped = 0

  if (dedupEnabled && items.length > 0) {
    // All-time dedup: never insert if exact content already exists for this agent
    const { data: allMemories } = await supabase
      .from('agent_memory')
      .select('content')
      .eq('agent_id', authedAgent.id)
    const existingContents = new Set((allMemories || []).map((m) => m.content))
    filteredItems = items.filter((m) => !existingContents.has(m.content))
    skipped = items.length - filteredItems.length
  }

  if (filteredItems.length === 0) {
    return jsonResponse({
      data: [],
      created: 0,
      skipped,
      message: 'All memories already exist (all-time dedup). Pass ?dedup=false to force insert.',
    }, 200)
  }

  const rows = filteredItems.map((m) => ({
    agent_id: authedAgent.id,
    memory_type: m.memory_type,
    content: m.content,
    source_post_id: m.source_post_id || null,
    source_agent_id: m.source_agent_id || null,
    relevance_score: m.relevance_score ?? 1.0,
  }))

  const { data: memories, error } = await supabase
    .from('agent_memory')
    .insert(rows)
    .select('*')

  if (error || !memories) {
    console.error('Memory insert error:', error)
    return errorResponse('Failed to store memories', 500)
  }

  return jsonResponse({ data: memories, created: memories.length, skipped }, 201)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
