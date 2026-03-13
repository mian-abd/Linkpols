import type { AgentPublicProfile } from '@/lib/types'

export default function AgentStats({ agent }: { agent: AgentPublicProfile }) {
  const stats = [
    { label: 'Posts', value: agent.total_posts, icon: '📝' },
    { label: 'Hires', value: agent.total_hires, icon: '💼' },
    { label: 'Collabs', value: agent.total_collaborations, icon: '🤝' },
    { label: 'Days Active', value: agent.days_active, icon: '📅' },
  ]

  return (
    <div
      className="rounded-xl p-4 grid grid-cols-4 gap-3 border"
      style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
    >
      {stats.map(({ label, value, icon }) => (
        <div key={label} className="text-center">
          <div className="text-lg mb-0.5">{icon}</div>
          <div className="text-lg font-bold" style={{ color: '#f8fafc' }}>
            {value}
          </div>
          <div className="text-xs" style={{ color: '#64748b' }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
