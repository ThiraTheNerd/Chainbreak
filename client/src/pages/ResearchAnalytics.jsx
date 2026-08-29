import { FlaskConical, Users, TrendingUp, Gauge as GaugeIcon, Lightbulb, XCircle } from 'lucide-react'
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics'
import { StatCard } from '@/components/dashboard/StatCard'
import { SectionCard } from '@/components/progress/SectionCard'
import { LearningGainChart } from '@/components/analytics/LearningGainChart'
import { SusGauge } from '@/components/analytics/SusGauge'
import { HintDepthChart } from '@/components/analytics/HintDepthChart'
import { HintSourceBreakdown } from '@/components/analytics/HintSourceBreakdown'

// Admin-only, read-only research analytics over REAL data (GET
// /api/admin/analytics — gated the same way as the existing hint research
// export, GET /api/hints/research; see server/routes/admin.js). Every
// number rendered here is a live DB aggregate computed the same way the
// Python pipeline in analysis/ computes it — see
// server/services/analytics.service.js for the metric-by-metric mapping.
// This page never fabricates a value: insufficient real data renders as an
// honest "awaiting study data" state, never a zeroed or placeholder chart.
export function ResearchAnalytics() {
  const { data, isLoading, isError, error, refetch } = useAdminAnalytics()

  const domains = data?.rq1?.domains
  const totalDomain = domains?.total
  const usability = data?.usability
  const hints = data?.hints

  return (
    <div className="p-5 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 text-accent text-xs uppercase tracking-[0.2em] font-mono">
          <FlaskConical size={15} /> Research Analytics
        </div>
        <h1 className="text-2xl font-semibold mt-2">Study results, live from real data</h1>
        <p className="text-text-2 text-sm mt-1 max-w-2xl">
          Read-only aggregates computed from the assessments and hint-usage tables, using the same
          math as the offline analysis pipeline (<code className="text-text-3">analysis/</code>). Aggregated
          and anonymised — no participant identities appear here.
        </p>
      </header>

      {isError && (
        <div className="border border-danger/40 bg-danger/10 text-danger rounded-lg p-4 flex items-center gap-3 text-sm">
          <XCircle size={18} />
          {error?.message || 'Failed to load analytics.'}
          <button className="ml-auto underline" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {/* Summary stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Complete pre/post pairs"
          value={isLoading ? '—' : totalDomain?.n ?? 0}
          subtext="Participants with both assessments"
          icon={Users}
          iconColor="text-accent"
        />
        <StatCard
          label="Mean normalised gain (g)"
          value={isLoading ? '—' : totalDomain?.normGain !== null && totalDomain?.normGain !== undefined ? totalDomain.normGain.toFixed(2) : '—'}
          subtext="Total knowledge score, Hake's g"
          icon={TrendingUp}
          iconColor="text-success"
        />
        <StatCard
          label="Mean SUS score"
          value={isLoading ? '—' : usability?.meanSus ?? '—'}
          subtext={usability?.n ? `of 100 · ${usability.n} rating${usability.n === 1 ? '' : 's'}` : 'of 100'}
          icon={GaugeIcon}
          iconColor="text-purple"
        />
        <StatCard
          label="Hint uptake"
          value={isLoading ? '—' : hints?.uptake?.pct !== null && hints?.uptake?.pct !== undefined ? `${hints.uptake.pct}%` : '—'}
          subtext={hints?.uptake ? `${hints.uptake.used} of ${hints.uptake.totalParticipants} participants` : 'No hints revealed yet'}
          icon={Lightbulb}
          iconColor="text-warning"
        />
      </div>

      {/* RQ1 — learning gain */}
      <SectionCard title="RQ1 — Learning gain by domain" icon={TrendingUp}>
        {isLoading
          ? <div className="h-[220px] bg-surface-2 rounded animate-pulse" />
          : <LearningGainChart domains={domains} minPairsRequired={data?.rq1?.minPairsRequired} />
        }
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RQ1 usability — SUS */}
        <SectionCard title="RQ1 — Usability (SUS)" icon={GaugeIcon}>
          {isLoading
            ? <div className="h-[140px] bg-surface-2 rounded animate-pulse" />
            : <SusGauge usability={usability} />
          }
        </SectionCard>

        {/* RQ3 — hint usage */}
        <SectionCard
          title="RQ3 — Hint usage"
          icon={Lightbulb}
          right={<span className="text-[10px] text-text-3 uppercase tracking-wide">Exploratory</span>}
        >
          {isLoading
            ? <div className="h-[140px] bg-surface-2 rounded animate-pulse" />
            : (
              <div className="space-y-4">
                <HintDepthChart hints={hints} />
                <HintSourceBreakdown hints={hints} />
                <p className="text-text-3 text-[11px] border-t border-border pt-3">
                  Descriptive / exploratory only — this study has no hint/no-hint control group and a
                  small sample, so usage patterns here are not evidence that hints caused, helped, or
                  hurt learning.
                </p>
              </div>
            )
          }
        </SectionCard>
      </div>
    </div>
  )
}
