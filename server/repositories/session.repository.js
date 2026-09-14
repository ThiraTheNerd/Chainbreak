import pool from '../db/connection.js';

export async function findActiveByUserAndChallenge(userId, challengeId) {
  const [rows] = await pool.query(
    `SELECT * FROM sessions
      WHERE user_id = ? AND challenge_id = ?
        AND status IN ('provisioning','running')
      ORDER BY created_at DESC LIMIT 1`,
    [userId, challengeId],
  );
  return rows[0] ?? null;
}

export async function create({ id, userId, challengeId, expiresAt }) {
  await pool.query(
    `INSERT INTO sessions (id, user_id, challenge_id, status, expires_at)
     VALUES (?, ?, ?, 'provisioning', ?)`,
    [id, userId, challengeId, expiresAt],
  );
  return findById(id);
}

export async function attachContainer(id, { containerId, workstationContainerId, networkId }) {
  await pool.query(
    `UPDATE sessions SET container_id = ?, workstation_container_id = ?, network_id = ?, status = 'running'
      WHERE id = ?`,
    [containerId, workstationContainerId, networkId, id],
  );
}

export async function findExpired() {
  const [rows] = await pool.query(
    `SELECT * FROM sessions WHERE status = 'running' AND expires_at <= NOW()`,
  );
  return rows;
}

/**
 * 'provisioning' rows past their own expiry — e.g. the server crashed
 * mid-provision before the catch block could mark the row 'failed'.
 * findExpired() above only looks at 'running' rows, so a stuck
 * 'provisioning' row is otherwise never selected by anything.
 *
 * The expiry comparison is done in SQL rather than in JS against `new
 * Date()`: this project's mysql2 pool has no explicit `timezone` option,
 * so it parses MySQL's naive DATETIME strings as the Node process's LOCAL
 * timezone before converting to a JS Date. This MySQL server's naive
 * timestamps are actually UTC, so on a host where Node's local TZ isn't
 * also UTC, a JS-side comparison is silently wrong by a full hour.
 * Comparing in SQL sidesteps the timezone question entirely.
 */
export async function findStaleProvisioning() {
  const [rows] = await pool.query(
    `SELECT * FROM sessions WHERE status = 'provisioning' AND expires_at <= NOW()`,
  );
  return rows;
}

// Every session not yet in a terminal state, regardless of TTL — checked
// by reaper.service.js's reconcileStale() directly against Docker rather
// than against any notion of time.
export async function findRunningOrProvisioning() {
  const [rows] = await pool.query(
    `SELECT * FROM sessions WHERE status IN ('running', 'provisioning')`,
  );
  return rows;
}

export async function markEnded(id) {
  await pool.query(
    `UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = ?`,
    [id],
  );
}

export async function markExpired(id) {
  await pool.query(`UPDATE sessions SET status = 'expired' WHERE id = ?`, [id]);
}

export async function markFailed(id) {
  await pool.query(`UPDATE sessions SET status = 'failed' WHERE id = ?`, [id]);
}

export async function lastSessionAt(userId) {
  const [rows] = await pool.query(
    `SELECT MAX(created_at) AS last_session FROM sessions WHERE user_id = ?`,
    [userId],
  );
  return rows[0]?.last_session ?? null;
}

export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT s.*, c.network_alias
       FROM sessions s
       JOIN challenges c ON c.id = s.challenge_id
      WHERE s.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}
