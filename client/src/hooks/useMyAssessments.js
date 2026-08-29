import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

// GET /api/assessment/mine — the caller's own canonical (attempt_number = 1)
// pre/post rows, each carrying attemptCount (how many times that type was
// ever submitted, including resubmissions). See server/routes/assessment.js.
export function useMyAssessments() {
  return useQuery({
    queryKey: ['assessment', 'mine'],
    queryFn: () => api.get('/assessment/mine').then(r => r.data),
    staleTime: 30_000,
  })
}
