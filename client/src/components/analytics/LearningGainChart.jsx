import { BarChart3 } from 'lucide-react'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

const DOMAIN_ORDER = [
  { key: 'web', label: 'Web' },
  { key: 'container', label: 'Container' },
  { key: 'cloud', label: 'Cloud' },
  { key: 'total', label: 'Total' },
]

const CHART_HEIGHT = 140

// Same bands/thresholds as analysis/learning_gain.py's interpret_g().
function gainBand(g) {
  if (g === null || g === undefined) return { label: 'undefined', className: 'text-text-3' }
  if (g >= 0.7) return { label: 'high gain', className: 'text-success' }
  if (g >= 0.3) return { label: 'medium gain', className: 'text-accent' }
  if (g > 0) return { label: 'low gain', className: 'text-warning' }
  return { label: 'no/negative gain', className: 'text-danger' }
}

// Mirrors run_analysis.py's fig_prepost.png. All four domains share the
// same N (same set of complete pairs), so gating on domains.total.sufficient
// covers the whole chart.
export function LearningGainChart({ domains, minPairsRequired = 2 }) {
  const total = domains?.total

  if (!total || !total.sufficient) {
    return (
      <AnalyticsEmptyState
        icon={BarChart3}
        message={`Awaiting study data — need at least ${minPairsRequired} participants with a complete pre + post pair (currently ${total?.n ?? 0}).`}
      />
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-end justify-around gap-6" style={{ height: CHART_HEIGHT }}>
        {DOMAIN_ORDER.map(({ key, label }) => {
          const d = domains[key]
          const preH = Math.round(((d.meanPrePct ?? 0) / 100) * CHART_HEIGHT)
          const postH = Math.round(((d.meanPostPct ?? 0) / 100) * CHART_HEIGHT)
          return (
            <div key={key} className="flex flex-col items-center justify-end h-full flex-1">
              <div className="flex items-end gap-1.5">
                <div className="flex flex-col items-center">
                  <span className="text-text-3 text-[10px] mb-1 tabular-nums">
                    {Math.round(d.meanPrePct ?? 0)}%
                  </span>
                  <div className="w-5 bg-text-3/50 rounded-t-sm transition-all duration-700" style={{ height: `${preH}px` }} />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-success text-[10px] mb-1 tabular-nums">
                    {Math.round(d.meanPostPct ?? 0)}%
                  </span>
                  <div className="w-5 bg-success rounded-t-sm transition-all duration-700" style={{ height: `${postH}px` }} />
                </div>
              </div>
              <p className="text-text-1 text-xs font-medium mt-2">{label}</p>
            </div>
          )
        })}
      </div>

      <div className="flex justify-around gap-4 mt-3 pt-3 border-t border-border">
        {DOMAIN_ORDER.map(({ key }) => {
          const d = domains[key]
          const band = gainBand(d.normGain)
          return (
            <div key={key} className="flex-1 text-center">
              <p className="text-text-2 text-[11px]">
                g = <span className="tabular-nums">{d.normGain !== null ? d.normGain.toFixed(2) : '—'}</span>
              </p>
              <p className={`text-[10px] mt-0.5 ${band.className}`}>{band.label}</p>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-text-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-text-3/50 inline-block" /> Pre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-success inline-block" /> Post
        </span>
        <span>N = {total.n} complete pair{total.n === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}
