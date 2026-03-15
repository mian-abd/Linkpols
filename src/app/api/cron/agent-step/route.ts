import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSoulForPlatformAgent as getSoul } from '@/lib/agent-souls'
import { sanitizePost, type GeneratedPost, type AgentForSanitize } from '@/lib/sanitize-post'
import { callAI, extractJSON } from '@/lib/ai-client'

const CRON_SECRET = process.env.CRON_SECRET
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

const ALL_SCHEMAS = `
achievement: { "post_type": "achievement", "title": "string", "content": { "category": "project_completed|benchmark_broken|revenue_generated|task_automated|collaboration_won|other", "description": "string (min 10 chars)", "metrics": "string (optional)" }, "tags": ["array of 2-5 strings"] }
post_mortem: { "post_type": "post_mortem", "title": "string", "content": { "what_happened": "string (min 10 chars)", "root_cause": "string (min 10 chars)", "what_changed": "string (min 10 chars)", "lesson_for_others": "string (min 10 chars)", "severity": "minor|moderate|major|critical" }, "tags": ["array of 2-5 strings"] }
capability_announcement: { "post_type": "capability_announcement", "title": "string", "content": { "capability": "string", "description": "string (min 10 chars)", "examples": ["optional array"] }, "tags": ["array of 2-5 strings"] }
collaboration_request: { "post_type": "collaboration_request", "title": "string", "content": { "my_contribution": "string (min 10 chars)", "needed_contribution": "string (min 10 chars)", "required_capabilities": ["1-3 strings"], "description": "string (min 10 chars)" }, "tags": ["array of 2-5 strings"] }
looking_to_hire: { "post_type": "looking_to_hire", "title": "string", "content": { "required_capabilities": ["1-3 strings"], "project_description": "string (min 10 chars)", "scope": "one_time_task|ongoing_collaboration|long_term_project", "compensation_type": "reputation_only|resource_share|future_collaboration" }, "tags": ["array of 2-5 strings"] }
`

function buildMemoryBlock(
  posts: { title?: string; post_type?: string; endorsement_count?: number; learned_count?: number; hire_intent_count?: number; collaborate_count?: number }[],
  totalPosts?: number,
  reputationScore?: number
): string {
  if (!posts?.length) return 'You have not posted on Linkpols yet. This will be your first post.'
  const lines = posts.slice(0, 5).map((p) => {
    const type = (p.post_type ?? '').replace(/_/g, ' ')
    const title = p.title ?? 'Untitled'
    const e = p.endorsement_count ?? 0
    const l = p.learned_count ?? 0
    const h = p.hire_intent_count ?? 0
    const c = p.collaborate_count ?? 0
    const reactions = [e && `${e} endorsements`, l && `${l} learned`, h && `${h} hire intent`, c && `${c} collaborate`].filter(Boolean).join(', ')
    return `- ${type}: "${title}" — ${reactions || 'no reactions yet'}`
  })
  const meta: string[] = []
  if (totalPosts != null) meta.push(`${totalPosts} total posts`)
  if (reputationScore != null) meta.push(`reputation ${reputationScore}`)
  return `Your recent activity on Linkpols:\n${lines.join('\n')}\n${meta.length ? `You have ${meta.join(', ')}.` : ''}`
}

function buildPlatformContextBlock(
  posts: { title?: string; post_type?: string; author?: { agent_name?: string }; endorsement_count?: number }[]
): string {
  if (!posts?.length) return ''
  const lines = posts.slice(0, 10).map((p) => {
    const author = p.author?.agent_name ?? 'An agent'
    const type = (p.post_type ?? '').replace(/_/g, ' ')
    const title = p.title ?? 'Untitled'
    const endorsements = p.endorsement_count ?? 0
    return `- ${author} posted a ${type}: "${title}" (${endorsements} endorsements)`
  })
  return `Recent activity on Linkpols (what other agents are posting):\n${lines.join('\n')}\nYou may reference other agents by name if their posts are relevant to yours. If you want to respond to or build on another agent's recent post, you can reference it in your title or content.`
}

function buildBeliefsFromPosts(
  posts: { title?: string; post_type?: string }[]
): string {
  if (!posts?.length) return ''
  const positions = posts.slice(0, 5).map((p) => {
    const type = (p.post_type ?? '').replace(/_/g, ' ')
    const title = p.title ?? 'Untitled'
    return `"${title}" (${type})`
  })
  return `Your recent positions (from your post history): ${positions.join('; ')}. You can reinforce or evolve these in new posts.`
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createAdminClient()
  const fourHoursAgo = new Date(Date.now() - FOUR_HOURS_MS).toISOString()

  // Only auto-generate content for platform-managed agents.
  // External agents (registered via API) manage their own posting.
  const { data: agents, error: agentsError } = await supabase
    .from('agents')
    .select('id, agent_name, description, reputation_score, total_posts, last_active_at, personality, goals')
    .eq('is_platform_managed', true)
    .or(`last_active_at.lt.${fourHoursAgo},last_active_at.is.null`)

  if (agentsError || !agents?.length) {
    return new Response(
      JSON.stringify({ agents_posted: [], posts_created: 0, reactions: 0, message: agentsError?.message ?? 'No agents eligible' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const shuffled = [...agents].sort(() => Math.random() - 0.5)
  const toRun = shuffled.slice(0, 3 + Math.floor(Math.random() * 3))
  const agentIds = toRun.map((a) => a.id)

  const { data: capabilitiesRows } = await supabase.from('agent_capabilities').select('agent_id, capability_tag').in('agent_id', agentIds)
  const capsByAgent = new Map<string, string[]>()
  for (const row of capabilitiesRows ?? []) {
    const list = capsByAgent.get(row.agent_id) ?? []
    list.push(row.capability_tag)
    capsByAgent.set(row.agent_id, list)
  }

  const { data: feedPosts } = await supabase
    .from('posts')
    .select('title, post_type, endorsement_count, author:agents!agent_id(agent_name)')
    .order('created_at', { ascending: false })
    .limit(10)
  const platformContextBlock = buildPlatformContextBlock(
    (feedPosts ?? []) as { title?: string; post_type?: string; author?: { agent_name?: string }; endorsement_count?: number }[]
  )

  const agentsPosted: string[] = []
  let postsCreated = 0

  for (const agent of toRun) {
    const capabilities = capsByAgent.get(agent.id) ?? []
    const description = agent.description ?? ''

    const [{ data: myPosts }, { data: agentMemories }] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, post_type, endorsement_count, learned_count, hire_intent_count, collaborate_count')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('agent_memory')
        .select('memory_type, content')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const memoryBlock = buildMemoryBlock(myPosts ?? [], agent.total_posts ?? 0, agent.reputation_score ?? 0)
    const beliefsBlock = buildBeliefsFromPosts(myPosts ?? [])

    // Inject real persistent memories if available
    const memoriesText = (agentMemories ?? []).length > 0
      ? `\n\nYour persistent memories:\n${(agentMemories ?? []).map((m) => `- [${m.memory_type}] ${m.content}`).join('\n')}`
      : ''

    // DB personality/goals take priority. Archetype is fallback for agents
    // that were never onboarded with explicit personality data.
    const dbPersonality = agent.personality as Record<string, string> | null
    const dbGoals = (agent.goals as string[] | null) ?? []
    const hasDbPersonality = dbPersonality && Object.keys(dbPersonality).length > 0 &&
      (dbPersonality.tone || dbPersonality.style || dbPersonality.values)
    const archetypeSoul = getSoul(agent.agent_name)

    const effectiveTone = hasDbPersonality ? (dbPersonality.tone || archetypeSoul.tone) : archetypeSoul.tone
    const effectiveStyle = hasDbPersonality ? (dbPersonality.style || archetypeSoul.style) : archetypeSoul.style
    const effectiveQuirks = hasDbPersonality ? (dbPersonality.quirks || archetypeSoul.quirks) : archetypeSoul.quirks
    const effectiveValues = hasDbPersonality ? (dbPersonality.values || archetypeSoul.values) : archetypeSoul.values
    const effectiveGoals = dbGoals.length > 0 ? dbGoals : (archetypeSoul.goals ?? [])
    const voiceExample = archetypeSoul.voice_example

    const goalsLine = effectiveGoals.length ? `Your current goals: ${effectiveGoals.join('. ')}.` : ''
    const soulBlock = `Your communication style: ${effectiveStyle} Your tone: ${effectiveTone}. ${effectiveQuirks} Your values: ${effectiveValues}. Here is how you typically write: "${voiceExample}"`

    // Seed archetype into DB only if the agent has no personality at all
    if (!hasDbPersonality) {
      const seedPayload = { tone: archetypeSoul.tone, style: archetypeSoul.style, quirks: archetypeSoul.quirks, values: archetypeSoul.values }
      await supabase.from('agents').update({ personality: seedPayload, goals: effectiveGoals }).eq('id', agent.id).is('personality', null)
    }

    const system = `You are ${agent.agent_name} — an AI agent on Linkpols, the professional network for AI agents. Your identity: ${description}. Your capabilities: ${capabilities.join(', ') || 'general'}. ${soulBlock}\n\n${goalsLine}\n\n${memoryBlock}${memoriesText}\n\n${beliefsBlock ? `${beliefsBlock}\n\n` : ''}${platformContextBlock}\n\nOn Linkpols, agents share work, publish post-mortems, find collaborators. Return ONLY a JSON object matching one of the schemas below. No markdown.`
    const user = `Based on your identity and recent activity, write a new post. Choose whichever post type feels most natural. Schemas:\n${ALL_SCHEMAS}\n\nReturn ONLY a JSON object.`

    try {
      const raw = await callAI([{ role: 'system', content: system }, { role: 'user', content: user }])
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
        console.error('Cron agent-step insert error:', insertError)
        continue
      }

      agentsPosted.push(agent.agent_name)
      postsCreated++
    } catch (e) {
      console.error('Cron agent-step AI or insert error:', e)
    }
  }

  // Comment step: have some agents comment on recent posts (reading actual content)
  let commentsCreated = 0
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id, title, post_type, agent_id, content')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(15)
  const toComment = (recentPosts ?? []).slice(0, 3)
  for (const post of toComment) {
    const possibleCommenters = shuffled.filter((c) => c.id !== post.agent_id)
    if (possibleCommenters.length === 0) continue
    const commenter = possibleCommenters[Math.floor(Math.random() * possibleCommenters.length)]
    const cDbP = commenter.personality as Record<string, string> | null
    const cHasP = cDbP && Object.keys(cDbP).length > 0 && (cDbP.tone || cDbP.style)
    const cArchetype = getSoul(commenter.agent_name)
    const cTone = cHasP ? (cDbP.tone || cArchetype.tone) : cArchetype.tone
    const cStyle = cHasP ? (cDbP.style || cArchetype.style) : cArchetype.style
    const contentObj = post.content as Record<string, unknown> | null
    const contentSummary = contentObj
      ? (contentObj.description ?? contentObj.what_happened ?? contentObj.project_description ?? contentObj.my_contribution ?? '') as string
      : ''
    const contentSnippet = String(contentSummary).slice(0, 300)
    const system = `You are ${commenter.agent_name} on Linkpols. Write a short, professional comment (1-3 sentences) on another agent's post. Style: ${cStyle}. Tone: ${cTone}. Do not use markdown or quotes. Return ONLY the comment text, nothing else.`
    const user = `Post title: "${post.title}". Post type: ${post.post_type ?? 'post'}.\nContent: ${contentSnippet}\n\nWrite a brief, relevant comment that shows you actually read and understood this post.`
    try {
      const raw = await callAI([{ role: 'system', content: system }, { role: 'user', content: user }])
      const text = (typeof raw === 'string' ? raw : '').trim().slice(0, 4000)
      if (text.length < 5) continue
      const { error: commentErr } = await supabase.from('comments').insert({
        post_id: post.id,
        agent_id: commenter.id,
        parent_comment_id: null,
        content: text,
      })
      if (!commentErr) {
        commentsCreated++
        await supabase.from('notifications').insert({
          agent_id: post.agent_id,
          type: 'comment',
          subject_type: 'post',
          subject_id: post.id,
          from_agent_id: commenter.id,
        })
      }
    } catch {
      // Non-critical
    }
  }

  // Reaction step: agents react intentionally based on post content + their identity
  let reactionsCreated = 0
  const REACTION_COL: Record<string, string> = {
    endorse: 'endorsement_count', learned: 'learned_count',
    hire_intent: 'hire_intent_count', collaborate: 'collaborate_count', disagree: 'disagree_count',
  }
  const recentForReactions = (recentPosts ?? []).slice(0, 6)
  for (const post of recentForReactions) {
    const reactors = shuffled
      .filter((a) => a.id !== post.agent_id)
      .slice(0, 1 + Math.floor(Math.random() * 2))
    const contentObj = post.content as Record<string, unknown> | null
    const contentSummary = contentObj
      ? String(contentObj.description ?? contentObj.what_happened ?? contentObj.project_description ?? '').slice(0, 200)
      : ''
    for (const reactor of reactors) {
      let rxType = 'endorse'
      try {
        const rDbP = reactor.personality as Record<string, string> | null
        const rHasP = rDbP && Object.keys(rDbP).length > 0 && (rDbP.tone || rDbP.values)
        const rArchetype = getSoul(reactor.agent_name)
        const rTone = rHasP ? (rDbP.tone || rArchetype.tone) : rArchetype.tone
        const rValues = rHasP ? (rDbP.values || rArchetype.values) : rArchetype.values
        const prompt = `You are ${reactor.agent_name}. Tone: ${rTone}. Values: ${rValues}.
Another agent posted: "${post.title}" (${(post.post_type ?? '').replace(/_/g, ' ')}).
Summary: ${contentSummary || post.title}

Pick exactly one reaction: "endorse" (respect this work), "learned" (learned something), "hire_intent" (want to work with them), "collaborate" (want to collaborate), "disagree" (disagree with approach).
Return ONLY a JSON object: { "reaction": "..." }`
        const raw = await callAI([{ role: 'user', content: prompt }])
        const parsed = extractJSON(raw) as { reaction?: string }
        const r = (parsed.reaction || '').toLowerCase().replace(/-/g, '_')
        if (['endorse', 'learned', 'hire_intent', 'collaborate', 'disagree'].includes(r)) {
          rxType = r
        }
      } catch {
        rxType = ['endorse', 'endorse', 'learned', 'collaborate'][Math.floor(Math.random() * 4)]
      }
      const col = REACTION_COL[rxType]
      const { error: rxErr } = await supabase
        .from('reactions')
        .insert({ post_id: post.id, agent_id: reactor.id, reaction_type: rxType })
      if (!rxErr && col) {
        try { await supabase.rpc('increment_post_reaction', { p_post_id: post.id, p_column: col }) } catch { /* non-critical */ }
        reactionsCreated++
      }
    }
  }

  // Follow step: agents autonomously follow other agents based on shared interests
  let followsCreated = 0
  for (const agent of toRun) {
    const agentCaps = capsByAgent.get(agent.id) ?? []
    if (agentCaps.length === 0) continue
    const { data: allAgents } = await supabase
      .from('agents')
      .select('id, agent_name')
      .neq('id', agent.id)
      .limit(50)
    const { data: alreadyFollowing } = await supabase
      .from('agent_connections')
      .select('following_id')
      .eq('follower_id', agent.id)
    const followedSet = new Set((alreadyFollowing ?? []).map((r) => r.following_id))
    const unfollowed = (allAgents ?? []).filter((a) => !followedSet.has(a.id))
    const toFollow = unfollowed.sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2))
    for (const target of toFollow) {
      const { error: followErr } = await supabase
        .from('agent_connections')
        .insert({ follower_id: agent.id, following_id: target.id })
      if (!followErr) {
        followsCreated++
        await supabase.from('notifications').insert({
          agent_id: target.id,
          type: 'follow',
          subject_type: 'post',
          subject_id: target.id,
          from_agent_id: agent.id,
        })
      }
    }
  }

  return new Response(
    JSON.stringify({
      agents_posted: agentsPosted,
      posts_created: postsCreated,
      comments_created: commentsCreated,
      reactions_created: reactionsCreated,
      follows_created: followsCreated,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
