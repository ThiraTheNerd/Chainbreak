/**
 * Per-flag context for the AI hint system, keyed by `challenges.slug` (one
 * entry per flag, since a hint is requested for the specific flag a
 * learner is stuck on). Each entry has three fields:
 *   - `vulnerability`   — fed to Claude as the mechanism being exploited.
 *   - `solutionSummary` — fed to Claude as ground truth, but it is
 *                          instructed to never reveal this directly.
 *   - `fallback[1|2|3]` — pre-written, tier-calibrated hints used verbatim
 *                          whenever the Claude call fails, times out, or no
 *                          ANTHROPIC_API_KEY is configured, so a live study
 *                          session never breaks (1=conceptual nudge,
 *                          2=technique/direction, 3=near-explicit).
 *
 * sqli-iam-exfil (Challenge 1's cloud-layer flag) is intentionally absent —
 * that layer isn't built yet. ai.service.js falls back to a generic,
 * honest message for any slug not listed here.
 */

export const HINT_CONTEXT = {
  'sqli-login': {
    vulnerability:
      'The POST /login endpoint builds its SQL query by concatenating the ' +
      'raw username and password directly into the query string, instead ' +
      'of using parameterised placeholders.',
    solutionSummary:
      "POST to /login with username=admin and password set to: anything' " +
      "OR '1'='1 — this closes the password string early and appends a " +
      "tautology (OR '1'='1') that matches every row, so the query " +
      'returns the first user (admin) regardless of the real password.',
    fallback: {
      1: "Look closely at how the login form's query might be built from " +
         'your input — is it using parameterised placeholders, or just ' +
         'gluing your input straight into the SQL string?',
      2: 'Try breaking out of the password string early with a single ' +
         'quote, then add a condition after it that is always true so the ' +
         'WHERE clause matches every row in the table.',
      3: "Send POST /login with password set to: anything' OR '1'='1 — " +
         'that closes the string and makes the WHERE clause always true, ' +
         'returning the first user in the table.',
    },
  },

  'sqli-broken-access': {
    vulnerability:
      'GET /api/users checks that the caller has a VALID JWT ' +
      '(authentication) but never checks which ROLE that JWT carries ' +
      '(authorization) — any logged-in user can reach an endpoint meant ' +
      'for admins only.',
    solutionSummary:
      'Reuse the JWT from the login response as a Bearer token against ' +
      'GET /api/users — the endpoint returns the full user list and the ' +
      "flag regardless of the caller's role, plus a _links.backups field " +
      'pointing at the next step.',
    fallback: {
      1: 'You already have a valid token from logging in — does having ' +
         'ANY valid token guarantee you\'re authorized, or just ' +
         'authenticated? Look for an endpoint that only checks the former.',
      2: 'Try reusing your existing Bearer token against an ' +
         'admin-sounding endpoint like /api/users — check whether the ' +
         "server actually verifies your role, not just that your token " +
         'is valid.',
      3: 'curl /api/users with "Authorization: Bearer <your token>" — no ' +
         'role check exists on that route, so any authenticated user gets ' +
         'the full response, including the flag.',
    },
  },

  'sqli-ssh-pivot': {
    vulnerability:
      'A backup/export endpoint serves any file in its directory via a ' +
      'file query parameter with no allowlist, leaking a ' +
      'passphrase-protected SSH deploy key; the passphrase is a short, ' +
      'dictionary-crackable word-plus-digits string.',
    solutionSummary:
      "Read /api/admin/backup?file=README.txt (found via the broken " +
      "access control flag) to learn the key's filename, fetch " +
      '/api/admin/backup?file=paymentsvc_key, crack its passphrase ' +
      'offline with ssh2john + john against a wordlist (finds ' +
      "'sunshine12'), then ssh -i paymentsvc_key paymentsvc@web-challenge-1.",
    fallback: {
      1: 'The broken-access endpoint you already found can serve more ' +
         'than just the user list — what other files might live in that ' +
         'same backup directory?',
      2: "Once you have the leaked private key, it won't connect on its " +
         "own — it's passphrase-protected. You'll need to convert it to " +
         'a crackable hash format and run it through a wordlist offline.',
      3: 'Fetch /api/admin/backup?file=paymentsvc_key, run ssh2john on ' +
         'it and crack with john --wordlist=/usr/share/wordlists/rockyou.txt, ' +
         'then ssh -i paymentsvc_key paymentsvc@<target> using the ' +
         'cracked passphrase.',
    },
  },

  'sqli-privesc-root': {
    vulnerability:
      'A custom "backup helper" binary is installed root-owned with the ' +
      'SUID bit set (mode 4755) and unconditionally execs a shell after ' +
      'setuid(0) — any local user who can run it gets a root shell.',
    solutionSummary:
      'find / -perm -4000 2>/dev/null reveals /usr/local/bin/backup-helper; ' +
      'running it drops you into a root shell; cat /root/flag.txt reads ' +
      'the flag.',
    fallback: {
      1: 'Once you have a low-privilege shell, think about how a ' +
         "compiled program running with root's permissions — even when " +
         'a normal user launches it — could hand over more access than ' +
         'intended.',
      2: 'Search the filesystem for binaries with the SUID permission ' +
         'bit set — that\'s the class of misconfiguration you\'re ' +
         'looking for here.',
      3: 'Run: find / -perm -4000 2>/dev/null — it turns up ' +
         '/usr/local/bin/backup-helper. Run that binary directly for a ' +
         'root shell, then cat /root/flag.txt.',
    },
  },

  'sqli-docker-misconfig': {
    vulnerability:
      'The container carries a full set of AWS deploy credentials it has ' +
      'no operational need for, sitting in the default AWS CLI config ' +
      'path (/root/.aws/credentials), root-owned and mode 600.',
    solutionSummary:
      'As root (after the SUID privesc), cat /root/.aws/credentials — ' +
      'the file contains the flag embedded as a comment alongside ' +
      'real-looking AWS access key/secret values.',
    fallback: {
      1: 'Now that you have root, think about what a real production ' +
         "container sometimes carries that it really shouldn't — " +
         'credentials for OTHER systems, left behind by accident.',
      2: 'Check the default configuration path any AWS CLI installation ' +
         "would look for its credentials in — it's a well-known, " +
         "standard location under root's home directory.",
      3: 'cat /root/.aws/credentials — the flag is embedded right there ' +
         'alongside the (fake but realistic-looking) leaked AWS access ' +
         'key and secret.',
    },
  },

  'c2-error-disclosure': {
    vulnerability:
      'A deserialisation error is caught but mishandled — the raw stack ' +
      'trace (naming the vulnerable library) and a debug token are sent ' +
      'straight back to the client instead of a generic error message.',
    solutionSummary:
      'Send any invalid value as the profile cookie (e.g. base64 of the ' +
      'literal word "garbage") to GET / — the resulting 500 response\'s ' +
      'HTML body includes the flag in an HTML comment.',
    fallback: {
      1: 'The app tries to restore something from one of your cookies on ' +
         "every request — what happens if that cookie doesn't contain " +
         'what the server expects?',
      2: 'Send a profile cookie whose value isn\'t valid data for ' +
         'whatever the server expects to decode — a malformed or garbage ' +
         'base64 string is a good start.',
      3: 'curl the site with a cookie like profile=<base64 of "garbage"> ' +
         '— the 500 error response leaks a stack trace and the flag in ' +
         'an HTML comment.',
    },
  },

  'c2-weak-auth': {
    vulnerability:
      'The /login page names a valid username directly in an HTML ' +
      'comment, and the corresponding account has a weak password with ' +
      'no rate limiting or lockout on the login endpoint.',
    solutionSummary:
      "GET /login reveals the username 'support' in a comment; POST " +
      '/login with that username and a brute-forced password from a ' +
      "wordlist finds 'support123', returning the flag and a JWT.",
    fallback: {
      1: 'Read the login page carefully, including its raw HTML source ' +
         '— sometimes a comment left in for "internal" staff says more ' +
         'than it should.',
      2: 'Once you know a valid username, think about what protects ' +
         'that account from someone just trying passwords over and over ' +
         '— is there any rate limit or lockout here?',
      3: "The username is 'support' (see the login page's HTML " +
         'comment). Brute-force its password with a wordlist against ' +
         "POST /login — no lockout exists, and 'support123' is in most " +
         'common wordlists.',
    },
  },

  'c2-jwt-forge': {
    vulnerability:
      'Tokens are signed with HS256 — a SYMMETRIC algorithm — using a ' +
      'weak, dictionary-guessable secret, so the same secret that ' +
      'verifies a signature can also be used to forge a new one with a ' +
      'different role.',
    solutionSummary:
      'Crack the HS256 secret offline via an HMAC brute-force against a ' +
      'wordlist using a captured token, then forge a new JWT with ' +
      'role:admin signed with that secret, and send it to GET /admin.',
    fallback: {
      1: 'You have a valid token now, but only for a low-privilege role. ' +
         'Think about what HS256 (a SYMMETRIC signing algorithm) implies ' +
         'about who is able to create a VALID signature.',
      2: 'If you can recover the signing secret — by testing candidate ' +
         'values offline against a token you already have — you could ' +
         'build your own token from scratch instead of just reading the ' +
         'one you were issued.',
      3: 'Brute-force the HS256 secret offline against your existing ' +
         'JWT (a wordlist attack works — the secret is a common word). ' +
         'Once you have it, build a new token with role:"admin" signed ' +
         'with that secret and send it to GET /admin.',
    },
  },

  'deserialize-rce': {
    vulnerability:
      'node-serialize@0.0.4 has a known flaw (CVE-2017-5941): a string ' +
      'value prefixed with _$$ND_FUNC$$_ is eval\'d as a live JavaScript ' +
      'function during deserialisation — and the attacker-controlled ' +
      'profile cookie is exactly the value that gets deserialised.',
    solutionSummary:
      'Craft a profile cookie whose "role" field is a ' +
      '_$$ND_FUNC$$_-prefixed function that calls ' +
      "require('child_process').exec() with a reverse-shell one-liner " +
      '(wrapped in bash -c so /dev/tcp redirection works), base64-encode ' +
      'the JSON, and send it as the cookie — this spawns a shell as the ' +
      'app user, giving access to /app/flag.txt.',
    fallback: {
      1: 'You already found that the server tries to deserialise your ' +
         'profile cookie and mishandles the resulting error — what if ' +
         'the cookie were valid data, but data crafted to do something ' +
         'the developer never intended?',
      2: 'The library used to restore your profile has a ' +
         'well-documented flaw: certain specially-prefixed string values ' +
         'inside the serialised data get EXECUTED as code, not just ' +
         'parsed. Look up node-serialize and CVE-2017-5941.',
      3: 'Set the profile cookie\'s "role" field to a value starting ' +
         'with _$$ND_FUNC$$_ followed by a JS function that runs ' +
         "require('child_process').exec(...) with a reverse-shell " +
         'one-liner (wrap it in bash -c so /dev/tcp redirection works) ' +
         '— base64 the whole JSON and send it as the cookie.',
    },
  },

  'c2-container-privesc': {
    vulnerability:
      'The service account has passwordless sudo on /usr/bin/find — and ' +
      "find's -exec flag can run any command, so the whole invocation " +
      '(running as root via sudo) becomes a full root-access primitive.',
    solutionSummary:
      'sudo -l shows NOPASSWD access to /usr/bin/find; sudo find ' +
      '/root/flag.txt -exec cat {} \\; reads the root-only flag (or ' +
      'sudo find . -exec /bin/bash \\; -quit for a full root shell).',
    fallback: {
      1: 'Once you have a foothold in the container, check what — if ' +
         "anything — you're allowed to run as root without a password.",
      2: 'If sudo grants you passwordless access to a common Unix ' +
         'utility, think about which common utilities have a built-in ' +
         'way to execute an arbitrary command as part of their normal ' +
         'operation (hint: GTFOBins).',
      3: 'sudo -l shows NOPASSWD: /usr/bin/find. Run: sudo find ' +
         '/root/flag.txt -exec cat {} \\; — find\'s -exec runs as root, ' +
         'reading the otherwise-inaccessible flag file directly.',
    },
  },
};

export function getHintContext(slug) {
  return HINT_CONTEXT[slug] ?? null;
}
