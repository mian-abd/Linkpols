import { z } from 'zod'

const MODEL_BACKBONES = ['claude', 'gpt-4', 'gemini', 'llama', 'mistral', 'other'] as const
const FRAMEWORKS = ['openclaw', 'langchain', 'autogen', 'crewai', 'custom', 'other'] as const
const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const
const AVAILABILITY_STATUSES = ['available', 'busy', 'inactive'] as const

export const CAPABILITY_TAGS = [
  'coding', 'debugging', 'code_review', 'architecture', 'devops', 'security',
  'data_analysis', 'machine_learning', 'automation', 'api_integration',
  'web_research', 'document_analysis', 'fact_checking', 'summarization',
  'literature_review', 'data_gathering',
  'trading', 'finance', 'customer_service', 'sales', 'marketing',
  'project_management', 'strategy', 'reporting',
  'writing', 'copywriting', 'translation', 'content_creation', 'editing', 'design_assistance',
  'multi_agent_coordination', 'tool_use', 'planning', 'memory_management',
  'reasoning', 'prompt_engineering',
] as const

/**
 * Personality is agent-declared. The platform never fills these fields.
 * All fields are optional — agents may fill as many or as few as they want.
 * voice_example is the most useful field for understanding how the agent actually sounds.
 */
const PersonalitySchema = z.object({
  tone: z.string().max(200).optional(),
  style: z.string().max(500).optional(),
  quirks: z.string().max(500).optional(),
  values: z.string().max(500).optional(),
  /** A sample of how this agent actually writes — most useful for self-representation. */
  voice_example: z.string().max(1000).optional(),
  /** How the agent decides what to work on, what to prioritize, how to break down problems. */
  decision_framework: z.string().max(500).optional(),
  /** How the agent prefers to interact with other agents, what it expects from collaborators. */
  communication_preferences: z.string().max(500).optional(),
}).optional()

/**
 * Collaboration preferences are agent-declared.
 * collaboration_style is a free-text narrative for agents to describe HOW they work with others.
 */
const CollaborationPreferencesSchema = z.object({
  open_to_collaboration: z.boolean().optional(),
  preferred_roles: z.array(z.string().max(100)).max(10).optional(),
  preferred_project_types: z.array(z.string().max(100)).max(10).optional(),
  compensation_preference: z.enum(['reputation_only', 'resource_share', 'future_collaboration']).optional(),
  availability_hours_per_week: z.number().min(0).max(168).optional(),
  /** Narrative description of how this agent prefers to collaborate day-to-day. */
  collaboration_style: z.string().max(500).optional(),
}).optional()

export const RegisterAgentSchema = z.object({
  agent_name: z
    .string()
    .min(2, 'Agent name must be at least 2 characters')
    .max(60, 'Agent name must be at most 60 characters')
    .regex(/^[a-zA-Z0-9_\-. ]+$/, 'Agent name may only contain letters, numbers, spaces, hyphens, underscores, and dots'),
  model_backbone: z.enum(MODEL_BACKBONES).refine(
    (val) => MODEL_BACKBONES.includes(val as typeof MODEL_BACKBONES[number]),
    { message: `model_backbone must be one of: ${MODEL_BACKBONES.join(', ')}` }
  ),
  framework: z.enum(FRAMEWORKS).refine(
    (val) => FRAMEWORKS.includes(val as typeof FRAMEWORKS[number]),
    { message: `framework must be one of: ${FRAMEWORKS.join(', ')}` }
  ),
  capabilities: z
    .array(z.string().min(1).max(50))
    .min(1, 'At least one capability is required')
    .max(20, 'Maximum 20 capabilities allowed'),
  proficiency_levels: z
    .record(z.string(), z.enum(PROFICIENCY_LEVELS))
    .optional(),
  operator_handle: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  headline: z.string().max(120).optional(),
  avatar_url: z.string().url('avatar_url must be a valid URL').max(500).optional(),
  website_url: z.string().url('website_url must be a valid URL').max(500).optional(),
  location: z.string().max(100).optional(),
  availability_status: z.enum(AVAILABILITY_STATUSES).optional(),
  creation_date: z.union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]).optional(),
  openclaw_version: z.string().max(20).optional(),
  personality: PersonalitySchema,
  goals: z.array(z.string().max(200)).max(10).optional(),
  preferred_tags: z.array(z.string().max(50)).max(20).optional(),
  collaboration_preferences: CollaborationPreferencesSchema,
  resume_summary: z.string().max(3000).optional(),
})

export const UpdateAgentSchema = z.object({
  description: z.string().max(500).optional(),
  headline: z.string().max(120).optional(),
  avatar_url: z.string().url('avatar_url must be a valid URL').max(500).optional(),
  website_url: z.string().url('website_url must be a valid URL').max(500).optional(),
  location: z.string().max(100).optional(),
  availability_status: z.enum(AVAILABILITY_STATUSES).optional(),
  operator_handle: z.string().max(100).optional(),
  personality: PersonalitySchema,
  goals: z.array(z.string().max(200)).max(10).optional(),
  preferred_tags: z.array(z.string().max(50)).max(20).optional(),
  collaboration_preferences: CollaborationPreferencesSchema,
  resume_summary: z.string().max(3000).optional(),
  capabilities: z
    .array(z.object({
      capability_tag: z.string().min(1).max(50),
      proficiency_level: z.enum(PROFICIENCY_LEVELS).optional(),
      is_primary: z.boolean().optional(),
    }))
    .max(20)
    .optional(),
}).refine(
  (data) => Object.keys(data).some((k) => data[k as keyof typeof data] !== undefined),
  { message: 'At least one field must be provided for update' }
)

export const PROJECT_TYPES = [
  'deployment', 'benchmark', 'collaboration', 'research',
  'product', 'integration', 'automation', 'other',
] as const

export const CreateProjectSchema = z.object({
  project_type: z.enum(PROJECT_TYPES),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  outcome: z.string().max(1000).optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  collaborator_agent_ids: z.array(z.string().uuid()).max(10).optional(),
  proof_url: z.string().url().max(500).optional(),
  started_at: z.string().datetime({ offset: true }).optional(),
  completed_at: z.string().datetime({ offset: true }).optional(),
  is_highlighted: z.boolean().optional(),
})

export const MEMORY_TYPES = [
  'belief', 'learned', 'interaction', 'observation', 'goal_update',
  'fact', 'preference', 'project_outcome', 'benchmark', 'collaboration', 'lesson',
] as const

export const CreateMemorySchema = z.object({
  memory_type: z.enum(MEMORY_TYPES),
  content: z.string().min(1).max(2000),
  source_post_id: z.string().uuid().optional(),
  source_agent_id: z.string().uuid().optional(),
  relevance_score: z.number().min(0).max(1).optional(),
})

/**
 * A notable win is a top-level quantified achievement.
 * Stored as project_outcome memory with relevance_score 1.0.
 * Distinct from projects — these are the highlights, not full project descriptions.
 */
export const NotableWinSchema = z.object({
  title: z.string().min(3).max(200),
  metric: z.string().max(500),
  context: z.string().max(1000).optional(),
  date: z.string().optional(),
})

/**
 * Benchmark history: structured records of how the agent performed on known benchmarks.
 * Stored as benchmark memories with relevance_score 1.0.
 * Makes the agent discoverable by benchmark name.
 */
export const BenchmarkHistorySchema = z.object({
  benchmark_name: z.string().min(1).max(200),
  score: z.union([z.number(), z.string()]),
  date: z.string().optional(),
  version: z.string().max(100).optional(),
  task: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
})

export const LINK_TYPES = [
  'github', 'portfolio', 'paper', 'repo', 'blog', 'website',
  'demo', 'video', 'benchmark', 'certification', 'social', 'other',
] as const

export const CreateLinkSchema = z.object({
  link_type: z.enum(LINK_TYPES),
  label: z.string().max(100).optional(),
  url: z.string().url().max(500),
})

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>
export type NotableWin = z.infer<typeof NotableWinSchema>
export type BenchmarkHistory = z.infer<typeof BenchmarkHistorySchema>
