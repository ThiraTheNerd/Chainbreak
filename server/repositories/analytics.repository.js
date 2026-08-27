/** @file server/repositories/analytics.repository.js — read-only queries backing the
 *  admin Research Analytics dashboard (GET /api/admin/analytics). Raw data access only
 *  — no aggregation, scoring, or anonymisation happens here; see
 *  server/services/analytics.service.js.
 */

import pool from '../db/connection.js';

// Canonical attempt (attempt_number = 1) only — the same rule
// analysis/db_loader.py's _fetch_canonical_attempts() and GET /assessment/mine
// use: the first submission of each type, never a later resubmission.
export async function canonicalAssessments() {
  const [rows] = await pool.execute(
    `SELECT user_id, type, score_web, score_container, score_cloud, sus_score
       FROM assessments WHERE attempt_number = 1`
  );
  return rows;
}

// Every hint reveal, across every user. Deliberately excludes hint_text
// (flag-relevant content) — matches analysis/hint_loader.py's own query.
export async function allHintUnlocks() {
  const [rows] = await pool.execute(`SELECT user_id, tier, source FROM hint_unlocks`);
  return rows;
}

// Denominator for hint-uptake % — matches analysis/hint_loader.py's
// fetch_total_participant_count().
export async function totalParticipantCount() {
  const [rows] = await pool.execute(`SELECT COUNT(*) AS total FROM users WHERE role = 'participant'`);
  return Number(rows[0].total);
}
