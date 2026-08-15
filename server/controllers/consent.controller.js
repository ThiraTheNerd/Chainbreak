import * as consentService from '../services/consent.service.js';
import * as consentRepository from '../repositories/consent.repository.js';

export async function record(req, res) {
  const { consentVersion, consentItems, audioRecordingConsent, typedName } = req.body || {};
  const result = await consentService.recordConsent(req.user.id, {
    consentVersion, consentItems, audioRecordingConsent, typedName,
  });
  res.status(201).json(result);
}

export async function me(req, res) {
  const status = await consentService.getStatus(req.user.id);


  let exempt = req.user.role === 'admin';
  if (!exempt) {
    const ctx = await consentRepository.findAccessContext(req.user.id);
    exempt = ctx?.cohort === 'original';
  }

  res.json({ ...status, exempt });
}

export async function withdraw(req, res) {
  await consentService.withdrawConsent(req.user.id);
  res.json({ message: 'Consent withdrawn. Your data will be flagged for the research team to action exclusion.' });
}

// Admin-only status view — see consentRepository.listAll() for why this is
// never joined to assessments/scores.
export async function adminList(_req, res) {
  const records = await consentService.listConsentStatus();
  res.json({ records });
}
