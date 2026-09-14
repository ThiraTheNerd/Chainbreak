import { randomUUID, randomBytes } from 'node:crypto';
import config from '../config/env.js';
import * as challenges from '../repositories/challenge.repository.js';
import * as sessions from '../repositories/session.repository.js';
import * as dockerService from './docker.service.js';
import { AppError } from '../utils/errors.js';

export async function startChallenge(user, challengeId) {
  const challenge = await challenges.findById(challengeId);
  console.log('challenge', challenge, 'user', user, 'challengeId', challengeId);
  if (!challenge) throw new AppError('Challenge not found', 404);

  // A refresh or double-click must not spawn a second container.
  const existing = await sessions.findActiveByUserAndChallenge(user.id, challengeId);
  if (existing) return toClientView(existing, challenge);

  // Persisted before provisioning, so a mid-provision crash leaves a
  // tracked 'provisioning'/'failed' row rather than an orphan container.
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + config.docker.ttlMinutes * 60_000);
  await sessions.create({ id, userId: user.id, challengeId, expiresAt });

  if (challenge.docker_image) {
    // Per-session flag, so it can't be shared between participants.
    const flag = `flag{sqli_${randomBytes(5).toString('hex')}}`;
    try {
      const ids = await dockerService.provision({
        sessionId: id,
        image: challenge.docker_image,
        networkAlias: challenge.network_alias ?? 'target',
        flag,
      });
      await sessions.attachContainer(id, ids);
    } catch (err) {
      await sessions.markFailed(id);
      throw new AppError('Failed to start challenge environment', 502, { cause: err });
    }
  } else {
    await sessions.attachContainer(id, { containerId: null, workstationContainerId: null, networkId: null });
  }

  return toClientView(await sessions.findById(id), challenge);
}

// Flag values are never included here, only their capture state.
function toClientView(session, challenge) {
  return {
    sessionId: session.id,
    status:    session.status,
    expiresAt: session.expires_at,
    challenge: {
      id: challenge.id, slug: challenge.slug, title: challenge.title,
      brief: challenge.description, layer: challenge.layer,
    },
  };
}

export async function stopChallenge(user, sessionId) {
  const session = await sessions.findById(sessionId);
  // 404 (not 403) for both absent and not-yours — no ownership enumeration oracle.
  if (!session || session.user_id !== user.id) throw new AppError('Session not found', 404);

  if (session.status === 'running' || session.status === 'provisioning') {
    await dockerService.teardown(session); // killing the workstation ends the pty, closing the socket itself
    await sessions.markExpired(sessionId);
  }
  return { status: 'expired' };
}
