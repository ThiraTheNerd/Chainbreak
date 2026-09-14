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

// One row per solved challenge, at its first correct-submission timestamp —
// the same dedup rule as scoreForUser() below (distinct solved challenge,
// correct = 1) so a cumulative-XP series built from this never drifts from
// the XP number shown elsewhere.
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

export async function lastActivityAt(userId) {
  const [rows] = await pool.query(
    `SELECT MAX(submitted_at) AS last_activity FROM submissions WHERE user_id = :userId`,
    { userId }
  );
  return rows[0]?.last_activity ?? null;
}

// Points are summed over distinct solved challenges, so submitting the same
// correct flag twice can't be paid twice. Solution-unlock and hint spend are
// then subtracted; `score` is floored at 0 as a defensive backstop (both
// spends are also blocked server-side before they'd go negative).
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

// Every user, ranked, net of solution-unlock and hint spend like
// scoreForUser. LEFT JOINs so zero-solve users still appear, at score 0.
export async function leaderboard(limit = 50) {
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