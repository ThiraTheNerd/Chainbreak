import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

const CONSENT_STATUS_KEY = ['consent', 'me']

// GET /api/consent/me — { completed, consented, withdrawn, exempt, ... }.
// staleTime: 0 because this result gates access to the whole app: a stale
// "not consented" is harmless (worst case, an extra redirect to /consent
// that immediately resolves), but a stale "consented" surviving a
// withdrawal would not be. See ConsentGate.jsx for how this is used.
export function useConsentStatus() {
  return useQuery({
    queryKey: CONSENT_STATUS_KEY,
    queryFn: () => api.get('/consent/me').then(r => r.data),
    staleTime: 0,
  })
}

// POST /api/consent — server derives `consented`, never trusts a
// client-sent flag (see server/services/consent.service.js). Invalidates
// the status query so ConsentGate re-evaluates immediately on success.
export function useSubmitConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.post('/consent', payload).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONSENT_STATUS_KEY }),
  })
}
