import Docker from 'dockerode';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const docker = new Docker({ socketPath: config.docker.socketPath });
const LABEL = 'chainbreak.session';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  // Must match LocalStack/seed-c2-cloud.py's CI_RUNNER_ACCESS_KEY_ID/
  // CI_RUNNER_SECRET_ACCESS_KEY exactly — these bridge into Challenge 2's
  // cloud escalation, planted at /root/ci-deploy-key.env by entrypoint.sh.
  CI_ACCESS_KEY_ID:     'AKIAC2CIRUNNERBOT001',
  CI_SECRET_ACCESS_KEY: 'C2ciRunnerFakeSecretKeyEXAMPLE12345678AB',
};

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
        `JWT_SECRET=killer`,
        `APP_USER=websvc`,
        `PORT=3000`,
      ];
    default:
      return [`PORT=3000`];
  }
}

export async function provision({ sessionId, image, networkAlias = 'target', flag }) {
  const networkName = `chainbreak-net-${sessionId}`;
  const mem = config.docker.memoryMb * 1024 * 1024;
  const limits = {
    Memory:     mem,
    MemorySwap: mem, // == Memory => swap disabled
    NanoCpus:   config.docker.nanoCpus,
    PidsLimit:  config.docker.pidsLimit,
  };

  let network, target, workstation;

  try {
    network = await docker.createNetwork({
      Name: networkName,
      Driver: config.docker.networkDriver,
      Labels: { [LABEL]: sessionId },
    });

    target = await docker.createContainer({
      Image: image,
      name:  `chainbreak-${sessionId}-target`,
      // Sets \h in every shell prompt on the target — without it Docker's
      // auto-generated hex container id is the hostname instead.
      Hostname: networkAlias,
      Labels: { [LABEL]: sessionId },
      Env: flagEnvFor(image),
      HostConfig: { ...limits, NetworkMode: networkName },
      NetworkingConfig: {
        EndpointsConfig: { [networkName]: { Aliases: [networkAlias] } },
      },
    });

    workstation = await docker.createContainer({
      Image: config.docker.workstationImage,
      name:  `chainbreak-${sessionId}-ws`,
      // Sets the shell prompt's hostname (terminal.js's PS1 uses \h) so it
      // presents as the attacker box, not the target.
      Hostname: 'chainbreak-ws',
      Labels: { [LABEL]: sessionId },
      Tty: true,
      HostConfig: { ...limits, NetworkMode: networkName },
      NetworkingConfig: {
        EndpointsConfig: { [networkName]: { Aliases: ['workstation'] } },
      },
    });

    await target.start();
    await workstation.start();

    // Best-effort, non-fatal: only the workstation joins the shared
    // LocalStack network, and a session must still provision successfully
    // even if that network doesn't exist (e.g. compose was run without the
    // localstack service).
    try {
      await docker.getNetwork(config.docker.localstackNetwork).connect({ Container: workstation.id });
    } catch (err) {
      logger.warn(`[docker.service] could not attach workstation to LocalStack network '${config.docker.localstackNetwork}': ${err.message}`);
    }

    // Only the target's readiness matters — the workstation is `sleep
    // infinity`, so its "Running" flips true instantly either way.
    await waitUntilReady(target);

    return {
      containerId:            target.id,
      workstationContainerId: workstation.id,
      networkId:              network.id,
    };
  } catch (err) {
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
    if (!State.Health || State.Health.Status === 'healthy') return;
    await sleep(intervalMs);
  }
  throw new Error('container did not become ready before timeout');
}

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
 * Attempts all three resources regardless of whether an earlier one failed,
 * treating "already gone" (404) as success on each. Throws with every real
 * failure aggregated onto `err.failures` only if something was genuinely
 * left behind — callers (reaper.service.js, session.service.js) rely on
 * this to decide whether the session's DB row can be marked done.
 */
export async function teardown(session) {
  const sessionId = session.id ?? '(unknown)';
  const { container_id, workstation_container_id, network_id } = session;
  const failures = [];

  // Containers first, so the network has a chance of being empty by the
  // time removal is attempted on it.
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
