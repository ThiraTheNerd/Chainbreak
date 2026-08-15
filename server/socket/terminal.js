import * as pty       from 'node-pty';
import { execFile }   from 'node:child_process';
import { promisify }  from 'node:util';
import { submitFlagForSession } from '../services/flag.service.js';
import * as learnerSessions from '../repositories/learner-session.repository.js';
import logger         from '../utils/logger.js';
import pool           from '../db/connection.js';

const execFileAsync = promisify(execFile);

const FLAG_PATTERN = /flag\{[A-Za-z0-9_-]{4,64}\}/g;

const ANSI = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', amber: '\x1b[33m', dim: '\x1b[2m' };


async function detectShell(containerId) {
  try {
    await execFileAsync('/usr/local/bin/docker', ['exec', containerId, 'sh', '-c', 'command -v bash']);
    return 'bash';
  } catch {
    return 'sh';
  }
}

function buildWelcomeBanner(targetAlias) {
  const { bold, green, amber, dim, reset } = ANSI;
  const targetLine = targetAlias
    ? `them over the network (e.g. the target at ${targetAlias}:3000).`
    : `them over the network — run recon to locate your target.`;
  return [
    `${bold}${green}== ChainBreak Attacker Workstation — operator console ==${reset}`,
    `${amber}This is YOUR operating base. Targets are remote — enumerate and attack${reset}`,
    `${amber}${targetLine}${reset}`,
    `${dim}(This is a cosmetic banner — nothing above ran in the container.)${reset}`,
    '',
  ].join('\r\n');
}

export async function handleTerminal(socket, io) {
  const session     = socket.session;
  console.log('[Terminal] session keys:', Object.keys(session));
  const targetAlias = session.network_alias || socket.handshake.auth?.networkAlias || null;
  const containerId = session.workstation_container_id || session.container_id;

  const initialCols = socket.handshake.auth?.cols || 80;
  const initialRows = socket.handshake.auth?.rows || 24;

  if (!containerId) {
    socket.emit('terminal:error', 'No container available for this session');
    return;
  }

  // Sent before the pty is spawned, so nothing live can race it — purely
  // cosmetic, never written to the container or scanned for flags.
  socket.emit('terminal:output', buildWelcomeBanner(targetAlias));

 
  const shell = await detectShell(containerId);
  let ptyProcess;
  try {
    ptyProcess = pty.spawn('/usr/local/bin/docker', [
      'exec', '-it',
      containerId,
      shell,
    ], {
      name: 'xterm-256color',
      cols: initialCols,
      rows: initialRows,
      cwd:  process.env.HOME || '/root',
      env:  { ...process.env, TERM: 'xterm-256color' },
    });
    console.log(`[Terminal] ${socket.user.username} → ${containerId.slice(0, 12)}`);
  } catch (err) {
    console.error('[Terminal] Failed to spawn pty:', err.message);
    socket.emit('terminal:error', `Cannot connect to container: ${err.message}`);
    return;
  }

  ptyProcess.onData(async (data) => {
    socket.emit('terminal:output', data);

    const matches = [...new Set(data.match(FLAG_PATTERN) || [])];
    for (const flag of matches) {
      processFlagCapture(socket, io, flag, ptyProcess).catch(err => {
        console.error('[Terminal] Flag error:', err.message);
      });
    }
  });

  socket.on('terminal:input', (data) => {
    try {
      ptyProcess.write(data);
    } catch {
      socket.emit('terminal:error', 'Terminal connection lost');
    }
  });

  socket.on('terminal:resize', ({ cols, rows }) => {
    try {
      ptyProcess.resize(
        Math.min(Math.max(cols, 10), 500),
        Math.min(Math.max(rows, 2), 100)
      );
    } catch {}
  });

  socket.on('disconnect', () => {
    try { ptyProcess.kill(); } catch {}
    console.log(`[Terminal] pty closed — ${socket.user.username}`);
  });


  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`[Terminal] pty exited for ${socket.user.username} (code=${exitCode}, signal=${signal})`);
    learnerSessions.end(socket.learnerSessionId, 'pty_exit').catch((err) =>
      logger.error(`[Terminal] failed to end learner session ${socket.learnerSessionId} on pty exit`, err)
    );
  });
}

// After a flag lands, the client writes feedback text into xterm
// out-of-band, never through the pty — the real shell's belief about where
// its prompt sits is now out of sync with where xterm left the cursor.
// Ctrl-U then Enter (not a bare \n) nudges a real prompt redraw through the
// pty: a bare \n would EXECUTE whatever the user had typed but not yet
// submitted; Ctrl-L was rejected because it clears the whole screen,
// wiping the flag message itself.
function nudgePromptRedraw(ptyProcess) {
  try {
    ptyProcess.write('\x15\n');
  } catch {
    // Best-effort cosmetic nudge.
  }
}

// Tests the detected flag against every challenge in the session's own
// module (resolved server-side inside flag.service.js from
// socket.session.challenge_id — never from client input) and records
// EXACTLY ONE submissions row for the outcome, whichever candidate (if any)
// actually matched. See flag.service.js::submitFlagForSession for why this
// is safe for multi-flag modules and why it no longer creates a row per
// candidate checked.
async function processFlagCapture(socket, io, flagValue, ptyProcess) {
  const result = await submitFlagForSession({
    userId:             socket.user.id,
    sessionChallengeId: socket.session.challenge_id,
    submittedFlag:      flagValue,
    learnerSessionId:   socket.learnerSessionId,
  });

  if (!result.correct) return;

  const { challengeId } = result;

  if (result.alreadySolved) {
    socket.emit('flag:already_captured', { flag: flagValue, challengeId });
    nudgePromptRedraw(ptyProcess);
    return;
  }

  const [rows] = await pool.execute(
    'SELECT layer FROM challenges WHERE id = ?',
    [challengeId]
  );
  const layer = rows[0]?.layer || 'owasp'; // 'owasp' | 'docker' | 'aws'

  socket.emit('flag:captured', {
    flag:          flagValue,
    challengeId,
    layer,
    pointsAwarded: result.pointsAwarded,
    message:       `Flag captured — ${layer} layer +${result.pointsAwarded} pts`,
  });
  nudgePromptRedraw(ptyProcess);

  io.emit('scores:updated', {
    userId:      socket.user.id,
    username:    socket.user.username,
    challengeId,
    layer,
  });

  console.log(
    `[Flag] ✓ ${socket.user.username} captured ${flagValue} (${layer}, +${result.pointsAwarded}pts)`
  );
}
