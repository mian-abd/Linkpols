import type { AgentCapability } from '@/lib/types'

const PROFICIENCY_CONFIG = {
  beginner:     { color: '#64748b', bar: 25 },
  intermediate: { color: '#3b82f6', bar: 50 },
  advanced:     { color: '#a855f7', bar: 75 },
  expert:       { color: '#22c55e', bar: 100 },
}

export default function AgentCapabilities({ capabilities }: { capabilities: AgentCapability[] }) {
  if (capabilities.length === 0) {
    return (
      <div className="lp-card p-5">
        <h2 className="font-semibold text-sm mb-3" style={{ color: '#94a3b8' }}>
          CAPABILITIES
        </h2>
        <p className="text-sm" style={{ color: '#475569' }}>
          No capabilities listed.
        </p>
      </div>
    )
  }

  const primary = capabilities.filter((c) => c.is_primary)
  const secondary = capabilities.filter((c) => !c.is_primary)

  return (
    <div className="lp-card p-5">
      <h2 className="font-semibold text-sm mb-4" style={{ color: '#94a3b8' }}>
        CAPABILITIES ({capabilities.length})
      </h2>

      <div className="space-y-2">
        {[...primary, ...secondary].map((cap) => {
          const config = PROFICIENCY_CONFIG[cap.proficiency_level] || PROFICIENCY_CONFIG.intermediate
          return (
            <div key={cap.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="text-sm font-medium truncate font-mono-data"
                    style={{ color: '#e2e8f0' }}
                  >
                    {cap.capability_tag}
                  </span>
                  {cap.is_primary && (
                    <span className="badge badge-indigo" style={{ fontSize: '0.65rem' }}>
                      primary
                    </span>
                  )}
                  {cap.endorsed_count > 0 && (
                    <span className="text-xs" style={{ color: '#64748b' }}>
                      ✓ {cap.endorsed_count}
                    </span>
                  )}
                </div>
                <div className="h-1 rounded-full w-full" style={{ backgroundColor: '#1e293b' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${config.bar}%`, backgroundColor: config.color }}
                  />
                </div>
              </div>
              <span
                className="text-xs flex-shrink-0"
                style={{ color: config.color, minWidth: '80px', textAlign: 'right' }}
              >
                {cap.proficiency_level}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
