import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Square, ArrowLeft, Maximize2, Lock, Sparkles } from 'lucide-react'
import { getSolution }         from '@/lib/solutions'
import { SolutionWalkthrough } from '@/components/solution/SolutionWalkthrough'
import { HintPanel }           from '@/components/hints/HintPanel'
import { useSolutionUnlockStatus, useUnlockSolution } from '@/hooks/useSolutionUnlock'
import { useScores }           from '@/hooks/useScores'

// Objectives, each tied to the SPECIFIC challenge (by slug) that satisfies it —
// not to an aggregate layer. Both the owasp layer (sqli-login + sqli-broken-access)
// and the docker/container layer (sqli-ssh-pivot + sqli-privesc-root +
// sqli-docker-misconfig) hold more than one flag, so checking "is my own flag
// captured" per-objective is what lets an earlier flag tick immediately
// without waiting on the rest of its layer.
//
// 'sqli-container-escape' (the old deferred host-escape placeholder) no
// longer exists as a challenge — it was repurposed into sqli-docker-misconfig
// — so there are no objectives left referencing it.
const OBJECTIVES_BY_IMAGE = {
  'chainbreak-challenge-1': [
    { id: 'bypass',        label: 'Bypass authentication via SQL injection',         slug: 'sqli-login' },
    { id: 'flag1',         label: 'Capture Flag 1',                                   slug: 'sqli-login' },
    { id: 'broken-access', label: 'Escalate access via broken access control',       slug: 'sqli-broken-access' },
    { id: 'flag2',         label: 'Capture Flag 2',                                   slug: 'sqli-broken-access' },
    { id: 'ssh-pivot',     label: 'Pivot onto the container via the leaked SSH key',  slug: 'sqli-ssh-pivot' },
    { id: 'flag3',         label: 'Capture Flag 3',                                   slug: 'sqli-ssh-pivot' },
    { id: 'root',          label: 'Escalate to root inside the container',            slug: 'sqli-privesc-root' },
    { id: 'flag4',         label: 'Capture Flag 4',                                   slug: 'sqli-privesc-root' },
    { id: 'awscreds',      label: 'Find AWS credentials on the container',            slug: 'sqli-docker-misconfig' },
    { id: 'flag5',         label: 'Capture Flag 5',                                   slug: 'sqli-docker-misconfig' },
    { id: 'creds',         label: 'Steal IAM credentials from environment',           slug: 'sqli-iam-exfil' },
    { id: 'flag6',         label: 'Capture Flag 6',                                   slug: 'sqli-iam-exfil' },
  ],
    'chainbreak-challenge-2': [
    { id: 'c2-err',   label: 'Leak internals via the mishandled error path',          slug: 'c2-error-disclosure' },
    { id: 'c2-fe',    label: 'Capture the error-disclosure flag',                     slug: 'c2-error-disclosure' },
    { id: 'c2-auth',  label: 'Brute-force the support login (no lockout)',            slug: 'c2-weak-auth' },
    { id: 'c2-fa',    label: 'Capture the auth flag',                                 slug: 'c2-weak-auth' },
    { id: 'c2-jwt',   label: 'Crack the HS256 secret and forge an admin token',       slug: 'c2-jwt-forge' },
    { id: 'c2-fj',    label: 'Capture the JWT flag',                                  slug: 'c2-jwt-forge' },
    { id: 'c2-rce',   label: 'Achieve RCE via the node-serialize cookie',            slug: 'deserialize-rce' },
    { id: 'c2-fr',    label: 'Capture the RCE flag',                                  slug: 'deserialize-rce' },
    { id: 'c2-root',  label: 'Escalate to root inside the container',                 slug: 'c2-container-privesc' },
    { id: 'c2-fp',    label: 'Capture the root flag',                                 slug: 'c2-container-privesc' },
  ],
}

// Pay-to-unlock prompt shown in the Solution tab until this module's
// walkthrough has been unlocked (a ONE-TIME XP spend — see
// server/services/unlock.service.js for the cost formula and
// server/repositories/unlock.repository.js for why a double-click can't
// charge twice).
function SolutionLockedPanel({ cost, currentScore, onUnlock, isUnlocking, error }) {
  const canAfford = cost != null && currentScore >= cost
  return (
    <div className="flex flex-col items-center justify-center
                    h-full text-center gap-3 py-8">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center
                      justify-center border border-accent/20">
        <Lock size={18} className="text-accent" />
      </div>
      <p className="text-text-1 text-sm font-medium">Solution locked</p>
      <p className="text-text-2 text-xs max-w-[240px] leading-relaxed">
        Unlock the full step-by-step walkthrough for this challenge — a
        ONE-TIME cost. Once unlocked, it's yours for good, no matter how
        far along you are. Or capture every flag in this challenge and
        it unlocks automatically, free.
      </p>
      <button
        onClick={onUnlock}
        disabled={isUnlocking || !canAfford || cost == null}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                   bg-accent text-white rounded-lg hover:bg-accent/90
                   transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles size={14} />
        {isUnlocking ? 'Unlocking...' : `Unlock solution (−${cost ?? '...'} XP)`}
      </button>
      {!canAfford && cost != null && (
        <p className="text-warning text-xs">
          Not enough XP yet — you have {currentScore}, need {cost}.
        </p>
      )}
      {error && (
        <p className="text-danger text-xs max-w-[240px]">{error.message}</p>
      )}
    </div>
  )
}

function ObjectiveItem({ label, done }) {
  return (
    <div className={`flex items-start gap-2.5 text-sm
                     ${done ? 'text-text-3 line-through' : 'text-text-2'}`}>
      {done
        ? <CheckSquare size={15} className="text-success flex-shrink-0 mt-0.5" />
        : <Square      size={15} className="text-text-3 flex-shrink-0 mt-0.5" />
      }
      {label}
    </div>
  )
}

export function MissionBrief({ challenge, stage, solvedSlugs, hintChallenges }) {
  const [tab, setTab] = useState('brief')
  const objectives = OBJECTIVES_BY_IMAGE[challenge?.docker_image] ?? []   // 👈 add this

  // Not stage-gated: the Solution tab is always reachable — what it shows
  // depends on `access`, in priority order (see server/services/unlock.service.js):
  //   'completed' — every flag in the module is solved: free, permanent,
  //                  no charge, no lock icon, even if never paid.
  //   'paid'      — not completed, but this user spent XP to unlock it.
  //   'locked'    — neither yet: show the pay-to-unlock panel.
  // Either 'completed' or 'paid' persists server-side across reloads/sessions.
  const { data: unlockStatus, isLoading: unlockLoading } = useSolutionUnlockStatus(challenge?.id)
  const unlockMutation = useUnlockSolution(challenge?.id)
  const { data: scoreData } = useScores()
  const access   = unlockStatus?.access ?? 'locked'
  const unlocked = access !== 'locked'

  const tabs = [
    { id: 'brief',    label: 'Brief' },
    { id: 'hints',    label: 'Hints' },
    { id: 'solution', label: unlocked || unlockLoading ? 'Solution' : 'Solution 🔒' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center border-b border-border px-4 flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2.5 text-sm border-b-2 transition-colors
                        ${tab === t.id
                          ? 'border-accent text-text-1'
                          : 'border-transparent text-text-2 hover:text-text-1'
                        }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-text-3 text-xs font-mono py-2.5">
          stage {Math.min(stage + 1, 3)} of 3
        </span>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">

        {tab === 'brief' && (
          <div className="flex flex-col gap-4">
            {/* Operation label */}
            <div>
              <p className="text-warning text-xs font-mono tracking-widest uppercase mb-1">
                Operation: Chain Reaction — Stage {stage + 1}
              </p>
              <h3 className="text-text-1 text-base font-medium">
                {stage === 0 ? 'Breach the perimeter'
                 : stage === 1 ? 'Escape the container'
                 : stage === 2 ? 'Infiltrate the cloud'
                 : 'Kill chain complete'}
              </h3>
            </div>

            {/* Description */}
            <p className="text-text-2 text-sm leading-relaxed">
              {challenge?.description ||
                'Intelligence suggests the authentication query is constructed ' +
                'without parameterisation. Your objective: bypass authentication, ' +
                'capture the session token, and use your foothold to investigate ' +
                'the container environment.'}
            </p>

            {/* Objectives checklist */}
            <div className="flex flex-col gap-2">
              {objectives.map(obj => (
                <ObjectiveItem
                  key={obj.id}
                  label={obj.label}
                  done={solvedSlugs?.has(obj.slug) ?? false}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'hints' && (
          <HintPanel
            challenges={hintChallenges || []}
            currentScore={scoreData?.score ?? 0}
          />
        )}

        {tab === 'solution' && (
          <div className="flex flex-col gap-4">
            {/* Back-to-brief affordance + full-page escape hatch — the tab
                bar above already switches back to Brief, this is just an
                explicit in-content shortcut for the same action. */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setTab('brief')}
                className="flex items-center gap-1 text-text-3 text-xs
                           hover:text-text-1 transition-colors"
              >
                <ArrowLeft size={12} /> Back to brief
              </button>
              {unlocked && (
                <Link
                  to={`/challenge/${challenge?.id}/solution`}
                  className="flex items-center gap-1 text-text-3 text-xs
                             hover:text-text-1 transition-colors"
                  title="Open the solution as a full page"
                >
                  <Maximize2 size={12} /> Full page
                </Link>
              )}
            </div>

            {/* The terminal on the left stays mounted and untouched while
                this renders — this is purely a right-panel tab swap, same
                as Brief/Hints, not a navigation. */}
            {unlockLoading ? (
              <p className="text-text-3 text-xs text-center py-8">Loading...</p>
            ) : unlocked ? (
              <SolutionWalkthrough solution={getSolution(challenge?.docker_image)} compact />
            ) : (
              <SolutionLockedPanel
                cost={unlockStatus?.cost}
                currentScore={scoreData?.score ?? 0}
                onUnlock={() => unlockMutation.mutate()}
                isUnlocking={unlockMutation.isPending}
                error={unlockMutation.error}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
