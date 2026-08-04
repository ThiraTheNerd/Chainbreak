/** @file server/repositories/hint.repository.js — AI-hint persistence (one-time per tier). */

import pool from '../db/connection.js';

/** This user's unlock row for one specific (challenge, tier), or null. */
export async function findUnlock(userId, challengeId, tier) {
  const [rows] = await pool.execute(
    `SELECT tier, cost, hint_text, source, created_at FROM hint_unlocks
      WHERE user_id = ? AND challenge_id = ? AND tier = ? LIMIT 1`,
    [userId, challengeId, tier]
  );
  return rows[0] || null;
}

/** All of this user's revealed tiers for one challenge, in tier order. */
export async function findUnlocksForChallenge(userId, challengeId) {
  const [rows] = await pool.execute(
    `SELECT tier, cost, hint_text, source, created_at FROM hint_unlocks
      WHERE user_id = ? AND challenge_id = ? ORDER BY tier ASC`,
    [userId, challengeId]
  );
  return rows;
}

/**
 * Records a one-time tier reveal. The UNIQUE(user_id, challenge_id, tier)
 * constraint is what actually enforces "never re-charged" — a concurrent
 * double-click races on the same INSERT, and the loser hits ER_DUP_ENTRY
 * instead of paying (and generating a second Claude call) twice.
 */
export async function recordUnlock({ userId, challengeId, tier, cost, hintText, source }) {
  try {
    await pool.execute(
      `INSERT INTO hint_unlocks (user_id, challenge_id, tier, cost, hint_text, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, challengeId, tier, cost, hintText, source]
    );
    return { alreadyUnlocked: false, cost, hintText, source };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const existing = await findUnlock(userId, challengeId, tier);
      return {
        alreadyUnlocked: true,
        cost: existing?.cost ?? cost,
        hintText: existing?.hint_text ?? hintText,
        source: existing?.source ?? source,
      };
    }
    throw err;
  }
}

/** Total XP this user has spent revealing hints, across all challenges. */
export async function totalSpentByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(cost), 0) AS total FROM hint_unlocks WHERE user_id = ?`,
    [userId]
  );
  return Number(rows[0].total);
}

/** This user's hint reveals grouped by tier — count + spend per tier, for
 *  the Progress dashboard's hint-usage breakdown. */
export async function tierBreakdownForUser(userId) {
  const [rows] = await pool.execute(
    `SELECT tier, COUNT(*) AS count, COALESCE(SUM(cost), 0) AS spent
       FROM hint_unlocks WHERE user_id = ? GROUP BY tier ORDER BY tier`,
    [userId]
  );
  return rows.map((r) => ({ tier: r.tier, count: Number(r.count), spent: Number(r.spent) }));
}

/** Per-user spend totals for everyone who has revealed at least one hint — for scoring. */
export async function totalSpentByAllUsers() {
  const [rows] = await pool.execute(
    `SELECT user_id, SUM(cost) AS total FROM hint_unlocks GROUP BY user_id`
  );
  return rows.map((r) => ({ userId: r.user_id, total: Number(r.total) }));
}

/**
 * Research export: every hint reveal, across every user — the raw data for
 * "hint depth vs learning outcome" analysis. Admin-only at the route level
 * (see server/routes/hints.js).
 */
export async function allHintReveals() {
  const [rows] = await pool.execute(
    `SELECT h.user_id, u.username, h.challenge_id, c.slug, c.title,
            h.tier, h.cost, h.source, h.created_at
       FROM hint_unlocks h
       JOIN users u      ON u.id = h.user_id
       JOIN challenges c ON c.id = h.challenge_id
      ORDER BY h.created_at ASC`
  );
  return rows;
}
