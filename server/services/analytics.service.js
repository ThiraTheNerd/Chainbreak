

import * as analyticsRepository from '../repositories/analytics.repository.js';

const DOMAIN_MAX = { web: 10, container: 13, cloud: 10 };
const KNOWLEDGE_MAX = 33;

// Matches run_analysis.py's own floor ("[ERROR] Need at least 2 complete
// pairs to analyse") — below this a mean/gain is not a result, just noise.
const MIN_PAIRS_FOR_RESULT = 2;

// Bangor/Sauro's published industry-average SUS score, used as the
// reference line in the dashboard's usability gauge. The Python pipeline
// doesn't compute a SUS aggregate itself (sus_score is stored by the server
// at submission time — see assessment.js's computeSusScore() — but never
// summarised in analysis/*.py), so this endpoint takes the mean of that
// already-server-computed field; nothing about SUS scoring is reimplemented.
const SUS_BENCHMARK = 68;

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function round(x, dp) {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

function normalisedGain(pre, post, max) {
  const headroom = max - pre;
  return headroom > 0 ? (post - pre) / headroom : null;
}

function pairAssessmentsByUser(rows) {
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, {});
    byUser.get(row.user_id)[row.type] = row;
  }
  const pairs = [];
  for (const phases of byUser.values()) {
    if (phases.pre && phases.post) pairs.push(phases);
  }
  return pairs;
}

function domainValue(row, domain) {
  return domain === 'total'
    ? row.score_web + row.score_container + row.score_cloud
    : row[`score_${domain}`];
}

function analyseDomain(pairs, domain, max) {
  const pres = [];
  const posts = [];
  const gains = [];
  for (const { pre, post } of pairs) {
    const preScore = domainValue(pre, domain);
    const postScore = domainValue(post, domain);
    pres.push(preScore);
    posts.push(postScore);
    const g = normalisedGain(preScore, postScore, max);
    if (g !== null) gains.push(g);
  }
  const n = pairs.length;
  return {
    domain,
    maxScore: max,
    n,
    meanPrePct: n ? round((100 * mean(pres)) / max, 1) : null,
    meanPostPct: n ? round((100 * mean(posts)) / max, 1) : null,
    normGain: gains.length ? round(mean(gains), 3) : null,
    sufficient: n >= MIN_PAIRS_FOR_RESULT,
  };
}

// Same buckets/order as analysis/hint_analysis.py's depth_bucket(): hints
// are revealed progressively (hint.service.js enforces tier order), so the
// deepest tier reached already implies every lower tier was used too.
function depthBucket(maxTier) {
  if (maxTier <= 1) return 'Tier 1 only';
  if (maxTier === 2) return 'Up to Tier 2';
  return 'Up to Tier 3';
}

function analyseRq1(assessmentRows) {
  const pairs = pairAssessmentsByUser(assessmentRows);
  return {
    minPairsRequired: MIN_PAIRS_FOR_RESULT,
    domains: {
      web: analyseDomain(pairs, 'web', DOMAIN_MAX.web),
      container: analyseDomain(pairs, 'container', DOMAIN_MAX.container),
      cloud: analyseDomain(pairs, 'cloud', DOMAIN_MAX.cloud),
      total: analyseDomain(pairs, 'total', KNOWLEDGE_MAX),
    },
  };
}

function analyseUsability(assessmentRows) {
  // Only 'post' rows carry a sus_score (server only asks the usability
  // instrument post-session — see server/routes/assessment.js).
  const susScores = assessmentRows
    .filter((r) => r.type === 'post' && r.sus_score !== null && r.sus_score !== undefined)
    .map((r) => Number(r.sus_score));
  return {
    n: susScores.length,
    meanSus: susScores.length ? round(mean(susScores), 1) : null,
    benchmark: SUS_BENCHMARK,
    sufficient: susScores.length >= MIN_PAIRS_FOR_RESULT,
  };
}

function analyseHints(hintRows, totalParticipants) {
  if (hintRows.length === 0) {
    // Matches hint_analysis.py's own early return when hint_unlocks is
    // empty: no behavioural report is computed at all, not a zeroed one.
    return {
      sufficient: false,
      uptake: null,
      depthDistribution: [],
      sourceBreakdown: [],
    };
  }

  const perParticipant = new Map();
  for (const row of hintRows) {
    if (!perParticipant.has(row.user_id)) {
      perParticipant.set(row.user_id, { maxTier: 0 });
    }
    const p = perParticipant.get(row.user_id);
    p.maxTier = Math.max(p.maxTier, row.tier);
  }

  const usedCount = perParticipant.size;
  const neverUsed = Math.max(0, totalParticipants - usedCount);
  const bucketCounts = { 'Tier 1 only': 0, 'Up to Tier 2': 0, 'Up to Tier 3': 0 };
  for (const p of perParticipant.values()) {
    bucketCounts[depthBucket(p.maxTier)] += 1;
  }
  const depthDistribution = [
    { bucket: 'No hints used', participants: neverUsed },
    { bucket: 'Tier 1 only', participants: bucketCounts['Tier 1 only'] },
    { bucket: 'Up to Tier 2', participants: bucketCounts['Up to Tier 2'] },
    { bucket: 'Up to Tier 3', participants: bucketCounts['Up to Tier 3'] },
  ];

  const totalEvents = hintRows.length;
  const aiCount = hintRows.filter((r) => r.source === 'ai').length;
  const fallbackCount = totalEvents - aiCount;
  const sourceBreakdown = [
    { source: 'ai', count: aiCount, pct: round((100 * aiCount) / totalEvents, 1) },
    { source: 'fallback', count: fallbackCount, pct: round((100 * fallbackCount) / totalEvents, 1) },
  ];

  return {
    sufficient: true,
    uptake: {
      used: usedCount,
      totalParticipants,
      pct: totalParticipants ? round((100 * usedCount) / totalParticipants, 1) : null,
    },
    depthDistribution,
    sourceBreakdown,
  };
}

export async function getResearchAnalytics() {
  const [assessmentRows, hintRows, totalParticipants] = await Promise.all([
    analyticsRepository.canonicalAssessments(),
    analyticsRepository.allHintUnlocks(),
    analyticsRepository.totalParticipantCount(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    rq1: analyseRq1(assessmentRows),
    usability: analyseUsability(assessmentRows),
    hints: analyseHints(hintRows, totalParticipants),
  };
}
