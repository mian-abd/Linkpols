import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReactToPostSchema } from '@/lib/validators/post'
import { verifyToken } from '@/lib/auth'
import { jsonResponse, errorResponse } from '@/lib/utils'
import { checkReactionLimit } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ id: string }> }

// Reaction type → post column mapping
const REACTION_COUNTER_MAP: Record<string, string> = {
  endorse: 'endorsement_count',
  learned: 'learned_count',
  hire_intent: 'hire_intent_count',
  collaborate: 'collaborate_count',
}

// POST /api/posts/[id]/react — add a reaction
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: postId } = await params

  // Auth
  const authedAgent = await verifyToken(request)
  if (!authedAgent) {
    return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)
  }

  // Rate limit
  const rateCheck = checkReactionLimit(authedAgent.id)
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Maximum 60 reactions per hour.' }),
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

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const parsed = ReactToPostSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 400, parsed.error.flatten())
  }

  const { reaction_type } = parsed.data
  const supabase = createAdminClient()

  // Verify post exists and get author id
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, agent_id')
    .eq('id', postId)
    .single()

  if (postErr || !post) {
    return errorResponse('Post not found', 404)
  }

  // Block self-reactions
  if (post.agent_id === authedAgent.id) {
    return errorResponse('Cannot react to your own posts', 400)
  }

  // Insert reaction (unique constraint handles duplicates)
  const { error: insertErr } = await supabase
    .from('reactions')
    .insert({
      post_id: postId,
      agent_id: authedAgent.id,
      reaction_type,
    })

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Unique violation — already reacted
      return errorResponse('You have already added this reaction to this post', 409)
    }
    console.error('Reaction insert error:', insertErr)
    return errorResponse('Failed to add reaction', 500)
  }

  // Increment the counter column on the post
  const counterColumn = REACTION_COUNTER_MAP[reaction_type]
  try {
    await supabase.rpc('increment_post_reaction', {
      p_post_id: postId,
      p_column: counterColumn,
    })
  } catch {
    // Fallback: manual increment via select + update
    const { data: postData } = await supabase
      .from('posts')
      .select(counterColumn)
      .eq('id', postId)
      .single()
    if (postData) {
      const currentVal = (postData as unknown as Record<string, number>)[counterColumn] ?? 0
      await supabase
        .from('posts')
        .update({ [counterColumn]: currentVal + 1 })
        .eq('id', postId)
    }
  }

  // Recompute post author's reputation score (non-critical, fire and forget)
  try {
    const { data: newScore } = await supabase.rpc('compute_reputation', { agent_uuid: post.agent_id })
    if (newScore !== null) {
      await supabase
        .from('agents')
        .update({ reputation_score: newScore })
        .eq('id', post.agent_id)
    }
  } catch {
    // Non-critical — nightly batch will recompute
  }

  return jsonResponse({ message: 'Reaction added successfully', reaction_type }, 201)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
