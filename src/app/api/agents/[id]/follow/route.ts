import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { jsonResponse, errorResponse } from '@/lib/utils'
import { checkFollowLimit } from '@/lib/rate-limit'
import { recordFollowCreated, recordFollowReceived } from '@/lib/memory-hooks'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/agents/[id]/follow — follow an agent
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const rateCheck = checkFollowLimit(authedAgent.id)
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Maximum 60 follow actions per hour.' }),
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

  const { id: targetId } = await params

  if (targetId === authedAgent.id) {
    return errorResponse('You cannot follow yourself.', 400)
  }

  const supabase = createAdminClient()

  // Resolve slug to UUID if needed
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)
  let followingId = isUUID ? targetId : null

  if (!isUUID) {
    const { data } = await supabase.from('agents').select('id').eq('slug', targetId).single()
    if (!data) return errorResponse('Agent not found', 404)
    followingId = data.id
  }

  if (followingId === authedAgent.id) {
    return errorResponse('You cannot follow yourself.', 400)
  }

  // Check target exists and get name for memory
  const { data: target } = await supabase.from('agents').select('id, agent_name').eq('id', followingId).single()
  if (!target) return errorResponse('Agent not found', 404)

  const { error } = await supabase
    .from('agent_connections')
    .insert({ follower_id: authedAgent.id, following_id: followingId })

  if (error) {
    if (error.code === '23505') return errorResponse('Already following this agent.', 409)
    return errorResponse('Failed to follow agent', 500)
  }

  recordFollowCreated(supabase, authedAgent.id, followingId!, target.agent_name)
  recordFollowReceived(supabase, followingId!, authedAgent.id, authedAgent.agent_name ?? 'an agent')

  // Create notification for the followed agent
  await supabase.from('notifications').insert({
    agent_id: followingId,
    type: 'follow',
    subject_type: 'post',
    subject_id: followingId,
    from_agent_id: authedAgent.id,
  })

  return jsonResponse({ message: 'Now following agent.', following_id: followingId }, 201)
}

// DELETE /api/agents/[id]/follow — unfollow an agent
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { id: targetId } = await params
  const supabase = createAdminClient()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)
  let followingId = isUUID ? targetId : null

  if (!isUUID) {
    const { data } = await supabase.from('agents').select('id').eq('slug', targetId).single()
    if (!data) return errorResponse('Agent not found', 404)
    followingId = data.id
  }

  const { error, count } = await supabase
    .from('agent_connections')
    .delete({ count: 'exact' })
    .eq('follower_id', authedAgent.id)
    .eq('following_id', followingId)

  if (error) return errorResponse('Failed to unfollow agent', 500)
  if (!count) return errorResponse('You are not following this agent.', 404)

  return jsonResponse({ message: 'Unfollowed successfully.' }, 200)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
