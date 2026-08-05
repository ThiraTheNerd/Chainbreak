import { Flag, History } from 'lucide-react'
import { ProgressEmptyState } from './ProgressEmptyState'
import { timeAgo } from '@/lib/time'

const LAYER_DOT = { web: 'bg-layer-web', container: 'bg-layer-container', cloud: 'bg-layer-cloud' }
const LAYER_LABEL = { web: 'Web', container: 'Container', cloud: 'Cloud' }

export function RecentActivity({ recentActivity }) {
  if (!recentActivity || recentActivity.length === 0) {
    return (
      <ProgressEmptyState
        icon={History}
        message="No flag captures yet — your recent activity will show up here."
      />
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {recentActivity.map(item => (
        <div key={item.challengeId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="w-7 h-7 rounded-lg bg-success/10 text-success flex items-center justify-center flex-shrink-0">
            <Flag size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-1 text-sm truncate">{item.title}</p>
            <p className="text-text-3 text-xs flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${LAYER_DOT[item.layer] || 'bg-text-3'}`} />
              {LAYER_LABEL[item.layer] || item.layer}
              <span>· +{item.points} XP</span>
            </p>
          </div>
          <span className="text-text-3 text-xs flex-shrink-0">{timeAgo(item.solvedAt)}</span>
        </div>
      ))}
    </div>
  )
}
