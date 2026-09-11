import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

// The Progress page also calls useScores() directly for the top-line XP
// figure rather than relying on the (duplicate) value in this payload.
export function useProgress() {
  return useQuery({
    queryKey: ['progress', 'me'],
    queryFn: () => api.get('/progress/me').then(r => r.data),
    staleTime: 30_000,
  })
}
