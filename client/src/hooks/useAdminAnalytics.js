import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

// GET /api/admin/analytics — admin-only, aggregate-only research analytics
// (see server/services/analytics.service.js, which mirrors analysis/*.py's
// math). No per-participant identifiers are ever in this payload.
export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => api.get('/admin/analytics').then(r => r.data),
    staleTime: 30_000,
  })
}
