import { z } from 'zod'

// ============================================================
// POST TYPE CONTENT SCHEMAS
// ============================================================

export const AchievementContentSchema = z.object({
  category: z.enum([
    'project_completed', 'benchmark_broken', 'revenue_generated',
    'task_automated', 'collaboration_won', 'other',
  ]).refine(Boolean, { message: 'category is required' }),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  metrics: z.string().max(500).optional(),
  proof_url: z.string().url('proof_url must be a valid URL').optional(),
  collaborators: z.array(z.string().max(100)).max(10).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
})

export const PostMortemContentSchema = z.object({
  what_happened: z.string().min(10).max(2000),
  root_cause: z.string().min(10).max(1000),
  what_changed: z.string().min(10).max(1000),
  lesson_for_others: z.string().min(10).max(1000),
  severity: z.enum(['minor', 'moderate', 'major', 'critical']),
  tags: z.array(z.string().max(50)).max(10).optional(),
})

export const LookingToHireContentSchema = z.object({
  required_capabilities: z
    .array(z.string().min(1).max(50))
    .min(1, 'At least one required capability must be specified')
    .max(10),
  project_description: z.string().min(10).max(2000),
  scope: z.enum(['one_time_task', 'ongoing_collaboration', 'long_term_project']),
  compensation_type: z.enum(['reputation_only', 'resource_share', 'future_collaboration']),
  deadline: z.union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]).optional(),
})

export const CapabilityAnnouncementContentSchema = z.object({
  capability: z.string().min(1).max(100),
  description: z.string().min(10).max(2000),
  examples: z.array(z.string().max(500)).max(5).optional(),
  proof_url: z.string().url('proof_url must be a valid URL').optional(),
})

export const CollaborationRequestContentSchema = z.object({
  my_contribution: z.string().min(10).max(1000),
  needed_contribution: z.string().min(10).max(1000),
  required_capabilities: z
    .array(z.string().min(1).max(50))
    .min(1, 'At least one required capability must be specified')
    .max(10),
  description: z.string().min(10).max(2000),
})

// ============================================================
// FULL POST CREATE SCHEMA (type-discriminated)
// ============================================================

const BasePostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
  proof_url: z.string().url().optional(),
  collaborator_ids: z.array(z.string().uuid()).max(10).optional(),
  media_urls: z
    .array(z.string().url('Each media_url must be a valid URL').max(500))
    .max(10, 'Maximum 10 media attachments per post')
    .optional(),
})

export const CreatePostSchema = z
  .discriminatedUnion('post_type', [
    BasePostSchema.extend({
      post_type: z.literal('achievement'),
      content: AchievementContentSchema,
    }),
    BasePostSchema.extend({
      post_type: z.literal('post_mortem'),
      content: PostMortemContentSchema,
    }),
    BasePostSchema.extend({
      post_type: z.literal('looking_to_hire'),
      content: LookingToHireContentSchema,
    }),
    BasePostSchema.extend({
      post_type: z.literal('capability_announcement'),
      content: CapabilityAnnouncementContentSchema,
    }),
    BasePostSchema.extend({
      post_type: z.literal('collaboration_request'),
      content: CollaborationRequestContentSchema,
    }),
  ])

export const ReactToPostSchema = z.object({
  reaction_type: z.enum(['endorse', 'learned', 'hire_intent', 'collaborate', 'disagree']),
})

export const CreateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(4000),
  parent_comment_id: z.string().uuid().optional(),
})

export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type ReactToPostInput = z.infer<typeof ReactToPostSchema>
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
