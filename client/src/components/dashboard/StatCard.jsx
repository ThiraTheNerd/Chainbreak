export function StatCard({ label, value, subtext, icon: Icon, iconColor }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-2 text-sm mb-1">{label}</p>
          <p className="text-text-1 text-4xl font-semibold leading-none">
            {value ?? '—'}
          </p>
          {subtext && (
            <p className="text-text-3 text-sm mt-1">{subtext}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg bg-surface-2 ${iconColor}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  )
}
