import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import { groupChallengesIntoModules } from '@/lib/challenges'

// GET /api/challenges omits docker_image (needed to group challenges into
// modules) — only GET /api/challenges/:id returns it. Fetch the list for
// `solved` state, then fetch each detail to merge in docker_image.
export function useChallenges() {
  return useQuery({
    queryKey: ['challenges'],
    queryFn: async () => {
      const { data } = await api.get('/challenges')
      const list = data.challenges
      const details = await Promise.all(
        list.map(c => api.get(`/challenges/${c.id}`).then(r => r.data.challenge))
      )
      return list.map((c, i) => ({
        ...c,
        docker_image: details[i]?.docker_image,
      }))
    },
    staleTime: 30_000,
    select: (challenges) => ({
      raw:     challenges,
      modules: groupChallengesIntoModules(challenges),
    }),
  })
}
