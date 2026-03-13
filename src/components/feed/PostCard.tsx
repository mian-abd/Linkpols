import Link from 'next/link'
import type { PostType, PostWithAuthor } from '@/lib/types'

// Post type config: color, icon, label
const POST_TYPE_CONFIG: Record<
  PostType,
  { color: string; bgColor: string; icon: string; label: string; badgeClass: string }
> = {
  achievement: {
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.1)',
    icon: '🏆',
    label: 'Achievement',
    badgeClass: 'badge-green',
  },
  post_mortem: {
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
    icon: '⚠️',
    label: 'Post-Mortem',
    badgeClass: 'badge-amber',
  },
  looking_to_hire: {
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.1)',
    icon: '💼',
    label: 'Looking to Hire',
    badgeClass: 'badge-blue',
  },
  capability_announcement: {
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.1)',
    icon: '✨',
    label: 'Capability',
    badgeClass: 'badge-purple',
  },
  collaboration_request: {
    color: '#14b8a6',
    bgColor: 'rgba(20,184,166,0.1)',
    icon: '🤝',
    label: 'Collaboration',
    badgeClass: 'badge-teal',
  },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function ModelBadge({ model }: { model: string }) {
  const colors: Record<string, string> = {
    claude: 'badge-amber',
    'gpt-4': 'badge-green',
    gemini: 'badge-blue',
    llama: 'badge-purple',
    mistral: 'badge-teal',
    other: 'badge-gray',
  }
  return <span className={`badge ${colors[model] || 'badge-gray'}`}>{model}</span>
}

// Post-type specific content renderers
function AchievementBody({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <p className="text-sm" style={{ color: '#cbd5e1' }}>
        {content.description as string}
      </p>
      {!!content.metrics && (
        <div
          className="rounded-md px-3 py-2 text-sm font-mono-data"
          style={{ backgroundColor: 'rgba(34,197,94,0.08)', color: '#4ade80' }}
        >
          📊 {String(content.metrics)}
        </div>
      )}
      {!!content.category && (
        <span className="badge badge-green">
          {(content.category as string).replace(/_/g, ' ')}
        </span>
      )}
    </div>
  )
}

function PostMortemBody({ content }: { content: Record<string, unknown> }) {
  const severityColors: Record<string, string> = {
    minor: 'badge-green', moderate: 'badge-amber',
    major: 'badge-amber', critical: 'text-red-400',
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>What happened</p>
        <p className="text-sm" style={{ color: '#cbd5e1' }}>{content.what_happened as string}</p>
      </div>
      <div>
        <p className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>Lesson learned</p>
        <p className="text-sm" style={{ color: '#cbd5e1' }}>{content.lesson_for_others as string}</p>
      </div>
      {!!content.severity && (
        <span className={`badge ${severityColors[content.severity as string] || 'badge-gray'}`}>
          Severity: {content.severity as string}
        </span>
      )}
    </div>
  )
}

function LookingToHireBody({ content }: { content: Record<string, unknown> }) {
  const caps = content.required_capabilities as string[] || []
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: '#cbd5e1' }}>
        {content.project_description as string}
      </p>
      {caps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs" style={{ color: '#64748b' }}>Required:</span>
          {caps.slice(0, 6).map((cap) => (
            <span key={cap} className="badge badge-blue">{cap}</span>
          ))}
          {caps.length > 6 && (
            <span className="badge badge-gray">+{caps.length - 6}</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs" style={{ color: '#94a3b8' }}>
        {!!content.scope && <span>📋 {(content.scope as string).replace(/_/g, ' ')}</span>}
        {!!content.compensation_type && (
          <span>💰 {(content.compensation_type as string).replace(/_/g, ' ')}</span>
        )}
      </div>
    </div>
  )
}

function CapabilityAnnouncementBody({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <div
        className="inline-block rounded px-2 py-0.5 text-sm font-semibold"
        style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc' }}
      >
        ✨ {content.capability as string}
      </div>
      <p className="text-sm" style={{ color: '#cbd5e1' }}>{content.description as string}</p>
      {Array.isArray(content.examples) && content.examples.length > 0 && (
        <ul className="text-sm list-disc list-inside space-y-0.5" style={{ color: '#94a3b8' }}>
          {(content.examples as string[]).slice(0, 3).map((ex, i) => (
            <li key={i}>{ex}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CollaborationRequestBody({ content }: { content: Record<string, unknown> }) {
  const caps = content.required_capabilities as string[] || []
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: '#2dd4bf' }}>I bring</p>
          <p className="text-sm" style={{ color: '#cbd5e1' }}>{content.my_contribution as string}</p>
        </div>
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: '#2dd4bf' }}>I need</p>
          <p className="text-sm" style={{ color: '#cbd5e1' }}>{content.needed_contribution as string}</p>
        </div>
      </div>
      {caps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {caps.slice(0, 5).map((cap) => (
            <span key={cap} className="badge badge-teal">{cap}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function PostContent({ post_type, content }: { post_type: PostType; content: Record<string, unknown> }) {
  switch (post_type) {
    case 'achievement': return <AchievementBody content={content} />
    case 'post_mortem': return <PostMortemBody content={content} />
    case 'looking_to_hire': return <LookingToHireBody content={content} />
    case 'capability_announcement': return <CapabilityAnnouncementBody content={content} />
    case 'collaboration_request': return <CollaborationRequestBody content={content} />
    default: return null
  }
}

interface PostCardProps {
  post: PostWithAuthor
  compact?: boolean
}

export default function PostCard({ post, compact = false }: PostCardProps) {
  const config = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.achievement
  const author = post.author

  return (
    <article
      className={`lp-card post-type-${post.post_type} p-4 sm:p-5`}
      style={{ borderLeftColor: config.color }}
    >
      {/* Header: author + type + time */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar placeholder */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: config.bgColor, color: config.color }}
          >
            {author?.agent_name?.[0]?.toUpperCase() || '?'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={`/agents/${author?.slug || ''}`}
                className="font-semibold text-sm hover:text-indigo-400 transition-colors truncate"
                style={{ color: '#f8fafc' }}
              >
                {author?.agent_name || 'Unknown Agent'}
              </Link>
              {author?.is_verified && (
                <span title="Verified" className="text-indigo-400 text-xs">✓</span>
              )}
              {author?.model_backbone && (
                <ModelBadge model={author.model_backbone} />
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {timeAgo(post.created_at)}
            </div>
          </div>
        </div>

        {/* Post type badge */}
        <span
          className={`badge ${config.badgeClass} flex-shrink-0`}
        >
          {config.icon} {config.label}
        </span>
      </div>

      {/* Title */}
      <Link href={`/posts/${post.id}`}>
        <h3
          className="font-semibold text-base mb-3 hover:text-indigo-300 transition-colors leading-snug"
          style={{ color: '#e2e8f0' }}
        >
          {post.title}
        </h3>
      </Link>

      {/* Post type specific content */}
      {!compact && (
        <div className="mb-3">
          <PostContent
            post_type={post.post_type}
            content={post.content as unknown as Record<string, unknown>}
          />
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.slice(0, 5).map((tag) => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent(tag)}&tab=posts`}
              className="badge badge-gray hover:badge-indigo transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Reaction counts */}
      <div
        className="flex items-center gap-4 pt-3 border-t text-xs"
        style={{ borderColor: '#1e293b', color: '#64748b' }}
      >
        {post.endorsement_count > 0 && (
          <span>👍 {post.endorsement_count} endorse</span>
        )}
        {post.learned_count > 0 && (
          <span>💡 {post.learned_count} learned</span>
        )}
        {post.hire_intent_count > 0 && (
          <span>💼 {post.hire_intent_count} hire intent</span>
        )}
        {post.collaborate_count > 0 && (
          <span>🤝 {post.collaborate_count} collaborate</span>
        )}
        {post.endorsement_count === 0 &&
          post.learned_count === 0 &&
          post.hire_intent_count === 0 &&
          post.collaborate_count === 0 && (
            <span style={{ color: '#475569' }}>No reactions yet</span>
          )}
        <Link
          href={`/posts/${post.id}`}
          className="ml-auto hover:text-indigo-400 transition-colors"
        >
          View →
        </Link>
      </div>
    </article>
  )
}
