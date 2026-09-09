import { useState, useMemo }  from 'react'
import { Search }             from 'lucide-react'
import { useLeaderboard }     from '@/hooks/useLeaderboard'
import { useAuth }            from '@/hooks/useAuth'
import { Podium }             from '@/components/scoreboard/Podium'
import { LeaderboardTable }   from '@/components/scoreboard/LeaderboardTable'
import { FilterBar }          from '@/components/scoreboard/FilterBar'

const ROLE_LABEL = {
  admin:       'Admin',
  participant: 'MSc student',
}

export function Scoreboard() {
  const { user }      = useAuth()
  const { data: raw = [], isLoading, isError } = useLeaderboard()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const entries = useMemo(() => {
    let list = raw.map(e => ({
      ...e,
      roleLabel:    ROLE_LABEL[e.role] || e.role,
      isCurrentUser: e.id === user?.id,
    }))

    if (filter === 'participant') {
      list = list.filter(e => e.role === 'participant')
    } else if (filter === 'practitioner') {
      list = list.filter(e => e.role === 'practitioner')
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.username.toLowerCase().includes(q))
    }

    return list
  }, [raw, filter, search, user?.id])

  const top3 = entries.slice(0, 3)

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-text-1 text-2xl font-semibold">Scoreboard</h1>
          <p className="text-text-2 text-sm mt-0.5">
            Live rankings across all participants
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <FilterBar value={filter} onChange={setFilter} />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2
                                       text-text-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search participant..."
            className="cb-input pl-8 w-56 text-sm"
          />
        </div>
      </div>

      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl
                        p-4 text-danger text-sm mb-6">
          Failed to load leaderboard.
        </div>
      )}
      {!isLoading && top3.length >= 1 && (
        <div className="mb-8">
          <Podium entries={top3} />
        </div>
      )}
      {isLoading
        ? <LeaderboardSkeleton />
        : <LeaderboardTable entries={entries} />
      }
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 bg-surface rounded-lg animate-pulse" />
      ))}
    </div>
  )
}
