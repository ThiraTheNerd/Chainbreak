import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

// Permanent solve state (from `submissions`) for a challenge's module,
// keyed by layer — { solved: { owasp, docker, aws }, capturedFlagValues, hasActiveSession }.
export function useChallengeProgress(challengeId) {
  return useQuery({
    queryKey: ['challenges', challengeId, 'progress'],
    queryFn: async () => {
      const { data } = await api.get(`/challenges/${challengeId}/progress`)
      return data
    },
    enabled: Boolean(challengeId),
    staleTime: 30_000,
  })
}
