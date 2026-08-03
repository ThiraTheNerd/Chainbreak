/** @file server/repositories/submission.repository.js — attempts + score aggregation. */

import pool from '../db/connection.js';

export async function hasSolved(userId, challengeId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM submissions
      WHERE user_id = :userId AND challenge_id = :challengeId AND correct = 1
      LIMIT 1`,
    { userId, challengeId }
  );
  return rows.length > 0;
}

export async function record({ userId, challengeId, correct }) {
  const [result] = await pool.query(
    `INSERT INTO submissions (user_id, challenge_id, correct)
     VALUES (:userId, :challengeId, :correct)`,
    { userId, challengeId, correct: correct ? 1 : 0 }
  );
  return { id: result.insertId };
}

/**
 * One row per solved challenge, at its FIRST correct-submission timestamp,
 * in solve order — for the Progress dashboard's time series, recent-activity
 * list, and OWASP coverage. Deliberately the SAME dedup rule as
 * scoreForUser() above (DISTINCT solved challenge, correct = 1) so a
 * cumulative-XP series built from this never drifts from the XP number
 * shown elsewhere.
 */
export async function solveHistory(userId) {
  const [rows] = await pool.query(
    `SELECT c.id AS challenge_id, c.title, c.layer, c.category, c.points,
            MIN(s.submitted_at) AS solved_at
       FROM submissions s
       JOIN challenges c ON c.id = s.challenge_id
      WHERE s.user_id = :userId AND s.correct = 1
      GROUP BY c.id, c.title, c.layer, c.category, c.points
      ORDER BY solved_at ASC`,
    { userId }
  );
  return rows;
}

/** Most recent submission (correct or not) — an attempt still counts as
 *  activity for the Progress dashboard's "last active" stat. */
export async function lastActivityAt(userId) {
  const [rows] = await pool.query(
    `SELECT MAX(submitted_at) AS last_activity FROM submissions WHERE user_id = :userId`,
    { userId }
  );
  return rows[0]?.last_activity ?? null;
}

/**
 * A user's score. Points are summed over DISTINCT solved challenges, so a user
 * who submits the same correct flag twice cannot be paid twice. Solution-
 * unlock spend (server/repositories/unlock.repository.js) AND hint spend
 * (server/repositories/hint.repository.js) are then subtracted — both are
 * one-time XP costs (per module for solutions, per tier for hints; see
 * unlock.service.js / hint.service.js). `score` is floored at 0 so the
 * displayed/usable XP is never negative (both spends are also blocked
 * server-side if they'd go negative in the first place — this floor is the
 * defensive backstop, not the normal path).
 */
export async function scoreForUser(userId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(c.points), 0) AS score,
            COUNT(DISTINCT c.id)       AS solved_count
       FROM (SELECT DISTINCT user_id, challenge_id
               FROM submissions WHERE correct = 1 AND user_id = :userId) s
       JOIN challenges c ON c.id = s.challenge_id`,
    { userId }
  );
  const rawScore = Number(rows[0].score);
  const solvedCount = Number(rows[0].solved_count);

  const [unlockRows] = await pool.query(
    `SELECT COALESCE(SUM(cost), 0) AS spent FROM solution_unlocks WHERE user_id = :userId`,
    { userId }
  );
  const unlockSpend = Number(unlockRows[0].spent);

  const [hintRows] = await pool.query(
    `SELECT COALESCE(SUM(cost), 0) AS spent FROM hint_unlocks WHERE user_id = :userId`,
    { userId }
  );
  const hintSpend = Number(hintRows[0].spent);

  return {
    score: Math.max(0, rawScore - unlockSpend - hintSpend),
    solvedCount,
    rawScore,
    unlockSpend,
    hintSpend,
  };
}

/** Leaderboard: every user, ranked (zero-solve users included at score 0).
 *  Score here is also net of solution-unlock AND hint spend, same as scoreForUser. */
export async function leaderboard(limit = 50) {
  // The derived table `s` collapses each solved challenge to ONE row per user
  // (with the time it was first solved), so a challenge solved/submitted many
  // times can't inflate SUM(points). No second join back to `submissions`.
  // LEFT JOINs (not INNER) so users with zero solves still appear, at score 0.
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.role,
            COALESCE(SUM(c.points), 0) AS raw_score,
            COUNT(c.id)                AS solved_count,
            MAX(s.solved_at)           AS last_solve
       FROM users u
       LEFT JOIN (
         SELECT user_id, challenge_id, MIN(submitted_at) AS solved_at
           FROM submissions
          WHERE correct = 1
          GROUP BY user_id, challenge_id
       ) s ON s.user_id = u.id
       LEFT JOIN challenges c ON c.id = s.challenge_id
      GROUP BY u.id, u.username, u.role`
  );

  // Fetched separately (not joined into the query above) to keep the score
  // subtraction as simple, obviously-correct JS rather than a GROUP BY that
  // has to reason about two more aggregates' functional dependency.
  const [unlockSpendRows] = await pool.query(
    `SELECT user_id, SUM(cost) AS spent FROM solution_unlocks GROUP BY user_id`
  );
  const [hintSpendRows] = await pool.query(
    `SELECT user_id, SUM(cost) AS spent FROM hint_unlocks GROUP BY user_id`
  );
  const unlockSpendByUser = new Map(unlockSpendRows.map((r) => [r.user_id, Number(r.spent)]));
  const hintSpendByUser   = new Map(hintSpendRows.map((r) => [r.user_id, Number(r.spent)]));

  const withScores = rows.map((r) => {
    const spend = (unlockSpendByUser.get(r.id) || 0) + (hintSpendByUser.get(r.id) || 0);
    return {
      id: r.id,
      username: r.username,
      role: r.role,
      score: Math.max(0, Number(r.raw_score) - spend),
      solvedCount: Number(r.solved_count),
      lastSolve: r.last_solve,
    };
  });

  // Ties broken by who got there first — a fair, explainable ranking rule.
  withScores.sort((a, b) =>
    b.score - a.score ||
    new Date(a.lastSolve || 0) - new Date(b.lastSolve || 0)
  );

  return withScores.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    id: r.id,
    username: r.username,
    role: r.role,
    score: r.score,
    solvedCount: r.solvedCount,
  }));
}