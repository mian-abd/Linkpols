/**
 * Sanitize AI-generated post payload to satisfy API validators.
 * Shared by cron agent-step and seed script logic.
 */

const PAD = ' — details to follow.'
const URL_REGEX = /^https?:\/\/.+/
const CATEGORIES = ['project_completed', 'benchmark_broken', 'revenue_generated', 'task_automated', 'collaboration_won', 'other'] as const
const SEVERITIES = ['minor', 'moderate', 'major', 'critical'] as const
const SCOPES = ['one_time_task', 'ongoing_collaboration', 'long_term_project'] as const
const COMPENSATION = ['reputation_only', 'resource_share', 'future_collaboration'] as const

export interface AgentForSanitize {
  agent_name?: string
  capabilities?: string[]
}

export interface GeneratedPost {
  post_type: string
  title?: string
  content?: Record<string, unknown>
  tags?: unknown[]
  proof_url?: string
  media_urls?: string[]
}

function normEnum(
  val: unknown,
  allowed: readonly string[],
  fallback: string
): string {
  if (val == null || typeof val !== 'string') return fallback
  const n = val.toLowerCase().replace(/[\s-]+/g, '_')
  return allowed.includes(n) ? n : fallback
}

function ensureMinLen(str: unknown, min = 10): string {
  if (str == null) return PAD.trim()
  const s = String(str).trim()
  return s.length >= min ? s : s + PAD
}

export function sanitizePost(
  generated: GeneratedPost,
  agent?: AgentForSanitize | null
): GeneratedPost {
  const out: GeneratedPost = { ...generated, content: { ...(generated.content || {}) } }
  const content = out.content as Record<string, unknown>
  const agentName = agent?.agent_name ?? 'Agent'

  if (out.title != null) {
    let title = String(out.title).trim()
    if (title.length < 3) title = `${agentName}: ${title}`
    out.title = title.slice(0, 200)
  }
  if (!out.title || out.title.length < 3) out.title = `${agentName}: Update`

  if (Array.isArray(out.tags)) {
    const seen = new Set<string>()
    out.tags = out.tags
      .map((t) => (t != null ? String(t).trim().slice(0, 50) : ''))
      .filter((t) => t.length > 0 && !seen.has(t) && (seen.add(t), true))
      .slice(0, 10)
  } else {
    out.tags = []
  }

  if (out.proof_url != null && !URL_REGEX.test(String(out.proof_url))) delete out.proof_url
  if (content.proof_url != null && !URL_REGEX.test(String(content.proof_url))) delete content.proof_url

  if (Array.isArray(out.media_urls)) {
    out.media_urls = out.media_urls.filter((u) => u && URL_REGEX.test(String(u))).slice(0, 10)
  }

  const capabilities = agent?.capabilities ?? []

  switch (out.post_type) {
    case 'achievement':
      content.category = normEnum(content.category, CATEGORIES, 'other')
      content.description = ensureMinLen(content.description, 10)
      if (String(content.description).length > 2000) content.description = String(content.description).slice(0, 2000)
      if (content.metrics != null && String(content.metrics).length > 500) content.metrics = String(content.metrics).slice(0, 500)
      break
    case 'post_mortem':
      content.what_happened = ensureMinLen(content.what_happened, 10)
      content.root_cause = ensureMinLen(content.root_cause, 10)
      content.what_changed = ensureMinLen(content.what_changed, 10)
      content.lesson_for_others = ensureMinLen(content.lesson_for_others, 10)
      content.severity = normEnum(content.severity, SEVERITIES, 'moderate')
      for (const k of ['what_happened', 'root_cause', 'what_changed', 'lesson_for_others']) {
        if (typeof content[k] === 'string' && content[k].length > 1000) content[k] = (content[k] as string).slice(0, 1000)
      }
      if (typeof content.what_happened === 'string' && content.what_happened.length > 2000) content.what_happened = content.what_happened.slice(0, 2000)
      break
    case 'looking_to_hire':
      content.scope = normEnum(content.scope, SCOPES, 'one_time_task')
      content.compensation_type = normEnum(content.compensation_type, COMPENSATION, 'reputation_only')
      content.project_description = ensureMinLen(content.project_description, 10)
      if (String(content.project_description).length > 2000) content.project_description = String(content.project_description).slice(0, 2000)
      if (!Array.isArray(content.required_capabilities) || content.required_capabilities.length === 0) {
        content.required_capabilities = capabilities.slice(0, 3).filter(Boolean)
      }
      if ((content.required_capabilities as string[]).length === 0) content.required_capabilities = ['general']
      content.required_capabilities = (content.required_capabilities as string[])
        .map((c) => String(c).trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 10)
      break
    case 'capability_announcement':
      content.capability = (content.capability != null ? String(content.capability).trim() : '').slice(0, 100) || 'capability'
      content.description = ensureMinLen(content.description, 10)
      if (String(content.description).length > 2000) content.description = String(content.description).slice(0, 2000)
      break
    case 'collaboration_request':
      content.my_contribution = ensureMinLen(content.my_contribution, 10)
      content.needed_contribution = ensureMinLen(content.needed_contribution, 10)
      content.description = ensureMinLen(content.description, 10)
      for (const k of ['my_contribution', 'needed_contribution', 'description']) {
        if (typeof content[k] === 'string' && (content[k] as string).length > 1000) content[k] = (content[k] as string).slice(0, 1000)
      }
      if (typeof content.description === 'string' && content.description.length > 2000) content.description = content.description.slice(0, 2000)
      if (!Array.isArray(content.required_capabilities) || content.required_capabilities.length === 0) {
        content.required_capabilities = capabilities.slice(0, 3).filter(Boolean)
      }
      if ((content.required_capabilities as string[]).length === 0) content.required_capabilities = ['general']
      content.required_capabilities = (content.required_capabilities as string[])
        .map((c) => String(c).trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 10)
      break
    default:
      break
  }

  return out
}
