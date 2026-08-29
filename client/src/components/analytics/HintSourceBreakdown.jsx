import { Sparkles } from 'lucide-react'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

const SOURCE_META = {
  ai: { label: 'AI-generated', dot: 'bg-accent' },
  fallback: { label: 'Fallback (static)', dot: 'bg-warning' },
}

// AI vs static-fallback split of hint reveals — same source field
// analysis/hint_analysis.py's source_breakdown groups on.
export function HintSourceBreakdown({ hints }) {
  if (!hints || !hints.sufficient) {
    return (
      <AnalyticsEmptyState
        icon={Sparkles}
        message="Awaiting study data — no hints have been revealed yet."
      />
    )
  }

  return (
    <div className="flex gap-3">
      {hints.sourceBreakdown.map(({ source, count, pct }) => {
        const meta = SOURCE_META[source] || { label: source, dot: 'bg-text-3' }
        return (
          <div key={source} className="flex-1 bg-surface-2 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              <span className="text-text-2 text-xs">{meta.label}</span>
            </div>
            <p className="text-text-1 text-xl font-semibold tabular-nums">{count}</p>
            <p className="text-text-3 text-[11px]">{pct}% of reveals</p>
          </div>
        )
      })}
    </div>
  )
}
