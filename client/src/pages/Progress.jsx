import { useEffect, useMemo, useState } from 'react'
import { Zap, Flag, CheckCircle2, Clock, Lightbulb, PieChart, TrendingUp, Layers, History, ShieldCheck } from 'lucide-react'
import { useChallenges } from '@/hooks/useChallenges'
import { useScores } from '@/hooks/useScores'
import { useProgress } from '@/hooks/useProgress'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/dashboard/StatCard'
import { SectionCard } from '@/components/progress/SectionCard'
import { FlagDonutChart } from '@/components/progress/FlagDonutChart'
import { XpTrendChart } from '@/components/progress/XpTrendChart'
import { LayerMasteryRings } from '@/components/progress/LayerMasteryRings'
import { CoverageAndHints } from '@/components/progress/CoverageAndHints'
import { RecentActivity } from '@/components/progress/RecentActivity'
import { timeAgo, shortDate } from '@/lib/time'

// Every number here comes from existing repositories/services (useScores,
// useChallenges) plus GET /api/progress/me for shapes nothing else exposes
// (time series, OWASP/hint-tier breakdowns, last-active) — see
// server/services/progress.service.js, which reuses the same scoring and
// per-layer state rather than recomputing it, so nothing here can drift
// from numbers shown elsewhere in the app.
export function Progress() {
  const { user } = useAuth()
  const { data: challengeData, isLoading: loadingChallenges } = useChallenges()
  const { data: scoreData, isLoading: loadingScores } = useScores()
  const { data: progress, isLoading: loadingProgress, isError: progressError } = useProgress()

  const modules = challengeData?.modules || []
  const totalModules = modules.length
  const modulesComplete = useMemo(
    () => modules.filter(m => m.allSolved).length,
    [modules]
  )

  const loading = loadingChallenges || loadingScores || loadingProgress
  const xp = scoreData?.score ?? 0
  const rawXp = scoreData?.rawScore ?? 0
  const totalSpend = (scoreData?.unlockSpend ?? 0) + (scoreData?.hintSpend ?? 0)

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const hour = now.getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const messages = {
    morning: 'The best time to break something is before your coffee gets cold. Ready to chain your first exploit today?',
    afternoon: "Attackers don't take lunch breaks — but you've earned one. Pick up where you left off and keep the chain going.",
    evening: 'The quiet hours are when the real hacking happens. Fire up a session and see how far the chain goes tonight.',
  }
  const firstName = user?.firstName || user?.first_name || user?.name?.split(' ')[0] || user?.username
  const avatarUrl = user?.avatar || user?.avatarUrl
  const initials = (firstName || 'CB').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,_rgba(56,139,253,0.12),_transparent_34%),radial-gradient(circle_at_20%_15%,_rgba(46,160,67,0.06),_transparent_28%)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1240px] mx-auto">
        <div className="relative overflow-hidden bg-surface border border-border rounded-2xl p-5 sm:p-7 mb-6">
          <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full border-[24px] border-accent/10" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-accent text-xs font-medium uppercase tracking-[0.18em] mb-3">
                <ShieldCheck size={15} />
                Progress centre
              </div>
              <h1 className="text-text-1 text-2xl sm:text-3xl font-semibold tracking-tight">
                Good {timeOfDay}{firstName ? `, ${firstName}` : ''} 👋
              </h1>
              <p className="text-text-2 text-sm sm:text-base leading-6 mt-2">
                {messages[timeOfDay]}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="Profile" className="w-14 h-14 rounded-2xl object-cover border border-border-2" />
                : <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-lg font-semibold">
                    {initials}
                  </div>
              }
              <div>
                <p className="text-text-1 font-medium">{firstName || 'Learner'}</p>
                <p className="text-text-3 text-xs mt-0.5">{user?.role || 'Security learner'}</p>
              </div>
            </div>
          </div>
        </div>

      {progressError && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-danger text-sm mb-4">
          Failed to load progress data. Make sure the backend server is running.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Total XP"
          value={loading ? '—' : xp.toLocaleString()}
          subtext={totalSpend > 0 ? `${rawXp} raw − ${totalSpend} spent` : 'No deductions'}
          icon={Zap}
          iconColor="text-accent"
        />
        <StatCard
          label="Flags captured"
          value={loading ? '—' : progress?.flagsCaptured ?? 0}
          subtext={`of ${progress?.totalFlags ?? 0} total`}
          icon={Flag}
          iconColor="text-accent"
        />
        <StatCard
          label="Challenges complete"
          value={loading ? '—' : modulesComplete}
          subtext={`of ${totalModules} modules`}
          icon={CheckCircle2}
          iconColor="text-success"
        />
        <StatCard
          label="Last active"
          value={loading ? '—' : timeAgo(progress?.lastActiveAt)}
          subtext={progress?.lastActiveAt ? shortDate(progress.lastActiveAt) : 'No activity yet'}
          icon={Clock}
          iconColor="text-purple"
        />
        <StatCard
          label="Hints used"
          value={loading ? '—' : progress?.hintCount ?? 0}
          subtext={`−${progress?.hintSpend ?? 0} XP total`}
          icon={Lightbulb}
          iconColor="text-warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <SectionCard title="Flags by layer" icon={PieChart} className="lg:col-span-2">
          {loading
            ? <div className="h-[160px] flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-surface-2 animate-pulse" />
              </div>
            : <FlagDonutChart flagsByLayer={progress?.flagsByLayer} />
          }
        </SectionCard>

        <SectionCard title="XP over time" icon={TrendingUp} className="lg:col-span-3">
          {loading
            ? <div className="h-[180px] bg-surface-2 rounded animate-pulse" />
            : <XpTrendChart timeSeries={progress?.timeSeries} />
          }
        </SectionCard>
      </div>

      <SectionCard title="Per-layer mastery" icon={Layers} className="mb-4">
        {loading
          ? <div className="h-24 bg-surface-2 rounded animate-pulse" />
          : <LayerMasteryRings flagsByLayer={progress?.flagsByLayer} />
        }
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <SectionCard title="Learning behaviour" className="lg:col-span-3">
          {loading
            ? <div className="h-32 bg-surface-2 rounded animate-pulse" />
            : <CoverageAndHints
                owaspCoverage={progress?.owaspCoverage}
                hintTierBreakdown={progress?.hintTierBreakdown}
                hintCount={progress?.hintCount}
              />
          }
        </SectionCard>

        <SectionCard title="Recent activity" icon={History} className="lg:col-span-2">
          {loading
            ? <div className="h-32 bg-surface-2 rounded animate-pulse" />
            : <RecentActivity recentActivity={progress?.recentActivity} />
          }
        </SectionCard>
      </div>
    </div>
    </div>
  )
}
