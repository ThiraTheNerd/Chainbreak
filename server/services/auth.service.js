import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import * as userRepository from '../repositories/user.repository.js';
import * as passwordResetRepository from '../repositories/password-reset.repository.js';
import { ConflictError, UnauthorizedError, BadRequestError } from '../utils/errors.js';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
 
export async function register({ username, email, password }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) throw new ConflictError('An account with that email already exists');
 
  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
  const user = await userRepository.create({ username, email, passwordHash });
 
  return { user, token: signToken(user) };
}
 
export async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  // Identical message whether email is unknown or password wrong — no account enumeration.
  if (!user) throw new UnauthorizedError('Invalid credentials');
 
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');
 
  return {
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
    token: signToken(user),
  };
}
 
// Always succeeds from the caller's point of view — whether or not the
// email matches an account — so the response can't be used to enumerate
// registered emails.
export async function requestPasswordReset({ email }) {
  const user = await userRepository.findByEmail(email);
  if (!user) return { resetUrl: null };

  await passwordResetRepository.invalidateAllForUser(user.id);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await passwordResetRepository.create({ userId: user.id, tokenHash, expiresAt });

  const resetUrl = `${config.server.clientOrigin}/reset-password?token=${rawToken}`;

  // Dev-mode delivery: no SMTP provider is configured yet, so the link is
  // logged server-side instead of emailed. Swap this for a real mailer call
  // (nodemailer/SES) when one is added — the rest of the flow won't change.
  logger.info(`Password reset requested for ${user.email}: ${resetUrl}`);

  // Only handed back to the caller outside production, so the flow is
  // testable end-to-end without an email provider.
  return { resetUrl: config.server.nodeEnv !== 'production' ? resetUrl : null };
}

export async function resetPassword({ token, password }) {
  if (!token || !password) throw new BadRequestError('token and password are required');

  const tokenHash = hashToken(token);
  const reset = await passwordResetRepository.findValidByTokenHash(tokenHash);
  if (!reset) throw new BadRequestError('Invalid or expired reset link');

  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
  await userRepository.updatePassword(reset.user_id, passwordHash);
  await passwordResetRepository.markUsed(reset.id);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}
 
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}