import pool from '../db/connection.js';

export async function create({ id, environmentSessionId, userId }) {
  await pool.query(
    `INSERT INTO learner_sessions (id, environment_session_id, user_id)
     VALUES (:id, :environmentSessionId, :userId)`,
    { id, environmentSessionId, userId }
  );
  return findById(id);
}

export async function findById(id) {
  const [rows] = await pool.query(`SELECT * FROM learner_sessions WHERE id = :id`, { id });
  return rows[0] ?? null;
}

export async function touch(id) {
  await pool.query(
    `UPDATE learner_sessions SET last_activity_at = NOW() WHERE id = :id AND status = 'active'`,
    { id }
  );
}


export async function end(id, reason) {
  await pool.query(
    `UPDATE learner_sessions SET status = 'ended', ended_at = NOW(), end_reason = :reason
      WHERE id = :id AND status = 'active'`,
    { id, reason }
  );
}


export async function endAllActiveForEnvironment(environmentSessionId, reason) {
  await pool.query(
    `UPDATE learner_sessions SET status = 'ended', ended_at = NOW(), end_reason = :reason
      WHERE environment_session_id = :environmentSessionId AND status = 'active'`,
    { environmentSessionId, reason }
  );
}


export async function endAllActive(reason) {
  await pool.query(
    `UPDATE learner_sessions SET status = 'ended', ended_at = NOW(), end_reason = :reason
      WHERE status = 'active'`,
    { reason }
  );
}
