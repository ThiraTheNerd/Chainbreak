import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Clock3, Flag, Loader2 } from 'lucide-react'
import { LayerBadge } from './LayerBadge'
import { useChallengeProgress } from '@/hooks/useChallengeProgress'
import { useMyAssessments } from '@/hooks/useMyAssessments'
import { useToast } from '@/hooks/use-toast'
import api from '@/services/api'

function getCategoryColor(category = '') {
  if (category.startsWith('A01')) return 'border-l-purple-500'
  if (category.startsWith('A03')) return 'border-l-accent'
  if (category.startsWith('A08')) return 'border-l-danger'
  if (category.startsWith('A10')) return 'border-l-warning'
  return 'border-l-border-2'
}

const DIFFICULTY_BADGE = {
  easy:   'text-success border-success/40 bg-success/10',
  medium: 'text-warning border-warning/40 bg-warning/10',
  hard:   'text-danger  border-danger/40  bg-danger/10',
}

export function ChallengeCard({ module }) {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  const {
    id, title, description, category, difficulty,
    flagCount, estimatedMinutes,
    webSolved, containerSolved, cloudSolved,
  } = module

  const borderColor = getCategoryColor(category)

  // "Continue" once there's permanent solve progress (survives an expired
  // container) or an active session is still running for this module.
  const { data: progress } = useChallengeProgress(id)
  const hasProgress = webSolved || containerSolved || cloudSolved
    || Boolean(progress?.hasActiveSession)

  // Loading is treated as "allowed" — the server's requirePreAssessment
  // middleware is the real gate; this is just UX to avoid a flash-block on
  // first render for learners who've already completed it.
  const { data: myAssessments, isLoading: loadingAssessments } = useMyAssessments()
  const hasPreAssessment = loadingAssessments
    || myAssessments?.assessments?.some(a => a.type === 'pre')

  const { toast } = useToast()

  const startMutation = useMutation({
    mutationFn: () =>
      api.post(`/sessions/challenges/${id}/session`).then(r => r.data),
    onSuccess: ({ sessionId, expiresAt }) => {
      if (expiresAt) {
        sessionStorage.setItem(`cb_session_${sessionId}_expires`, expiresAt)
      }
      navigate(`/challenge/${id}?session=${sessionId}`)
    },
    onError: (err) => {
      setError(err.message)
      setTimeout(() => setError(null), 4000)
    },
  })

  const handleStart = () => {
    if (!hasPreAssessment) {
      toast({
        variant: 'warning',
        title: 'Pre-assessment required',
        description: 'Complete the pre-assessment before starting challenges.',
      })
      return
    }
    startMutation.mutate()
  }

  return (
    <div className={`bg-surface border border-border rounded-xl
                     border-l-4 ${borderColor}
                     flex flex-col transition-colors hover:border-border-2`}>
      <div className="p-5 flex-1">

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded border
                           text-text-2 border-border bg-surface-2">
            {category || 'Uncategorised'}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                            border capitalize ${DIFFICULTY_BADGE[difficulty]
                              || DIFFICULTY_BADGE.medium}`}>
            {difficulty}
          </span>
        </div>

        <h3 className="text-text-1 font-medium text-base mb-1.5 leading-snug">
          {title || 'Untitled module'}
        </h3>

        <p className="text-text-2 text-sm leading-relaxed line-clamp-2 mb-4">
          {description}
        </p>

        <div className="flex items-center gap-4 text-text-3 text-xs mb-4">
          <span className="inline-flex items-center gap-1.5">
            <Flag size={13} />
            {flagCount} {flagCount === 1 ? 'flag' : 'flags'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} />
            {estimatedMinutes} min
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <LayerBadge type="web"       solved={webSolved} />
          <LayerBadge type="container" solved={containerSolved}
                      locked={!webSolved} />
          <LayerBadge type="cloud"     solved={cloudSolved}
                      locked={!containerSolved} />
        </div>

        {error && (
          <p className="text-danger text-xs mt-2">{error}</p>
        )}
      </div>

      <div className="px-5 pb-5">
        <button
          onClick={handleStart}
          disabled={startMutation.isPending || !id}
          title={!id ? 'No entry point challenge found for this module' : undefined}
          className="w-full flex items-center justify-center gap-2
                     border border-border rounded-lg py-2 text-sm text-text-2
                     hover:text-text-1 hover:border-border-2 hover:bg-surface-2
                     transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {startMutation.isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Starting...</>
          ) : !id ? (
            'No entry point available'
          ) : hasProgress ? (
            <>Continue challenge <ArrowRight size={14} /></>
          ) : (
            <>Start challenge <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  )
}
