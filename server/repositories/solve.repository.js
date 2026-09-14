import pool from '../db/connection.js';

// INSERT IGNORE + the UNIQUE key = first solve scores, replays are no-ops.
export async function recordSolve({ userId, challengeId, sessionId, points }) {
  const [res] = await pool.query(
    `INSERT IGNORE INTO solves (user_id, challenge_id, session_id, points)
     VALUES (?, ?, ?, ?)`,
    [userId, challengeId, sessionId, points],
  );
  return res.affectedRows === 1;   // false => already solved
}

export async function leaderboard() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username,
            COALESCE(SUM(s.points), 0) AS score,
            MAX(s.solved_at) AS last_solve
       FROM users u
       LEFT JOIN solves s ON s.user_id = u.id
      GROUP BY u.id, u.username
      ORDER BY score DESC, last_solve ASC`,   // ties broken by who finished first
  );
  return rows;
}