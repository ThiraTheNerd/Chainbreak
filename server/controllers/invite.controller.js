import * as inviteService from '../services/invite.service.js';
import { BadRequestError } from '../utils/errors.js';

export async function generate(req, res) {
  const { count, label, expiresAt } = req.body || {};
  const codes = await inviteService.generateCodes({
    count: count ?? 1,
    label,
    expiresAt,
    createdBy: req.user.id,
  });
  res.status(201).json({ codes });
}

export async function list(_req, res) {
  const codes = await inviteService.listCodes();
  res.json({ codes });
}

export async function revoke(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new BadRequestError('Invalid invite code id');
  await inviteService.revokeCode(id);
  res.json({ message: 'Invite code revoked' });
}
