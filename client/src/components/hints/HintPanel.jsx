import { useState } from 'react'
import { Sparkles, Lock, ChevronDown, CheckCircle2, Circle } from 'lucide-react'
import { useHintStatus, useRevealHint } from '@/hooks/useHints'

const TIER_LABELS = { 1: 'Nudge', 2: 'Direction', 3: 'Near-explicit' }

// Full literal class names (not built via string transformation) so
// Tailwind's content scanner can actually find and generate them — the
// same reasoning as SolutionWalkthrough.jsx's LAYER_META.
const LAYER_DOT = {
  web:       'bg-layer-web',
  container: 'bg-layer-container',
  cloud:     'bg-layer-cloud',
}

function HintTierRow({ tier, locked, currentScore, onReveal, isRevealing, error }) {
  // Already revealed — show the persisted hint text (identical on every
  // future visit, since the server stores what it generated rather than
  // regenerating on each view).
  if (tier.unlocked) {
    return (
      <div className="bg-surface-2 border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-text-1 text-xs font-medium">
            Tier {tier.tier} — {TIER_LABELS[tier.tier]}
          </span>
          {tier.source === 'ai' ? (
            <span className="flex items-center gap-1 text-purple text-[10px] font-mono uppercase tracking-wide">
              <Sparkles size={10} /> AI
            </span>
          ) : (
            <span className="text-text-3 text-[10px] font-mono uppercase tracking-wide">
              preset
            </span>
          )}
        </div>
        <p className="text-text-2 text-sm leading-relaxed">{tier.hint}</p>
      </div>
    )
  }

  // Locked because a prior tier hasn't been revealed yet — progressive,
  // can't skip ahead.
  if (locked) {
    return (
      <div className="bg-surface-2/50 border border-dashed border-border
                      rounded-lg p-3 flex items-center gap-2 opacity-60">
        <Lock size={12} className="text-text-3 flex-shrink-0" />
        <span className="text-text-3 text-xs">
          Tier {tier.tier} — reveal tier {tier.tier - 1} first
        </span>
      </div>
    )
  }

  // Revealable now.
  const canAfford = currentScore >= tier.cost
  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-2 text-xs">
          Tier {tier.tier} — {TIER_LABELS[tier.tier]}
        </span>
        <button
          onClick={onReveal}
          disabled={isRevealing || !canAfford}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px]
                     font-medium bg-accent text-white rounded-md
                     hover:bg-accent/90 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRevealing ? 'Asking Claude...' : `Reveal (−${tier.cost} XP)`}
        </button>
      </div>
      {!canAfford && (
        <p className="text-warning text-[11px]">
          Need {tier.cost} XP, have {currentScore}.
        </p>
      )}
      {error && <p className="text-danger text-[11px]">{error.message}</p>}
    </div>
  )
}

function HintTierLadder({ challengeId, currentScore }) {
  const { data: status, isLoading } = useHintStatus(challengeId)
  const revealMutation = useRevealHint(challengeId)
  const [revealingTier, setRevealingTier] = useState(null)

  if (isLoading) {
    return <p className="text-text-3 text-xs py-3">Loading hints...</p>
  }

  const tiers = status?.tiers || []

  return (
    <div className="flex flex-col gap-2 pt-2">
      {tiers.map((t, i) => {
        const priorUnlocked = i === 0 || tiers[i - 1].unlocked
        const isThisRevealing = revealingTier === t.tier && revealMutation.isPending
        return (
          <HintTierRow
            key={t.tier}
            tier={t}
            locked={!t.unlocked && !priorUnlocked}
            currentScore={currentScore}
            onReveal={() => {
              setRevealingTier(t.tier)
              revealMutation.mutate(t.tier)
            }}
            isRevealing={isThisRevealing}
            error={revealingTier === t.tier ? revealMutation.error : null}
          />
        )
      })}
    </div>
  )
}

function HintFlagCard({ challenge, expanded, onToggle, currentScore }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-3
                   text-left hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {challenge.solved
            ? <CheckCircle2 size={14} className="text-success flex-shrink-0" />
            : <Circle size={14} className="text-text-3 flex-shrink-0" />
          }
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${LAYER_DOT[challenge.layer] || 'bg-text-3'}`} />
          <span className={`text-sm truncate ${challenge.solved ? 'text-text-3 line-through' : 'text-text-1'}`}>
            {challenge.title}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-text-3 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <HintTierLadder challengeId={challenge.id} currentScore={currentScore} />
        </div>
      )}
    </div>
  )
}

// AI-powered progressive hints, one flag at a time — the module's flags are
// listed as expandable cards, each holding its own independent 3-tier
// ladder (see HintTierLadder above). Data-driven: takes whatever challenge
// list it's given (from ChallengePage's module data) and renders it
// generically, same contract as SolutionWalkthrough.
export function HintPanel({ challenges = [], currentScore = 0 }) {
  const firstUnsolvedId = challenges.find((c) => !c.solved)?.id ?? challenges[0]?.id
  const [expandedId, setExpandedId] = useState(firstUnsolvedId)

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center
                      h-full text-center gap-3 py-8">
        <p className="text-text-3 text-sm">No flags to hint yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 mb-1">
        <div className="w-7 h-7 rounded-full bg-purple/10 flex items-center
                        justify-center border border-purple/20 flex-shrink-0">
          <Sparkles size={14} className="text-purple" />
        </div>
        <p className="text-text-2 text-xs leading-relaxed">
          AI-generated hints, one flag at a time. Each tier is a one-time
          XP cost — pick the flag you're stuck on below, then reveal
          tiers in order.
        </p>
      </div>

      {challenges.map((c) => (
        <HintFlagCard
          key={c.id}
          challenge={c}
          expanded={expandedId === c.id}
          onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
          currentScore={currentScore}
        />
      ))}
    </div>
  )
}
