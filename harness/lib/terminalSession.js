// harness/lib/terminalSession.js
//
// Wraps socket.io-client so exploit code reads like a transcript: send a
// line, wait for the shell to hand control back, read what it printed.
// This is deliberately the SAME channel and the SAME events a human at a
// browser uses (server/socket/terminal.js, client/src/components/terminal/
// Terminal.jsx): terminal:input in, terminal:output out, flag:captured
// whenever the SERVER's own regex scanner (not us — we never call
// flag.service.js directly) recognises a flag string in that output.
//
// IMPORTANT — this is a real pty, so it has local echo: every command we
// "type" via terminal:input is echoed straight back to us over
// terminal:output before the shell's real result appears, exactly as it
// would render on a human's screen. `runCommand`'s returned `output`
// therefore contains the echoed input line as well as the command's real
// result. We deal with this by asserting CONTAINMENT/pattern-match on
// output (does it include the JSON we expect, the uid=0 we expect, the
// flag text we expect) rather than exact string equality on the whole
// blob — the same thing a human visually scanning a terminal does: look
// for the expected text, not diff the entire screen.

import { io } from 'socket.io-client';
import { config } from '../config.js';

// Appended after every scripted command so we know "the shell is idle and
// ready for the next line" without guessing at shell-specific prompt
// formats. This works identically whether the foreground process at the
// far end of the pty is the workstation's own bash, a shell we've SSH'd
// into, or a root shell obtained via a SUID escalation — from the pty's
// point of view all three are just "whatever currently reads this
// terminal's stdin," and this tag is something WE chose, never something
// we have to parse out of a shell-specific prompt.
const DONE_TAG = '__CHAINBREAK_DONE__';

export class TerminalSession {
  constructor() {
    this.socket = null;
    this.buffer = '';        // every byte of terminal:output received, ever
    this.readOffset = 0;     // how much of `buffer` earlier waits already consumed
    this.capturedFlags = []; // every flag:captured payload, in arrival order
    this.terminalErrors = [];// every terminal:error message, for failure diagnostics
  }

  /**
   * Opens the socket exactly as the real terminal component does: the JWT,
   * the session id, and every challenge id in the module go in
   * `auth`, verified server-side by server/socket/index.js's middleware
   * (JWT valid, session.user_id === sub, session.status === 'running').
   */
  connect({ baseUrl, token, sessionId, challengeIds }) {
    return new Promise((resolve, reject) => {
      const socket = io(baseUrl ?? config.baseUrl, {
        auth: { token, sessionId, challengeIds, cols: 120, rows: 40 },
        transports: ['websocket'],
        timeout: 10_000,
      });
      this.socket = socket;

      socket.on('terminal:output', (data) => {
        this.buffer += data;
      });
      socket.on('flag:captured', (payload) => {
        this.capturedFlags.push(payload);
      });
      socket.on('terminal:error', (msg) => {
        this.terminalErrors.push(msg);
      });

      socket.once('connect', () => resolve());
      socket.once('connect_error', (err) => reject(new Error(`socket connect_error: ${err.message}`)));
    });
  }

  /** Sends raw keystrokes, unmodified — the same event
   *  client/src/components/terminal/Terminal.jsx emits on every keypress. */
  sendInput(text) {
    if (!this.socket) throw new Error('TerminalSession.sendInput called before connect()');
    this.socket.emit('terminal:input', text);
  }

  /**
   * Polls the accumulated buffer (from the current read offset onward)
   * until `predicate` is satisfied, then advances the offset past
   * everything just consumed. Polling — rather than a single one-shot
   * 'terminal:output' listener — is necessary because output arrives in
   * arbitrarily small chunks; we need to re-check the WHOLE accumulated
   * unseen text on every chunk, not any one chunk in isolation.
   */
  async _waitUntil(predicate, timeoutMs, describeFailure) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const unseen = this.buffer.slice(this.readOffset);
      if (predicate(unseen)) {
        this.readOffset = this.buffer.length;
        return unseen;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const unseen = this.buffer.slice(this.readOffset);
    throw new Error(
      `${describeFailure} — timed out after ${timeoutMs}ms.\n` +
      `--- unconsumed terminal output ---\n${unseen}\n--- end ---`
    );
  }

  /**
   * Waits for a specific string/regex to appear — for the one case that
   * has no natural "command finished" moment: opening an interactive
   * session (an SSH login) whose next prompt belongs to a different shell
   * than the one we sent the command from, so there is no `$?` to echo.
   */
  async waitForOutput(matcher, { timeoutMs = config.timeouts.output, label = 'expected output' } = {}) {
    const test = typeof matcher === 'string' ? (s) => s.includes(matcher) : (s) => matcher.test(s);
    return this._waitUntil(test, timeoutMs, `Never saw ${label}`);
  }

  /**
   * Runs one command on whatever shell currently owns the pty and waits
   * for it to finish. `cmd` and the follow-up `echo TAG$?` are joined with
   * `;` onto a SINGLE typed line, sent as one write — this matters, and
   * was not the first thing tried. An earlier version sent them as two
   * separate lines (cmd, then a second line with the echo), reasoning that
   * two lines would behave the same as one semicolon-joined line since
   * either way the shell only reaches the echo once `cmd` has finished.
   * That reasoning holds for an ordinary command, but breaks for one like
   * `john`, which puts the tty into raw/character mode WHILE it runs (so
   * it can react to a keypress with a status update). Two separate lines
   * means two separate newline-terminated lines sit in the kernel's input
   * queue; bash only reads and dispatches the FIRST one (`cmd`) before our
   * second line ever needs to be consumed — and once `cmd`'s process
   * switches the tty to raw mode, THAT process — not bash — is what reads
   * our still-queued second line, one keystroke at a time. Confirmed by
   * reproducing it directly against john: the follow-up `echo TAG$?` line
   * was consumed by john itself as a keypress, printing its "Delayed
   * status pending..." line, and the real tag never arrived until john
   * finished on its own — well past our completion check. Joining onto
   * ONE line sent as ONE write avoids this: the kernel buffers exactly one
   * line, bash reads that whole line in a single pass BEFORE forking
   * anything, and only THEN executes `cmd` followed by the echo — entirely
   * inside bash's own sequencing, never as separate terminal input `cmd`'s
   * process could intercept.
   *
   * The cost of this fix: a `;`-joined single line cannot carry a
   * multi-line heredoc (the `; echo` would land inside the heredoc BODY,
   * not after it) — so a heredoc is sent directly via sendInput() instead
   * of through this method; see chains/chainA.test.js's login.json step.
   */
  async runCommand(cmd, { timeoutMs = config.timeouts.command } = {}) {
    this.sendInput(`${cmd}; echo ${DONE_TAG}$?\n`);

    // DONE_TAG shows up TWICE: first almost instantly, as the tty's local
    // echo of the literal `echo TAG$?` line we just sent (unexpanded —
    // `$?` hasn't run yet); then again, only once `cmd` has actually
    // finished executing, as that echo command's REAL printed result
    // (`$?` expanded to a digit). Waiting for just ONE occurrence would
    // resolve on the echo alone — near-instantly, regardless of how long
    // `cmd` itself takes — so we require a SECOND occurrence after the
    // first, which only exists once the shell has genuinely finished `cmd`
    // and gotten back around to running the echo for real.
    const hasTwoOccurrences = (s) => {
      const first = s.indexOf(DONE_TAG);
      return first !== -1 && s.indexOf(DONE_TAG, first + DONE_TAG.length) !== -1;
    };
    const raw = await this._waitUntil(
      hasTwoOccurrences,
      timeoutMs,
      `Command did not complete: ${cmd}`
    );

    // DONE_TAG appears TWICE in `raw`: first as the tty's local echo of the
    // literal `echo TAG$?` we just typed (unexpanded — `$?` hasn't run
    // yet), then again as that command's REAL printed result (`$?`
    // expanded to a digit). We want the second occurrence — lastIndexOf,
    // not indexOf — otherwise the "exit code" we slice out is actually the
    // still-unexpanded text "$?" from the echoed input line.
    const tagIndex = raw.lastIndexOf(DONE_TAG);
    const output = raw.slice(0, tagIndex);           // echoed input + real command output
    const afterTag = raw.slice(tagIndex + DONE_TAG.length);
    const exitCode = Number((afterTag.match(/^(\d+)/) ?? [null, NaN])[1]);

    return { output, exitCode, raw };
  }

  /**
   * Blocks until a flag:captured event for this specific challengeId has
   * arrived (checking flags already buffered before this call too, since
   * the server can emit before we start waiting). This is how a stage
   * proves the SERVER's own regex scanner — not our own string-matching —
   * recognised the flag, which is the actual mechanism a real learner's
   * flag submission goes through (server/socket/terminal.js's
   * processFlagCapture -> flag.service.js's submitFlag).
   */
  async waitForFlag(challengeId, { timeoutMs = config.timeouts.flag } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = this.capturedFlags.find((f) => f.challengeId === challengeId);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(
      `Flag for challenge ${challengeId} was never captured. ` +
      `flag:captured events seen so far: ${JSON.stringify(this.capturedFlags)}`
    );
  }

  /** Disconnects the socket. Safe to call more than once / on a socket
   *  that never connected — teardown must never itself throw. */
  close() {
    try { this.socket?.disconnect(); } catch { /* best-effort */ }
  }
}

/** Finds and parses the first JSON object in a blob of terminal output,
 *  ignoring whatever local-echo text (the curl command we typed) surrounds
 *  it. Used to pull structured fields (a JWT, a flag string) out of a raw
 *  HTTP response that curl printed straight into the terminal. */
export function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in output:\n${text}`);
  return JSON.parse(match[0]);
}
