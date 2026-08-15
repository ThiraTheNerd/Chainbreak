import pool from '../db/connection.js';


export async function createIfFirst({ userId, challengeId, learnerSessionId, submissionId, pointsAwarded }, conn = pool) {
  const [result] = await conn.query(
    `INSERT IGNORE INTO completions
       (user_id, challenge_id, learner_session_id, submission_id, points_awarded, completed_at)
     VALUES (:userId, :challengeId, :learnerSessionId, :submissionId, :pointsAwarded, NOW())`,
    { userId, challengeId, learnerSessionId, submissionId, pointsAwarded }
  );
  return result.affectedRows === 1; // true => this call created the first (and only) completion
}

export async function hasCompleted(userId, challengeId) {
  if (challengeId == null) return true;
  const [rows] = await pool.query(
    `SELECT 1 FROM completions WHERE user_id = :userId AND challenge_id = :challengeId LIMIT 1`,
    { userId, challengeId }
  );
  return rows.length > 0;
}

// Completions-based equivalent of submission.repository.js::solveHistory —
// one row per completed challenge, ordered by when it was completed.
export async function history(userId) {
  const [rows] = await pool.query(
    `SELECT c.id AS challenge_id, c.title, c.layer, c.category, c.points,
            co.completed_at AS solved_at
       FROM completions co
       JOIN challenges c ON c.id = co.challenge_id
      WHERE co.user_id = :userId
      ORDER BY co.completed_at ASC`,
    { userId }
  );
  return rows;
}

// Completions-based equivalent of submission.repository.js::scoreForUser —
// kept side-by-side with the submissions-based version so the two can be
// compared for every user before score.service.js is switched over (see
// SESSION_ATTEMPT_COMPLETION_MIGRATION_PLAN.md section 6). Same
// hint/solution spend subtraction, same floor-at-zero.
export async function scoreForUser(userId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(points_awarded), 0) AS score, COUNT(*) AS solved_count
       FROM completions WHERE user_id = :userId`,
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

// Completions-based equivalent of submission.repository.js::leaderboard.
export async function leaderboard(limit = 50) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.role,
            COALESCE(SUM(co.points_awarded), 0) AS raw_score,
            COUNT(co.id)                        AS solved_count,
            MAX(co.completed_at)                AS last_solve
       FROM users u
       LEFT JOIN completions co ON co.user_id = u.id
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
