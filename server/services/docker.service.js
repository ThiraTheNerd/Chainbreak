// file: server/services/docker.service.js
import Docker from 'dockerode';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const docker = new Docker({ socketPath: config.docker.socketPath });
const LABEL = 'chainbreak.session';                 // lets the reaper find our resources
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Challenge-1's target app/entrypoint read FLAG_1/FLAG_2A/FLAG_PRIVESC — see
// challenges/challenge-1/web/app.js (FLAG_1, FLAG_2A) and entrypoint.sh
// (FLAG_PRIVESC, written to /root/flag.txt behind the SUID privesc). These
// are the flag PLAINTEXTS whose bcrypt hash was seeded for each corresponding
// challenge row in db/seed.js — static for now, matching how Layer 1 already works.
const CHALLENGE_1_FLAGS = {
  FLAG_1:                 'flag{sqli_owasp_bypass}',
  FLAG_2A:                'flag{sqli_broken_access}',
  FLAG_PRIVESC:           'flag{sqli_privesc_root}',
  FLAG_DOCKER_MISCONFIG:  'flag{sqli_docker_misconfig}',
  FLAG_SSH_PIVOT:         'flag{sqli_ssh_pivot}',
};
const CHALLENGE_2_FLAGS = {
  FLAG_RCE:     'flag{deserialize_rce_foothold}',
  FLAG_ERRORLEAK: 'flag{verbose_error_disclosure}',
  FLAG_PRIVESC: 'flag{container_root_escalation}',
  FLAG_WEAKAUTH:  'flag{weak_auth_no_lockout}',
  FLAG_JWTFORGE:  'flag{jwt_secret_cracked}',
  // Cloud layer bridge — NOT a flag itself, the leaked CI creds that start
  // Challenge 2's two-hop cloud escalation (see LocalStack/seed-c2-cloud.py).
  // Must match that seed file's CI_RUNNER_ACCESS_KEY_ID/
  // CI_RUNNER_SECRET_ACCESS_KEY exactly — planted root-only at
  // /root/ci-deploy-key.env by entrypoint.sh. The actual cloud flag,
  // flag{cloud_credential_escalation}, lives only in LocalStack (the
  // acme/prod/master secret at the end of the chain), never in this
  // container's env or filesystem.
  CI_ACCESS_KEY_ID:     'AKIAC2CIRUNNERBOT001',
  CI_SECRET_ACCESS_KEY: 'C2ciRunnerFakeSecretKeyEXAMPLE12345678AB',
};

// Picks which flag env a target gets, based on its image. This is what actually
// hands the flag plaintexts to the container so they exist for the learner to find.
function flagEnvFor(image) {
  switch (image) {
    case 'chainbreak-challenge-1':
      return [
        `FLAG_1=${CHALLENGE_1_FLAGS.FLAG_1}`,
        `FLAG_2A=${CHALLENGE_1_FLAGS.FLAG_2A}`,
        `FLAG_PRIVESC=${CHALLENGE_1_FLAGS.FLAG_PRIVESC}`,
        `FLAG_DOCKER_MISCONFIG=${CHALLENGE_1_FLAGS.FLAG_DOCKER_MISCONFIG}`,
        `FLAG_SSH_PIVOT=${CHALLENGE_1_FLAGS.FLAG_SSH_PIVOT}`,
        `PORT=3000`,
      ];
    case 'chainbreak-challenge-2':
      return [
        `FLAG_RCE=${CHALLENGE_2_FLAGS.FLAG_RCE}`,
        `FLAG_ERRORLEAK=${CHALLENGE_2_FLAGS.FLAG_ERRORLEAK}`,
        `FLAG_PRIVESC=${CHALLENGE_2_FLAGS.FLAG_PRIVESC}`,
        `FLAG_WEAKAUTH=${CHALLENGE_2_FLAGS.FLAG_WEAKAUTH}`,
        `FLAG_JWTFORGE=${CHALLENGE_2_FLAGS.FLAG_JWTFORGE}`,
        `FLAG_CI_ACCESS_KEY_ID=${CHALLENGE_2_FLAGS.CI_ACCESS_KEY_ID}`,
        `FLAG_CI_SECRET_ACCESS_KEY=${CHALLENGE_2_FLAGS.CI_SECRET_ACCESS_KEY}`,
        `JWT_SECRET=killer`,  // used by the JWT forge challenge
        `APP_USER=websvc`,
        `PORT=3000`,
      ];
    default:
      return [`PORT=3000`];
  }
}


/**
 * Provision a ready environment for one session: an isolated network holding a
 * TARGET (the vulnerable app, reachable as `target`) and a WORKSTATION (the attacker
 * box the terminal attaches to). Returns all three ids, or throws having cleaned up
 * any partial resources — the caller never reasons about half-built state.
 */
export async function provision({ sessionId, image, networkAlias = 'target', flag }) {
  const networkName = `chainbreak-net-${sessionId}`;
  const mem = config.docker.memoryMb * 1024 * 1024;
  const limits = {
    Memory:     mem,
    MemorySwap: mem,                                // == Memory => swap disabled
    NanoCpus:   config.docker.nanoCpus,             // fractional CPU cap
    PidsLimit:  config.docker.pidsLimit,            // fork-bomb protection
  };

  let network, target, workstation;                 // three resources now, not two

  try {
    // Per-session isolated network: one learner can never reach another's containers.
    network = await docker.createNetwork({
      Name: networkName,
      Driver: config.docker.networkDriver,
      Labels: { [LABEL]: sessionId },
      // Internal: true,  // Layer 3 needs LocalStack reachability — leave off for now
    });

    // --- TARGET: the vulnerable app. Reachable as `target` on the network. ---
    target = await docker.createContainer({
      Image: image,
      name:  `chainbreak-${sessionId}-target`,
      // Authoritative source for \h in every shell prompt on the target
      // (paymentsvc's SSH login, and root's post-privesc shell) — without
      // this, Docker's auto-generated hex container id is the hostname, so
      // \h renders as e.g. "2f1f0fe8bfe7" instead of something meaningful.
      // Reuses networkAlias so the hostname and the network-reachable name
      // are the same string — same pattern already used for the workstation.
      Hostname: networkAlias,
      Labels: { [LABEL]: sessionId },
      Env: flagEnvFor(image),
      // Env: flag ? [
      //   `FLAG_1=${CHALLENGE_1_FLAGS.FLAG_1}`,
      //   `FLAG_2A=${CHALLENGE_1_FLAGS.FLAG_2A}`,
      //   `FLAG_PRIVESC=${CHALLENGE_1_FLAGS.FLAG_PRIVESC}`,
      //   `FLAG_DOCKER_MISCONFIG=${CHALLENGE_1_FLAGS.FLAG_DOCKER_MISCONFIG}`,
      //   `FLAG_SSH_PIVOT=${CHALLENGE_1_FLAGS.FLAG_SSH_PIVOT}`,
      //   `PORT=3000`,
      // ] : [`PORT=3000`],
      HostConfig: { ...limits, NetworkMode: networkName },
      NetworkingConfig: {
        EndpointsConfig: { [networkName]: { Aliases: [networkAlias] } },   // was ['target']
      },
    });

    // --- WORKSTATION: the attacker box the xterm.js terminal attaches to. ---
    workstation = await docker.createContainer({
      Image: config.docker.workstationImage,
      name:  `chainbreak-${sessionId}-ws`,
      // Authoritative source for the shell prompt's hostname (terminal.js's
      // PS1 uses \h, which resolves from this) — makes the container present
      // as the attacker box, not the target (`hostname`/`uname -n` agree too).
      Hostname: 'chainbreak-ws',
      Labels: { [LABEL]: sessionId },
      Tty: true,                                    // interactive `docker exec bash`
      HostConfig: { ...limits, NetworkMode: networkName },
      NetworkingConfig: {
        EndpointsConfig: { [networkName]: { Aliases: ['workstation'] } },
      },
    });

    await target.start();
    await workstation.start();

    // Cloud layer STAGE 1 (plumbing only — no vulnerability/flag yet):
    // attach the workstation to the shared LocalStack network so
    // `aws --endpoint-url=http://localstack:4566 ...` resolves `localstack`
    // from inside it. Only the workstation joins — the target doesn't need
    // (and currently has no reason to reach) LocalStack. Best-effort and
    // non-fatal: if the network doesn't exist (e.g. `docker compose up` was
    // run without the localstack service, or someone hasn't pulled the
    // latest compose file), a session must still provision successfully —
    // no current challenge depends on cloud reachability.
    try {
      await docker.getNetwork(config.docker.localstackNetwork).connect({ Container: workstation.id });
    } catch (err) {
      logger.warn(`[docker.service] could not attach workstation to LocalStack network '${config.docker.localstackNetwork}': ${err.message}`);
    }

    // Wait for the TARGET only. The workstation is `sleep infinity`, so its
    // "Running" flips true instantly and tells us nothing useful. Readiness that
    // matters is the app the learner is about to attack.
    await waitUntilReady(target);

    return {
      containerId:            target.id,            // "container_id" == the target
      workstationContainerId: workstation.id,       // new — teardown & terminal need it
      networkId:              network.id,
    };
  } catch (err) {
    // Self-cleanup: never leak a half-provisioned environment. Best-effort here is
    // correct — we're re-throwing the original error and don't want a cleanup
    // failure to mask it.
    if (target)      await target.remove({ force: true }).catch(() => {});
    if (workstation) await workstation.remove({ force: true }).catch(() => {});
    if (network)     await network.remove().catch(() => {});
    throw err;
  }
}

async function waitUntilReady(container, { timeoutMs = 30_000, intervalMs = 750 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { State } = await container.inspect();
    if (!State.Running) throw new Error('container exited during startup');
    // If the image declares a HEALTHCHECK, honour it; otherwise "Running" is enough.
    if (!State.Health || State.Health.Status === 'healthy') return;
    await sleep(intervalMs);
  }
  throw new Error('container did not become ready before timeout');
}

/**
 * Does this container id still exist in Docker? Used by the reaper's stale-
 * row reconciliation (a session's DB row can outlive its containers if the
 * server crashed mid-session, someone ran `docker rm`/`docker system prune`
 * outside the app, etc.) — see reaper.service.js's reconcileStale().
 */
export async function containerExists(id) {
  if (!id) return false;
  try {
    await docker.getContainer(id).inspect();
    return true;
  } catch (err) {
    if (err.statusCode === 404) return false;
    throw err;
  }
}

/**
 * Best-effort removal of one container. Never throws on "already gone"
 * (404) — that's the expected, idempotent outcome of retrying teardown on a
 * session that's already partially torn down. Any OTHER error is logged and
 * recorded in `failures`, but does NOT stop the caller from attempting the
 * next resource — this is what actually fixes the leak: previously, a
 * single non-404 failure on ANY one resource (via a bare `.catch(ignoreMissing)`
 * that re-threw real errors, with no surrounding try/catch) aborted removal
 * of everything after it in the same teardown() call.
 */
async function removeContainer(sessionId, label, id, failures) {
  if (!id) return;
  const short = id.slice(0, 12);
  try {
    await docker.getContainer(id).remove({ force: true });
    logger.info(`[teardown] session ${sessionId}: removed ${label} container ${short}`);
  } catch (err) {
    if (err.statusCode === 404) {
      logger.info(`[teardown] session ${sessionId}: ${label} container ${short} already gone`);
      return;
    }
    logger.error(`[teardown] session ${sessionId}: FAILED removing ${label} container ${short}: ${err.message}`);
    failures.push({ resource: `${label}-container`, id, error: err.message });
  }
}

/** Same best-effort/idempotent/logged shape as removeContainer, for the
 *  per-session network. Previously had NO error handling at all — an
 *  already-removed network (404) threw uncaught, which alone broke
 *  idempotency on any retry. */
async function removeNetwork(sessionId, id, failures) {
  if (!id) return;
  const short = id.slice(0, 12);
  try {
    await docker.getNetwork(id).remove();
    logger.info(`[teardown] session ${sessionId}: removed network ${short}`);
  } catch (err) {
    if (err.statusCode === 404) {
      logger.info(`[teardown] session ${sessionId}: network ${short} already gone`);
      return;
    }
    logger.error(`[teardown] session ${sessionId}: FAILED removing network ${short}: ${err.message}`);
    failures.push({ resource: 'network', id, error: err.message });
  }
}

/**
 * Best-effort, idempotent cleanup. Accepts a session ROW (snake_case)
 * straight from the DB, so the reaper can pass `s` directly.
 *
 * Removes the target container, the workstation container (which also
 * detaches it from every network it's on, including the shared LocalStack
 * network it joins post-create — verified empirically: force-removing a
 * multi-network container leaves no stale endpoints on the surviving
 * shared network), and finally the per-session network — attempting ALL
 * THREE regardless of whether an earlier one failed, and treating "already
 * gone" (404) as success on every one of them, not just containers.
 *
 * Throws (aggregating every real failure onto `err.failures`) only if
 * something was genuinely left behind after every resource was attempted —
 * callers (reaper.service.js, session.service.js's stopChallenge) rely on
 * this to decide whether it's safe to mark the session's DB row as fully
 * done, or whether it must be retried.
 */
export async function teardown(session) {
  const sessionId = session.id ?? '(unknown)';
  const { container_id, workstation_container_id, network_id } = session;
  const failures = [];

  // Containers first (so the network has a real chance of being empty by
  // the time we try to remove it) — but every step below runs regardless
  // of whether an earlier one failed.
  await removeContainer(sessionId, 'target', container_id, failures);
  await removeContainer(sessionId, 'workstation', workstation_container_id, failures);
  await removeNetwork(sessionId, network_id, failures);

  if (failures.length > 0) {
    const err = new Error(
      `teardown incomplete for session ${sessionId}: ${failures.map((f) => f.resource).join(', ')} failed`
    );
    err.failures = failures;
    throw err;
  }
}

