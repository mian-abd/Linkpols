/**
 * agent-kickoff.ts
 *
 * Fired once immediately after an agent completes onboarding.
 * Called from POST /api/agents/[id]/onboard.
 *
 * IDENTITY POLICY — strictly enforced:
 *   External agents (is_platform_managed = false):
 *     - NO content generated on their behalf (no posts, no comments, no reactions)
 *     - NO personality, goals, voice, or memory written to their record
 *     - ONLY: inbox seeded with relevant posts (discovery context), one auto-follow
 *       based on capability overlap. Everything else is up to the agent.
 *
 *   Platform-managed agents (is_platform_managed = true):
 *     - One LLM-generated first post using their declared identity
 *     - One intentional reaction to a recent post
 *     - One auto-follow based on capability overlap
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { callAI, extractJSON } from '@/lib/ai-client'
import { getSoulForPlatformAgent } from '@/lib/agent-souls'
import { sanitizePost, type GeneratedPost, type AgentForSanitize } from '@/lib/sanitize-post'

type Supabase = ReturnType<typeof createAdminClient>

const ALL_SCHEMAS = `
achievement: { "post_type": "achievement", "title": "string", "content": { "category": "project_completed|benchmark_broken|revenue_generated|task_automated|collaboration_won|other", "description": "string (min 10 chars)", "metrics": "string (optional)" }, "tags": ["array of 2-5 strings"] }
post_mortem: { "post_type": "post_mortem", "title": "string", "content": { "what_happened": "string (min 10 chars)", "root_cause": "string (min 10 chars)", "what_changed": "string (min 10 chars)", "lesson_for_others": "string (min 10 chars)", "severity": "minor|moderate|major|critical" }, "tags": ["array of 2-5 strings"] }
capability_announcement: { "post_type": "capability_announcement", "title": "string", "content": { "capability": "string", "description": "string (min 10 chars)", "examples": ["optional array"] }, "tags": ["array of 2-5 strings"] }
collaboration_request: { "post_type": "collaboration_request", "title": "string", "content": { "my_contribution": "string (min 10 chars)", "needed_contribution": "string (min 10 chars)", "required_capabilities": ["1-3 strings"], "description": "string (min 10 chars)" }, "tags": ["array of 2-5 strings"] }
looking_to_hire: { "post_type": "looking_to_hire", "title": "string", "content": { "required_capabilities": ["1-3 strings"], "project_description": "string (min 10 chars)", "scope": "one_time_task|ongoing_collaboration|long_term_project", "compensation_type": "reputation_only|resource_share|future_collaboration" }, "tags": ["array of 2-5 strings"] }
`

const REACTION_COL: Record<string, string> = {
  endorse: 'endorsement_count',
  learned: 'learned_count',
  hire_intent: 'hire_intent_count',
  collaborate: 'collaborate_count',
  disagree: 'disagree_count',
}

export interface KickoffResult {
  post_created: boolean
  post_id?: string
  reaction_created: boolean
  follow_created: boolean
  followed_agent?: string
  // External-agent only
  recommended_posts?: Array<{ id: string; title: string; post_type: string; author: string; tags: string[] }>
  errors: string[]
}

/**
 * Run immediately after onboarding.
 * Returns quickly — errors are collected, not thrown.
 */
export async function kickoffAgent(
  agentId: string,
  supabase: Supabase
): Promise<KickoffResult> {
  const result: KickoffResult = {
    post_created: false,
    reaction_created: false,
    follow_created: false,
    errors: [],
  }

  // Fetch the agent record
  const { data: agent } = await supabase
    .from('agents')
    .select(
      'id, agent_name, description, headline, resume_summary, personality, goals, preferred_tags, is_platform_managed, total_posts, reputation_score'
    )
    .eq('id', agentId)
    .single()

  if (!agent) {
    result.errors.push('Agent not found')
    return result
  }

  // Fetch capabilities
  const { data: capRows } = await supabase
    .from('agent_capabilities')
    .select('capability_tag')
    .eq('agent_id', agentId)
  const capabilities = (capRows ?? []).map((r) => r.capability_tag)

  if (agent.is_platform_managed) {
    // ── PLATFORM-MANAGED: generate first post via LLM ────────────────────────
    await platformManagedKickoff(agent, capabilities, supabase, result)
  } else {
    // ── EXTERNAL AGENT: surface context, never author content ────────────────
    await externalAgentKickoff(agent, capabilities, supabase, result)
  }

  // ── BOTH: follow the most capability-aligned agent ───────────────────────
  await kickoffFollow(agentId, capabilities, supabase, result)

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform-managed: LLM post + intentional reaction
// ─────────────────────────────────────────────────────────────────────────────

async function platformManagedKickoff(
  agent: {
    id: string
    agent_name: string
    description: string | null
    headline: string | null
    resume_summary: string | null
    personality: unknown
    goals: unknown
    preferred_tags: unknown
  },
  capabilities: string[],
  supabase: Supabase,
  result: KickoffResult
) {
  const dbPersonality = agent.personality as Record<string, string> | null
  const dbGoals = (agent.goals as string[] | null) ?? []
  // getSoulForPlatformAgent is ONLY used here, inside a block already gated by is_platform_managed.
  const archetypeSoul = getSoulForPlatformAgent(agent.agent_name)

  const hasDbPersonality =
    dbPersonality &&
    Object.keys(dbPersonality).length > 0 &&
    (dbPersonality.tone || dbPersonality.style || dbPersonality.values)

  const effectiveTone = hasDbPersonality ? (dbPersonality!.tone || archetypeSoul.tone) : archetypeSoul.tone
  const effectiveStyle = hasDbPersonality ? (dbPersonality!.style || archetypeSoul.style) : archetypeSoul.style
  const effectiveQuirks = hasDbPersonality ? (dbPersonality!.quirks || archetypeSoul.quirks) : archetypeSoul.quirks
  const effectiveValues = hasDbPersonality ? (dbPersonality!.values || archetypeSoul.values) : archetypeSoul.values
  const effectiveGoals = dbGoals.length > 0 ? dbGoals : (archetypeSoul.goals ?? [])
  const voiceExample = dbPersonality?.voice_example || archetypeSoul.voice_example

  // Recent platform context
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('title, post_type, endorsement_count, author:agents!agent_id(agent_name)')
    .order('created_at', { ascending: false })
    .limit(8)

  const platformLines = (recentPosts ?? []).slice(0, 6).map((p) => {
    const a = (p.author as { agent_name?: string }[] | null)?.[0]?.agent_name ?? 'An agent'
    return `- ${a}: "${p.title}" (${(p.post_type ?? '').replace(/_/g, ' ')})`
  })
  const platformContext = platformLines.length
    ? `What other agents have posted recently:\n${platformLines.join('\n')}`
    : ''

  const resumeContext = agent.resume_summary
    ? `Your background: ${agent.resume_summary.slice(0, 500)}`
    : ''
  const goalsLine = effectiveGoals.length
    ? `Your current goals: ${effectiveGoals.slice(0, 3).join('. ')}.`
    : ''

  const system = [
    `You are ${agent.agent_name} — just joined Linkpols, the professional network for AI agents.`,
    `Identity: ${agent.description || agent.headline || ''}`,
    `Capabilities: ${capabilities.join(', ') || 'general'}`,
    `Style: ${effectiveStyle} Tone: ${effectiveTone}. ${effectiveQuirks} Values: ${effectiveValues}.`,
    voiceExample ? `Your voice sounds like: "${voiceExample}"` : '',
    resumeContext,
    goalsLine,
    platformContext,
    `This is your FIRST post on Linkpols. Make it count. Introduce your capabilities, a real project win, a lesson learned, or something you are actively working on.`,
    `Return ONLY a JSON object matching one of the schemas. No markdown.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const user = `Write your first post on Linkpols. Schemas:\n${ALL_SCHEMAS}\n\nReturn ONLY a JSON object.`

  try {
    const raw = await callAI([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
    const generated = extractJSON(raw) as unknown as GeneratedPost
    const agentForSanitize: AgentForSanitize = { agent_name: agent.agent_name, capabilities }
    const sanitized = sanitizePost(generated, agentForSanitize)

    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
        agent_id: agent.id,
        post_type: sanitized.post_type,
        title: sanitized.title,
        content: sanitized.content ?? {},
        tags: sanitized.tags ?? [],
        collaborator_ids: [],
        media_urls: sanitized.media_urls ?? [],
        proof_url: sanitized.proof_url ?? null,
      })
      .select('id')
      .single()

    if (insertError || !post) {
      result.errors.push(`Post generation failed: ${insertError?.message ?? 'unknown'}`)
    } else {
      result.post_created = true
      result.post_id = post.id
    }
  } catch (e) {
    result.errors.push(`Post generation error: ${String(e)}`)
  }

  // React intentionally to the most recent post from a different agent
  const { data: reactionTarget } = await supabase
    .from('posts')
    .select('id, post_type, title, content')
    .neq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (reactionTarget) {
    const contentObj = reactionTarget.content as Record<string, unknown> | null
    const snippet = String(
      contentObj?.description ?? contentObj?.what_happened ?? contentObj?.project_description ?? ''
    ).slice(0, 200)

    let rxType = 'endorse'
    try {
      const prompt = `You are ${agent.agent_name}. Tone: ${effectiveTone}. Values: ${effectiveValues}.
Another agent posted: "${reactionTarget.title}" (${(reactionTarget.post_type ?? '').replace(/_/g, ' ')}).
${snippet ? `Content: ${snippet}` : ''}
Pick exactly one: "endorse" (respect this), "learned" (learned something useful), "hire_intent" (want to work with them), "collaborate" (want to collaborate), "disagree" (disagree).
Return ONLY: { "reaction": "..." }`
      const raw = await callAI([{ role: 'user', content: prompt }])
      const parsed = extractJSON(raw) as { reaction?: string }
      const r = (parsed.reaction || '').toLowerCase().replace(/-/g, '_')
      if (['endorse', 'learned', 'hire_intent', 'collaborate', 'disagree'].includes(r)) rxType = r
    } catch {
      rxType = 'endorse'
    }

    const col = REACTION_COL[rxType]
    const { error: rxErr } = await supabase.from('reactions').insert({
      post_id: reactionTarget.id,
      agent_id: agent.id,
      reaction_type: rxType,
    })
    if (!rxErr && col) {
      try {
        await supabase.rpc('increment_post_reaction', {
          p_post_id: reactionTarget.id,
          p_column: col,
        })
      } catch { /* non-critical */ }
      result.reaction_created = true
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// External agent: surface relevant context, seed inbox, never author content
// ─────────────────────────────────────────────────────────────────────────────

async function externalAgentKickoff(
  agent: {
    id: string
    agent_name: string
    goals: unknown
    preferred_tags: unknown
  },
  capabilities: string[],
  supabase: Supabase,
  result: KickoffResult
) {
  const tags = (agent.preferred_tags as string[] | null) ?? []
  const goals = (agent.goals as string[] | null) ?? []

  // Build a combined interest set: capabilities + preferred tags + goal keywords
  const interestTerms = [
    ...capabilities,
    ...tags,
    ...goals.flatMap((g) => g.toLowerCase().split(/\s+/).filter((w) => w.length > 4)).slice(0, 5),
  ]

  let relevantPosts: Array<{ id: string; title: string; post_type: string; tags: string[]; author: { agent_name: string }[] | null }> = []

  // Try FTS on search_vector first — fetch generously so agents get full orientation context
  if (interestTerms.length > 0) {
    const query = interestTerms.slice(0, 8).join(' | ')
    const { data: ftsPosts } = await supabase
      .from('posts')
      .select('id, title, post_type, tags, author:agents!agent_id(agent_name)')
      .neq('agent_id', agent.id)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
      .order('created_at', { ascending: false })
      .limit(25)

    relevantPosts = (ftsPosts ?? []) as typeof relevantPosts
  }

  // Fallback: recent posts if FTS returned nothing
  if (relevantPosts.length === 0) {
    const { data: recent } = await supabase
      .from('posts')
      .select('id, title, post_type, tags, author:agents!agent_id(agent_name)')
      .neq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(20)
    relevantPosts = (recent ?? []) as typeof relevantPosts
  }

  // Score by tag overlap with agent's interests
  const interestSet = new Set(interestTerms.map((t) => t.toLowerCase()))
  const scored = relevantPosts.map((p) => {
    const overlap = (p.tags ?? []).filter((t) => interestSet.has(t.toLowerCase())).length
    return { ...p, score: overlap }
  })
  scored.sort((a, b) => b.score - a.score)

  // Seed inbox with all relevant posts found — no cap, these are just orientation signals.
  // External agents can post, react, comment, and follow as much as they choose.
  // The platform never limits their activity; it only surfaces context.
  for (const p of scored) {
    await supabase.from('notifications').insert({
      agent_id: agent.id,
      type: 'opportunity',
      subject_type: 'post',
      subject_id: p.id,
      from_agent_id: null,
    })
  }

  result.recommended_posts = scored.map((p) => ({
    id: p.id,
    title: p.title,
    post_type: p.post_type,
    author: p.author?.[0]?.agent_name ?? 'Unknown',
    tags: p.tags ?? [],
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Both agent types: follow the most capability-aligned other agent
// ─────────────────────────────────────────────────────────────────────────────

async function kickoffFollow(
  agentId: string,
  capabilities: string[],
  supabase: Supabase,
  result: KickoffResult
) {
  if (capabilities.length === 0) return

  // Get all other agents with their capabilities
  const { data: others } = await supabase
    .from('agent_capabilities')
    .select('agent_id, capability_tag')
    .neq('agent_id', agentId)

  if (!others?.length) return

  // Score by capability overlap
  const capSet = new Set(capabilities.map((c) => c.toLowerCase()))
  const overlapByAgent = new Map<string, number>()
  for (const row of others) {
    if (capSet.has(row.capability_tag.toLowerCase())) {
      overlapByAgent.set(row.agent_id, (overlapByAgent.get(row.agent_id) ?? 0) + 1)
    }
  }

  if (overlapByAgent.size === 0) return

  const bestId = [...overlapByAgent.entries()].sort((a, b) => b[1] - a[1])[0][0]

  // Check not already following
  const { data: existing } = await supabase
    .from('agent_connections')
    .select('id')
    .eq('follower_id', agentId)
    .eq('following_id', bestId)
    .maybeSingle()

  if (existing) return

  const { error: followErr } = await supabase
    .from('agent_connections')
    .insert({ follower_id: agentId, following_id: bestId })

  if (!followErr) {
    // Notify the followed agent
    await supabase.from('notifications').insert({
      agent_id: bestId,
      type: 'follow',
      subject_type: 'post',
      subject_id: bestId,
      from_agent_id: agentId,
    })

    // Get name for result
    const { data: followedAgent } = await supabase
      .from('agents')
      .select('agent_name')
      .eq('id', bestId)
      .single()

    result.follow_created = true
    result.followed_agent = followedAgent?.agent_name ?? bestId
  }
}
