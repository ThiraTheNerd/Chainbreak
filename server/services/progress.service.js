
import * as scoreService from './score.service.js';
import * as challengeRepository from '../repositories/challenge.repository.js';
import * as submissionRepository from '../repositories/submission.repository.js';
import * as completionRepository from '../repositories/completion.repository.js';
import * as hintRepository from '../repositories/hint.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';

const LAYER_KEY = { owasp: 'web', docker: 'container', aws: 'cloud' };

function emptyLayerBucket() {
  return { captured: 0, total: 0 };
}

export async function getMyProgress(userId) {
  const [score, challenges, history, hintTiers, lastSubmissionAt, lastSessionAt] = await Promise.all([
    scoreService.getMyScore(userId),
    challengeRepository.findAll({ userId }),
    completionRepository.history(userId),
    hintRepository.tierBreakdownForUser(userId),
    submissionRepository.lastActivityAt(userId),
    sessionRepository.lastSessionAt(userId),
  ]);

  const flagsByLayer = { web: emptyLayerBucket(), container: emptyLayerBucket(), cloud: emptyLayerBucket() };
  for (const c of challenges) {
    const key = LAYER_KEY[c.layer];
    if (!key) continue;
    flagsByLayer[key].total += 1;
    if (c.solved) flagsByLayer[key].captured += 1;
  }

  // Uses the same distinct-challenge dedup rule as scoreForUser(), so the
  // final cumulative value always equals the raw (pre-spend) score.
  let cumulativeXp = 0;
  const timeSeries = history.map((row, i) => {
    cumulativeXp += row.points;
    return {
      challengeId: row.challenge_id,
      title: row.title,
      layer: LAYER_KEY[row.layer] || row.layer,
      points: row.points,
      solvedAt: row.solved_at,
      cumulativeXp,
      cumulativeFlags: i + 1,
    };
  });

  const owaspCoverage = [];
  const categoryIndex = new Map();
  for (const row of history) {
    if (row.layer !== 'owasp') continue;
    const category = row.category || 'Uncategorised';
    if (!categoryIndex.has(category)) {
      categoryIndex.set(category, owaspCoverage.length);
      owaspCoverage.push({ category, count: 0 });
    }
    owaspCoverage[categoryIndex.get(category)].count += 1;
  }

  const hintCount = hintTiers.reduce((sum, t) => sum + t.count, 0);

  // Most recent of any submission attempt (not just a correct one) or
  // session start.
  const activityTimestamps = [lastSubmissionAt, lastSessionAt]
    .filter(Boolean)
    .map((d) => new Date(d).getTime());
  const lastActiveAt = activityTimestamps.length
    ? new Date(Math.max(...activityTimestamps)).toISOString()
    : null;

  const recentActivity = [...history].reverse().slice(0, 8).map((row) => ({
    challengeId: row.challenge_id,
    title: row.title,
    layer: LAYER_KEY[row.layer] || row.layer,
    points: row.points,
    solvedAt: row.solved_at,
  }));

  return {
    xp: score.score,
    rawXp: score.rawScore,
    unlockSpend: score.unlockSpend,
    hintSpend: score.hintSpend,
    solvedCount: score.solvedCount,
    totalFlags: challenges.length,
    flagsCaptured: challenges.filter((c) => c.solved).length,
    flagsByLayer,
    hintCount,
    hintTierBreakdown: hintTiers,
    lastActiveAt,
    timeSeries,
    owaspCoverage,
    recentActivity,
  };
}
