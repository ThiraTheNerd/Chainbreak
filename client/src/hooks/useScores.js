import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

export function useScores() {
  return useQuery({
    queryKey: ['scores', 'me'],
    queryFn:  () => api.get('/scores/me').then(r => r.data),
    staleTime: 30_000,
  })
}
