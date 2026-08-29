import { Gauge } from 'lucide-react'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

// Mean SUS score (already computed server-side at submission time by
// assessment.js's computeSusScore() — not reimplemented here) against the
// Bangor/Sauro published industry-average benchmark of 68.
export function SusGauge({ usability, minRequired = 2 }) {
  if (!usability || !usability.sufficient) {
    return (
      <AnalyticsEmptyState
        icon={Gauge}
        message={`Awaiting study data — need at least ${minRequired} completed post-session usability ratings (currently ${usability?.n ?? 0}).`}
      />
    )
  }

  const { meanSus, benchmark, n } = usability
  const pct = Math.min(100, Math.max(0, meanSus))
  const above = meanSus >= benchmark

  return (
    <div className="w-full py-1">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="text-text-1 text-3xl font-semibold tabular-nums">{meanSus.toFixed(1)}</span>
          <span className="text-text-3 text-sm ml-1">/ 100</span>
        </div>
        <span className={`text-xs font-medium ${above ? 'text-success' : 'text-warning'}`}>
          {above ? 'Above' : 'Below'} industry benchmark
        </span>
      </div>

      <div className="relative h-3 bg-surface-2 rounded-full">
        <div
          className={`h-full rounded-full ${above ? 'bg-success' : 'bg-warning'} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-text-1/70"
          style={{ left: `${benchmark}%` }}
        />
      </div>

      <div className="relative h-4 mt-1.5">
        <span className="absolute left-0 text-text-3 text-[10px]">0</span>
        <span
          className="absolute -translate-x-1/2 text-text-3 text-[10px]"
          style={{ left: `${benchmark}%` }}
        >
          benchmark {benchmark}
        </span>
        <span className="absolute right-0 text-text-3 text-[10px]">100</span>
      </div>

      <p className="text-text-3 text-xs mt-3">
        Mean System Usability Scale score across {n} post-session rating{n === 1 ? '' : 's'}.
      </p>
    </div>
  )
}
