/** @file server/repositories/unlock.repository.js — solution-unlock persistence (pay-to-unlock, one-time). */

import pool from '../db/connection.js';

/** This user's unlock record for a module, or null if never unlocked. */
export async function findUnlock(userId, dockerImage) {
  const [rows] = await pool.execute(
    `SELECT cost, unlocked_at FROM solution_unlocks WHERE user_id = ? AND docker_image = ? LIMIT 1`,
    [userId, dockerImage]
  );
  return rows[0] || null;
}

/**
 * Records a one-time unlock. The UNIQUE(user_id, docker_image) constraint is
 * what actually enforces "one-time" — two concurrent unlock attempts (e.g. a
 * double-click) race on the same INSERT, and the loser hits ER_DUP_ENTRY
 * instead of charging the user twice. That failure is caught here and
 * treated as "already unlocked" rather than propagated as an error.
 */
export async function recordUnlock({ userId, dockerImage, cost }) {
  try {
    await pool.execute(
      `INSERT INTO solution_unlocks (user_id, docker_image, cost) VALUES (?, ?, ?)`,
      [userId, dockerImage, cost]
    );
    return { alreadyUnlocked: false, cost };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const existing = await findUnlock(userId, dockerImage);
      return { alreadyUnlocked: true, cost: existing?.cost ?? cost };
    }
    throw err;
  }
}

/** Total XP this user has spent unlocking solutions, across all modules. */
export async function totalSpentByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(cost), 0) AS total FROM solution_unlocks WHERE user_id = ?`,
    [userId]
  );
  return Number(rows[0].total);
}

/** Per-user spend totals for every user who has unlocked at least one solution — for leaderboard/scoring. */
export async function totalSpentByAllUsers() {
  const [rows] = await pool.execute(
    `SELECT user_id, SUM(cost) AS total FROM solution_unlocks GROUP BY user_id`
  );
  return rows.map((r) => ({ userId: r.user_id, total: Number(r.total) }));
}
