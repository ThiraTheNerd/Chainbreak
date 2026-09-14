import { TrendingUp } from 'lucide-react'

const DOMAINS = [
  { key: 'web',       label: 'Web security',       color: 'text-layer-web',       max: 10 },
  { key: 'container', label: 'Container security', color: 'text-layer-container', max: 13 },
  { key: 'cloud',     label: 'Cloud security',     color: 'text-layer-cloud',     max: 10 },
]
const TOTAL_MAX = 33

// Pulls both canonical rows from GET /api/assessment/mine so it's visible
// every time the learner opens the Assessment tab, not just right after submitting.
export function MyResultsSummary({ pre, post, isLoading }) {
  if (isLoading) {
    return (
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface-2 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!pre && !post) return null

  const gain = pre && post ? post.total - pre.total : null

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center gap-2 text-text-2 text-xs font-medium uppercase tracking-wide mb-3">
        <TrendingUp size={14} className="text-accent" />
        Your results
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {DOMAINS.map(d => (
          <div key={d.key} className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-text-2 text-xs mb-2">{d.label}</p>
            <div className="flex items-center justify-center gap-2">
              <div>
                <p className="text-text-2 text-xl font-semibold">{pre ? pre[`score_${d.key}`] : '—'}</p>
                <p className="text-text-3 text-[10px]">Pre</p>
              </div>
              <span className="text-text-3 text-sm">→</span>
              <div>
                <p className={`text-xl font-semibold ${d.color}`}>{post ? post[`score_${d.key}`] : '—'}</p>
                <p className="text-text-3 text-[10px]">Post</p>
              </div>
            </div>
            <p className="text-text-3 text-[10px] mt-1">out of {d.max}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 text-center mb-3">
        <p className="text-text-2 text-sm">Total score</p>
        <div className="flex items-center justify-center gap-3 mt-1">
          <p className="text-text-2 text-2xl font-semibold">
            {pre ? pre.total : '—'}<span className="text-text-3 text-sm font-normal">/{TOTAL_MAX}</span>
          </p>
          <span className="text-text-3">→</span>
          <p className="text-text-1 text-2xl font-semibold">
            {post ? post.total : '—'}<span className="text-text-3 text-sm font-normal">/{TOTAL_MAX}</span>
          </p>
        </div>

        {gain !== null ? (
          <p className={`text-sm font-medium mt-2 ${gain > 0 ? 'text-success' : gain < 0 ? 'text-danger' : 'text-text-3'}`}>
            {gain > 0 ? '+' : ''}{gain} point{Math.abs(gain) === 1 ? '' : 's'} knowledge gain
          </p>
        ) : (
          <p className="text-text-3 text-xs mt-2">
            {pre && !post
              ? 'Complete your post-assessment to see your knowledge gain'
              : 'Complete your pre-assessment to get started'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 text-xs text-text-3">
        <span>
          Pre-assessment: {pre ? `${pre.attemptCount} attempt${pre.attemptCount === 1 ? '' : 's'}` : 'not attempted yet'}
        </span>
        <span>
          Post-assessment: {post ? `${post.attemptCount} attempt${post.attemptCount === 1 ? '' : 's'}` : 'not attempted yet'}
        </span>
      </div>
    </div>
  )
}
