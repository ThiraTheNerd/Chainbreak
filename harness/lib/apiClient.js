// harness/lib/apiClient.js
//
// Talks to ChainBreak exactly the way the React client does: plain HTTP,
// a Bearer JWT carried on every authenticated request, no cookies, no
// server-side session state (server/routes/auth.js,
// server/middleware/auth.js). This is the "register/login -> start
// session -> poll to running" half of the reusable plumbing both chain
// test files use; harness/lib/terminalSession.js is the other half.

import { config } from '../config.js';

/** Parses a fetch Response as JSON and throws loudly (with the body) on a
 *  non-2xx status, instead of letting callers discover the problem three
 *  lines later from an undefined field. */
async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} from ${res.url}: ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Registers a brand-new participant account and returns { user, token }.
 * A fresh, unique account per test run sidesteps "already solved"
 * bookkeeping (flag.service.js awards points once per user, and
 * submitFlag's alreadySolved branch changes what event shape gets emitted)
 * — this harness is about FUNCTIONAL exploitability (does the chain still
 * work end to end), not about scoring history, so a clean account every
 * time keeps every run identical.
 */
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
  return json(res); // { user, token }
}

/** GET /api/challenges — every row the catalogue currently knows about,
 *  each with { id, slug, title, layer, points, difficulty, solved }. */
export async function listChallenges(token) {
  const res = await fetch(`${config.baseUrl}/api/challenges`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { challenges } = await json(res);
  return challenges;
}

/**
 * Resolves slug -> numeric id for exactly the slugs a chain needs.
 * Numeric challenge ids are seed-data-dependent (they can shift on a
 * re-seed); slugs are the stable, human-meaningful identifier this
 * harness is written against — so we always look ids up live via the real
 * catalogue endpoint rather than hardcoding them. Throws loudly, naming
 * the missing slug, if the running platform's data doesn't match what
 * this harness expects — that mismatch is itself a finding worth
 * surfacing, not something to silently paper over.
 */
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

/**
 * POST /api/sessions/challenges/:id/session. Idempotent server-side —
 * session.service.js's startChallenge() returns the existing row if one is
 * already provisioning/running for this (user, challengeId) pair rather
 * than provisioning a second time — so calling this more than once for the
 * same challenge id is always safe, which is what pollSessionUntilRunning
 * below relies on.
 *
 * CORRECTION vs. this harness's original brief: the path is
 * /api/sessions/challenges/:id/session, not /api/challenges/:id/session —
 * server/routes/index.js mounts session.routes.js's router (whose own
 * route is defined as '/challenges/:id/session') under the '/sessions'
 * prefix, so the two prefixes stack. Verified directly: POST
 * /api/challenges/1/session 404s ("Route not found"), while this path
 * returns 201. It's also, independently, the exact path the real React
 * client calls (client/src/components/dashboard/ChallengeCard.jsx's
 * startMutation) — confirming this is the real learner-facing endpoint,
 * not just one of two accidental aliases. (A second, differently-named
 * route, POST /api/challenges/:id/start, reaches the same controller
 * function and also works — but nothing in the actual client calls it, so
 * it's not what "as a real learner would" means here.)
 */
export async function startSession(token, challengeId) {
  const res = await fetch(`${config.baseUrl}/api/sessions/challenges/${challengeId}/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return json(res); // { sessionId, status, expiresAt, challenge }
}

/**
 * Polls the same idempotent endpoint until the session reaches 'running'.
 * Today's startChallenge() actually AWAITS the whole docker.service.js
 * provision() call before it ever responds, so in practice the very first
 * call already comes back 'running' (or throws a 502, surfaced here as
 * 'failed') — this loop exists so the harness is correct against that
 * behaviour AND against a future async-provisioning redesign, without the
 * two test files needing to know or care which one is currently true.
 */
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

/**
 * DELETE /api/sessions/challenges/:id/session — same corrected prefix as
 * startSession above. Note the route param here is the SESSION UUID, not a
 * challenge id (session.controller.js's stopChallenge passes req.params.id
 * straight into sessions.findById). Always called from a test's
 * afterAll/finally so a failed exploit still tears its containers and
 * per-session network down (docker.service.js's teardown()). Verified:
 * returns { status: 'expired' } and the target/workstation containers are
 * gone from `docker ps` immediately after.
 */
export async function stopSession(token, sessionId) {
  const res = await fetch(`${config.baseUrl}/api/sessions/challenges/${sessionId}/session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return json(res);
}
