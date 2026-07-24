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

// challenge.layer ('owasp'|'docker'|'aws') -> the kill-chain node/panel key it maps to
const LAYER_KEY = { owasp: 'web', docker: 'container', aws: 'cloud' }

// Draggable split between the kill-chain section and the tabbed content
// section of the right panel — pixel-based (not percentage) so the minimums
// mean the same thing regardless of viewport height.
const MIN_KILLCHAIN_PX = 160  // enough for a condensed graph + its header
const MIN_TABS_PX      = 220  // enough to read a few lines of a solution step

export function ChallengePage() {
  const { id }             = useParams()
  const [searchParams]     = useSearchParams()
  const sessionId          = searchParams.get('session')
  const { token, isAuthenticated } = useAuth()
  const queryClient        = useQueryClient()

  // Session expiry — stored when navigating from dashboard
  // Fallback: 60 minutes from now if not stored
  const expiresAt = sessionStorage.getItem(`cb_session_${sessionId}_expires`)
    || new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // Raw captured flag text, keyed by CHALLENGE ID (not layer) — a layer can
  // hold more than one flag, so a single per-layer slot would lose one.
  const [capturedFlags, setCapturedFlags]   = useState({})
  const [connected, setConnected]           = useState(false)
  const [terminalError, setTerminalError]   = useState(null)

  // Draggable kill-chain/tabs split (right panel only — never touches the
  // terminal pane). `topPx` is null until first measured, at which point it
  // falls back to a 60% starting split; after that, drag math is pure
  // pixels. Session-only, as specified — no persistence across reloads.
  const rightPanelRef = useRef(null)
  const [topPx, setTopPx] = useState(null)
  const [fitKey, setFitKey] = useState(0)     // bumped on drag-end to re-fitView the graph
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
    setFitKey(k => k + 1)  // snap the kill-chain graph to re-fit its new size
  }, [])

  // Live captures land here instantly (by challenge id) so the graph doesn't
  // have to wait on the `challenges` query refetch to reflect a just-solved
  // flag. `moduleData`'s own `c.solved` is the PERMANENT source (survives a
  // reload) — this set only covers the gap until that refetch completes.
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

  // A layer is only "compromised" once EVERY challenge in it is solved — the
  // web layer holds two flags (sqli-login + sqli-broken-access) and the
  // container layer holds three (sqli-ssh-pivot, sqli-privesc-root,
  // sqli-docker-misconfig), so capturing just one must not fully compromise
  // the node.
  const webSolvedCount       = webChallenges.filter(isSolved).length
  const webProgress          = webChallenges.length ? webSolvedCount / webChallenges.length : 0
  const webComplete          = webChallenges.length > 0 && webSolvedCount === webChallenges.length
  const containerSolvedCount = containerChallenges.filter(isSolved).length
  const containerProgress    = containerChallenges.length ? containerSolvedCount / containerChallenges.length : 0
  const containerComplete    = containerChallenges.length > 0 && containerSolvedCount === containerChallenges.length
  const cloudComplete        = cloudChallenges.length > 0 && cloudChallenges.every(isSolved)

  // Stage: 0=none, 1=web done, 2=container done, 3=all done
  const stage = cloudComplete ? 3 : containerComplete ? 2 : webComplete ? 1 : 0

  // One row per CHALLENGE (not per layer) for the Flag panel, in module order
  // (web flags first, then container, then cloud) — this is what surfaces
  // both web flags as separate rows instead of one overwriting the other.
  // Falls back to a permanent-solved placeholder when there's no live raw
  // value yet (e.g. a reload), so hydration and live capture render the same.
  const flagRows = allChallenges.map((c, i) => ({
    id:    c.id,
    label: `Flag ${i + 1}`,
    layer: LAYER_KEY[c.layer],
    value: capturedFlags[c.id] ?? (isSolved(c) ? '[already captured]' : null),
  }))

  // Which challenge SLUGS are solved — the Brief objectives key off the
  // specific flag they describe, not an aggregate layer, so Flag 1 alone
  // ticks its own objectives immediately without waiting on Flag 2.
  const solvedSlugs = new Set(allChallenges.filter(isSolved).map(c => c.slug))

  // Every flag in the module, normalised for the Hints tab — hints are
  // per-flag (unlike the Solution tab, which covers the whole module), so
  // it needs the full list, not just the module's primary/entry challenge.
  const hintChallenges = allChallenges.map(c => ({
    id: c.id, slug: c.slug, title: c.title, layer: LAYER_KEY[c.layer], solved: isSolved(c),
  }))

  // All hooks must run on every render regardless of the redirect checks
  // below, so this is declared before the early returns.
  const handleFlagCaptured = useCallback(({ flag, challengeId }) => {
    setCapturedFlags(prev => ({ ...prev, [challengeId]: flag }))
    setLocallyCaptured(prev => {
      const next = new Set(prev)
      next.add(challengeId)
      return next
    })

    // Refresh scores + the permanent per-challenge solved state in TanStack Query cache
    queryClient.invalidateQueries({ queryKey: ['scores', 'me'] })
    queryClient.invalidateQueries({ queryKey: ['challenges'] })
  }, [queryClient])

  // Redirect if not authenticated or no session
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!sessionId) return <Navigate to="/dashboard" replace />

  const challenge   = moduleData?.entry
  const challengeIds = moduleData?.allIds || []

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* Top bar */}
      <TopBar
        challenge={challenge}
        stage={stage}
        expiresAt={expiresAt}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANE — Terminal */}
        <div className="w-1/2 flex flex-col border-r border-border">

          {/* Terminal header bar */}
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

          {/* xterm.js mounts here — flex-1 gives it all remaining height */}
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

          {/* Command input bar at bottom */}
          <div className="h-11 flex items-center gap-2 px-3
                          border-t border-border bg-surface flex-shrink-0">
            <span className="text-success text-xs font-mono">$</span>
            <input
              type="text"
              placeholder="Enter command..."
              className="flex-1 bg-transparent text-text-2 text-sm
                         placeholder:text-text-3 outline-none font-mono"
              onKeyDown={(e) => {
                // The terminal handles its own input via xterm.js
                // This input bar is decorative — real input goes to xterm
                e.preventDefault()
              }}
            />
            <button className="text-text-3 hover:text-accent transition-colors p-1">
              <span className="text-xs">↵</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANE — Kill chain + mission brief */}
        <div ref={rightPanelRef} className="w-1/2 flex flex-col overflow-hidden">

          {/* Kill chain graph — draggable-height section, ~60% to start */}
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

            {/* React Flow graph — key bumps on drag-end so it remounts and
                re-runs fitView against its new box, instead of staying
                fit to whatever size it was before the resize. */}
            <div className="flex-1 px-2" style={{ minHeight: 0 }}>
              <KillChainGraph key={fitKey} stage={stage} webProgress={webProgress} containerProgress={containerProgress} />
            </div>

            {/* Flag status rows */}
            <FlagStatusRow flags={flagRows} />
          </div>

          {/* Drag handle — resizes the split above/below it. Purely a
              layout change: nothing here unmounts the terminal (a sibling
              in a completely separate pane) or the tab content underneath. */}
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

          {/* Mission brief — remaining height */}
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
