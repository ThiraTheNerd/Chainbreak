// TODO: Add per-layer breakdown when /api/scores/leaderboard returns
// flag_submissions data joined by layer. Currently approximated from solvedCount.
function layerApprox(solvedCount = 0) {
  const web       = Math.min(solvedCount, 2)
  const container = Math.min(Math.max(solvedCount - 2, 0), 2)
  const cloud     = Math.min(Math.max(solvedCount - 4, 0), 2)
  return {
    web:       Math.round((web / 2) * 100),
    container: Math.round((container / 2) * 100),
    cloud:     Math.round((cloud / 2) * 100),
  }
}

function MiniBar({ pct, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-text-3 text-xs w-7 text-right">{pct}</span>
    </div>
  )
}

function FlagDots({ count, max = 6 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-sm"
          style={{ background: i < count ? '#2EA043' : '#30363D' }}
        />
      ))}
    </div>
  )
}

const COL_HEADERS = [
  { label: 'RANK',        cls: 'w-16 text-center' },
  { label: 'PARTICIPANT', cls: 'flex-1'            },
  { label: 'GROUP',       cls: 'w-28'              },
  { label: 'FLAGS',       cls: 'w-32'              },
  { label: 'WEB',         cls: 'w-24'              },
  { label: 'CONTAINER',   cls: 'w-24'              },
  { label: 'CLOUD',       cls: 'w-24'              },
  { label: 'POINTS',      cls: 'w-20 text-right'   },
]

export function LeaderboardTable({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-text-3 text-sm">
        No participants yet.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-border
                      bg-surface-2">
        {COL_HEADERS.map(h => (
          <div key={h.label}
               className={`text-text-3 text-[10px] font-mono tracking-wider
                           uppercase ${h.cls}`}>
            {h.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div>
        {entries.map((entry, idx) => {
          const layers = layerApprox(entry.solvedCount)
          const isYou  = entry.isCurrentUser

          return (
            <div
              key={entry.id}
              className={`flex items-center px-4 py-3 transition-colors
                          ${idx < entries.length - 1 ? 'border-b border-border' : ''}
                          ${isYou ? 'border-l-2 border-l-accent bg-accent/5' : ''}
                          hover:bg-surface-2`}
            >
              {/* Rank */}
              <div className="w-16 text-center">
                <span className={`text-sm font-mono font-medium
                                  ${idx < 3 ? 'text-warning' : 'text-text-2'}`}>
                  #{String(entry.rank).padStart(2, '0')}
                </span>
              </div>

              {/* Participant */}
              <div className="flex-1 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-surface-2 border border-border
                                flex items-center justify-center flex-shrink-0">
                  <span className="text-text-2 text-xs font-medium">
                    {entry.username?.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-1 text-sm">{entry.username}</span>
                  {isYou && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono
                                     bg-accent/20 text-accent border border-accent/30">
                      you
                    </span>
                  )}
                </div>
              </div>

              {/* Group */}
              <div className="w-28">
                <span className="text-text-2 text-sm">{entry.roleLabel}</span>
              </div>

              {/* Flags */}
              <div className="w-32">
                <FlagDots count={entry.solvedCount || 0} max={6} />
              </div>

              {/* Layer bars */}
              <div className="w-24">
                <MiniBar pct={layers.web} color="#388BFD" />
              </div>
              <div className="w-24">
                <MiniBar pct={layers.container} color="#2EA043" />
              </div>
              <div className="w-24">
                <MiniBar pct={layers.cloud} color="#D29922" />
              </div>

              {/* Points */}
              <div className="w-20 text-right">
                <span className="text-accent text-sm font-medium font-mono">
                  {(entry.score || 0).toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
