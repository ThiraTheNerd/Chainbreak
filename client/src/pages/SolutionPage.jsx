import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { useChallengeModule }        from '@/hooks/useChallengeModule'
import { useSolutionUnlockStatus }   from '@/hooks/useSolutionUnlock'
import { getSolution }               from '@/lib/solutions'
import { SolutionWalkthrough }       from '@/components/solution/SolutionWalkthrough'

// A secondary path alongside MissionBrief's in-panel Solution tab (the
// primary one, which keeps the terminal visible) — both share the same
// SolutionWalkthrough renderer and the same access gating, so this page
// only adds page-level chrome around it.
export function SolutionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: moduleData, isLoading } = useChallengeModule(Number(id))
  const { data: unlockStatus, isLoading: unlockLoading } = useSolutionUnlockStatus(Number(id))

  if (isLoading || unlockLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-text-2 text-sm">
        Loading...
      </div>
    )
  }

  if (!moduleData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-text-1 text-lg font-medium">Challenge not found</p>
        <Link to="/dashboard" className="text-accent text-sm hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const { entry } = moduleData

  if (unlockStatus?.access === 'locked') {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-surface-2 border border-border
                        flex items-center justify-center">
          <Lock size={20} className="text-text-3" />
        </div>
        <p className="text-text-1 text-lg font-medium">Solution locked</p>
        <p className="text-text-2 text-sm max-w-sm">
          This walkthrough hasn't been unlocked yet. Head back to the
          challenge's Solution tab to unlock it for {unlockStatus?.cost ?? '...'} XP
          — a one-time cost — or capture every flag in the challenge to
          unlock it automatically, free.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 flex items-center gap-1.5 px-4 py-2 text-sm text-text-2
                     border border-border rounded-lg hover:text-text-1
                     hover:border-border-2 transition-colors"
        >
          <ArrowLeft size={14} /> Back to challenge
        </button>
      </div>
    )
  }

  const solution = getSolution(entry?.docker_image)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-text-2 text-sm mb-6
                     hover:text-text-1 transition-colors"
        >
          <ArrowLeft size={14} /> Back to challenge
        </button>

        <SolutionWalkthrough solution={solution} />
      </div>
    </div>
  )
}
