import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

// Solution access status: { access: 'completed'|'paid'|'locked', cost,
// unlockedAt, dockerImage }. 'completed' means every flag in the module is
// solved (free, permanent, no charge — see server/services/unlock.service.js
// for why this takes priority over a paid record). 'paid' means a
// solution_unlocks row exists. Either way it's server-persisted, so this
// survives reloads and new sessions the same way solved-flag progress does.
export function useSolutionUnlockStatus(challengeId) {
  return useQuery({
    queryKey: ['challenges', challengeId, 'solution-unlock'],
    queryFn: async () => (await api.get(`/challenges/${challengeId}/solution-unlock`)).data,
    enabled: Boolean(challengeId),
    staleTime: 30_000,
  })
}

// Spends XP once to unlock (a no-op if access is already 'completed' or
// 'paid' — the server never double-charges, and never charges at all for
// completion-based access). This never needs client-side guarding beyond
// hiding the button once access isn't 'locked'.
export function useUnlockSolution(challengeId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post(`/challenges/${challengeId}/solution-unlock`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges', challengeId, 'solution-unlock'] })
      queryClient.invalidateQueries({ queryKey: ['scores', 'me'] })
    },
  })
}
