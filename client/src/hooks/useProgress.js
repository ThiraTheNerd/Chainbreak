import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

// GET /api/progress/me — the extra shapes the Progress dashboard needs that
// no existing endpoint exposes (time series, OWASP/hint-tier breakdowns,
// last-active). XP/solvedCount on this payload are the SAME values
// /api/scores/me returns (see server/services/progress.service.js) — this
// hook doesn't duplicate that call, the Progress page also uses useScores()
// directly for the top-line XP figure, same as the Dashboard does.
export function useProgress() {
  return useQuery({
    queryKey: ['progress', 'me'],
    queryFn: () => api.get('/progress/me').then(r => r.data),
    staleTime: 30_000,
  })
}
