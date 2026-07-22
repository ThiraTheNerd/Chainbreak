// services/session.service.js
import { randomUUID, randomBytes } from 'node:crypto';          // built into Node 25 — no dependency
import config from '../config/env.js';
import * as challenges from '../repositories/challenge.repository.js';
import * as sessions from '../repositories/session.repository.js';
import * as dockerService from './docker.service.js';
import { AppError } from '../utils/errors.js';      // named export, file: errors.js

export async function startChallenge(user, challengeId) {
  // (2) existence + gating — the kill-chain sequence, enforced server-side
  const challenge = await challenges.findById(challengeId);
  console.log('challenge', challenge, 'user', user, 'challengeId', challengeId);
  if (!challenge) throw new AppError('Challenge not found', 404);

  // const unlocked = await challenges.hasSolved(user.id, challenge.prerequisite_id);
  // if (!unlocked) throw new AppError('Complete the previous layer first', 423); // Locked

  // (3) idempotency — a refresh or double-click must NOT spawn a second container
  const existing = await sessions.findActiveByUserAndChallenge(user.id, challengeId);
  if (existing) return toClientView(existing, challenge);

  // (5, first half) persist the row BEFORE provisioning, so a mid-provision crash
  //     leaves a tracked 'provisioning'/'failed' row rather than an orphan container
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + config.docker.ttlMinutes * 60_000);
  await sessions.create({ id, userId: user.id, challengeId, expiresAt });

  if (challenge.docker_image) {
    // per-session flag: kills flag-sharing between participants
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
    // no container needed — mark it running so the client can proceed
    await sessions.attachContainer(id, { containerId: null, workstationContainerId: null, networkId: null });
  }


  // (7) shape the payload
  return toClientView(await sessions.findById(id), challenge);
}

// (7) hydrate the view. Flags/hints/kill-chain state come from your progress tables —
//     and the flag VALUES are never included, only their capture state.
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

// file: server/services/session.service.js  (ADD this export)
export async function stopChallenge(user, sessionId) {
  const session = await sessions.findById(sessionId);
  // 404 (not 403) for both absent and not-yours — no ownership enumeration oracle.
  if (!session || session.user_id !== user.id) throw new AppError('Session not found', 404);

  if (session.status === 'running' || session.status === 'provisioning') {
    await dockerService.teardown(session);   // killing the workstation ends the pty → socket closes itself
    await sessions.markExpired(sessionId);
  }
  return { status: 'expired' };
}
