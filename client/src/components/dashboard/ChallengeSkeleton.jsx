export function ChallengeSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl
                    border-l-4 border-l-border p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 w-32 bg-surface-2 rounded" />
        <div className="h-5 w-16 bg-surface-2 rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-surface-2 rounded mb-2" />
      <div className="h-4 w-full bg-surface-2 rounded mb-1" />
      <div className="h-4 w-2/3 bg-surface-2 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-surface-2 rounded-full" />
        <div className="h-6 w-24 bg-surface-2 rounded-full" />
        <div className="h-6 w-16 bg-surface-2 rounded-full" />
      </div>
    </div>
  )
}
