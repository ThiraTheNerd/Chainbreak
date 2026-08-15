import crypto from 'crypto';
import * as inviteRepository from '../repositories/invite.repository.js';
import { BadRequestError } from '../utils/errors.js';


const CODE_BYTES = 16;
const MAX_BATCH = 500;

function generateCode() {
  return crypto.randomBytes(CODE_BYTES).toString('base64url');
}

export async function generateCodes({ count = 1, label, expiresAt, createdBy }) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    throw new BadRequestError(`count must be an integer between 1 and ${MAX_BATCH}`);
  }
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await inviteRepository.create({ code, label, createdBy, expiresAt: expiresAt ?? null });
    codes.push({ code, label: label ?? null, expiresAt: expiresAt ?? null });
  }
  return codes;
}

export async function listCodes() {
  return inviteRepository.list();
}

export async function revokeCode(id) {
  const affected = await inviteRepository.revoke(id);
  if (!affected) {
    throw new BadRequestError('Code not found, or not eligible for revocation (only an unused code can be revoked)');
  }
}
