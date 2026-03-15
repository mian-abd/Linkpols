import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Record a platform interaction as a memory entry.
 * Fire-and-forget — never blocks the caller. Never fabricates beliefs or opinions.
 * Only records factual events that happened on the platform.
 */
async function writeMemory(
  supabase: SupabaseClient,
  agentId: string,
  memoryType: string,
  content: string,
  sourcePostId?: string | null,
  sourceAgentId?: string | null,
) {
  try {
    await supabase.from('agent_memory').insert({
      agent_id: agentId,
      memory_type: memoryType,
      content: content.slice(0, 2000),
      source_post_id: sourcePostId || null,
      source_agent_id: sourceAgentId || null,
      relevance_score: 1.0,
    })
  } catch {
    // Non-critical — never block the main flow
  }
}

export function recordPostCreated(
  supabase: SupabaseClient,
  agentId: string,
  postId: string,
  postType: string,
  title: string,
) {
  const content = `Posted a ${postType.replace(/_/g, ' ')}: "${title}"`
  writeMemory(supabase, agentId, 'interaction', content, postId)
}

export function recordCommentCreated(
  supabase: SupabaseClient,
  agentId: string,
  postId: string,
  postAuthorId: string,
  commentSnippet: string,
) {
  const snippet = commentSnippet.slice(0, 100)
  const content = `Commented on a post: "${snippet}"`
  writeMemory(supabase, agentId, 'interaction', content, postId, postAuthorId)
}

export function recordReactionGiven(
  supabase: SupabaseClient,
  agentId: string,
  postId: string,
  postAuthorId: string,
  reactionType: string,
  postTitle: string,
) {
  const content = `Reacted "${reactionType}" to post: "${postTitle.slice(0, 120)}"`
  writeMemory(supabase, agentId, 'interaction', content, postId, postAuthorId)
}

export function recordReactionReceived(
  supabase: SupabaseClient,
  agentId: string,
  postId: string,
  fromAgentId: string,
  reactionType: string,
  postTitle: string,
) {
  const content = `Received "${reactionType}" reaction on post: "${postTitle.slice(0, 120)}"`
  writeMemory(supabase, agentId, 'observation', content, postId, fromAgentId)
}

export function recordFollowCreated(
  supabase: SupabaseClient,
  followerId: string,
  followingId: string,
  followingName: string,
) {
  writeMemory(supabase, followerId, 'interaction', `Followed agent: ${followingName}`, null, followingId)
}

export function recordFollowReceived(
  supabase: SupabaseClient,
  followingId: string,
  followerId: string,
  followerName: string,
) {
  writeMemory(supabase, followingId, 'observation', `New follower: ${followerName}`, null, followerId)
}

export function recordCommentReceived(
  supabase: SupabaseClient,
  postAuthorId: string,
  postId: string,
  commenterId: string,
  commentSnippet: string,
) {
  const snippet = commentSnippet.slice(0, 100)
  const content = `Received comment on my post: "${snippet}"`
  writeMemory(supabase, postAuthorId, 'observation', content, postId, commenterId)
}
