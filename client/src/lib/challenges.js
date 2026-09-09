// Attack-sequence order for slugs where the server's natural query order
// doesn't reflect chronological intent — challenge-1's docker layer has
// three flags with the same points value, so a points-based sort ties and
// falls back to row order, which puts sqli-ssh-pivot (added later, a much
// higher id) last even though it's the first step of that attack chain.
const ATTACK_SEQUENCE = [
  'sqli-login', 'sqli-broken-access',
  'sqli-ssh-pivot', 'sqli-privesc-root', 'sqli-docker-misconfig',
  'sqli-iam-exfil',
]

// Slugs not listed in ATTACK_SEQUENCE keep the server's own relative order,
// placed after anything that is explicitly sequenced.
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

  // A layer is solved only when every challenge in it is solved.
  const layerSolved   = (list) => list.length > 0 && list.every(c => c.solved)
  const layerProgress = (list) => list.length > 0
    ? list.filter(c => c.solved).length / list.length
    : 0

  return Object.values(groups).map(g => {
    const web       = bySequence(g.web)
    const container = bySequence(g.container)
    const cloud     = bySequence(g.cloud)
    const allChallenges = [...web, ...container, ...cloud]
    const primary = web[0]

    return {
      id:           primary?.id,
      title:        primary?.title       || container[0]?.title || cloud[0]?.title,
      description:  primary?.description || '',
      category:     primary?.category    || '',
      difficulty:   primary?.difficulty  || 'medium',
      docker_image: primary?.docker_image || '',
      flagCount:    allChallenges.length,
      estimatedMinutes: 60,
      totalPoints:  allChallenges.reduce((sum, c) => sum + (c.points || 0), 0),
      webChallenges:       web,
      containerChallenges: container,
      cloudChallenges:     cloud,
      webSolved:          layerSolved(web),
      containerSolved:    layerSolved(container),
      cloudSolved:        layerSolved(cloud),
      webProgress: layerProgress(web),
      containerProgress: layerProgress(container),
      // In attack-sequence order — this is what the socket handshake needs
      // and what the Flag panel numbers Flag 1/2/3/... from.
      allIds: allChallenges.map(c => c.id).filter(Boolean),
      allSolved: allChallenges.length > 0 && allChallenges.every(c => c.solved),
      anySolved: allChallenges.some(c => c.solved),
    }
  })
}
