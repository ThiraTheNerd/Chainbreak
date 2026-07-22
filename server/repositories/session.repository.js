// repositories/session.repository.js
import pool from '../db/connection.js';   // default export IS the mysql2 pool

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
// --- NEW: the reaper's two hooks ---
export async function findExpired() {
  const [rows] = await pool.query(
    `SELECT * FROM sessions WHERE status = 'running' AND expires_at <= NOW()`,
  );
  return rows;   // snake_case rows — teardown() reads them directly
}

/**
 * 'provisioning' rows past their OWN expiry — e.g. the server crashed
 * mid-`await dockerService.provision(...)`, before the catch block could
 * mark the row 'failed'. findExpired() above deliberately only looks at
 * 'running' rows, so a stuck 'provisioning' row is otherwise never
 * selected by anything, no matter how old it gets (confirmed by testing).
 *
 * The expiry comparison is done HERE, in SQL — deliberately mirroring
 * findExpired()'s own `expires_at <= NOW()` pattern — rather than in JS
 * against `new Date()`. That distinction matters: this project's mysql2
 * pool has no explicit `timezone` option, so it parses MySQL's naive
 * DATETIME strings as being in the Node process's LOCAL timezone before
 * converting to a JS Date. This MySQL server's own naive timestamps are
 * actually UTC (`time_zone=SYSTEM`, matching its container's UTC clock),
 * so on any host where Node's local TZ isn't ALSO UTC, a JS-side
 * `new Date(row.expires_at) > new Date()` comparison is silently wrong by
 * a full hour (verified live in this exact dev environment: Node reports
 * `getTimezoneOffset() === -60`, i.e. UTC+1) — which, in an earlier,
 * unmerged version of this reconciliation logic, caused a
 * genuinely-in-flight provisioning row (expiring 30 real minutes in the
 * future) to be misjudged as already stale. Comparing in SQL sidesteps
 * the client-side timezone question entirely, the same way findExpired()
 * already safely does.
 */
export async function findStaleProvisioning() {
  const [rows] = await pool.query(
    `SELECT * FROM sessions WHERE status = 'provisioning' AND expires_at <= NOW()`,
  );
  return rows;
}

/**
 * Every session not yet in a terminal state — 'running' AND 'provisioning',
 * regardless of TTL. Used by reaper.service.js's reconcileStale() to check
 * each one directly against Docker (does its container still exist at
 * all?) rather than against any notion of time — so, unlike
 * findStaleProvisioning() above, there is no timezone-sensitive comparison
 * here to get wrong in the first place.
 */
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

/** Most recent session start for this user — folded into the Progress
 *  dashboard's "last active" stat alongside submission activity, so a
 *  learner who started a session but hasn't captured a flag yet still
 *  shows recent activity instead of "never". */
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
