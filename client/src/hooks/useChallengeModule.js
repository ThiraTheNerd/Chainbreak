import { useMemo } from 'react'
import { useChallenges } from './useChallenges'

// GET /api/challenges (list) omits docker_image, so filtering list rows by
// docker_image (as the naive version of this hook would) always comes up
// empty. useChallenges() already merges docker_image in via per-id detail
// fetches and groups into modules — reuse that cache instead of doing the
// same N+1 fetch a second time here.
export function useChallengeModule(challengeId) {
  const { data, ...rest } = useChallenges()

  const module = useMemo(() => {
    if (!data?.modules || !challengeId) return null
    const found = data.modules.find(m => m.allIds?.includes(challengeId))
    if (!found) return null

    return {
      // Module identity — first web (owasp) challenge, same as `id`/`title` above
      entry:     found.webChallenges[0] || found.containerChallenges[0] || found.cloudChallenges[0],
      web:       found.webChallenges,
      container: found.containerChallenges,
      cloud:     found.cloudChallenges,
      webProgress: found.webProgress,
      containerProgress: found.containerProgress,
      // Every challenge id in the module — the socket handshake needs ALL of
      // them so every flag in a layer (not just one) gets scanned.
      allIds: found.allIds,
    }
  }, [data, challengeId])

  return { ...rest, data: module }
}
