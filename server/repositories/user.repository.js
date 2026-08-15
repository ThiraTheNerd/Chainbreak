import pool from '../db/connection.js';
 
export async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, username, email, password_hash, role
       FROM users WHERE email = :email LIMIT 1`,
    { email }
  );
  return rows[0] || null;
}
 
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, username, email, role, created_at
       FROM users WHERE id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}
 

export async function create({ username, email, passwordHash, role = 'participant', cohort = 'remote' }, conn = pool) {
  const [result] = await conn.query(
    `INSERT INTO users (username, email, password_hash, role, cohort)
     VALUES (:username, :email, :passwordHash, :role, :cohort)`,
    { username, email, passwordHash, role, cohort }
  );
  return { id: result.insertId, username, email, role, cohort };
}

export async function updatePassword(id, passwordHash) {
  await pool.query(
    `UPDATE users SET password_hash = :passwordHash WHERE id = :id`,
    { id, passwordHash }
  );
}
