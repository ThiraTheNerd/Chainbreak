import { Lightbulb } from 'lucide-react'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

// Deepest-tier-reached distribution — same buckets as
// analysis/hint_analysis.py's depth_bucket()/TIER_BUCKET_ORDER.
export function HintDepthChart({ hints }) {
  if (!hints || !hints.sufficient) {
    return (
      <AnalyticsEmptyState
        icon={Lightbulb}
        message="Awaiting study data — no hints have been revealed yet."
      />
    )
  }

  const { depthDistribution, uptake } = hints
  const max = Math.max(...depthDistribution.map((d) => d.participants), 1)

  return (
    <div>
      <p className="text-text-2 text-xs mb-4">
        {uptake.used} of {uptake.totalParticipants} participant{uptake.totalParticipants === 1 ? '' : 's'} used
        at least one hint{uptake.pct !== null ? ` (${uptake.pct}%)` : ''}.
      </p>
      <div className="space-y-3">
        {depthDistribution.map(({ bucket, participants }) => (
          <div key={bucket}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-2">{bucket}</span>
              <span className="font-mono text-text-1">{participants}</span>
            </div>
            <div className="h-2 bg-surface-2 rounded-sm overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-700"
                style={{ width: `${(participants / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
