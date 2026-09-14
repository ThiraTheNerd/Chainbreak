import { Link2Off, ChevronRight, Lightbulb, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StagesStepper } from './StagesStepper'
import { useScores }     from '@/hooks/useScores'

// Countdown itself is owned by ChallengePage (it also needs `expired` to
// close the session and redirect) and passed down as `formatted`/`urgent`
// so there's a single ticking timer, not two independent ones.
export function TopBar({ challenge, stage, formatted, urgent, hintsUsed = 0 }) {
  const { data: scoreData }   = useScores()
  const score = scoreData?.score || 0

  return (
    <header className="h-12 flex items-center justify-between px-4
                       border-b border-border bg-surface flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Link to="/dashboard"
              className="flex items-center gap-1.5 text-text-2 hover:text-text-1
                         transition-colors flex-shrink-0">
          <Link2Off size={16} className="text-accent" />
          <span className="text-sm font-medium hidden sm:block">
            <span className="text-text-1">Chain</span>
            <span className="text-accent">Break</span>
          </span>
        </Link>

        <ChevronRight size={14} className="text-text-3 flex-shrink-0" />
        <Link to="/dashboard"
              className="text-text-2 text-sm hover:text-text-1 hidden md:block">
          Challenges
        </Link>
        <ChevronRight size={14} className="text-text-3 flex-shrink-0 hidden md:block" />
        <span className="text-text-1 text-sm truncate max-w-[200px]">
          {challenge?.title || 'Loading...'}
        </span>
      </div>
      <div className="flex-1 flex justify-center">
        <StagesStepper stage={stage} />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className={`flex items-center gap-1.5 font-mono text-sm
                         ${urgent ? 'text-danger' : 'text-text-2'}`}>
          <Clock size={14} />
          {formatted || '--:--'}
        </div>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                           border border-warning/30 bg-warning/10
                           text-warning text-xs hover:bg-warning/20
                           transition-colors">
          <Lightbulb size={13} />
          Hint ({hintsUsed})
        </button>
        <div className="text-accent text-sm font-medium font-mono">
          {score.toLocaleString()} XP
        </div>
      </div>
    </header>
  )
}
