import pool from '../db/connection.js';

export async function findByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, consented, consent_version, consent_items,
            audio_recording_consent, typed_name, consented_at, withdrawn_at
       FROM consent_records WHERE user_id = :userId LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}


export async function findAccessContext(userId) {
  const [rows] = await pool.query(
    `SELECT u.cohort, cr.consented, cr.withdrawn_at
       FROM users u
       LEFT JOIN consent_records cr ON cr.user_id = u.id
      WHERE u.id = :userId LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}


export async function upsert(userId, {
  consented, consentVersion, consentItems, audioRecordingConsent, typedName,
}) {
  await pool.query(
    `INSERT INTO consent_records
       (user_id, consented, consent_version, consent_items, audio_recording_consent, typed_name, consented_at)
     VALUES (:userId, :consented, :consentVersion, :consentItems, :audioRecordingConsent, :typedName, NOW())
     ON DUPLICATE KEY UPDATE
       consented               = VALUES(consented),
       consent_version         = VALUES(consent_version),
       consent_items           = VALUES(consent_items),
       audio_recording_consent = VALUES(audio_recording_consent),
       typed_name               = VALUES(typed_name),
       consented_at            = VALUES(consented_at)`,
    {
      userId,
      consented,
      consentVersion,
      consentItems: JSON.stringify(consentItems),
      audioRecordingConsent,
      typedName,
    }
  );
}

// Only affects a record that isn't already withdrawn — returns affected-row
// count so the caller can tell "withdrawn" apart from "nothing to withdraw".
export async function withdraw(userId) {
  const [result] = await pool.query(
    `UPDATE consent_records SET withdrawn_at = NOW()
      WHERE user_id = :userId AND withdrawn_at IS NULL`,
    { userId }
  );
  return result.affectedRows;
}


export async function listAll() {
  const [rows] = await pool.query(
    `SELECT cr.user_id, u.username, u.email, cr.consented, cr.consent_version,
            cr.audio_recording_consent, cr.consented_at, cr.withdrawn_at
       FROM consent_records cr
       JOIN users u ON u.id = cr.user_id
      ORDER BY cr.consented_at DESC`
  );
  return rows;
}
