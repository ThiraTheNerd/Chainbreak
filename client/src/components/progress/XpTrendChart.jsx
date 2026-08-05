import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { ProgressEmptyState } from './ProgressEmptyState'
import { shortDate } from '@/lib/time'

const WIDTH = 560
const HEIGHT = 180
const PAD_X = 12
const PAD_Y = 16

// Cumulative XP over time, from the learner's own solve history
// (server/services/progress.service.js timeSeries — first-correct-submission
// per challenge, same challenge set the XP figure is summed from). Points
// are spaced evenly along X by SOLVE ORDER, not by elapsed real time — with
// only a handful of captures, a strictly time-proportional axis tends to
// bunch same-day solves into one corner and leave the rest of the chart
// empty; solve order stays honest about the trajectory shape while reading
// more clearly, and each point's real date is shown below it.
export function XpTrendChart({ timeSeries }) {
  const { linePath, areaPath, points, maxXp } = useMemo(() => {
    if (!timeSeries || timeSeries.length === 0) {
      return { linePath: '', areaPath: '', points: [], maxXp: 0 }
    }
    const maxXp = Math.max(...timeSeries.map(p => p.cumulativeXp), 1)
    const stepX = timeSeries.length > 1 ? (WIDTH - PAD_X * 2) / (timeSeries.length - 1) : 0
    const coords = timeSeries.map((p, i) => {
      const x = timeSeries.length > 1 ? PAD_X + i * stepX : WIDTH / 2
      const y = PAD_Y + (1 - p.cumulativeXp / maxXp) * (HEIGHT - PAD_Y * 2)
      return { x, y, ...p }
    })
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
    const areaPath = coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${HEIGHT - PAD_Y} L ${coords[0].x} ${HEIGHT - PAD_Y} Z`
      : ''
    return { linePath, areaPath, points: coords, maxXp }
  }, [timeSeries])

  if (!timeSeries || timeSeries.length === 0) {
    return (
      <ProgressEmptyState
        icon={TrendingUp}
        message="No captures yet — your XP growth over time will show up here."
      />
    )
  }

  // A single data point can't draw a line — show it as a lone dot plus its value.
  if (timeSeries.length === 1) {
    const only = timeSeries[0]
    return (
      <div className="flex flex-col items-center justify-center h-full py-6">
        <div className="w-3 h-3 rounded-full bg-accent mb-3" />
        <p className="text-text-1 text-lg font-semibold">{only.cumulativeXp} XP</p>
        <p className="text-text-3 text-xs mt-1">first capture · {shortDate(only.solvedAt)}</p>
        <p className="text-text-2 text-xs mt-2">Solve another flag to see your trend line.</p>
      </div>
    )
  }

  const labelStep = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#388BFD" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#388BFD" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#xpFill)" stroke="none" />
        <path d={linePath} fill="none" stroke="#388BFD" strokeWidth="2.5"
              strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.challengeId ?? i} cx={p.x} cy={p.y} r="3" fill="#388BFD" />
        ))}
      </svg>
      <div className="flex justify-between mt-1 px-1">
        {points.filter((_, i) => i % labelStep === 0 || i === points.length - 1).map((p, i) => (
          <span key={p.challengeId ?? i} className="text-text-3 text-[10px]">
            {shortDate(p.solvedAt)}
          </span>
        ))}
      </div>
      <p className="text-text-3 text-xs mt-2 text-center">
        Cumulative XP across {timeSeries.length} capture{timeSeries.length === 1 ? '' : 's'} — now at {maxXp} XP (raw, before hint/unlock spend)
      </p>
    </div>
  )
}
