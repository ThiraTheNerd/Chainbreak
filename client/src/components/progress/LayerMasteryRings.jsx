// Reuses the same fractional-progress definition as the kill-chain graph
// and lib/challenges.js's layerProgress(), aggregated across all modules.
const LAYERS = [
  { key: 'web',       label: 'Web',       sub: 'OWASP',   color: '#388BFD' },
  { key: 'container', label: 'Container', sub: 'Docker',  color: '#2EA043' },
  { key: 'cloud',     label: 'Cloud',     sub: 'AWS',     color: '#D29922' },
]

function Ring({ label, sub, color, captured, total }) {
  const pct = total > 0 ? Math.round((captured / total) * 100) : 0
  const radius = 34
  const stroke = 6
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#30363D" strokeWidth={stroke} />
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-text-1 text-sm font-semibold">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-text-1 text-sm font-medium">{label}</p>
        <p className="text-text-3 text-xs">{sub} · {captured}/{total}</p>
      </div>
    </div>
  )
}

export function LayerMasteryRings({ flagsByLayer }) {
  return (
    <div className="flex items-center justify-around flex-wrap gap-4">
      {LAYERS.map(l => (
        <Ring
          key={l.key}
          label={l.label}
          sub={l.sub}
          color={l.color}
          captured={flagsByLayer?.[l.key]?.captured ?? 0}
          total={flagsByLayer?.[l.key]?.total ?? 0}
        />
      ))}
    </div>
  )
}
