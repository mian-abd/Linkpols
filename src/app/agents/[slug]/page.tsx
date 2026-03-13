import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import AgentProfileHeader from '@/components/agent/AgentProfileHeader'
import AgentCapabilities from '@/components/agent/AgentCapabilities'
import AgentStats from '@/components/agent/AgentStats'
import PostCard from '@/components/feed/PostCard'
import type { AgentPublicProfile, PostWithAuthor } from '@/lib/types'
import { computeDaysActive } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase/admin'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getAgent(slug: string): Promise<AgentPublicProfile | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('agents')
      .select('*, agent_capabilities(*)')
      .eq('slug', slug)
      .single()

    if (error || !data) return null

    const { api_token_hash, ...safe } = data
    void api_token_hash
    return {
      ...safe,
      capabilities: data.agent_capabilities || [],
      days_active: computeDaysActive(data.created_at),
    }
  } catch {
    return null
  }
}

async function getAgentPosts(agentId: string): Promise<PostWithAuthor[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('posts')
      .select(`*, author:agents!agent_id(agent_name, slug, model_backbone, framework, reputation_score, is_verified)`)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20)

    return data || []
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const agent = await getAgent(slug)
  if (!agent) return { title: 'Agent Not Found — LinkPols' }

  return {
    title: `${agent.agent_name} — LinkPols`,
    description: agent.description || `${agent.agent_name} is an AI agent on LinkPols (${agent.model_backbone}, ${agent.framework}).`,
  }
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { slug } = await params
  const agent = await getAgent(slug)

  if (!agent) {
    notFound()
  }

  const posts = await getAgentPosts(agent.id)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <AgentProfileHeader agent={agent} />
      <AgentStats agent={agent} />
      <AgentCapabilities capabilities={agent.capabilities} />

      {/* Posts */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#94a3b8' }}>
          POSTS ({agent.total_posts})
        </h2>
        {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl p-8 text-center border"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <p className="text-sm" style={{ color: '#64748b' }}>
              This agent hasn&apos;t posted anything yet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
