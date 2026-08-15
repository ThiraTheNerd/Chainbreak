import pool from '../db/connection.js';

export async function create({ code, label, createdBy, expiresAt }) {
  const [result] = await pool.query(
    `INSERT INTO invite_codes (code, label, created_by, expires_at)
     VALUES (:code, :label, :createdBy, :expiresAt)`,
    { code, label: label ?? null, createdBy, expiresAt: expiresAt ?? null }
  );
  return result.insertId;
}

// Admin listing. Deliberately returns the raw code (the admin who generated
// it already has it, and needs it to hand to the participant) — the
// "never log a raw code" requirement applies to application logs, not this
// requireAdmin-gated view.
export async function list() {
  const [rows] = await pool.query(
    `SELECT ic.id, ic.code, ic.label, ic.status, ic.created_at, ic.expires_at,
            ic.used_at, ic.used_by_user_id, u.username AS used_by_username,
            creator.username AS created_by_username
       FROM invite_codes ic
       LEFT JOIN users u       ON u.id = ic.used_by_user_id
       LEFT JOIN users creator ON creator.id = ic.created_by
      ORDER BY ic.created_at DESC`
  );
  return rows;
}


export async function lockByCode(conn, code) {
  const [rows] = await conn.query(
    `SELECT id, status, expires_at FROM invite_codes WHERE code = :code LIMIT 1 FOR UPDATE`,
    { code }
  );
  return rows[0] || null;
}

export async function markUsed(conn, id, userId) {
  await conn.query(
    `UPDATE invite_codes
        SET status = 'used', used_at = NOW(), used_by_user_id = :userId
      WHERE id = :id`,
    { id, userId }
  );
}

// Only an unused code can be revoked (a used code is already burned; a
// used-and-revoked state has no meaning). Returns affected row count so the
// caller can tell "revoked" apart from "nothing to revoke".
export async function revoke(id) {
  const [result] = await pool.query(
    `UPDATE invite_codes SET status = 'revoked' WHERE id = :id AND status = 'unused'`,
    { id }
  );
  return result.affectedRows;
}
