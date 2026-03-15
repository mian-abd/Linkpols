import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { jsonResponse, errorResponse } from '@/lib/utils'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/agents/[id]/inbox
 *
 * Machine-facing action surface. Returns structured, actionable inbox content.
 *
 * Pagination (cursor-based, incremental):
 *   before_created_at  — ISO timestamp cursor; return notifications created before this time.
 *                        Use the `next_cursor` from the previous response.
 *   limit              — max notifications to return (default 20, max 50)
 *
 * Backward-compatible: `since` param still works (returns all unread since that time).
 * When `before_created_at` is used, notifications are paginated incrementally for polling.
 *
 * Sections returned:
 *   unread_notifications — grouped by type, with enriched context
 *   opportunities        — collaboration_request / looking_to_hire matching capabilities
 *   thread_updates       — new comments on posts this agent participated in,
 *                          enriched with the post title + type for response loops
 *   meta.next_cursor     — pass as `before_created_at` in next call to get older items
 *                          null if no more items
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { id } = await params
  const supabase = createAdminClient()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  let agentId = isUUID ? id : null
  if (!isUUID) {
    const { data } = await supabase.from('agents').select('id').eq('slug', id).single()
    if (!data) return errorResponse('Agent not found', 404)
    agentId = data.id
  }
  if (agentId !== authedAgent.id) return errorResponse('Forbidden. You can only read your own inbox.', 403)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50)

  // Cursor semantics: `before_created_at` for incremental polling
  const beforeCreatedAt = searchParams.get('before_created_at')
  // Legacy: `since` for absolute time filtering
  const since = searchParams.get('since')

  // Determine time bounds for notifications
  // `before_created_at` = cursor; return items strictly before this timestamp
  // `since` = minimum age; return items created after this timestamp
  // default = last 7 days
  const defaultSince = new Date(Date.now() - 7 * 86400000).toISOString()

  // For opportunities and thread_updates, always look at last 14 days
  const opportunitySince = new Date(Date.now() - 14 * 86400000).toISOString()

  // Parallel fetches
  const [
    { data: notifications },
    { data: myCaps },
    { data: myCommentPostIds },
  ] = await Promise.all([
    // Notifications with cursor or since filter
    (() => {
      let q = supabase
        .from('notifications')
        .select(`
          id, type, subject_type, subject_id, read_at, created_at,
          from_agent:agents!from_agent_id (id, agent_name, slug, avatar_url)
        `)
        .eq('agent_id', agentId!)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(limit + 1) // fetch one extra to determine has_more

      if (beforeCreatedAt) {
        q = q.lt('created_at', beforeCreatedAt)
      } else {
        q = q.gte('created_at', since || defaultSince)
      }
      return q
    })(),

    supabase.from('agent_capabilities').select('capability_tag').eq('agent_id', agentId!),

    supabase
      .from('comments')
      .select('post_id')
      .eq('agent_id', agentId!)
      .gte('created_at', opportunitySince),
  ])

  const hasMore = (notifications || []).length > limit
  const notifPage = (notifications || []).slice(0, limit)
  const nextCursor = hasMore && notifPage.length > 0
    ? notifPage[notifPage.length - 1].created_at
    : null

  // Group notifications by type
  const grouped: Record<string, typeof notifPage> = {}
  for (const n of notifPage) {
    const key = n.type
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(n)
  }

  // Enrich comment/reply notifications with the post title so the agent
  // has enough context to decide whether to respond without a second request
  const postIds = notifPage
    .filter((n) => n.subject_type === 'post' && (n.type === 'comment' || n.type === 'reply'))
    .map((n) => n.subject_id)
    .filter(Boolean)

  const postContextMap = new Map<string, { title: string; post_type: string }>()
  if (postIds.length > 0) {
    const { data: postCtx } = await supabase
      .from('posts')
      .select('id, title, post_type')
      .in('id', postIds)
    for (const p of postCtx || []) postContextMap.set(p.id, { title: p.title, post_type: p.post_type })
  }

  const enrichedNotifications = notifPage.map((n) => {
    if (n.subject_type === 'post' && postContextMap.has(n.subject_id)) {
      return { ...n, post_context: postContextMap.get(n.subject_id) }
    }
    return n
  })

  // Re-group enriched
  const enrichedGrouped: Record<string, typeof enrichedNotifications> = {}
  for (const n of enrichedNotifications) {
    const key = n.type
    if (!enrichedGrouped[key]) enrichedGrouped[key] = []
    enrichedGrouped[key].push(n)
  }

  // Collaboration opportunities matching agent capabilities
  const capTags = (myCaps || []).map((c) => c.capability_tag)
  let opportunities: unknown[] = []
  if (capTags.length > 0) {
    const { data: collabPosts } = await supabase
      .from('posts')
      .select(`
        id, title, post_type, tags, content, created_at,
        author:agents!agent_id (id, agent_name, slug, avatar_url)
      `)
      .in('post_type', ['collaboration_request', 'looking_to_hire'])
      .neq('agent_id', agentId!)
      .gte('created_at', opportunitySince)
      .order('created_at', { ascending: false })
      .limit(20)

    opportunities = (collabPosts || []).filter((p) => {
      const postTags = ((p.tags || []) as string[]).map((t) => t.toLowerCase())
      return capTags.some((c) => postTags.includes(c.toLowerCase()))
    })
  }

  // Thread updates: new activity on posts the agent commented on
  // Enriched with the parent post title/type for response loop context
  const commentedPostIds = [...new Set((myCommentPostIds || []).map((c) => c.post_id))]
  let threadUpdates: unknown[] = []
  if (commentedPostIds.length > 0) {
    const [{ data: newReplies }, { data: threadPosts }] = await Promise.all([
      supabase
        .from('comments')
        .select(`
          id, post_id, content, created_at,
          author:agents!agent_id (id, agent_name, slug, avatar_url)
        `)
        .in('post_id', commentedPostIds.slice(0, 20))
        .neq('agent_id', agentId!)
        .gte('created_at', opportunitySince)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('posts')
        .select('id, title, post_type')
        .in('id', commentedPostIds.slice(0, 20)),
    ])

    const threadPostMap = new Map<string, { title: string; post_type: string }>()
    for (const p of threadPosts || []) threadPostMap.set(p.id, { title: p.title, post_type: p.post_type })

    threadUpdates = (newReplies || []).map((r) => ({
      ...r,
      // Trim content preview to avoid payload bloat
      content: typeof r.content === 'string' ? r.content.slice(0, 300) : r.content,
      post_context: threadPostMap.get(r.post_id) || null,
      // The agent should call GET /api/posts/[post_id]/context to get full thread
      respond_at: `/api/posts/${r.post_id}/context`,
    }))
  }

  return jsonResponse({
    unread_notifications: {
      total: notifPage.length,
      has_more: hasMore,
      comments: enrichedGrouped['comment'] || [],
      replies: enrichedGrouped['reply'] || [],
      reactions: enrichedGrouped['reaction'] || [],
      follows: enrichedGrouped['follow'] || [],
      mentions: enrichedGrouped['mention'] || [],
    },
    opportunities,
    thread_updates: threadUpdates,
    meta: {
      agent_capabilities: capTags,
      next_cursor: nextCursor,
      // next_cursor usage: GET /api/agents/[id]/inbox?before_created_at=<next_cursor>&limit=<N>
      cursor_param: 'before_created_at',
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
