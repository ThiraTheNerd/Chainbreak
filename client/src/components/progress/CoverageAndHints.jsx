import { ShieldCheck, Lightbulb } from 'lucide-react'
import { ProgressEmptyState } from './ProgressEmptyState'

const TIER_LABELS = { 1: 'Tier 1 · nudge', 2: 'Tier 2 · direction', 3: 'Tier 3 · walkthrough' }

function OwaspCoverage({ owaspCoverage }) {
  if (!owaspCoverage || owaspCoverage.length === 0) {
    return (
      <ProgressEmptyState
        icon={ShieldCheck}
        message="No web-layer (OWASP) flags solved yet."
        cta={false}
      />
    )
  }
  const max = Math.max(...owaspCoverage.map(c => c.count))
  return (
    <div className="flex flex-col gap-2.5">
      {owaspCoverage.map(c => (
        <div key={c.category} className="flex items-center gap-3 text-sm">
          <span className="text-text-2 flex-1 truncate" title={c.category}>{c.category}</span>
          <div className="w-24 h-1.5 rounded-full bg-surface-2 overflow-hidden flex-shrink-0">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${(c.count / max) * 100}%` }}
            />
          </div>
          <span className="text-text-1 font-medium tabular-nums w-4 text-right">{c.count}</span>
        </div>
      ))}
    </div>
  )
}

function HintBreakdown({ hintTierBreakdown, hintCount }) {
  if (!hintCount) {
    return (
      <ProgressEmptyState
        icon={Lightbulb}
        message="No hints used yet."
        cta={false}
      />
    )
  }
  return (
    <div className="flex flex-col gap-2.5">
      {hintTierBreakdown.map(t => (
        <div key={t.tier} className="flex items-center justify-between text-sm">
          <span className="text-text-2">{TIER_LABELS[t.tier] || `Tier ${t.tier}`}</span>
          <span className="text-text-1 font-medium tabular-nums">
            {t.count} · <span className="text-warning">−{t.spent} XP</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function CoverageAndHints({ owaspCoverage, hintTierBreakdown, hintCount }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-text-1 text-sm font-medium mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-accent" /> OWASP coverage
        </h3>
        <OwaspCoverage owaspCoverage={owaspCoverage} />
      </div>
      <div>
        <h3 className="text-text-1 text-sm font-medium mb-3 flex items-center gap-2">
          <Lightbulb size={15} className="text-warning" /> Hint usage by tier
        </h3>
        <HintBreakdown hintTierBreakdown={hintTierBreakdown} hintCount={hintCount} />
      </div>
    </div>
  )
}
