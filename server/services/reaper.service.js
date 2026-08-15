import * as sessions from '../repositories/session.repository.js';
import * as learnerSessions from '../repositories/learner-session.repository.js';
import * as dockerService from './docker.service.js';
import logger from '../utils/logger.js';

const SWEEP_MS = 60_000;

export async function sweepOnce(io) {
  const expired = await sessions.findExpired();
  for (const s of expired) {
    try {

      await learnerSessions.endAllActiveForEnvironment(s.id, 'expired');
      io.in(`session:${s.id}`).disconnectSockets(true);
      await dockerService.teardown(s);
      await sessions.markExpired(s.id);
      logger.info(`reaper: reclaimed session ${s.id}`);
    } catch (err) {
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


export async function reconcileStale() {
  let reconciled = 0;


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
      await learnerSessions.endAllActiveForEnvironment(s.id, 'expired');
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
