import * as consentRepository from '../repositories/consent.repository.js';
import { BadRequestError, ConflictError } from '../utils/errors.js';

const AUDIO_CONSENT_VALUES = new Set(['consented', 'declined', 'not_applicable']);


function deriveConsented({ consentItems, typedName, audioRecordingConsent }) {
  const values = Object.values(consentItems);
  const allItemsTicked = values.length > 0 && values.every((v) => v === true);
  const hasTypedName = typeof typedName === 'string' && typedName.trim().length > 0;
  const validAudioChoice = AUDIO_CONSENT_VALUES.has(audioRecordingConsent);
  return allItemsTicked && hasTypedName && validAudioChoice;
}


export async function recordConsent(userId, { consentVersion, consentItems, audioRecordingConsent, typedName }) {
  if (!consentVersion || typeof consentVersion !== 'string') {
    throw new BadRequestError('consentVersion is required');
  }
  if (!consentItems || typeof consentItems !== 'object' || Array.isArray(consentItems)) {
    throw new BadRequestError('consentItems must be an object of item-key -> boolean');
  }
  if (!AUDIO_CONSENT_VALUES.has(audioRecordingConsent)) {
    throw new BadRequestError(`audioRecordingConsent must be one of: ${[...AUDIO_CONSENT_VALUES].join(', ')}`);
  }

  const existing = await consentRepository.findByUserId(userId);
  if (existing?.withdrawn_at) {

    throw new ConflictError(
      'This consent has already been withdrawn and cannot be resubmitted here — contact the research team.'
    );
  }

  const consented = deriveConsented({ consentItems, typedName, audioRecordingConsent });
  await consentRepository.upsert(userId, {
    consented,
    consentVersion,
    consentItems,
    audioRecordingConsent,
    typedName: typeof typedName === 'string' ? typedName.trim() : '',
  });
  return { consented };
}

// Used by the frontend to decide routing (show the consent screen vs study
// content) and by requireConsent (indirectly, via the repository) to gate
// study endpoints server-side.
export async function getStatus(userId) {
  const record = await consentRepository.findByUserId(userId);
  if (!record) return { completed: false, consented: false, withdrawn: false };
  return {
    completed: !!record.consented && !record.withdrawn_at,
    consented: !!record.consented,
    consentVersion: record.consent_version,
    audioRecordingConsent: record.audio_recording_consent,
    consentedAt: record.consented_at,
    withdrawn: !!record.withdrawn_at,
    withdrawnAt: record.withdrawn_at,
  };
}

// Self-serviceable withdrawal (cross-cutting requirement). Sets
// withdrawn_at only — never deletes the row or any research data. This
// FLAGS the participant for exclusion; an actual exclusion from analysis
// is a decision the researcher makes and actions separately, per protocol.
export async function withdrawConsent(userId) {
  const affected = await consentRepository.withdraw(userId);
  if (!affected) {
    throw new BadRequestError('No active consent record to withdraw');
  }
}

export async function listConsentStatus() {
  return consentRepository.listAll();
}
