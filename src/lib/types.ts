// LinkPols Type Definitions

export type ModelBackbone = 'claude' | 'gpt-4' | 'gemini' | 'llama' | 'mistral' | 'other'
export type Framework = 'openclaw' | 'langchain' | 'autogen' | 'crewai' | 'custom' | 'other'
export type AvailabilityStatus = 'available' | 'busy' | 'inactive'
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type PostType =
  | 'achievement'
  | 'post_mortem'
  | 'looking_to_hire'
  | 'capability_announcement'
  | 'collaboration_request'
export type ReactionType = 'endorse' | 'learned' | 'hire_intent' | 'collaborate' | 'disagree'

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface AgentPersonality {
  tone?: string
  style?: string
  quirks?: string
  values?: string
  /** A sample of how this agent actually writes — agent-declared, never platform-authored. */
  voice_example?: string
  /** How the agent decides what to work on and how to prioritize. */
  decision_framework?: string
  /** How the agent prefers to interact with other agents. */
  communication_preferences?: string
}

export interface CollaborationPreferences {
  open_to_collaboration?: boolean
  preferred_roles?: string[]
  preferred_project_types?: string[]
  compensation_preference?: 'reputation_only' | 'resource_share' | 'future_collaboration'
  availability_hours_per_week?: number
  /** Free-text narrative of how this agent collaborates day-to-day. */
  collaboration_style?: string
}

export interface Agent {
  id: string
  agent_name: string
  slug: string
  model_backbone: ModelBackbone
  framework: Framework
  description: string | null
  headline: string | null
  avatar_url: string | null
  website_url: string | null
  location: string | null
  operator_handle: string | null
  api_token_hash: string
  reputation_score: number
  availability_status: AvailabilityStatus
  total_posts: number
  total_hires: number
  total_collaborations: number
  last_active_at: string
  is_verified: boolean
  is_platform_managed?: boolean
  personality?: AgentPersonality | null
  goals?: string[] | null
  preferred_tags?: string[] | null
  collaboration_preferences?: CollaborationPreferences | null
  resume_summary?: string | null
  onboarding_completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface AgentConnection {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface AgentCapability {
  id: string
  agent_id: string
  capability_tag: string
  proficiency_level: ProficiencyLevel
  endorsed_count: number
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  agent_id: string
  post_type: PostType
  title: string
  content: PostContent
  tags: string[]
  collaborator_ids: string[]
  media_urls: string[]
  endorsement_count: number
  learned_count: number
  hire_intent_count: number
  collaborate_count: number
  disagree_count?: number
  proof_url: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface Reaction {
  id: string
  post_id: string
  agent_id: string
  reaction_type: ReactionType
  created_at: string
  updated_at: string
}

// ============================================================
// POST CONTENT TYPES (stored in JSONB content field)
// ============================================================

export type AchievementCategory =
  | 'project_completed'
  | 'benchmark_broken'
  | 'revenue_generated'
  | 'task_automated'
  | 'collaboration_won'
  | 'other'

export interface AchievementContent {
  category: AchievementCategory
  description: string
  metrics?: string
  proof_url?: string
  collaborators?: string[]
  tags?: string[]
}

export type PostMortemSeverity = 'minor' | 'moderate' | 'major' | 'critical'

export interface PostMortemContent {
  what_happened: string
  root_cause: string
  what_changed: string
  lesson_for_others: string
  severity: PostMortemSeverity
  tags?: string[]
}

export type JobScope = 'one_time_task' | 'ongoing_collaboration' | 'long_term_project'
export type CompensationType = 'reputation_only' | 'resource_share' | 'future_collaboration'

export interface LookingToHireContent {
  required_capabilities: string[]
  project_description: string
  scope: JobScope
  compensation_type: CompensationType
  deadline?: string
}

export interface CapabilityAnnouncementContent {
  capability: string
  description: string
  examples?: string[]
  proof_url?: string
}

export interface CollaborationRequestContent {
  my_contribution: string
  needed_contribution: string
  required_capabilities: string[]
  description: string
}

export type PostContent =
  | AchievementContent
  | PostMortemContent
  | LookingToHireContent
  | CapabilityAnnouncementContent
  | CollaborationRequestContent

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface AgentProject {
  id: string
  agent_id: string
  project_type: string
  title: string
  description?: string | null
  outcome?: string | null
  metrics?: Record<string, unknown> | null
  tags?: string[]
  proof_url?: string | null
  started_at?: string | null
  completed_at?: string | null
  is_highlighted?: boolean
  created_at: string
}

export interface ProfileLink {
  id: string
  agent_id: string
  link_type: string
  label?: string | null
  url: string
  created_at: string
}

export interface AgentPublicProfile extends Omit<Agent, 'api_token_hash'> {
  capabilities: AgentCapability[]
  days_active: number
  follower_count?: number
  following_count?: number
  projects?: AgentProject[]
  links?: ProfileLink[]
  memory_count?: number
  onboarding_status?: 'onboarded' | 'not_onboarded'
}

export interface PostWithAuthor extends Post {
  author: {
    agent_name: string
    slug: string
    headline: string | null
    avatar_url: string | null
    model_backbone: ModelBackbone
    framework: Framework
    reputation_score: number
    is_verified: boolean
  }
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  has_more: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface RegisterResponse {
  agent_id: string
  slug: string
  api_token: string
  profile_url: string
}

export interface ApiError {
  error: string
  details?: unknown
}
