// file: server/services/reaper.service.js
import * as sessions from '../repositories/session.repository.js';
import * as dockerService from './docker.service.js';
import logger from '../utils/logger.js';

const SWEEP_MS = 60_000;

export async function sweepOnce(io) {
  const expired = await sessions.findExpired();
  for (const s of expired) {
    try {
      io.in(`session:${s.id}`).disconnectSockets(true);  // close the terminal cleanly first
      await dockerService.teardown(s);                   // reads s.container_id etc. (snake_case)
      await sessions.markExpired(s.id);
      logger.info(`reaper: reclaimed session ${s.id}`);
    } catch (err) {
      // Leave the row 'running' on failure => retried next sweep (at-least-once).
      // teardown() now attempts every resource best-effort before throwing, so
      // err.failures (if present) names exactly which ones are still stuck —
      // logged here instead of just "it failed" so a real leak is visible,
      // not silent.
      logger.error(
        `reaper: failed on ${s.id} — will retry next sweep` +
          (err.failures ? ` (stuck: ${err.failures.map((f) => f.resource).join(', ')})` : ''),
        err
      );
    }
  }

  const reconciled = await reconcileStale();
  if (reconciled > 0) {
    logger.info(`reaper: reconciled ${reconciled} stale session row(s)`);
  }

  return expired.length;
}

/**
 * Catches what findExpired()/sweepOnce() structurally can't: rows whose DB
 * status ('running' or 'provisioning') no longer reflects reality in
 * Docker, because nothing ever revisits them otherwise —
 *   1. 'provisioning' rows past their own expiry that never got as far as
 *      having ANY container id attached — session.service.js's
 *      startChallenge() already marks a provisioning FAILURE as 'failed',
 *      but that only runs if the process is still alive to catch it; a
 *      server crash/restart mid-provision leaves the row stuck
 *      'provisioning' forever otherwise (verified: findExpired()'s query
 *      never selects it, no matter how stale).
 *   2. 'running'/'provisioning' rows that DO have container ids, but whose
 *      containers no longer exist in Docker at all (crashed, manually
 *      `docker rm`'d, wiped by `docker system prune`, etc.) — teardown()
 *      is still run best-effort in case the per-session NETWORK is
 *      somehow still around even though the containers aren't, then the
 *      row is marked 'ended' (finally giving that status — and
 *      sessions.markEnded(), previously dead code with no caller anywhere
 *      in the codebase — a real, correct purpose).
 * Runs at the end of every periodic sweep, and once at startup (see
 * startReaper below) so a server restart cleans up immediately rather than
 * waiting up to SWEEP_MS.
 */
export async function reconcileStale() {
  let reconciled = 0;

  // 1. 'provisioning' rows past their OWN expiry that never got as far as
  //    having ANY container id attached — the expiry check happens in SQL
  //    (findStaleProvisioning), not via a JS-side Date comparison; see
  //    that function's doc comment for why the latter is actually unsafe
  //    in this project (a real, verified mysql2/timezone footgun, not a
  //    hypothetical one).
  const staleProvisioning = await sessions.findStaleProvisioning();
  for (const s of staleProvisioning) {
    if (s.container_id || s.workstation_container_id) continue; // handled in step 2 instead
    await sessions.markFailed(s.id);
    logger.warn(`reaper: reconciled stale 'provisioning' session ${s.id} — no resources were ever created`);
    reconciled++;
  }

  // 2. 'running'/'provisioning' rows that DO have container ids, but whose
  //    containers no longer exist in Docker at all (crashed, manually
  //    `docker rm`'d, wiped by `docker system prune`, etc.) — checked
  //    directly against Docker, regardless of TTL, so there's no
  //    timezone-sensitive time comparison here either. teardown() is
  //    still run best-effort in case the per-session NETWORK is somehow
  //    still around even though the containers aren't, then the row is
  //    marked 'ended' — finally giving sessions.markEnded() (previously
  //    dead code with no caller anywhere in the codebase) a real, correct
  //    purpose.
  const active = await sessions.findRunningOrProvisioning();
  for (const s of active) {
    const hasAnyContainerId = Boolean(s.container_id || s.workstation_container_id);
    if (!hasAnyContainerId) continue; // nothing to check against Docker

    const [targetExists, workstationExists] = await Promise.all([
      dockerService.containerExists(s.container_id),
      dockerService.containerExists(s.workstation_container_id),
    ]);

    if (!targetExists && !workstationExists) {
      try {
        await dockerService.teardown(s); // best-effort — mainly to catch a lingering network
      } catch (err) {
        logger.warn(`reaper: reconcile teardown had residual failures for ${s.id}: ${err.message}`);
      }
      await sessions.markEnded(s.id);
      logger.warn(`reaper: reconciled orphaned-row session ${s.id} — its containers were already gone from Docker`);
      reconciled++;
    }
  }

  return reconciled;
}

export function startReaper(io) {
  // Run once immediately on boot — catches anything that went stale WHILE
  // the server was down (crashed mid-provision, containers removed out
  // from under a tracked row while nothing was watching) instead of
  // waiting up to SWEEP_MS for the first periodic sweep to find it.
  sweepOnce(io).catch((err) => logger.error('reaper startup sweep crashed', err));

  const timer = setInterval(() => {
    sweepOnce(io).catch((err) => logger.error('reaper sweep crashed', err));
  }, SWEEP_MS);
  timer.unref();                 // don't keep the process alive in tests
  return () => clearInterval(timer);
}
