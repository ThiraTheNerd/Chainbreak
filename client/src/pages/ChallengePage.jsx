import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useQueryClient }      from '@tanstack/react-query'
import { GripHorizontal }      from 'lucide-react'
import { useAuth }             from '@/hooks/useAuth'
import { useChallengeModule }  from '@/hooks/useChallengeModule'
import { TopBar }              from '@/components/challenge/TopBar'
import { TerminalPane }        from '@/components/terminal/Terminal'
import { KillChainGraph }      from '@/components/killchain/KillChainGraph'
import { FlagStatusRow }       from '@/components/challenge/FlagStatusRow'
import { MissionBrief }        from '@/components/challenge/MissionBrief'

const LAYER_KEY = { owasp: 'web', docker: 'container', aws: 'cloud' }

// Pixel-based (not percentage) so the minimums mean the same thing
// regardless of viewport height.
const MIN_KILLCHAIN_PX = 160
const MIN_TABS_PX      = 220

export function ChallengePage() {
  const { id }             = useParams()
  const [searchParams]     = useSearchParams()
  const sessionId          = searchParams.get('session')
  const { token, isAuthenticated } = useAuth()
  const queryClient        = useQueryClient()

  const expiresAt = sessionStorage.getItem(`cb_session_${sessionId}_expires`)
    || new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // Keyed by challenge id, not layer — a layer can hold more than one flag,
  // so a single per-layer slot would lose one.
  const [capturedFlags, setCapturedFlags]   = useState({})
  const [connected, setConnected]           = useState(false)
  const [terminalError, setTerminalError]   = useState(null)

  // Session-only split state, no persistence across reloads.
  const rightPanelRef = useRef(null)
  const [topPx, setTopPx] = useState(null)
  const [fitKey, setFitKey] = useState(0)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (topPx == null && rightPanelRef.current) {
      setTopPx(Math.round(rightPanelRef.current.getBoundingClientRect().height * 0.6))
    }
  }, [topPx])

  const handleDividerPointerDown = useCallback((e) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleDividerPointerMove = useCallback((e) => {
    if (!draggingRef.current || !rightPanelRef.current) return
    const rect = rightPanelRef.current.getBoundingClientRect()
    const raw = e.clientY - rect.top
    const max = Math.max(MIN_KILLCHAIN_PX, rect.height - MIN_TABS_PX)
    setTopPx(Math.min(max, Math.max(MIN_KILLCHAIN_PX, raw)))
  }, [])

  const handleDividerPointerUp = useCallback((e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setFitKey(k => k + 1)
  }, [])

  // Live captures land here instantly by challenge id; moduleData's own
  // `c.solved` is the permanent source (survives a reload) — this set only
  // covers the gap until that refetch completes.
  const [locallyCaptured, setLocallyCaptured] = useState(() => new Set())

  const { data: moduleData, isLoading } = useChallengeModule(Number(id))

  const webChallenges       = moduleData?.web       || []
  const containerChallenges = moduleData?.container || []
  const cloudChallenges     = moduleData?.cloud     || []
  const allChallenges       = [...webChallenges, ...containerChallenges, ...cloudChallenges]

  const isSolved = useCallback(
    (c) => Boolean(c?.solved) || locallyCaptured.has(c?.id),
    [locallyCaptured]
  )

  // A layer is only "compromised" once every challenge in it is solved.
  const webSolvedCount       = webChallenges.filter(isSolved).length
  const webProgress          = webChallenges.length ? webSolvedCount / webChallenges.length : 0
  const webComplete          = webChallenges.length > 0 && webSolvedCount === webChallenges.length
  const containerSolvedCount = containerChallenges.filter(isSolved).length
  const containerProgress    = containerChallenges.length ? containerSolvedCount / containerChallenges.length : 0
  const containerComplete    = containerChallenges.length > 0 && containerSolvedCount === containerChallenges.length
  const cloudComplete        = cloudChallenges.length > 0 && cloudChallenges.every(isSolved)

  // 0=none, 1=web done, 2=container done, 3=all done
  const stage = cloudComplete ? 3 : containerComplete ? 2 : webComplete ? 1 : 0

  // One row per challenge (not per layer), in module order, so both web
  // flags surface as separate rows instead of one overwriting the other.
  const flagRows = allChallenges.map((c, i) => ({
    id:    c.id,
    label: `Flag ${i + 1}`,
    layer: LAYER_KEY[c.layer],
    value: capturedFlags[c.id] ?? (isSolved(c) ? '[already captured]' : null),
  }))

  // The Brief's objectives key off the specific flag they describe, not an
  // aggregate layer, so Flag 1 alone ticks its own objectives immediately.
  const solvedSlugs = new Set(allChallenges.filter(isSolved).map(c => c.slug))

  // Hints are per-flag (unlike the Solution tab, which covers the whole
  // module), so this needs the full list, not just the entry challenge.
  const hintChallenges = allChallenges.map(c => ({
    id: c.id, slug: c.slug, title: c.title, layer: LAYER_KEY[c.layer], solved: isSolved(c),
  }))

  // Declared before the early returns below since hooks must run on every render.
  const handleFlagCaptured = useCallback(({ flag, challengeId }) => {
    setCapturedFlags(prev => ({ ...prev, [challengeId]: flag }))
    setLocallyCaptured(prev => {
      const next = new Set(prev)
      next.add(challengeId)
      return next
    })

    queryClient.invalidateQueries({ queryKey: ['scores', 'me'] })
    queryClient.invalidateQueries({ queryKey: ['challenges'] })
  }, [queryClient])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!sessionId) return <Navigate to="/dashboard" replace />

  const challenge   = moduleData?.entry
  const challengeIds = moduleData?.allIds || []

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      <TopBar
        challenge={challenge}
        stage={stage}
        expiresAt={expiresAt}
      />

      <div className="flex-1 flex overflow-hidden">

        <div className="w-1/2 flex flex-col border-r border-border">

          <div className="h-9 flex items-center justify-between px-3
                          bg-surface-2 border-b border-border flex-shrink-0">
            <span className="text-success text-xs font-mono">
              chainbreak@chainbreak-ws:~$
            </span>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full transition-colors
                               ${connected ? 'bg-success' : 'bg-text-3'}`} />
              <span className="text-text-3 text-xs font-mono">
                {connected ? 'connected' : 'connecting...'}
              </span>
              <span className="text-text-3 text-xs font-mono ml-2">
                tty0 · zsh
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {sessionId && token && (
              <TerminalPane
                sessionId={sessionId}
                challengeIds={challengeIds}
                token={token}
                onFlagCaptured={handleFlagCaptured}
                onConnected={() => setConnected(true)}
                onError={(msg) => setTerminalError(msg)}
              />
            )}
          </div>

          <div className="h-11 flex items-center gap-2 px-3
                          border-t border-border bg-surface flex-shrink-0">
            <span className="text-success text-xs font-mono">$</span>
            <input
              type="text"
              placeholder="Enter command..."
              className="flex-1 bg-transparent text-text-2 text-sm
                         placeholder:text-text-3 outline-none font-mono"
              onKeyDown={(e) => {
                // Decorative — real input goes to xterm.js.
                e.preventDefault()
              }}
            />
            <button className="text-text-3 hover:text-accent transition-colors p-1">
              <span className="text-xs">↵</span>
            </button>
          </div>
        </div>

        <div ref={rightPanelRef} className="w-1/2 flex flex-col overflow-hidden">

          <div className="flex flex-col overflow-y-auto"
               style={{
                 flexBasis:  topPx != null ? `${topPx}px` : '60%',
                 flexGrow:   0,
                 flexShrink: 0,
                 minHeight:  0,
               }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
              <h2 className="text-text-1 text-sm font-medium">
                Attack kill chain
              </h2>
              <span className="text-text-3 text-xs">
                3 nodes · {stage} of 3 compromised
              </span>
            </div>

            {/* key bumps on drag-end so the graph remounts and re-runs
                fitView against its new box */}
            <div className="flex-1 px-2" style={{ minHeight: 0 }}>
              <KillChainGraph key={fitKey} stage={stage} webProgress={webProgress} containerProgress={containerProgress} />
            </div>

            <FlagStatusRow flags={flagRows} />
          </div>

          <div
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize kill-chain and tabs split"
            className="h-2 flex-shrink-0 flex items-center justify-center
                       cursor-row-resize select-none touch-none group
                       bg-surface-2 hover:bg-accent/20 active:bg-accent/30
                       transition-colors"
          >
            <GripHorizontal size={13} className="text-text-3 group-hover:text-accent transition-colors" />
          </div>

          <div className="flex-1 border-t border-border overflow-hidden flex flex-col"
               style={{ minHeight: 0 }}>
            <MissionBrief
              challenge={challenge}
              stage={stage}
              solvedSlugs={solvedSlugs}
              hintChallenges={hintChallenges}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
