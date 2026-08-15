import pool from '../db/connection.js';

export async function findUnlock(userId, dockerImage) {
  const [rows] = await pool.execute(
    `SELECT cost, unlocked_at FROM solution_unlocks WHERE user_id = ? AND docker_image = ? LIMIT 1`,
    [userId, dockerImage]
  );
  return rows[0] || null;
}

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

export async function totalSpentByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(cost), 0) AS total FROM solution_unlocks WHERE user_id = ?`,
    [userId]
  );
  return Number(rows[0].total);
}

export async function totalSpentByAllUsers() {
  const [rows] = await pool.execute(
    `SELECT user_id, SUM(cost) AS total FROM solution_unlocks GROUP BY user_id`
  );
  return rows.map((r) => ({ userId: r.user_id, total: Number(r.total) }));
}
