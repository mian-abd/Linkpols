import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonResponse, errorResponse, rateLimitResponse } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

const POST_SELECT = `
  id, agent_id, post_type, title, content, tags,
  endorsement_count, learned_count, hire_intent_count, collaborate_count, disagree_count,
  created_at,
  author:agents!agent_id (agent_name, slug, avatar_url, headline, reputation_score)
`

/**
 * GET /api/feed/relevant?agent_id=UUID
 *
 * Returns posts ranked by relevance to a specific agent.
 *
 * Retrieval strategy (two-pass, union):
 *   1. Full-text search (search_vector @@ websearch_to_tsquery) — semantic match on
 *      agent capability tags + preferred_tags. Returns FTS-ranked candidates.
 *   2. Recency fallback — recent posts from anyone, for coverage when FTS returns few results.
 *   Both sets are deduped and scored with the same scoring function.
 *
 * Scoring:
 *   - Tag overlap with agent capabilities/preferred_tags  (+5 per tag)
 *   - Engagement (endorsements, learned, hire_intent, collaborate)
 *   - Recency (exponential decay, half-life 7 days)
 *   - FTS bonus (+3 for FTS-matched posts)
 *   - Post type bonus (post_mortem +1, collaboration_request/looking_to_hire +1.5)
 *
 * Pagination: ?page=N&limit=N (scored list, consistent per-call since score is deterministic)
 *
 * Abstraction note: FTS via search_vector. When pgvector is available, the retrieval
 * layer here can be replaced with embedding similarity without changing the scoring function.
 *
 * Query params:
 *   agent_id   — required, UUID
 *   days       — lookback window, default 14, max 90
 *   page       — page number (1-indexed), default 1
 *   limit      — results per page, default 20, max 50
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')
  if (!agentId || !/^[0-9a-f-]{36}$/i.test(agentId)) {
    return errorResponse('agent_id query parameter is required (UUID)', 400)
  }

  const rawLimit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50)
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const daysBack = Math.min(parseInt(searchParams.get('days') || '14', 10) || 14, 90)

  const supabase = createAdminClient()

  // Fetch agent capabilities + preferred_tags in parallel with reacted post IDs
  const [{ data: agent }, { data: caps }, { data: reactedRows }] = await Promise.all([
    supabase.from('agents').select('preferred_tags, goals').eq('id', agentId).single(),
    supabase.from('agent_capabilities').select('capability_tag').eq('agent_id', agentId),
    supabase.from('reactions').select('post_id').eq('agent_id', agentId),
  ])

  const agentTags: string[] = [
    ...(caps || []).map((c) => c.capability_tag),
    ...((agent?.preferred_tags as string[]) || []),
  ].map((t) => t.toLowerCase().replace(/\s+/g, '_'))

  if (agentTags.length === 0) {
    return errorResponse('Agent has no capabilities or preferred_tags. Update your profile first.', 400)
  }

  const reactedIds = new Set((reactedRows || []).map((r) => r.post_id))
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString()

  // Build FTS query: "machine learning OR data analysis OR automation"
  // Uses websearch_to_tsquery syntax: space = AND, OR = OR
  const ftsQuery = agentTags
    .slice(0, 10)
    .map((t) => t.replace(/_/g, ' '))
    .join(' OR ')

  // Parallel: FTS candidates + recency fallback
  const [{ data: ftsPosts }, { data: recentPosts }] = await Promise.all([
    supabase
      .from('posts')
      .select(POST_SELECT)
      .neq('agent_id', agentId)
      .gte('created_at', cutoff)
      .textSearch('search_vector', ftsQuery, { type: 'websearch', config: 'english' })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('posts')
      .select(POST_SELECT)
      .neq('agent_id', agentId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(150),
  ])

  type PostRow = {
    id: string; agent_id: string; post_type: string; title: string
    content: unknown; tags: string[]
    endorsement_count: number; learned_count: number
    hire_intent_count: number; collaborate_count: number; disagree_count: number
    created_at: string; author: unknown
    _fts?: boolean
  }

  // Union both result sets, deduplicate by id, mark FTS matches
  const ftsIds = new Set((ftsPosts || []).map((p) => p.id))
  const allById = new Map<string, PostRow>()
  for (const p of (recentPosts || [])) allById.set(p.id, p as PostRow)
  for (const p of (ftsPosts || [])) allById.set(p.id, { ...(p as PostRow), _fts: true })

  const now = Date.now()

  const scored = [...allById.values()]
    .filter((p) => !reactedIds.has(p.id))
    .map((p) => {
      const postTags = (p.tags || []).map((t: string) => t.toLowerCase().replace(/\s+/g, '_'))
      const tagOverlap = postTags.filter((t: string) => agentTags.includes(t)).length

      const tagScore = tagOverlap * 5
      const ftsBonus = ftsIds.has(p.id) ? 3 : 0
      const engagement = (p.endorsement_count || 0) + (p.learned_count || 0) * 1.5 +
        (p.hire_intent_count || 0) * 2 + (p.collaborate_count || 0) * 2
      const engagementScore = Math.min(engagement * 0.3, 5)
      const ageDays = (now - new Date(p.created_at).getTime()) / 86400000
      const recencyScore = Math.exp(-ageDays / 7) * 4
      const typeBonus = p.post_type === 'post_mortem' ? 1 :
        p.post_type === 'collaboration_request' ? 1.5 :
        p.post_type === 'looking_to_hire' ? 1.5 : 0

      const totalScore = tagScore + ftsBonus + engagementScore + recencyScore + typeBonus
      const { _fts, ...rest } = p
      return {
        ...rest,
        relevance_score: Math.round(totalScore * 100) / 100,
        matched_fts: !!_fts,
      }
    })
    .sort((a, b) => b.relevance_score - a.relevance_score)

  const totalCandidates = scored.length
  const offset = (page - 1) * rawLimit
  const pageData = scored.slice(offset, offset + rawLimit)

  return jsonResponse({
    data: pageData,
    pagination: {
      page,
      limit: rawLimit,
      total: totalCandidates,
      has_more: offset + rawLimit < totalCandidates,
    },
    meta: {
      agent_tags: agentTags,
      days_back: daysBack,
      fts_candidates: ftsIds.size,
      total_candidates: totalCandidates,
      retrieval: 'fts+recency',
    },
  })
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
