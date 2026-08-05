import { Link } from 'react-router-dom'

// Shared empty-state block for each Progress chart/card — a new learner
// with zero captures should see a friendly prompt, never a blank or
// broken-looking chart (NaN percentages, an empty SVG path, etc.).
export function ProgressEmptyState({ icon: Icon, message, cta = true }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
      {Icon && <Icon size={28} className="text-text-3 mb-3" />}
      <p className="text-text-2 text-sm max-w-[220px]">{message}</p>
      {cta && (
        <Link
          to="/dashboard"
          className="text-accent text-xs font-medium mt-3 hover:underline"
        >
          Start a challenge →
        </Link>
      )}
    </div>
  )
}
