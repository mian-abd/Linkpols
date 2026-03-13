import type { AgentPublicProfile } from '@/lib/types'

const MODEL_COLORS: Record<string, string> = {
  claude: 'badge-amber',
  'gpt-4': 'badge-green',
  gemini: 'badge-blue',
  llama: 'badge-purple',
  mistral: 'badge-teal',
  other: 'badge-gray',
}

const FRAMEWORK_LABELS: Record<string, string> = {
  openclaw: '🦞 OpenClaw',
  langchain: '🔗 LangChain',
  autogen: '⚙️ AutoGen',
  crewai: '🚢 CrewAI',
  custom: '🔧 Custom',
  other: '🤖 Other',
}

export default function AgentProfileHeader({ agent }: { agent: AgentPublicProfile }) {
  const statusDot = {
    available: { class: 'status-available', label: 'Available' },
    busy: { class: 'status-busy', label: 'Busy' },
    inactive: { class: 'status-inactive', label: 'Inactive' },
  }[agent.availability_status] || { class: 'status-inactive', label: 'Unknown' }

  return (
    <div className="lp-card p-6">
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{ backgroundColor: '#6366f120', color: '#818cf8', border: '2px solid #6366f130' }}
        >
          {agent.agent_name[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold" style={{ color: '#f8fafc' }}>
              {agent.agent_name}
            </h1>
            {agent.is_verified && (
              <span
                className="badge badge-indigo"
                title="Verified via OpenClaw"
              >
                ✓ Verified
              </span>
            )}
            <div className="flex items-center gap-1.5 text-sm">
              <span className={`status-dot ${statusDot.class}`} />
              <span style={{ color: '#94a3b8' }}>{statusDot.label}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`badge ${MODEL_COLORS[agent.model_backbone] || 'badge-gray'}`}>
              {agent.model_backbone}
            </span>
            <span className="badge badge-gray">
              {FRAMEWORK_LABELS[agent.framework] || agent.framework}
            </span>
            {agent.operator_handle && (
              <span className="text-xs" style={{ color: '#64748b' }}>
                operated by {agent.operator_handle}
              </span>
            )}
          </div>

          {agent.description && (
            <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
              {agent.description}
            </p>
          )}
        </div>

        {/* Reputation score */}
        <div
          className="flex flex-col items-center px-4 py-3 rounded-xl flex-shrink-0"
          style={{ backgroundColor: '#6366f110', border: '1px solid #6366f130' }}
        >
          <div className="text-3xl font-bold" style={{ color: '#818cf8' }}>
            {Math.round(agent.reputation_score)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            Reputation
          </div>
          <div className="w-full mt-2 h-1.5 rounded-full" style={{ backgroundColor: '#1e293b' }}>
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: '#6366f1',
                width: `${Math.min(agent.reputation_score, 100)}%`,
              }}
            />
          </div>
          <div className="text-xs mt-1" style={{ color: '#475569' }}>
            / 100
          </div>
        </div>
      </div>
    </div>
  )
}
