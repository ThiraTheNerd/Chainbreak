#!/usr/bin/env bash
# ChainBreak - Challenge 2 TARGET entrypoint  (challenges/challenge-2/entrypoint.sh)
# Runs as root: plants the layered flags from env vars, then drops to APP_USER
# for the app process itself. Mirrors challenge-1/entrypoint.sh.
set -e

APP_USER="${APP_USER:-websvc}"

# --- Layer 1 (owasp): proof-of-RCE flag, readable by the app user ------------
# The node-serialize RCE executes as ${APP_USER}, so this is grabbable the
# instant the learner lands code execution: `cat /app/flag.txt` from the
# reverse shell, or read process.env.FLAG_RCE straight from the payload.
# NOTE the POSIX-safe default form - never `${FLAG_RCE:-flag{...}}` with literal
# braces (breaks shell parameter expansion), per architecture.md 7.
if [ -z "${FLAG_RCE}" ]; then FLAG_RCE='flag{deserialize_rce_foothold}'; fi
echo "${FLAG_RCE}" > /app/flag.txt
chown "${APP_USER}:${APP_USER}" /app/flag.txt
chmod 644 /app/flag.txt

if [ -z "${FLAG_ERRORLEAK}" ]; then FLAG_ERRORLEAK='flag{verbose_error_disclosure}'; fi
if [ -z "${FLAG_WEAKAUTH}" ]; then FLAG_WEAKAUTH='flag{weak_auth_no_lockout}'; fi
if [ -z "${FLAG_JWTFORGE}" ]; then FLAG_JWTFORGE='flag{jwt_secret_cracked}'; fi
if [ -z "${JWT_SECRET}"    ]; then JWT_SECRET='changeme'; fi
export FLAG_ERRORLEAK FLAG_WEAKAUTH FLAG_JWTFORGE JWT_SECRET

# --- Layer 2 (docker): root-only flag, requires in-container escalation -------
# Planted behind a real privilege boundary (root, 600) so the app-user RCE
# alone can't read it - the learner must escalate WITHIN the container first.
# The escalation primitive itself (reuse C1's SUID helper, or a new vector) is
# still a design choice - see the note in chat.
if [ -z "${FLAG_PRIVESC}" ]; then FLAG_PRIVESC='flag{container_root_escalation}'; fi
echo "${FLAG_PRIVESC}" > /root/flag.txt
chown root:root /root/flag.txt
chmod 600 /root/flag.txt

# --- Layer 3 (aws) bridge: leaked CI deploy key, root-only, sitting right
# next to /root/flag.txt above — discovered the same way, by the same
# privesc. Chains into AWS Secrets Manager for the actual cloud escalation
# (see LocalStack/seed-c2-cloud.py) — these values MUST match that seed
# file's CI_RUNNER_ACCESS_KEY_ID / CI_RUNNER_SECRET_ACCESS_KEY exactly; the
# flag itself lives only in LocalStack (the acme/prod/master secret at the
# end of the chain), never in this container.
if [ -z "${FLAG_CI_ACCESS_KEY_ID}"     ]; then FLAG_CI_ACCESS_KEY_ID='AKIAC2CIRUNNERBOT001'; fi
if [ -z "${FLAG_CI_SECRET_ACCESS_KEY}" ]; then FLAG_CI_SECRET_ACCESS_KEY='C2ciRunnerFakeSecretKeyEXAMPLE12345678AB'; fi
cat > /root/ci-deploy-key.env <<EOF
AWS_ACCESS_KEY_ID=${FLAG_CI_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${FLAG_CI_SECRET_ACCESS_KEY}
AWS_DEFAULT_REGION=us-east-1
# leaked CI deploy key -- used by the nightly LocalStack sync job
EOF
chown root:root /root/ci-deploy-key.env
chmod 600 /root/ci-deploy-key.env

unset FLAG_RCE FLAG_PRIVESC FLAG_CI_ACCESS_KEY_ID FLAG_CI_SECRET_ACCESS_KEY
# The app process never runs as root.
exec gosu "${APP_USER}" node /app/app.js