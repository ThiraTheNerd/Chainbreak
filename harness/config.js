// harness/config.js
//
// Single source of truth for "where is ChainBreak" and how long we're
// willing to wait for it. Point CHAINBREAK_BASE_URL at a different host
// (e.g. a remote deployment) without touching any test file.
//
// baseUrl is the nginx-fronted origin (nginx/nginx.conf proxies /api/ and
// /socket.io/ straight through to the `server` container on :3000) —
// exactly what a real learner's browser talks to. We deliberately never
// hit the server container's own port directly, and we never touch the
// docker-compose "challenge-1"/"challenge-2" singleton services: those are
// stale leftovers (different, non-matching flag text — see the
// investigation notes) that no session's terminal ever actually reaches.
export const config = {
  baseUrl: process.env.CHAINBREAK_BASE_URL || 'http://localhost',

  timeouts: {
    // POST /challenges/:id/session currently blocks until the target
    // container passes its readiness check (docker.service.js's
    // waitUntilReady, a 30s budget) before it even responds — this just
    // needs to comfortably clear that plus a slow Docker daemon.
    sessionRunning: 60_000,
    // One shell command's round trip over the terminal socket.
    command: 20_000,
    // Waiting for a specific string to show up in terminal output that
    // isn't a discrete "command finished" event (a new shell prompt).
    output: 20_000,
    // john against the workstation's curated wordlist is measured at
    // "seconds to low minutes" per server/docker/workstation/Dockerfile's
    // own comment — generous headroom on top of that.
    passwordCrack: 180_000,
    // Waiting for one specific flag:captured event after the command that
    // should have printed it has already completed.
    flag: 15_000,
    // Whole-chain ceiling passed to vitest's per-test timeout: provisioning
    // + every round trip + the password crack, with headroom.
    chainOverall: 360_000,
  },

  // Real, seeded slugs (server/db/seed.js) — NOT a WB-01/CT-01/CL-01
  // scheme, which doesn't exist anywhere in ChainBreak's code or data.
  // Chain A is challenge-1's whole "payments" module: ONE shared
  // target+workstation container pair carries all three layers
  // (owasp -> docker -> aws) in sequence.
  chainA: {
    // The module's entry (web/owasp) row — the id POST
    // /challenges/:id/session is called with to provision the module.
    entrySlug: 'sqli-login',
    // Every flag-bearing row in the module. Sent as the socket handshake's
    // challengeIds (server/socket/index.js) so the terminal's flag
    // scanner recognises every flag this one session can print, not just
    // the entry challenge's.
    moduleSlugs: [
      'sqli-login', 'sqli-broken-access',
      'sqli-ssh-pivot', 'sqli-privesc-root', 'sqli-docker-misconfig',
      'sqli-iam-exfil',
    ],
    // The target's hostname on the per-session network (seed.js's
    // network_alias column for every row in this module; also the
    // container's Hostname, set in docker.service.js's provision()).
    networkAlias: 'web-challenge-1',
    // Static, hardcoded plaintexts (docker.service.js's CHALLENGE_1_FLAGS,
    // plus the S3 object LocalStack/seed-iam.py plants) — identical for
    // every session. Asserting against these is a MATCH check on
    // correctness, not a claim of per-session uniqueness (there is none).
    expectedFlags: {
      'sqli-login':            'flag{sqli_owasp_bypass}',
      'sqli-broken-access':    'flag{sqli_broken_access}',
      'sqli-ssh-pivot':        'flag{sqli_ssh_pivot}',
      'sqli-privesc-root':     'flag{sqli_privesc_root}',
      'sqli-docker-misconfig': 'flag{sqli_docker_misconfig}',
      'sqli-iam-exfil':        'flag{sqli_aws_iam_exfil}',
    },
  },
};
