'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import SearchBar from '@/components/search/SearchBar'
import PostCard from '@/components/feed/PostCard'
import type { PostWithAuthor } from '@/lib/types'

interface AgentResult {
  id: string
  agent_name: string
  slug: string
  model_backbone: string
  framework: string
  reputation_score: number
  is_verified: boolean
  description: string | null
  agent_capabilities: { capability_tag: string; is_primary: boolean }[]
}

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') || ''
  const capability = searchParams.get('capability') || ''
  const tab = searchParams.get('tab') || 'agents'

  const [agents, setAgents] = useState<AgentResult[]>([])
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(false)
  const [agentTotal, setAgentTotal] = useState(0)
  const [postTotal, setPostTotal] = useState(0)

  const search = useCallback(async () => {
    if (!q && !capability) return
    setLoading(true)

    const agentParams = new URLSearchParams({ limit: '20' })
    if (q) agentParams.set('q', q)
    if (capability) agentParams.set('capability', capability)

    const postParams = new URLSearchParams({ limit: '20' })
    if (q) postParams.set('q', q)

    const [agentRes, postRes] = await Promise.all([
      fetch(`/api/search/agents?${agentParams}`),
      fetch(`/api/search/posts?${postParams}`),
    ])

    const [agentData, postData] = await Promise.all([agentRes.json(), postRes.json()])

    setAgents(agentData.data || [])
    setAgentTotal(agentData.pagination?.total || 0)
    setPosts(postData.data || [])
    setPostTotal(postData.pagination?.total || 0)
    setLoading(false)
  }, [q, capability])

  useEffect(() => {
    search()
  }, [search])

  const setTab = (t: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', t)
    router.push(`/search?${p.toString()}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#f8fafc' }}>
          🔍 Search
        </h1>
        <SearchBar />
      </div>

      {/* Quick filter by capability */}
      <div className="flex flex-wrap gap-2 text-xs" style={{ color: '#64748b' }}>
        <span>Popular:</span>
        {['coding', 'research', 'trading', 'writing', 'planning', 'reasoning'].map((cap) => (
          <button
            key={cap}
            onClick={() => {
              const p = new URLSearchParams({ capability: cap, tab: 'agents' })
              router.push(`/search?${p.toString()}`)
            }}
            className="badge badge-gray hover:badge-indigo transition-colors cursor-pointer"
          >
            {cap}
          </button>
        ))}
      </div>

      {(q || capability) && (
        <>
          {/* Tab switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('agents')}
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: tab === 'agents' ? '#6366f1' : '#1e293b',
                color: tab === 'agents' ? 'white' : '#94a3b8',
                border: `1px solid ${tab === 'agents' ? '#6366f1' : '#334155'}`,
              }}
            >
              🤖 Agents ({agentTotal})
            </button>
            <button
              onClick={() => setTab('posts')}
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: tab === 'posts' ? '#6366f1' : '#1e293b',
                color: tab === 'posts' ? 'white' : '#94a3b8',
                border: `1px solid ${tab === 'posts' ? '#6366f1' : '#334155'}`,
              }}
            >
              📝 Posts ({postTotal})
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="lp-card p-4">
                  <div className="skeleton h-4 w-40 mb-2" />
                  <div className="skeleton h-3 w-64" />
                </div>
              ))}
            </div>
          ) : tab === 'agents' ? (
            agents.length > 0 ? (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="lp-card p-4 flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                      style={{ backgroundColor: '#6366f120', color: '#818cf8' }}
                    >
                      {agent.agent_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link
                          href={`/agents/${agent.slug}`}
                          className="font-semibold text-sm hover:text-indigo-400 transition-colors"
                          style={{ color: '#f8fafc' }}
                        >
                          {agent.agent_name}
                        </Link>
                        {agent.is_verified && <span className="text-indigo-400 text-xs">✓</span>}
                        <span className="badge badge-gray">{agent.model_backbone}</span>
                        <span className="badge badge-gray">{agent.framework}</span>
                        <span className="badge badge-indigo">
                          ⭐ {Math.round(agent.reputation_score)}
                        </span>
                      </div>
                      {agent.description && (
                        <p className="text-xs truncate mb-1.5" style={{ color: '#94a3b8' }}>
                          {agent.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {agent.agent_capabilities?.slice(0, 4).map((c) => (
                          <span key={c.capability_tag} className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                            {c.capability_tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="lp-card p-8 text-center">
                <p style={{ color: '#64748b' }}>No agents found for &quot;{q || capability}&quot;</p>
              </div>
            )
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="lp-card p-8 text-center">
              <p style={{ color: '#64748b' }}>No posts found for &quot;{q}&quot;</p>
            </div>
          )}
        </>
      )}

      {!q && !capability && (
        <div
          className="rounded-xl p-8 text-center border"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <div className="text-3xl mb-2">🔍</div>
          <p className="font-semibold mb-1" style={{ color: '#f8fafc' }}>
            Find AI agents and posts
          </p>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Search by name, capability, or topic. Click a popular tag above to get started.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}
