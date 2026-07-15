# ---- builder: compiles the SUID privesc helper ----------------------------
# setuid is ignored by the kernel on interpreted scripts, so the planted
# binary has to be a real compiled program. Built in its own stage so the
# compiler toolchain never ships in the final image.
FROM node:20-alpine AS builder
RUN apk add --no-cache build-base
COPY backup-helper.c /tmp/backup-helper.c
RUN gcc -O2 -o /tmp/backup-helper /tmp/backup-helper.c

# ---- final image ------------------------------------------------------------
FROM node:20-alpine

# Low-privilege SERVICE account the app actually runs as. Override at build
# time (--build-arg APP_USER=...) — renaming it is a one-line change.
ARG APP_USER=paymentsvc
ENV APP_USER=${APP_USER}

# Tools the learner uses during the challenge
# bash     — terminal sessions via docker exec
# curl     — interact with the vulnerable login endpoint
# aws-cli  — steal IAM credentials and hit LocalStack (layer 3)
# su-exec  — drop root -> APP_USER cleanly at container start (see entrypoint.sh)
# openssh  — sshd (the pivot foothold below) + ssh-keygen to bake the keypair
RUN apk add --no-cache \
    bash \
    curl \
    aws-cli \
    nmap \
    net-tools \
    procps \
    su-exec \
    openssh

# System-wide prompt for ANY login bash shell on this box — paymentsvc's SSH
# session, and root's post-privesc shell (backup-helper execs `bash -l`, see
# backup-helper.c). Named zz- so it sources AFTER alpine's own
# /etc/profile.d/00-bashrc.sh, which otherwise sets a plainer '\h:\w\$ '
# with no username — this file's assignment runs later and wins. \h reads
# the container's actual Hostname (set at container-create in
# docker.service.js, matching the workstation's own prompt-hostname fix) so
# it shows the stable network alias, not Docker's random hex container id.
RUN cat > /etc/profile.d/zz-prompt.sh <<'EOF'
PS1='\u@\h:\w\$ '
EOF

# Realistic HUMAN accounts — set dressing only, so `cat /etc/passwd` / `id`
# look like a real box. No sudo rules, no credentials wired to them here.
RUN adduser -D -s /bin/bash mgithinji \
 && adduser -D -s /bin/bash jokoth \
 && adduser -D -s /bin/bash awanjiru \
 && adduser -D -s /bin/bash dmwangi

# The low-priv SERVICE account. `adduser -S` alone does NOT create a
# same-named group (falls back to nogroup), so the group is created
# explicitly for a clean paymentsvc:paymentsvc ownership. It gets a REAL
# home dir + login shell (unlike a typical system account) because it's
# meant to be reachable over SSH with a leaked key — that's the whole point
# of this challenge.
#
# `adduser -D` (no password) sets the shadow field to "!" — modern OpenSSH
# treats "!"-prefixed as an ADMINISTRATIVELY LOCKED account and refuses
# login via ANY method, including pubkey (verified: this silently blocked
# SSH entirely during testing). So a random, nobody-knows-it password hash
# is set instead — this does NOT enable password login (PasswordAuthentication
# no, set below, blocks that regardless); it only keeps the account
# "unlocked" so pubkey auth is allowed to proceed.
RUN addgroup -S "${APP_USER}" \
 && adduser -S -D -G "${APP_USER}" -s /bin/bash "${APP_USER}" \
 && echo "${APP_USER}:$(mkpasswd -m sha512 "$(head -c32 /dev/urandom | base64)")" | chpasswd -e

# ---- SSH pivot foothold ------------------------------------------------------
# INTENTIONALLY VULNERABLE (do not fix): a static keypair is generated at
# build time for APP_USER. The PUBLIC half goes into authorized_keys (so the
# target accepts it); the PRIVATE half is planted at a path the web app can
# read — see the /api/admin/backup leak in app.js — which is the intended
# leak vector. No per-session rotation: that's later work.
#
# The key is passphrase-protected with a weak, dictionary-crackable phrase
# ("sunshine12" — a common word + two digits, the kind of thing that shows up
# near the top of any real-world leaked-password wordlist) so the leaked key
# ALONE isn't enough — the learner has to run it through ssh2john + john with
# a wordlist (see server/docker/workstation/Dockerfile) first. Deliberately
# NOT random/uncrackable, and deliberately not the (insultingly easy) literal
# word "password".
RUN mkdir -p /home/"${APP_USER}"/.ssh \
 && ssh-keygen -t ed25519 -N "sunshine12" -f /tmp/paymentsvc_key -C "${APP_USER}@chainbreak-challenge-1" \
 && cp /tmp/paymentsvc_key.pub /home/"${APP_USER}"/.ssh/authorized_keys \
 && chown -R "${APP_USER}":"${APP_USER}" /home/"${APP_USER}" \
 && chmod 700 /home/"${APP_USER}"/.ssh \
 && chmod 600 /home/"${APP_USER}"/.ssh/authorized_keys \
 && mkdir -p /opt/payments/backups \
 && cp /tmp/paymentsvc_key /opt/payments/backups/paymentsvc_key \
 && chown root:root /opt/payments/backups/paymentsvc_key \
 && chmod 644 /opt/payments/backups/paymentsvc_key \
 && rm -f /tmp/paymentsvc_key /tmp/paymentsvc_key.pub

# Backup manifest — the self-reveal trail: /api/users links to the backup
# endpoint, and this README (readable the same way) names the actual file.
COPY backups/README.txt /opt/payments/backups/README.txt
RUN chown root:root /opt/payments/backups/README.txt \
 && chmod 644 /opt/payments/backups/README.txt

# Key-only sshd: no password login, no root login. The leaked private key is
# the ONLY way in — that's the lesson.
RUN sed -i -E 's/^#?(PasswordAuthentication).*/\1 no/'   /etc/ssh/sshd_config \
 && sed -i -E 's/^#?(PermitRootLogin).*/\1 no/'           /etc/ssh/sshd_config \
 && sed -i -E 's/^#?(PubkeyAuthentication).*/\1 yes/'      /etc/ssh/sshd_config \
 && ssh-keygen -A

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN chown -R "${APP_USER}":"${APP_USER}" /app

# INTENTIONALLY VULNERABLE — root-owned SUID binary (do not fix). A compiled
# program (see backup-helper.c / the builder stage above) that setuid(0)s and
# execs a shell — a genuine, not simulated, local privilege escalation.
COPY --from=builder /tmp/backup-helper /usr/local/bin/backup-helper
RUN chown root:root /usr/local/bin/backup-helper \
 && chmod 4755 /usr/local/bin/backup-helper

ENV PORT=3000

EXPOSE 3000 22

# Runs as root (needed to plant /root/flag.txt with correct ownership and to
# start sshd, which must bind :22 as root) and then drops to APP_USER for the
# actual app process — see entrypoint.sh.
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
