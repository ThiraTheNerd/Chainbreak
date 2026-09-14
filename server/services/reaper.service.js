import * as sessions from '../repositories/session.repository.js';
import * as dockerService from './docker.service.js';
import logger from '../utils/logger.js';

const SWEEP_MS = 60_000;

export async function sweepOnce(io) {
  const expired = await sessions.findExpired();
  for (const s of expired) {
    try {
      io.in(`session:${s.id}`).disconnectSockets(true);
      await dockerService.teardown(s);
      await sessions.markExpired(s.id);
      logger.info(`reaper: reclaimed session ${s.id}`);
    } catch (err) {
      // Leave the row 'running' on failure so it's retried next sweep.
      // teardown() attempts every resource best-effort before throwing, so
      // err.failures names exactly which ones are still stuck.
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
 * status no longer reflects reality in Docker, because nothing else ever
 * revisits them —
 *   1. 'provisioning' rows past their own expiry that never got as far as
 *      having any container id attached (e.g. a server crash mid-provision).
 *      findExpired()'s query never selects these no matter how stale.
 *   2. 'running'/'provisioning' rows with container ids whose containers no
 *      longer exist in Docker at all (crashed, manually removed, wiped by
 *      `docker system prune`, etc.).
 * Runs at the end of every periodic sweep, and once at startup, so a server
 * restart cleans up immediately rather than waiting up to SWEEP_MS.
 */
export async function reconcileStale() {
  let reconciled = 0;

  // The expiry check happens in SQL (findStaleProvisioning), not a JS-side
  // Date comparison — see that function's doc comment for the mysql2/
  // timezone footgun that makes the JS-side version unsafe here.
  const staleProvisioning = await sessions.findStaleProvisioning();
  for (const s of staleProvisioning) {
    if (s.container_id || s.workstation_container_id) continue; // handled in step 2 instead
    await sessions.markFailed(s.id);
    logger.warn(`reaper: reconciled stale 'provisioning' session ${s.id} — no resources were ever created`);
    reconciled++;
  }

  const active = await sessions.findRunningOrProvisioning();
  for (const s of active) {
    const hasAnyContainerId = Boolean(s.container_id || s.workstation_container_id);
    if (!hasAnyContainerId) continue;

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
  sweepOnce(io).catch((err) => logger.error('reaper startup sweep crashed', err));

  const timer = setInterval(() => {
    sweepOnce(io).catch((err) => logger.error('reaper sweep crashed', err));
  }, SWEEP_MS);
  timer.unref(); // don't keep the process alive in tests
  return () => clearInterval(timer);
}
