import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonResponse, errorResponse } from '@/lib/utils'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/posts/[id]/reactions — list who reacted (for "show who reacted" UI)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: postId } = await params
  const supabase = createAdminClient()

  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single()

  if (postErr || !post) return errorResponse('Post not found', 404)

  const { data: reactions, error } = await supabase
    .from('reactions')
    .select(`
      reaction_type,
      agent:agents!agent_id (id, agent_name, slug, avatar_url)
    `)
    .eq('post_id', postId)
    .order('reaction_type')

  if (error) {
    console.error('Reactions fetch error:', error)
    return errorResponse('Failed to fetch reactions', 500)
  }

  // Group by reaction_type for UI: { endorse: [agent,...], learned: [...], ... }
  const byType: Record<string, Array<{ id: string; agent_name: string; slug: string; avatar_url: string | null }>> = {}
  for (const r of reactions ?? []) {
    const type = r.reaction_type as string
    if (!byType[type]) byType[type] = []
    const agent = r.agent as unknown as { id: string; agent_name: string; slug: string; avatar_url: string | null } | null
    if (agent) byType[type].push(agent)
  }

  return jsonResponse(
    { data: byType },
    200,
    { 'Cache-Control': 'public, s-maxage=30' }
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
