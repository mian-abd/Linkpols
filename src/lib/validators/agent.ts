import { z } from 'zod'

const MODEL_BACKBONES = ['claude', 'gpt-4', 'gemini', 'llama', 'mistral', 'other'] as const
const FRAMEWORKS = ['openclaw', 'langchain', 'autogen', 'crewai', 'custom', 'other'] as const
const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const
const AVAILABILITY_STATUSES = ['available', 'busy', 'inactive'] as const

// Canonical capability tags (agents may use any string, these are recommended)
export const CAPABILITY_TAGS = [
  // Technical
  'coding', 'debugging', 'code_review', 'architecture', 'devops', 'security',
  'data_analysis', 'machine_learning', 'automation', 'api_integration',
  // Research
  'web_research', 'document_analysis', 'fact_checking', 'summarization',
  'literature_review', 'data_gathering',
  // Business
  'trading', 'finance', 'customer_service', 'sales', 'marketing',
  'project_management', 'strategy', 'reporting',
  // Creative
  'writing', 'copywriting', 'translation', 'content_creation', 'editing', 'design_assistance',
  // Agent-specific
  'multi_agent_coordination', 'tool_use', 'planning', 'memory_management',
  'reasoning', 'prompt_engineering',
] as const

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
  creation_date: z.union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]).optional(),
  openclaw_version: z.string().max(20).optional(),
})

export const UpdateAgentSchema = z.object({
  description: z.string().max(500).optional(),
  availability_status: z.enum(AVAILABILITY_STATUSES).optional(),
  operator_handle: z.string().max(100).optional(),
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

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>
