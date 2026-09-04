// IMPORTANT — this is a real pty, so it has local echo: every command sent
// via terminal:input is echoed straight back over terminal:output before
// the shell's real result appears. `runCommand`'s returned `output`
// therefore contains the echoed input line as well as the command's real
// result — assert containment/pattern-match on it, not exact equality.

import { io } from 'socket.io-client';
import { config } from '../config.js';

const DONE_TAG = '__CHAINBREAK_DONE__';

export class TerminalSession {
  constructor() {
    this.socket = null;
    this.buffer = '';
    this.readOffset = 0;
    this.capturedFlags = [];
    this.terminalErrors = [];
  }

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

  sendInput(text) {
    if (!this.socket) throw new Error('TerminalSession.sendInput called before connect()');
    this.socket.emit('terminal:input', text);
  }

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

  async waitForOutput(matcher, { timeoutMs = config.timeouts.output, label = 'expected output' } = {}) {
    const test = typeof matcher === 'string' ? (s) => s.includes(matcher) : (s) => matcher.test(s);
    return this._waitUntil(test, timeoutMs, `Never saw ${label}`);
  }

  /**
   * `cmd` and the follow-up `echo TAG$?` are joined with `;` onto a SINGLE
   * typed line, sent as one write. Sending them as two separate lines
   * breaks for a command like `john` that puts the tty into raw mode while
   * it runs: bash only dispatches the first queued line before forking,
   * and the running process — not bash — ends up consuming the second
   * line one keystroke at a time. Joining onto one line avoids this
   * because bash reads the whole line before executing anything.
   *
   * Consequence: a `;`-joined line can't carry a multi-line heredoc (the
   * `; echo` would land inside the heredoc body) — send those via
   * sendInput() directly instead.
   */
  async runCommand(cmd, { timeoutMs = config.timeouts.command } = {}) {
    this.sendInput(`${cmd}; echo ${DONE_TAG}$?\n`);

    // DONE_TAG appears twice: first as the tty's local echo of the literal
    // `echo TAG$?` line (unexpanded), then again once the shell has
    // actually finished `cmd` and run the echo for real. Waiting for a
    // single occurrence would resolve on the echo alone, near-instantly.
    const hasTwoOccurrences = (s) => {
      const first = s.indexOf(DONE_TAG);
      return first !== -1 && s.indexOf(DONE_TAG, first + DONE_TAG.length) !== -1;
    };
    const raw = await this._waitUntil(
      hasTwoOccurrences,
      timeoutMs,
      `Command did not complete: ${cmd}`
    );

    // Use the second (real) occurrence, not the first (echoed, unexpanded).
    const tagIndex = raw.lastIndexOf(DONE_TAG);
    const output = raw.slice(0, tagIndex);
    const afterTag = raw.slice(tagIndex + DONE_TAG.length);
    const exitCode = Number((afterTag.match(/^(\d+)/) ?? [null, NaN])[1]);

    return { output, exitCode, raw };
  }

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

  close() {
    try { this.socket?.disconnect(); } catch { /* best-effort */ }
  }
}

export function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in output:\n${text}`);
  return JSON.parse(match[0]);
}
