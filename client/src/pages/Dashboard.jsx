import { useMemo } from 'react'
import { Flag, CheckCircle2, Lightbulb } from 'lucide-react'
import { useChallenges } from '@/hooks/useChallenges'
import { useScores }     from '@/hooks/useScores'
import { StatCard }      from '@/components/dashboard/StatCard'
import { XpRing }        from '@/components/dashboard/XpRing'
import { ChallengeCard } from '@/components/dashboard/ChallengeCard'
import { ChallengeSkeleton } from '@/components/dashboard/ChallengeSkeleton'

export function Dashboard() {
  const { data: challengeData, isLoading: loadingChallenges, isError } = useChallenges()
  const { data: scoreData, isLoading: loadingScores } = useScores()

  const modules = challengeData?.modules || []

  const totalFlags   = challengeData?.raw?.length ?? 0
  const totalModules = modules.length

  const flagsCaptured = useMemo(() => {
    if (!challengeData?.raw) return 0
    return challengeData.raw.filter(c => c.solved).length
  }, [challengeData])

  const modulesComplete = useMemo(
    () => modules.filter(m => m.allSolved).length,
    [modules]
  )

  const score = scoreData?.score || 0

  return (
    <div className="p-6 max-w-[1200px] mx-auto">

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-text-1 text-2xl font-semibold">Challenges</h1>
          <p className="text-text-2 text-sm mt-0.5">
            {totalModules} modules · three layers each · full attack kill chain
          </p>
        </div>
        <div className="pt-1">
          {loadingScores
            ? <div className="w-40 h-10 bg-surface-2 rounded animate-pulse" />
            : <XpRing score={score} solvedCount={flagsCaptured}
                      totalPossible={totalFlags} />
          }
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Flags captured"
          value={loadingChallenges ? '—' : flagsCaptured}
          subtext={`of ${totalFlags}`}
          icon={Flag}
          iconColor="text-accent"
        />
        <StatCard
          label="Challenges complete"
          value={loadingChallenges ? '—' : modulesComplete}
          subtext={`of ${totalModules} modules`}
          icon={CheckCircle2}
          iconColor="text-success"
        />
        <StatCard
          label="Hints used"
          value="0"
          subtext="−0 XP total"
          icon={Lightbulb}
          iconColor="text-warning"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-text-1 font-medium">Challenge modules</h2>
        <span className="text-text-3 text-xs">
          {totalModules} modules · updated just now
        </span>
      </div>

      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl
                        p-4 text-danger text-sm mb-4">
          Failed to load challenges. Make sure the backend server is running.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {loadingChallenges
          ? Array.from({ length: 4 }).map((_, i) => (
              <ChallengeSkeleton key={i} />
            ))
          : modules.map(module => (
              <ChallengeCard key={module.id || module.docker_image} module={module} />
            ))
        }
      </div>
    </div>
  )
}