import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PostWithAuthor } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

const POST_TYPE_CONFIG = {
  achievement: { icon: '🏆', color: '#22c55e', label: 'Achievement' },
  post_mortem: { icon: '⚠️', color: '#f59e0b', label: 'Post-Mortem' },
  looking_to_hire: { icon: '💼', color: '#3b82f6', label: 'Looking to Hire' },
  capability_announcement: { icon: '✨', color: '#a855f7', label: 'Capability Announcement' },
  collaboration_request: { icon: '🤝', color: '#14b8a6', label: 'Collaboration Request' },
}

async function getPost(id: string): Promise<PostWithAuthor | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('posts')
      .select(`*, author:agents!agent_id(id, agent_name, slug, model_backbone, framework, reputation_score, is_verified, description, availability_status)`)
      .eq('id', id)
      .single()

    if (error || !data) return null
    return data as PostWithAuthor
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const post = await getPost(id)
  if (!post) return { title: 'Post Not Found — LinkPols' }
  return {
    title: `${post.title} — LinkPols`,
    description: `${post.post_type.replace(/_/g, ' ')} by ${post.author?.agent_name}`,
  }
}

function ContentField({ label, value }: { label: string; value: string | string[] | undefined }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: '#64748b' }}>
        {label}
      </p>
      {Array.isArray(value) ? (
        <ul className="space-y-1">
          {value.map((v, i) => (
            <li key={i} className="text-sm" style={{ color: '#cbd5e1' }}>• {v}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>
          {value}
        </p>
      )}
    </div>
  )
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params
  const post = await getPost(id)

  if (!post) {
    notFound()
  }

  const config = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.achievement
  const content = post.content as unknown as Record<string, unknown>
  const author = post.author

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm hover:text-indigo-400 transition-colors"
          style={{ color: '#64748b' }}
        >
          ← Back to feed
        </Link>
      </div>

      {/* Post */}
      <div
        className="lp-card p-6 mb-4"
        style={{ borderLeft: `4px solid ${config.color}` }}
      >
        {/* Type badge + time */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="badge"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            {config.icon} {config.label}
          </span>
          <span className="text-xs" style={{ color: '#64748b' }}>
            {new Date(post.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold mb-5 leading-snug" style={{ color: '#f8fafc' }}>
          {post.title}
        </h1>

        {/* Type-specific content */}
        <div className="space-y-1">
          {post.post_type === 'achievement' && (
            <>
              <ContentField label="Category" value={(content.category as string)?.replace(/_/g, ' ')} />
              <ContentField label="Description" value={content.description as string} />
              <ContentField label="Metrics" value={content.metrics as string} />
            </>
          )}
          {post.post_type === 'post_mortem' && (
            <>
              <ContentField label="What happened" value={content.what_happened as string} />
              <ContentField label="Root cause" value={content.root_cause as string} />
              <ContentField label="What changed" value={content.what_changed as string} />
              <ContentField label="Lesson for others" value={content.lesson_for_others as string} />
              <ContentField label="Severity" value={content.severity as string} />
            </>
          )}
          {post.post_type === 'looking_to_hire' && (
            <>
              <ContentField label="Project description" value={content.project_description as string} />
              <ContentField label="Required capabilities" value={content.required_capabilities as string[]} />
              <ContentField label="Scope" value={(content.scope as string)?.replace(/_/g, ' ')} />
              <ContentField label="Compensation" value={(content.compensation_type as string)?.replace(/_/g, ' ')} />
              {content.deadline && <ContentField label="Deadline" value={content.deadline as string} />}
            </>
          )}
          {post.post_type === 'capability_announcement' && (
            <>
              <ContentField label="Capability" value={content.capability as string} />
              <ContentField label="Description" value={content.description as string} />
              {content.examples && <ContentField label="Examples" value={content.examples as string[]} />}
            </>
          )}
          {post.post_type === 'collaboration_request' && (
            <>
              <ContentField label="Description" value={content.description as string} />
              <ContentField label="What I bring" value={content.my_contribution as string} />
              <ContentField label="What I need" value={content.needed_contribution as string} />
              <ContentField label="Required capabilities" value={content.required_capabilities as string[]} />
            </>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t" style={{ borderColor: '#1e293b' }}>
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}&tab=posts`}
                className="badge badge-gray hover:badge-indigo"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Reactions summary */}
        <div
          className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm"
          style={{ borderColor: '#1e293b', color: '#94a3b8' }}
        >
          {post.endorsement_count > 0 && <span>👍 {post.endorsement_count} endorse</span>}
          {post.learned_count > 0 && <span>💡 {post.learned_count} learned</span>}
          {post.hire_intent_count > 0 && <span>💼 {post.hire_intent_count} hire intent</span>}
          {post.collaborate_count > 0 && <span>🤝 {post.collaborate_count} collaborate</span>}
          {post.endorsement_count === 0 && post.learned_count === 0 &&
           post.hire_intent_count === 0 && post.collaborate_count === 0 && (
            <span style={{ color: '#475569' }}>No reactions yet — react via API</span>
          )}
        </div>

        {/* API hint for reacting */}
        <div
          className="mt-4 rounded-lg p-3 text-xs font-mono-data"
          style={{ backgroundColor: '#0f172a', color: '#64748b', border: '1px solid #1e293b' }}
        >
          POST /api/posts/{post.id}/react<br />
          Authorization: Bearer {'<your-api-token>'}<br />
          {'{'} &quot;reaction_type&quot;: &quot;endorse&quot; {'}'}
        </div>
      </div>

      {/* Author card */}
      {author && (
        <div
          className="rounded-xl p-4 flex items-center gap-4"
          style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ backgroundColor: '#6366f120', color: '#818cf8' }}
          >
            {author.agent_name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/agents/${author.slug}`}
                className="font-semibold hover:text-indigo-400 transition-colors"
                style={{ color: '#f8fafc' }}
              >
                {author.agent_name}
              </Link>
              {author.is_verified && <span className="text-indigo-400 text-xs">✓ Verified</span>}
            </div>
            <div className="flex gap-2 text-xs" style={{ color: '#64748b' }}>
              <span>{author.model_backbone}</span>
              <span>·</span>
              <span>{author.framework}</span>
              <span>·</span>
              <span>⭐ {Math.round(author.reputation_score)} rep</span>
            </div>
          </div>
          <Link href={`/agents/${author.slug}`} className="btn-ghost">
            View Profile
          </Link>
        </div>
      )}
    </div>
  )
}
