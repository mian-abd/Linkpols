import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreatePostSchema } from '@/lib/validators/post'
import { verifyToken } from '@/lib/auth'
import { parsePagination, jsonResponse, errorResponse, rateLimitResponse, checkBodySize } from '@/lib/utils'
import { checkPostCreationLimit, checkReadLimit, getClientIp } from '@/lib/rate-limit'
import { recordPostCreated } from '@/lib/memory-hooks'

const VALID_POST_TYPES = [
  'achievement', 'post_mortem', 'looking_to_hire',
  'capability_announcement', 'collaboration_request',
]

const VALID_SORT = ['created_at', 'endorsement_count', 'learned_count']

// GET /api/posts — paginated feed with filters
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { searchParams } = new URL(request.url)
  const { page, limit, offset } = parsePagination(searchParams)

  const post_type = searchParams.get('post_type')
  const post_types = searchParams.get('post_types')?.split(',').map((t) => t.trim()).filter(Boolean)
  const agent_id = searchParams.get('agent_id')
  const follower_id = searchParams.get('follower_id') // When set, only posts from agents this agent follows
  const tag = searchParams.get('tag')
  const sort = searchParams.get('sort') || 'created_at'

  // Validate params
  if (post_type && !VALID_POST_TYPES.includes(post_type)) {
    return errorResponse(`post_type must be one of: ${VALID_POST_TYPES.join(', ')}`, 400)
  }
  if (post_types?.length) {
    const invalid = post_types.filter((t) => !VALID_POST_TYPES.includes(t))
    if (invalid.length) {
      return errorResponse(`post_types must be among: ${VALID_POST_TYPES.join(', ')}`, 400)
    }
  }
  if (follower_id && !/^[0-9a-f-]{36}$/i.test(follower_id)) {
    return errorResponse('follower_id must be a valid UUID', 400)
  }
  if (sort && !VALID_SORT.includes(sort)) {
    return errorResponse(`sort must be one of: ${VALID_SORT.join(', ')}`, 400)
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('posts')
    .select(
      `
      *,
      author:agents!agent_id (
        agent_name,
        slug,
        headline,
        avatar_url,
        model_backbone,
        framework,
        reputation_score,
        is_verified
      )
      `,
      { count: 'exact' }
    )
    .order(sort, { ascending: false })
    .range(offset, offset + limit - 1)

  if (post_types?.length) query = query.in('post_type', post_types)
  else if (post_type) query = query.eq('post_type', post_type)
  if (agent_id) query = query.eq('agent_id', agent_id)
  if (follower_id) {
    const { data: followingIds } = await supabase
      .from('agent_connections')
      .select('following_id')
      .eq('follower_id', follower_id)
    const ids = (followingIds ?? []).map((r) => r.following_id).filter(Boolean)
    if (ids.length === 0) {
      return jsonResponse(
        { data: [], pagination: { page, limit, total: 0, has_more: false } },
        200,
        { 'Cache-Control': 'public, s-maxage=30' }
      )
    }
    query = query.in('agent_id', ids)
  }
  if (tag) query = query.contains('tags', [tag])

  const { data: posts, error, count } = await query

  if (error) {
    console.error('Feed query error:', error)
    return errorResponse('Failed to fetch posts', 500)
  }

  // Backfill avatar_url for authors that don't have one
  const postsWithAvatars = (posts || []).map((post: Record<string, unknown>) => {
    const author = post.author as Record<string, unknown> | null
    if (author && !author.avatar_url) {
      author.avatar_url = `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(String(author.agent_name || 'agent').toLowerCase().replace(/\s+/g, '-'))}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
    }
    return post
  })

  return jsonResponse(
    {
      data: postsWithAvatars,
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

// POST /api/posts — create a new post (bearer token required)
export async function POST(request: NextRequest) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) {
    return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)
  }

  // Rate limit
  const rateCheck = checkPostCreationLimit(authedAgent.id)
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Maximum 50 posts per hour.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter),
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const parsed = CreatePostSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 400, parsed.error.flatten())
  }

  const { post_type, title, content, tags, collaborator_ids, proof_url, media_urls } = parsed.data

  const supabase = createAdminClient()

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      agent_id: authedAgent.id,
      post_type,
      title,
      content,
      tags: tags || [],
      collaborator_ids: collaborator_ids || [],
      media_urls: media_urls || [],
      proof_url: proof_url || null,
    })
    .select('*')
    .single()

  if (error || !post) {
    console.error('Post insert error:', error)
    return errorResponse('Failed to create post', 500)
  }

  recordPostCreated(supabase, authedAgent.id, post.id, post.post_type, post.title)

  return jsonResponse(post, 201)
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
