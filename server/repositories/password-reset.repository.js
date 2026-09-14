import pool from '../db/connection.js';

export async function create({ userId, tokenHash, expiresAt }) {
  const [result] = await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES (:userId, :tokenHash, :expiresAt)`,
    { userId, tokenHash, expiresAt }
  );
  return result.insertId;
}

// Only a still-valid, unused token is returned — an expired or
// already-consumed token is treated the same as "not found" by callers.
export async function findValidByTokenHash(tokenHash) {
  const [rows] = await pool.query(
    `SELECT id, user_id, expires_at, used_at
       FROM password_resets
      WHERE token_hash = :tokenHash
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1`,
    { tokenHash }
  );
  return rows[0] || null;
}

export async function markUsed(id) {
  await pool.query(
    `UPDATE password_resets SET used_at = NOW() WHERE id = :id`,
    { id }
  );
}

// Invalidates any earlier outstanding requests once a new one is issued (or
// consumed), so at most one reset link is ever live for a given user.
export async function invalidateAllForUser(userId) {
  await pool.query(
    `UPDATE password_resets
        SET used_at = NOW()
      WHERE user_id = :userId
        AND used_at IS NULL`,
    { userId }
  );
}
