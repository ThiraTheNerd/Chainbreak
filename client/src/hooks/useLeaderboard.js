import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

export function useLeaderboard() {
  return useQuery({
    queryKey:        ['scores', 'leaderboard'],
    queryFn:         () => api.get('/scores/leaderboard').then(r => r.data.leaderboard),
    staleTime:       20_000,
    refetchInterval: 30_000,   // poll every 30 seconds
  })
}
