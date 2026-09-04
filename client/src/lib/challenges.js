// Attack-sequence order for slugs where the server's natural query order
// (challenge.repository.js findAll: ORDER BY layer, then points ASC) doesn't
// reflect chronological intent. This currently only matters for
// challenge-1's docker layer: sqli-ssh-pivot / sqli-privesc-root /
// sqli-docker-misconfig all carry the same points value (150), so the
// points-based sort ties — and the tie-break falls back to something close
// to row order, which puts sqli-ssh-pivot (added later, a much higher id)
// LAST even though it's the FIRST step of the container-layer attack chain.
const ATTACK_SEQUENCE = [
  'sqli-login', 'sqli-broken-access',
  'sqli-ssh-pivot', 'sqli-privesc-root', 'sqli-docker-misconfig',
  'sqli-iam-exfil',
]

// Sorts a layer's challenge array into ATTACK_SEQUENCE order. Slugs not
// listed there (e.g. challenge-2's module, or a future flag not yet added
// to the sequence above) keep the server's own relative order, placed after
// anything that IS explicitly sequenced — never removed, never reordered
// among themselves.
function bySequence(list) {
  return [...list].sort((a, b) => {
    const ai = ATTACK_SEQUENCE.indexOf(a.slug)
    const bi = ATTACK_SEQUENCE.indexOf(b.slug)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export function groupChallengesIntoModules(challenges) {
  const groups = {}
  for (const c of challenges) {
    const key = c.docker_image || c.slug
    if (!groups[key]) groups[key] = { web: [], container: [], cloud: [] }
    if (c.layer === 'owasp')  groups[key].web.push(c)
    if (c.layer === 'docker') groups[key].container.push(c)
    if (c.layer === 'aws')    groups[key].cloud.push(c)
  }

  // A layer is solved only when EVERY challenge in it is solved (a layer can
  // hold more than one flag, e.g. challenge-1's owasp layer has both
  // sqli-login and sqli-broken-access).
  const layerSolved   = (list) => list.length > 0 && list.every(c => c.solved)
  const layerProgress = (list) => list.length > 0
    ? list.filter(c => c.solved).length / list.length
    : 0

  return Object.values(groups).map(g => {
    const web       = bySequence(g.web)
    const container = bySequence(g.container)
    const cloud     = bySequence(g.cloud)
    const allChallenges = [...web, ...container, ...cloud]
    // Each module is represented by its web (owasp) challenge as the primary
    const primary = web[0]

    return {
      // Identity comes from the (first) web challenge
      id:           primary?.id,
      title:        primary?.title       || container[0]?.title || cloud[0]?.title,
      description:  primary?.description || '',
      category:     primary?.category    || '',
      difficulty:   primary?.difficulty  || 'medium',
      docker_image: primary?.docker_image || '',
      flagCount:    allChallenges.length,
      estimatedMinutes: 60,
      totalPoints:  allChallenges.reduce((sum, c) => sum + (c.points || 0), 0),
      // Per-layer arrays, in attack-sequence order — a layer is no longer
      // assumed to hold exactly one challenge
      webChallenges:       web,
      containerChallenges: container,
      cloudChallenges:     cloud,
      // Per-layer completion (ALL of that layer's flags solved)
      webSolved:          layerSolved(web),
      containerSolved:    layerSolved(container),
      cloudSolved:        layerSolved(cloud),
      // Fractional web-layer progress (e.g. 0.5 with one of two owasp flags solved)
      webProgress: layerProgress(web),
      // Fractional container-layer progress — the docker layer now holds
      // three flags (ssh-pivot, privesc, misconfig), same reasoning as web.
      containerProgress: layerProgress(container),
      // Every challenge id in the module, in attack-sequence order — this is
      // what the socket handshake needs (every flag gets scanned regardless
      // of order) AND what the Flag panel numbers Flag 1/2/3/... from.
      allIds: allChallenges.map(c => c.id).filter(Boolean),
      // Overall module completion
      allSolved: allChallenges.length > 0 && allChallenges.every(c => c.solved),
      anySolved: allChallenges.some(c => c.solved),
    }
  })
}
