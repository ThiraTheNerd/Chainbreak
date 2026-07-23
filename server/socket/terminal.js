// server/socket/terminal.js
// Bridges xterm.js in the browser to a bash session inside a Docker container.
// Uses socket.session (verified in socket/index.js) to get the container id.
// Scans all output for flag{} patterns and calls the existing flag service.

import * as pty       from 'node-pty';
import { execFile }   from 'node:child_process';
import { promisify }  from 'node:util';
import { submitFlag } from '../services/flag.service.js';
import pool           from '../db/connection.js';

const execFileAsync = promisify(execFile);

// Matches your actual flag format: flag{sqli_owasp_bypass} etc.
const FLAG_PATTERN = /flag\{[A-Za-z0-9_-]{4,64}\}/g;

// ── ANSI helpers for cosmetic terminal text (banner only — never sent into
// the container, never scanned for flags) ───────────────────────────────────
const ANSI = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', amber: '\x1b[33m', dim: '\x1b[2m' };

// busybox ash (the `sh` in most minimal images) prints bash prompt escapes
// (\u \h \w) LITERALLY instead of expanding them — confirmed on the running
// system (`echo $0` -> sh even though bash was installed, because this exec
// was hardcoded to 'sh'). The workstation image has real bash with a system
// prompt baked into ~/.bashrc (see server/docker/workstation/Dockerfile), so
// prefer bash — but check first, so a container that happens not to have it
// still gets a shell instead of a failed exec.
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
  // Use the workstation container if provisioned, fall back to the target container.
  // The workstation is the "attacker box" the learner types commands into.
  const containerId = session.workstation_container_id || session.container_id;

  const initialCols = socket.handshake.auth?.cols || 80;
  const initialRows = socket.handshake.auth?.rows || 24;

  if (!containerId) {
    socket.emit('terminal:error', 'No container available for this session');
    return;
  }

  // ── Connect-time banner ────────────────────────────────────────────────
  // Emitted straight to the client over the same 'terminal:output' channel
  // the live shell uses, but BEFORE the pty is spawned — the pty doesn't
  // exist yet at this point, so there is nothing live that could race it.
  // Purely cosmetic: never written to the container, never passed through
  // the flag scanner below (that only sees ptyProcess.onData).
  socket.emit('terminal:output', buildWelcomeBanner(targetAlias));

  // ── Spawn a real shell session inside the container ────────────────────────
  // Spawned as a direct argv array (no intermediate `/bin/sh -c "..."` string)
  // so nothing upstream of `docker exec` gets a chance to mangle arguments.
  // `-t` allocates a real pty inside the container (the previous `-i`-only
  // exec had none, which is why the shell never rendered a proper
  // interactive prompt). The shell itself is bash when available — its
  // prompt (PS1=\u@\h:\w\$, baked into the image's ~/.bashrc, see
  // server/docker/workstation/Dockerfile) is what actually expands \u/\h/\w;
  // busybox ash prints those literally, which is what a hardcoded `sh` here
  // used to produce. Passing `-e PS1=...` doesn't survive bash's own startup
  // files reliably (confirmed: Debian's stock ~/.bashrc overwrites an
  // inherited PS1 unconditionally), so the image's baked-in prompt is the
  // single source of truth instead — nothing is injected per-exec here.
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

  // ── Stream output to browser + scan for flags ─────────────────────────────
  ptyProcess.onData(async (data) => {
    socket.emit('terminal:output', data);

    const matches = [...new Set(data.match(FLAG_PATTERN) || [])];
    for (const flag of matches) {
      processFlagCapture(socket, io, flag, ptyProcess).catch(err => {
        console.error('[Terminal] Flag error:', err.message);
      });
    }
  });

  // ── Forward keystrokes to container ──────────────────────────────────────
  socket.on('terminal:input', (data) => {
    try {
      ptyProcess.write(data);
    } catch {
      socket.emit('terminal:error', 'Terminal connection lost');
    }
  });

  // ── Handle terminal resize ────────────────────────────────────────────────
  socket.on('terminal:resize', ({ cols, rows }) => {
    try {
      ptyProcess.resize(
        Math.min(Math.max(cols, 10), 500),
        Math.min(Math.max(rows, 2), 100)
      );
    } catch {}
  });

  // ── Clean up on disconnect ────────────────────────────────────────────────
  socket.on('disconnect', () => {
    try { ptyProcess.kill(); } catch {}
    console.log(`[Terminal] pty closed — ${socket.user.username}`);
  });
}

// After a flag lands, the client writes feedback text straight into xterm
// via terminal.write() — OUT-OF-BAND, never through the pty. The real shell
// has no idea any of that appeared on screen, so its own (unaffected) belief
// about where its prompt already sits is now several rows above where xterm
// visually left the cursor — nothing re-syncs them until the user's next
// keypress forces some real pty output. Nudging the pty to print a REAL
// fresh prompt fixes that by going through the actual, in-sync channel.
//
// The nudge is Ctrl-U then Enter (\x15\n), not a bare \n: verified by hand
// (a small node-pty harness against this exact workstation image) that a
// bare \n EXECUTES whatever the user has typed but not yet submitted at the
// moment the flag lands — a real risk, not hypothetical. Ctrl-U clears the
// pending input line first (bash echoes the clear + redraws in place), so
// the trailing Enter is always safe. Ctrl-L was also tried and rejected: it
// clears the ENTIRE screen (\x1b[H\x1b[2J), wiping the flag message itself.
function nudgePromptRedraw(ptyProcess) {
  try {
    ptyProcess.write('\x15\n');
  } catch {
    // Best-effort cosmetic nudge — losing it just means the user needs one
    // keypress to resync, same as before this fix existed.
  }
}

async function processFlagCapture(socket, io, flagValue, ptyProcess) {
  const challengeIds = socket.challengeIds || [socket.session.challenge_id]
  console.log('[Terminal] challengeIds for session:', socket.challengeIds);
  for (const challengeId of challengeIds) {
    // submitFlag (imported from ../services/flag.service.js) does the
    // bcrypt comparison internally — it returns { correct: bool, ... }
    const result = await submitFlag({
      userId:        socket.user.id,
      challengeId,
      submittedFlag: flagValue,
    });

    if (!result.correct) continue // wrong challenge, try the next one

    if (result.alreadySolved) {
      socket.emit('flag:already_captured', { flag: flagValue, challengeId });
      nudgePromptRedraw(ptyProcess);
      return;
    }

    // Look up the challenge layer so the frontend knows which stage to advance
    const [rows] = await pool.execute(
      'SELECT layer FROM challenges WHERE id = ?',
      [challengeId]
    );
    const layer = rows[0]?.layer || 'owasp'; // 'owasp' | 'docker' | 'aws'

    socket.emit('flag:captured', {
      flag:          flagValue,
      challengeId,
      layer,          // ← frontend uses this to advance the kill chain stage
      pointsAwarded: result.pointsAwarded,
      message:       `Flag captured — ${layer} layer +${result.pointsAwarded} pts`,
    });
    nudgePromptRedraw(ptyProcess);

    // Tell all clients to refresh the leaderboard
    io.emit('scores:updated', {
      userId:      socket.user.id,
      username:    socket.user.username,
      challengeId,
      layer,
    });

    console.log(
      `[Flag] ✓ ${socket.user.username} captured ${flagValue} (${layer}, +${result.pointsAwarded}pts)`
    );
    return; // stop iterating — flag matched
  }
  // No match in any challenge — flag seen but not valid for this module
}
