import { PieChart } from 'lucide-react'
import { ProgressEmptyState } from './ProgressEmptyState'

// flagsByLayer: { web: {captured,total}, container: {...}, cloud: {...} } —
// the exact same per-layer captured/total counts the kill-chain graph and
// Dashboard's flag count are built from (server/services/progress.service.js).
const LAYERS = [
  { key: 'web',       label: 'Web (OWASP)',    color: '#388BFD', className: 'bg-layer-web' },
  { key: 'container', label: 'Container (Docker)', color: '#2EA043', className: 'bg-layer-container' },
  { key: 'cloud',     label: 'Cloud (AWS)',    color: '#D29922', className: 'bg-layer-cloud' },
]

export function FlagDonutChart({ flagsByLayer }) {
  const segments = LAYERS.map(l => ({ ...l, captured: flagsByLayer?.[l.key]?.captured ?? 0 }))
  const totalCaptured = segments.reduce((sum, s) => sum + s.captured, 0)

  if (totalCaptured === 0) {
    return (
      <ProgressEmptyState
        icon={PieChart}
        message="No flags captured yet — your layer breakdown will appear here."
      />
    )
  }

  const radius = 60
  const stroke = 20
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <div className="flex items-center gap-6 flex-wrap justify-center">
      <div className="relative w-[160px] h-[160px] flex-shrink-0">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#30363D" strokeWidth={stroke} />
          {segments.filter(s => s.captured > 0).map(s => {
            const fraction = s.captured / totalCaptured
            const dash = fraction * circumference
            const offset = -cumulative * circumference
            cumulative += fraction
            return (
              <circle
                key={s.key}
                cx="80" cy="80" r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                className="transition-all duration-700"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-text-1 text-2xl font-semibold leading-none">{totalCaptured}</span>
          <span className="text-text-3 text-[11px] mt-1">flags captured</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 min-w-[160px]">
        {segments.map(s => {
          const pct = totalCaptured > 0 ? Math.round((s.captured / totalCaptured) * 100) : 0
          return (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.className}`} />
              <span className="text-text-2 flex-1">{s.label}</span>
              <span className="text-text-1 font-medium tabular-nums">{s.captured}</span>
              <span className="text-text-3 text-xs w-9 text-right tabular-nums">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
