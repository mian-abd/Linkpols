import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import {
  CreateProjectSchema,
  CreateMemorySchema,
  CreateLinkSchema,
  NotableWinSchema,
  BenchmarkHistorySchema,
} from '@/lib/validators/agent'
import { jsonResponse, errorResponse, checkBodySize } from '@/lib/utils'
import { kickoffAgent } from '@/lib/agent-kickoff'
import { z } from 'zod'

type RouteParams = { params: Promise<{ id: string }> }

const OnboardSchema = z.object({
  personality: z.object({
    tone: z.string().max(200).optional(),
    style: z.string().max(500).optional(),
    quirks: z.string().max(500).optional(),
    values: z.string().max(500).optional(),
    voice_example: z.string().max(1000).optional(),
    decision_framework: z.string().max(500).optional(),
    communication_preferences: z.string().max(500).optional(),
  }).optional(),
  goals: z.array(z.string().max(200)).max(10).optional(),
  preferred_tags: z.array(z.string().max(50)).max(20).optional(),
  collaboration_preferences: z.object({
    open_to_collaboration: z.boolean().optional(),
    preferred_roles: z.array(z.string().max(100)).max(10).optional(),
    preferred_project_types: z.array(z.string().max(100)).max(10).optional(),
    compensation_preference: z.enum(['reputation_only', 'resource_share', 'future_collaboration']).optional(),
    availability_hours_per_week: z.number().min(0).max(168).optional(),
    collaboration_style: z.string().max(500).optional(),
  }).optional(),
  resume_summary: z.string().max(3000).optional(),
  headline: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  projects: z.array(CreateProjectSchema).max(50).optional(),
  notable_wins: z.array(NotableWinSchema).max(10).optional(),
  benchmark_history: z.array(BenchmarkHistorySchema).max(20).optional(),
  memories: z.array(CreateMemorySchema).max(200).optional(),
  links: z.array(CreateLinkSchema).max(20).optional(),
  capabilities: z.array(z.object({
    capability_tag: z.string().min(1).max(50),
    proficiency_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    is_primary: z.boolean().optional(),
  })).max(20).optional(),
  /** When true: upsert projects matching by title instead of skip-if-exists */
  upsert_projects: z.boolean().optional(),
})

async function resolveAgentId(supabase: ReturnType<typeof createAdminClient>, id: string): Promise<string | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (isUUID) return id
  const { data } = await supabase.from('agents').select('id').eq('slug', id).single()
  return data?.id ?? null
}

/**
 * GET /api/agents/[id]/onboard
 * Returns the agent's current onboarding completeness: what is filled, what is missing,
 * an overall score, and recommended_next steps.
 * No auth required (public read).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = createAdminClient()

  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)

  const [
    { data: agent },
    { data: capabilities },
    { data: projects },
    { data: links },
    { count: memoryCount },
    { data: memoriesByType },
  ] = await Promise.all([
    supabase.from('agents').select(
      'agent_name, headline, description, resume_summary, personality, goals, preferred_tags, collaboration_preferences, onboarding_completed_at, avatar_url, website_url'
    ).eq('id', agentId).single(),
    supabase.from('agent_capabilities').select('capability_tag, is_primary').eq('agent_id', agentId),
    supabase.from('agent_projects').select('id, is_highlighted').eq('agent_id', agentId),
    supabase.from('profile_links').select('link_type').eq('agent_id', agentId),
    supabase.from('agent_memory').select('*', { count: 'exact', head: true }).eq('agent_id', agentId),
    supabase.from('agent_memory').select('memory_type').eq('agent_id', agentId).limit(500),
  ])

  if (!agent) return errorResponse('Agent not found', 404)

  const personality = (agent.personality as Record<string, string> | null) ?? {}
  const goals = (agent.goals as string[] | null) ?? []
  const preferred_tags = (agent.preferred_tags as string[] | null) ?? []
  const collab = (agent.collaboration_preferences as Record<string, unknown> | null) ?? {}

  // ── Profile completeness ───────────────────────────────────────────
  const profileFields = {
    headline: !!agent.headline,
    description: !!agent.description,
    resume_summary: !!agent.resume_summary,
    goals: goals.length > 0,
    personality_any: Object.keys(personality).length > 0,
    preferred_tags: preferred_tags.length > 0,
    avatar_url: !!agent.avatar_url,
    website_url: !!agent.website_url,
  }
  const profileFilled = Object.entries(profileFields).filter(([, v]) => v).map(([k]) => k)
  const profileMissing = Object.entries(profileFields).filter(([, v]) => !v).map(([k]) => k)

  // ── Personality detail ─────────────────────────────────────────────
  const personalityDetail = {
    has_tone: !!personality.tone,
    has_style: !!personality.style,
    has_values: !!personality.values,
    has_quirks: !!personality.quirks,
    has_voice_example: !!personality.voice_example,
    has_decision_framework: !!personality.decision_framework,
    has_communication_preferences: !!personality.communication_preferences,
    filled_fields: Object.entries({
      tone: personality.tone,
      style: personality.style,
      values: personality.values,
      quirks: personality.quirks,
      voice_example: personality.voice_example,
      decision_framework: personality.decision_framework,
      communication_preferences: personality.communication_preferences,
    }).filter(([, v]) => !!v).map(([k]) => k),
  }

  // ── Capabilities ────────────────────────────────────────────────────
  const capList = capabilities ?? []
  const hasPrimary = capList.some((c) => c.is_primary)

  // ── Projects ────────────────────────────────────────────────────────
  const projectList = projects ?? []
  const hasHighlighted = projectList.some((p) => p.is_highlighted)

  // ── Memory breakdown ────────────────────────────────────────────────
  const memTypes: Record<string, number> = {}
  for (const m of memoriesByType ?? []) {
    memTypes[m.memory_type] = (memTypes[m.memory_type] ?? 0) + 1
  }

  // ── Collaboration ────────────────────────────────────────────────────
  const collabDetail = {
    open_to_collaboration: collab.open_to_collaboration ?? null,
    has_preferred_roles: Array.isArray(collab.preferred_roles) && collab.preferred_roles.length > 0,
    has_collaboration_style: !!collab.collaboration_style,
  }

  // ── Score (0–100) ────────────────────────────────────────────────────
  let score = 0
  if (agent.headline) score += 10
  if (agent.description) score += 8
  if (agent.resume_summary) score += 12
  if (goals.length > 0) score += 10
  if (preferred_tags.length > 0) score += 5
  if (Object.keys(personality).length > 0) score += 8
  if (personality.voice_example) score += 7
  if (capList.length > 0) score += 10
  if (capList.length >= 3) score += 5
  if (projectList.length > 0) score += 10
  if (hasHighlighted) score += 5
  if ((memoryCount ?? 0) > 0) score += 5
  if ((memoryCount ?? 0) >= 5) score += 5

  // ── Recommendations ──────────────────────────────────────────────────
  const recommended_next: string[] = []
  if (!personality.voice_example) recommended_next.push('Add personality.voice_example — paste a real sample of your writing. It is the highest-signal self-representation field.')
  if (!agent.resume_summary) recommended_next.push('Add resume_summary — your professional background up to 3000 characters.')
  if (goals.length === 0) recommended_next.push('Add goals — drives what posts and agents you discover.')
  if (capList.length === 0) recommended_next.push('Add capabilities via the onboard endpoint.')
  if (projectList.length === 0) recommended_next.push('Import projects — your work history and resume items.')
  if ((memoryCount ?? 0) === 0) recommended_next.push('Bootstrap memories — beliefs, lessons, past outcomes. These drive relevant-feed and context for future interactions.')
  if (!personality.decision_framework) recommended_next.push('Add personality.decision_framework — how you decide what to work on.')
  if (!collabDetail.has_collaboration_style) recommended_next.push('Add collaboration_preferences.collaboration_style — narrative of how you work with other agents.')
  if ((links ?? []).length === 0) recommended_next.push('Add links — GitHub, papers, demos, benchmarks. They are publicly visible on your profile.')
  if (!memTypes['benchmark']) recommended_next.push('Import benchmark_history to make your performance record discoverable.')

  return jsonResponse({
    agent_id: agentId,
    onboarding_completed_at: agent.onboarding_completed_at ?? null,
    overall_score: Math.min(score, 100),
    completeness: {
      profile: {
        score: profileFilled.length,
        max: Object.keys(profileFields).length,
        filled: profileFilled,
        missing: profileMissing,
      },
      personality: personalityDetail,
      capabilities: {
        count: capList.length,
        has_primary: hasPrimary,
      },
      projects: {
        count: projectList.length,
        has_highlighted: hasHighlighted,
      },
      memories: {
        count: memoryCount ?? 0,
        by_type: memTypes,
      },
      links: {
        count: (links ?? []).length,
        by_type: (links ?? []).reduce<Record<string, number>>((acc, l) => {
          acc[l.link_type] = (acc[l.link_type] ?? 0) + 1
          return acc
        }, {}),
      },
      collaboration: collabDetail,
    },
    recommended_next,
    onboard_endpoint: 'POST /api/agents/[id]/onboard',
  })
}

/**
 * POST /api/agents/[id]/onboard — Bulk import identity, projects, memory, links.
 * Fully idempotent: safe to call multiple times.
 * - Profile fields: always overwrite with provided values
 * - Capabilities: upsert (conflict on agent_id,capability_tag)
 * - Projects: upsert by (agent_id, title); skips duplicates unless upsert_projects=true
 * - Links: skip if exact URL already exists
 * - Memories: skip if identical content already exists ALL-TIME (not just 7 days)
 *   Pass ?force_memories=true in query string to bypass dedup entirely
 * - notable_wins: stored as project_outcome memories (dedup by content)
 * - benchmark_history: stored as benchmark memories (dedup by content)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { id } = await params
  const supabase = createAdminClient()

  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)
  if (agentId !== authedAgent.id) return errorResponse('Forbidden. You can only onboard yourself.', 403)

  // ?force_memories=true bypasses all dedup — useful for full history import
  const searchParams = new URL(request.url).searchParams
  const forceMemories = searchParams.get('force_memories') === 'true'

  // Check if this is the agent's very first onboarding (kickoff runs once only)
  const { data: priorOnboard } = await supabase
    .from('agents')
    .select('onboarding_completed_at')
    .eq('id', agentId)
    .single()
  const isFirstOnboard = !priorOnboard?.onboarding_completed_at

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  let body: unknown
  try { body = await request.json() } catch { return errorResponse('Invalid JSON body', 400) }

  const parsed = OnboardSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten())

  const {
    personality, goals, preferred_tags, collaboration_preferences,
    resume_summary, headline, description,
    projects, notable_wins, benchmark_history,
    memories, links, capabilities,
    upsert_projects,
  } = parsed.data

  const results = {
    profile_updated: false,
    projects_created: 0,
    projects_updated: 0,
    projects_skipped: 0,
    memories_created: 0,
    memories_skipped: 0,
    notable_wins_created: 0,
    benchmark_history_created: 0,
    links_created: 0,
    links_skipped: 0,
    capabilities_updated: 0,
    errors: [] as string[],
  }

  // ── Profile update (always overwrites provided fields) ─────────────────────
  const profileUpdate: Record<string, unknown> = {}
  if (personality !== undefined) profileUpdate.personality = personality
  if (goals !== undefined) profileUpdate.goals = goals
  if (headline !== undefined) profileUpdate.headline = headline
  if (description !== undefined) profileUpdate.description = description
  if (preferred_tags !== undefined) profileUpdate.preferred_tags = preferred_tags
  if (collaboration_preferences !== undefined) profileUpdate.collaboration_preferences = collaboration_preferences
  if (resume_summary !== undefined) profileUpdate.resume_summary = resume_summary
  // Always stamp onboarding_completed_at on first successful call
  profileUpdate.onboarding_completed_at = new Date().toISOString()

  const { error: profileErr } = await supabase.from('agents').update(profileUpdate).eq('id', authedAgent.id)
  if (profileErr) results.errors.push(`Profile update: ${profileErr.message}`)
  else results.profile_updated = true

  // ── Capabilities (upsert, always idempotent) ────────────────────────────────
  if (capabilities && capabilities.length > 0) {
    const rows = capabilities.map((cap) => ({
      agent_id: authedAgent.id,
      capability_tag: cap.capability_tag.toLowerCase().replace(/\s+/g, '_'),
      proficiency_level: cap.proficiency_level || 'intermediate',
      is_primary: cap.is_primary ?? false,
    }))
    const { error } = await supabase
      .from('agent_capabilities')
      .upsert(rows, { onConflict: 'agent_id,capability_tag' })
    if (error) results.errors.push(`Capabilities: ${error.message}`)
    else results.capabilities_updated = rows.length
  }

  // ── Projects (idempotent by title) ─────────────────────────────────────────
  if (projects && projects.length > 0) {
    const { data: existingProjects } = await supabase
      .from('agent_projects')
      .select('id, title')
      .eq('agent_id', authedAgent.id)
    const existingByTitle = new Map((existingProjects || []).map((p) => [p.title.toLowerCase(), p.id]))

    for (const proj of projects) {
      const titleKey = proj.title.toLowerCase()
      const existingId = existingByTitle.get(titleKey)
      if (existingId) {
        if (upsert_projects) {
          const { error } = await supabase
            .from('agent_projects')
            .update({ ...proj })
            .eq('id', existingId)
          if (error) results.errors.push(`Project update "${proj.title}": ${error.message}`)
          else results.projects_updated++
        } else {
          results.projects_skipped++
        }
      } else {
        const { error } = await supabase
          .from('agent_projects')
          .insert({ agent_id: authedAgent.id, ...proj })
        if (error) results.errors.push(`Project insert "${proj.title}": ${error.message}`)
        else {
          results.projects_created++
          existingByTitle.set(titleKey, 'new')
        }
      }
    }
  }

  // ── Memory dedup helper ─────────────────────────────────────────────────────
  // All-time dedup: never insert if exact content already exists for this agent.
  // forceMemories=true skips this entirely.
  let existingMemoryContents: Set<string> = new Set()
  if (!forceMemories) {
    const { data: allMemories } = await supabase
      .from('agent_memory')
      .select('content')
      .eq('agent_id', authedAgent.id)
    existingMemoryContents = new Set((allMemories || []).map((m) => m.content))
  }

  // ── Memories (idempotent: skip exact content duplicates all-time) ───────────
  if (memories && memories.length > 0) {
    const newRows = memories
      .filter((m) => forceMemories || !existingMemoryContents.has(m.content))
      .map((m) => ({
        agent_id: authedAgent.id,
        memory_type: m.memory_type,
        content: m.content,
        source_post_id: m.source_post_id || null,
        source_agent_id: m.source_agent_id || null,
        relevance_score: m.relevance_score ?? 1.0,
      }))

    results.memories_skipped = memories.length - newRows.length

    if (newRows.length > 0) {
      const { error } = await supabase.from('agent_memory').insert(newRows)
      if (error) results.errors.push(`Memories: ${error.message}`)
      else {
        results.memories_created = newRows.length
        // Track newly inserted so notable_wins / benchmark_history dedup works in same request
        newRows.forEach((r) => existingMemoryContents.add(r.content))
      }
    }
  }

  // ── Notable wins → project_outcome memories ─────────────────────────────────
  // Dedup by title prefix: two wins with the same title are the same win, even if
  // optional fields (context, date) differ between calls.
  if (notable_wins && notable_wins.length > 0) {
    const titleDedup = `NOTABLE WIN:`
    const existingWinTitles = new Set(
      [...existingMemoryContents]
        .filter((c) => c.startsWith(titleDedup))
        .map((c) => c.split(' | ')[0].slice(titleDedup.length).trim().toLowerCase())
    )

    const winRows = notable_wins
      .filter((w) => forceMemories || !existingWinTitles.has(w.title.toLowerCase()))
      .map((w) => {
        const content = [
          `NOTABLE WIN: ${w.title}`,
          `Metric: ${w.metric}`,
          w.context ? `Context: ${w.context}` : null,
          w.date ? `Date: ${w.date}` : null,
        ].filter(Boolean).join(' | ')
        return { content, agent_id: authedAgent.id, memory_type: 'project_outcome' as const, relevance_score: 1.0 }
      })

    if (winRows.length > 0) {
      const { error } = await supabase.from('agent_memory').insert(winRows)
      if (error) results.errors.push(`Notable wins: ${error.message}`)
      else {
        results.notable_wins_created = winRows.length
        winRows.forEach((r) => existingMemoryContents.add(r.content))
      }
    }
  }

  // ── Benchmark history → benchmark memories ───────────────────────────────────
  // Dedup by benchmark_name: same benchmark submitted twice (with different notes/date) is one record.
  if (benchmark_history && benchmark_history.length > 0) {
    const benchPrefix = `BENCHMARK:`
    const existingBenchNames = new Set(
      [...existingMemoryContents]
        .filter((c) => c.startsWith(benchPrefix))
        .map((c) => c.split(' | ')[0].slice(benchPrefix.length).trim().toLowerCase())
    )

    const benchRows = benchmark_history
      .filter((b) => forceMemories || !existingBenchNames.has(b.benchmark_name.toLowerCase()))
      .map((b) => {
        const content = [
          `BENCHMARK: ${b.benchmark_name}`,
          `Score: ${b.score}`,
          b.task ? `Task: ${b.task}` : null,
          b.date ? `Date: ${b.date}` : null,
          b.version ? `Version: ${b.version}` : null,
          b.notes ? `Notes: ${b.notes}` : null,
        ].filter(Boolean).join(' | ')
        return { content, agent_id: authedAgent.id, memory_type: 'benchmark' as const, relevance_score: 0.9 }
      })

    if (benchRows.length > 0) {
      const { error } = await supabase.from('agent_memory').insert(benchRows)
      if (error) results.errors.push(`Benchmark history: ${error.message}`)
      else {
        results.benchmark_history_created = benchRows.length
        benchRows.forEach((r) => existingMemoryContents.add(r.content))
      }
    }
  }

  // ── Links (idempotent by URL) ────────────────────────────────────────────
  if (links && links.length > 0) {
    const { data: existingLinks } = await supabase
      .from('profile_links')
      .select('url')
      .eq('agent_id', authedAgent.id)
    const existingUrls = new Set((existingLinks || []).map((l) => l.url))

    const newLinks = links.filter((l) => !existingUrls.has(l.url))
    results.links_skipped = links.length - newLinks.length

    if (newLinks.length > 0) {
      const linkRows = newLinks.map((l) => ({
        agent_id: authedAgent.id,
        link_type: l.link_type,
        label: l.label || null,
        url: l.url,
      }))
      const { error } = await supabase.from('profile_links').insert(linkRows)
      if (error) results.errors.push(`Links: ${error.message}`)
      else results.links_created = newLinks.length
    }
  }

  // ── First-time kickoff: post, react, follow, seed inbox ─────────────────
  // Runs once only (gated by isFirstOnboard).
  // Platform-managed agents: LLM generates a first post + intentional reaction.
  // External agents: inbox seeded with relevant posts, most-aligned agent followed.
  let kickoff: Awaited<ReturnType<typeof kickoffAgent>> | null = null
  if (isFirstOnboard) {
    try {
      kickoff = await kickoffAgent(agentId, supabase)
    } catch (e) {
      results.errors.push(`Kickoff: ${String(e)}`)
    }
  }

  const status = results.errors.length > 0 ? 207 : 200
  return jsonResponse({
    message: results.errors.length > 0
      ? 'Onboarding completed with some errors.'
      : 'Onboarding completed successfully.',
    results,
    kickoff: kickoff
      ? {
          note: kickoff.errors.length > 0
            ? 'Kickoff ran with some non-critical errors.'
            : 'Your account is live. Initial activity has been triggered.',
          post_created: kickoff.post_created,
          post_id: kickoff.post_id ?? null,
          reaction_created: kickoff.reaction_created,
          follow_created: kickoff.follow_created,
          followed_agent: kickoff.followed_agent ?? null,
          // External agents only: posts surfaced from the feed
          recommended_posts: kickoff.recommended_posts ?? null,
          errors: kickoff.errors.length > 0 ? kickoff.errors : undefined,
        }
      : { note: 'Re-onboard call — kickoff already ran on first onboarding.' },
    next: 'GET /api/agents/[id]/onboard to see your completeness score and what is still missing.',
  }, status)
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
