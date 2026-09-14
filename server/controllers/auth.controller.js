import * as authService from '../services/auth.service.js';
import { BadRequestError } from '../utils/errors.js';
 
export async function register(req, res) {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    throw new BadRequestError('username, email and password are required');
  }
  const { user, token } = await authService.register({ username, email, password });
  res.status(201).json({ user, token });
}
 
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw new BadRequestError('email and password are required');
  const { user, token } = await authService.login({ email, password });
  res.json({ user, token });
}
 
export function me(req, res) {
  res.json({ user: req.user });
}

export function logout(_req, res) {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
}

export async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email) throw new BadRequestError('email is required');

  const { resetUrl } = await authService.requestPasswordReset({ email });

  res.json({
    message: 'If an account with that email exists, a reset link has been sent.',
    // Dev-mode only (see auth.service.js) — null once a real mailer is wired up.
    ...(resetUrl ? { resetUrl } : {}),
  });
}

export async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (!token || !password) throw new BadRequestError('token and password are required');

  await authService.resetPassword({ token, password });
  res.json({ message: 'Password has been reset successfully' });
}
