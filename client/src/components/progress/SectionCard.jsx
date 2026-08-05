// Shared chrome for a Progress dashboard section: title + optional icon,
// consistent card styling (matches StatCard/ChallengeSkeleton elsewhere).
export function SectionCard({ title, icon: Icon, iconColor = 'text-accent', right, children, className = '' }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text-1 text-sm font-medium flex items-center gap-2">
          {Icon && <Icon size={15} className={iconColor} />}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  )
}
