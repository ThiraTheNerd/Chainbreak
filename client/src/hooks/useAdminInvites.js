import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

// Admin-only invite-code management — GET/POST /api/admin/invites.
// See server/services/invite.service.js and server/controllers/invite.controller.js.
export function useInviteCodes() {
  return useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: () => api.get('/admin/invites').then(r => r.data.codes),
    staleTime: 10_000,
  })
}

export function useGenerateInviteCodes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.post('/admin/invites', payload).then(r => r.data.codes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  })
}

export function useRevokeInviteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.post(`/admin/invites/${id}/revoke`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  })
}
