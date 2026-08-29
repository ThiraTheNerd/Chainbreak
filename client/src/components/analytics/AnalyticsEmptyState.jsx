// Shared empty state for a Research Analytics chart — this dashboard reads
// live DB aggregates only (see server/services/analytics.service.js), so
// "not enough real data yet" must always render as this honest message,
// never as a zeroed or placeholder-looking chart.
export function AnalyticsEmptyState({ icon: Icon, message }) {
  return (
    <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center py-8 px-4">
      {Icon && <Icon size={26} className="text-text-3 mb-3" />}
      <p className="text-text-2 text-sm max-w-[280px]">{message}</p>
    </div>
  )
}
