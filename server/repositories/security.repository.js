import pool from '../db/connection.js';
import logger from '../utils/logger.js';

// Written explicitly in UTC so started_at (server session time_zone) and
// completed_at (driver-local time_zone) stay on the same authority.
function toMysqlUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function createScan(scan) {
  await pool.query(`INSERT INTO security_scans (id, target, scan_type, status, current_phase, started_at)
    VALUES (:id, :target, :scanType, 'queued', 'Queued', :startedAt)`, { ...scan, startedAt: toMysqlUtc(new Date()) });
  return getScan(scan.id);
}

export async function updateScan(id, values) {
  const allowed = ['status', 'completed_at', 'current_phase', 'endpoints_found', 'urls_discovered', 'requests_made', 'total_findings', 'critical_count', 'high_count', 'medium_count', 'low_count', 'informational_count', 'score', 'error_message'];
  const normalised = values.completed_at instanceof Date ? { ...values, completed_at: toMysqlUtc(values.completed_at) } : values;
  const entries = Object.entries(normalised).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getScan(id);
  const assignments = entries.map(([key]) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE security_scans SET ${assignments} WHERE id = :id`, { id, ...Object.fromEntries(entries) });
  return getScan(id);
}

export async function insertFindings(findings) {
  const summary = { succeeded: 0, failed: 0 };
  if (!findings.length) return summary;
  const connection = await pool.getConnection();
  try {
    for (const finding of findings) {
      try {
        await connection.query(`INSERT INTO security_findings
          (scan_id, alert_name, risk, confidence, url, method, parameter, evidence, description, solution, reference_url, owasp_category, owasp_mapping, layer, challenge, ground_truth_status)
          VALUES (:scan_id, :alert_name, :risk, :confidence, :url, :method, :parameter, :evidence, :description, :solution, :reference_url, :owasp_category, :owasp_mapping, :layer, :challenge, :ground_truth_status)`, finding);
        summary.succeeded += 1;
      } catch (error) {
        summary.failed += 1;
        logger.error(`[security.repository] failed to insert finding "${finding.alert_name}"`, error);
      }
    }
  } finally { connection.release(); }
  return summary;
}

export async function getScan(id) {
  const [rows] = await pool.query('SELECT * FROM security_scans WHERE id = :id', { id });
  return rows[0] || null;
}

export async function listScans() {
  const [rows] = await pool.query('SELECT * FROM security_scans ORDER BY started_at DESC');
  return rows;
}

export async function getFindings(id) {
  const [rows] = await pool.query('SELECT * FROM security_findings WHERE scan_id = :id ORDER BY FIELD(risk, "high", "medium", "low", "informational"), id', { id });
  return rows;
}