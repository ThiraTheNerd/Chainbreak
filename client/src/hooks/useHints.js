import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

// This user's 3-tier hint ladder for ONE specific flag (challengeId).
// Revealed tiers include the persisted hint text + whether it came from
// Claude or the pre-written fallback — server-persisted (hint_unlocks), so
// it survives reloads/new sessions the same way solved-flag progress does.
export function useHintStatus(challengeId) {
  return useQuery({
    queryKey: ['challenges', challengeId, 'hints'],
    queryFn: async () => (await api.get(`/challenges/${challengeId}/hints`)).data,
    enabled: Boolean(challengeId),
    staleTime: 30_000,
  })
}

// Reveals one tier (pass the tier number to `.mutate`). The server enforces
// progressive order, affordability, and idempotency (a repeat call after
// revealing just returns the same persisted hint, no re-charge, no second
// Claude call) — this hook doesn't need to duplicate any of that.
export function useRevealHint(challengeId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tier) => (await api.post(`/challenges/${challengeId}/hints/${tier}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges', challengeId, 'hints'] })
      queryClient.invalidateQueries({ queryKey: ['scores', 'me'] })
    },
  })
}
