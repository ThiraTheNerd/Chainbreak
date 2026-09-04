import { config } from '../config.js';

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} from ${res.url}: ${JSON.stringify(body)}`);
  }
  return body;
}

// A fresh, unique account per run sidesteps "already solved" bookkeeping
// (flag.service.js's submitFlag awards points once per user and changes
// event shape on the alreadySolved branch) — this harness cares about
// functional exploitability, not scoring history.
export async function registerLearner() {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(`${config.baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `harness_${unique}`,
      email:    `harness_${unique}@chainbreak.local`,
      password: 'HarnessRun!2026',
    }),
  });
  return json(res);
}

export async function listChallenges(token) {
  const res = await fetch(`${config.baseUrl}/api/challenges`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { challenges } = await json(res);
  return challenges;
}

// Numeric challenge ids shift on a re-seed; slugs are the stable identifier
// this harness is written against, so ids are always resolved live rather
// than hardcoded.
export async function resolveSlugIds(token, slugs) {
  const challenges = await listChallenges(token);
  const bySlug = new Map(challenges.map((c) => [c.slug, c.id]));
  const map = {};
  for (const slug of slugs) {
    if (!bySlug.has(slug)) {
      throw new Error(`Seed data mismatch: challenge slug "${slug}" was not found via GET /api/challenges`);
    }
    map[slug] = bySlug.get(slug);
  }
  return map;
}

// Path is /api/sessions/challenges/:id/session, not /api/challenges/:id/session:
// server/routes/index.js mounts session.routes.js's router (itself
// '/challenges/:id/session') under the '/sessions' prefix, so the two
// prefixes stack. This is also the exact endpoint the React client calls
// (ChallengeCard.jsx's startMutation). Idempotent server-side, which is
// what pollSessionUntilRunning below relies on.
export async function startSession(token, challengeId) {
  const res = await fetch(`${config.baseUrl}/api/sessions/challenges/${challengeId}/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return json(res);
}

// startChallenge() currently awaits the full docker.service.js provision()
// before responding, so the first call already comes back 'running' (or a
// 502, surfaced here as 'failed') — this loop keeps the harness correct
// against a future async-provisioning redesign too.
export async function pollSessionUntilRunning(token, challengeId, { timeoutMs, intervalMs = 1500 } = {}) {
  const deadline = Date.now() + (timeoutMs ?? config.timeouts.sessionRunning);
  let last;
  while (Date.now() < deadline) {
    last = await startSession(token, challengeId);
    if (last.status === 'running') return last;
    if (last.status === 'failed') {
      throw new Error(`Session for challenge ${challengeId} was marked 'failed' during provisioning`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Session for challenge ${challengeId} did not reach 'running' within ${timeoutMs ?? config.timeouts.sessionRunning}ms ` +
    `(last status: ${last?.status ?? 'unknown'})`
  );
}

// The route param here is the session UUID, not a challenge id
// (session.controller.js's stopChallenge passes it straight into
// sessions.findById).
export async function stopSession(token, sessionId) {
  const res = await fetch(`${config.baseUrl}/api/sessions/challenges/${sessionId}/session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return json(res);
}
