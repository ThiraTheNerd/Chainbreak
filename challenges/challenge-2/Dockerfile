# ChainBreak - Challenge 2 TARGET  (challenges/challenge-2/Dockerfile)
# OWASP 2025 A03 - vulnerable/outdated component: node-serialize@0.0.4 (CVE-2017-5941)
#
# This is the vulnerable APP image. It REPLACES the old challenge-2/Dockerfile,
# which was a kalilinux/kali-rolling attacker toolkit - a misplaced artifact.
# In ChainBreak the attacker box is the shared workstation image the browser
# terminal attaches to (architecture.md 2 & 4), never a per-challenge container.

FROM node:18-slim

# gosu lets entrypoint (root) plant a root-only flag, then drop to the app user
# for the node process - same "root sets up, app runs unprivileged" shape as C1.
RUN apt-get update && apt-get install -y --no-install-recommends gosu sudo \
 && rm -rf /var/lib/apt/lists/*

# Low-priv service account the app runs as (mirrors C1's paymentsvc pattern).
# Rename by rebuilding with --build-arg APP_USER=...
ARG APP_USER=websvc
RUN useradd --create-home --shell /bin/bash "${APP_USER}"

# ── DELIBERATE MISCONFIG — container-layer escalation vector (Flag 2) ──
# websvc was granted passwordless sudo on `find` (picture an ops "log cleanup"
# job that just needed root and nobody scoped it down). But find's -exec can
# run ANY command as the target user, so this is a full root path — the
# intended way to reach the root-only /root/flag.txt. Own drop-in file, 0440,
# syntax-checked at build so a typo fails the build instead of the container.
RUN echo 'websvc ALL=(ALL) NOPASSWD: /usr/bin/find' > /etc/sudoers.d/websvc \
 && chmod 0440 /etc/sudoers.d/websvc \
 && visudo -c

WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
# The app file is app.js (package.json's main/start still say server.js - reconcile
# that separately; we invoke app.js directly in entrypoint to sidestep the mismatch).
COPY app.js ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]