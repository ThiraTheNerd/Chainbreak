export function XpRing({ score = 0, solvedCount = 0, totalPossible = 6 }) {
  const pct     = totalPossible > 0 ? Math.round((solvedCount / totalPossible) * 100) : 0
  const radius  = 22
  const stroke  = 3
  const circ    = 2 * Math.PI * radius
  const offset  = circ - (pct / 100) * circ

  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-accent text-3xl font-bold leading-none">
          {score.toLocaleString()}
        </p>
        <p className="text-text-3 text-xs mt-0.5 uppercase tracking-wider">
          XP score
        </p>
      </div>

      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28" cy="28" r={radius}
            fill="none"
            stroke="#30363D"
            strokeWidth={stroke}
          />
          <circle
            cx="28" cy="28" r={radius}
            fill="none"
            stroke="#388BFD"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center
                         text-text-1 text-xs font-medium">
          {pct}%
        </span>
      </div>
    </div>
  )
}
