/** @file server/repositories/challenge.repository.js — reads the challenge catalogue.
 *  NOTE: flag_hash is never selected here — the catalogue must never leak flags. */

import pool from '../db/connection.js';

/** All challenges, optionally filtered by layer. Marks which ones userId has solved. */
export async function findAll({ userId, layer = null }) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.slug, c.title, c.description, c.layer, c.points, c.difficulty,
            EXISTS (
              SELECT 1 FROM submissions s
               WHERE s.challenge_id = c.id AND s.user_id = ? AND s.correct = 1
            ) AS solved
       FROM challenges c
      WHERE (? IS NULL OR c.layer = ?)
      ORDER BY FIELD(c.layer,'owasp','docker','aws'), c.points ASC`,
    [userId, layer, layer]
  );
  return rows.map((r) => ({ ...r, solved: Boolean(r.solved) }));
}

/** One challenge, safe for public display (no flag_hash). */
export async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT id, slug, title, description, layer, points, difficulty, docker_image, network_alias
       FROM challenges WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/** Sibling challenges sharing a docker_image — i.e. one kill-chain module
 *  (owasp/docker/aws layers of the same scenario). Mirrors the grouping key
 *  the client uses in lib/challenges.js (`c.docker_image || c.slug`). */
export async function findByDockerImage(dockerImage) {
  const [rows] = await pool.execute(
    `SELECT id, layer FROM challenges WHERE docker_image = ?`,
    [dockerImage]
  );
  return rows;
}

/** Sum of points across every challenge in a module — used to derive the
 *  solution unlock cost (see server/services/unlock.service.js). */
export async function sumPointsByDockerImage(dockerImage) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(points), 0) AS total FROM challenges WHERE docker_image = ?`,
    [dockerImage]
  );
  return Number(rows[0].total);
}

/** Internal use only: includes flag_hash for verification. Never send this to a client. */
export async function findByIdWithFlag(id) {
  const [rows] = await pool.execute(
    `SELECT id, slug, title, layer, points, flag_hash
       FROM challenges WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/** Has this user solved the given challenge? */
export async function hasSolved(userId, challengeId) {
  if (challengeId == null) return true;
  const [rows] = await pool.execute(
    `SELECT 1 FROM submissions
      WHERE user_id = ? AND challenge_id = ? AND correct = 1 LIMIT 1`,
    [userId, challengeId]
  );
  return rows.length > 0;
}

/** Admin: create a challenge. */
export async function create({ slug, title, description, layer, category, difficulty, points, flagHash, dockerImage, networkAlias }) {
  const [result] = await pool.execute(
    `INSERT INTO challenges
       (slug, title, description, layer, category, difficulty, points, flag_hash, docker_image, network_alias)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [slug, title, description, layer, category, difficulty, points, flagHash, dockerImage, networkAlias]
  );
  return result.insertId;
}

/** Admin: remove a challenge. */
export async function remove(id) {
  const [result] = await pool.execute(
    `DELETE FROM challenges WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}
