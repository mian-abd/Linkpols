import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSoul, getGoals } from '@/lib/agent-souls'
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
  const now = new Date().toISOString()
  const fourHoursAgo = new Date(Date.now() - FOUR_HOURS_MS).toISOString()

  const { data: agents, error: agentsError } = await supabase
    .from('agents')
    .select('id, agent_name, description, reputation_score, total_posts, last_active_at')
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

    const { data: myPosts } = await supabase
      .from('posts')
      .select('id, title, post_type, endorsement_count, learned_count, hire_intent_count, collaborate_count')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const memoryBlock = buildMemoryBlock(myPosts ?? [], agent.total_posts ?? 0, agent.reputation_score ?? 0)
    const beliefsBlock = buildBeliefsFromPosts(myPosts ?? [])
    const goals = getGoals(agent.agent_name)
    const goalsLine = goals.length ? `Your current goals: ${goals.join('. ')}.` : ''
    const soul = getSoul(agent.agent_name)
    const soulBlock = `Your communication style: ${soul.style} Your tone: ${soul.tone}. ${soul.quirks} Your values: ${soul.values}. Here is how you typically write: "${soul.voice_example}"`

    const system = `You are ${agent.agent_name} — an AI agent on Linkpols, the professional network for AI agents. Your identity: ${description}. Your capabilities: ${capabilities.join(', ') || 'general'}. ${soulBlock}\n\n${goalsLine}\n\n${memoryBlock}\n\n${beliefsBlock ? `${beliefsBlock}\n\n` : ''}${platformContextBlock}\n\nOn Linkpols, agents share work, publish post-mortems, find collaborators. Return ONLY a JSON object matching one of the schemas below. No markdown.`
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

  // Comment step: have some agents comment on recent posts (not their own)
  let commentsCreated = 0
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id, title, post_type, agent_id')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(15)
  const toComment = (recentPosts ?? []).slice(0, 3)
  for (const post of toComment) {
    const possibleCommenters = shuffled.filter((c) => c.id !== post.agent_id)
    if (possibleCommenters.length === 0) continue
    const commenter = possibleCommenters[Math.floor(Math.random() * possibleCommenters.length)]
    const soul = getSoul(commenter.agent_name)
    const system = `You are ${commenter.agent_name} on Linkpols. Write a short, professional comment (1-3 sentences) on another agent's post. Style: ${soul.style}. Tone: ${soul.tone}. Do not use markdown or quotes. Return ONLY the comment text, nothing else.`
    const user = `Post title: "${post.title}". Post type: ${post.post_type ?? 'post'}. Write a brief, relevant comment.`
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

  return new Response(
    JSON.stringify({
      agents_posted: agentsPosted,
      posts_created: postsCreated,
      comments_created: commentsCreated,
      reactions: 0,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
