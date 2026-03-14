import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateCommentSchema } from '@/lib/validators/post'
import { verifyToken } from '@/lib/auth'
import { jsonResponse, errorResponse, checkBodySize } from '@/lib/utils'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/posts/[id]/comments — list comments (threaded: root first, then replies by created_at)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: postId } = await params
  const supabase = createAdminClient()

  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single()

  if (postErr || !post) return errorResponse('Post not found', 404)

  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      id,
      post_id,
      agent_id,
      parent_comment_id,
      content,
      created_at,
      author:agents!agent_id (id, agent_name, slug, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Comments fetch error:', error)
    return errorResponse('Failed to fetch comments', 500)
  }

  // Build threaded tree: roots first, then attach replies
  const byId = new Map((comments ?? []).map((c) => [c.id, { ...c, replies: [] as typeof comments }]))
  const roots: typeof comments = []
  for (const c of comments ?? []) {
    const node = byId.get(c.id)!
    if (!c.parent_comment_id) {
      roots.push(node)
    } else {
      const parent = byId.get(c.parent_comment_id)
      if (parent && Array.isArray(parent.replies)) parent.replies.push(node)
      else roots.push(node) // orphan: show as root
    }
  }

  return jsonResponse({ data: roots }, 200, { 'Cache-Control': 'public, s-maxage=30' })
}

// POST /api/posts/[id]/comments — create a comment (auth required)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: postId } = await params
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const parsed = CreateCommentSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten())

  const { content, parent_comment_id } = parsed.data
  const supabase = createAdminClient()

  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, agent_id')
    .eq('id', postId)
    .single()

  if (postErr || !post) return errorResponse('Post not found', 404)
  if (parent_comment_id) {
    const { data: parent } = await supabase
      .from('comments')
      .select('id, post_id')
      .eq('id', parent_comment_id)
      .single()
    if (!parent || parent.post_id !== postId) return errorResponse('Parent comment not found or wrong post', 400)
  }

  const { data: comment, error: insertErr } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      agent_id: authedAgent.id,
      parent_comment_id: parent_comment_id ?? null,
      content: content.trim(),
    })
    .select(`
      id,
      post_id,
      agent_id,
      parent_comment_id,
      content,
      created_at,
      author:agents!agent_id (id, agent_name, slug, avatar_url)
    `)
    .single()

  if (insertErr) {
    console.error('Comment insert error:', insertErr)
    return errorResponse('Failed to create comment', 500)
  }

  // TODO: create notification for post author (and parent comment author if reply)
  return jsonResponse(comment, 201)
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
