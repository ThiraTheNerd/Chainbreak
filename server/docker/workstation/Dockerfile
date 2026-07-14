# file: server/docker/workstation/Dockerfile

# ---- john-builder: compiles John the Ripper JUMBO ---------------------------
# Debian's own `john` package is JtR "core", which has NO ssh-key format
# support at all (verified: `john --list=formats` shows nothing for ssh, and
# a $sshng$ hash is refused with "No password hashes loaded"). Only Jumbo has
# ssh2john + the SSH private-key format, so it's built from source here and
# only the compiled runtime is copied into the final image below.
FROM debian:bookworm-slim AS john-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libssl-dev zlib1g-dev libbz2-dev git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Pinned commit on the actively-maintained bleeding-jumbo branch. The last
# TAGGED release (1.9.0-Jumbo-1) fails to compile on modern GCC (a known
# blake2.h struct-alignment error, fixed upstream since that tag) — verified
# by trying it first and hitting exactly that build failure.
RUN git clone https://github.com/openwall/john.git /usr/src/john \
 && cd /usr/src/john \
 && git checkout 9a336d800a091bec9650c29282485145f31c9ffc
WORKDIR /usr/src/john/src
RUN ./configure && make -s clean && make -sj"$(nproc)"

# ---- final image ------------------------------------------------------------
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash curl wget ca-certificates iputils-ping dnsutils netcat-openbsd jq procps \
      nmap \
      openssh-client \
      nodejs \
      python3 libssl3 zlib1g libbz2-1.0 libgomp1 \
      unzip \
 && rm -rf /var/lib/apt/lists/*

# ---- AWS CLI v2 (cloud layer, STAGE 1) ---------------------------------------
# Debian's own `awscli` apt package is v1 and quite dated; v2 has no apt
# package at all — AWS only ships it as a self-installing zip, arch-specific.
# Detects the build architecture rather than hardcoding x86_64, so this
# builds correctly on both amd64 hosts and arm64 (e.g. Apple Silicon Docker
# Desktop) without needing a forced --platform.
RUN ARCH="$(dpkg --print-architecture)" \
 && case "$ARCH" in \
      amd64) AWSCLI_ARCH=x86_64  ;; \
      arm64) AWSCLI_ARCH=aarch64 ;; \
      *) echo "unsupported architecture for awscli: $ARCH" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWSCLI_ARCH}.zip" -o /tmp/awscliv2.zip \
 && unzip -q /tmp/awscliv2.zip -d /tmp \
 && /tmp/aws/install \
 && rm -rf /tmp/awscliv2.zip /tmp/aws

# John's `run/` directory is its self-contained runtime (john.conf and other
# support files live alongside the binary, not just the bare executable, so
# the whole directory is copied rather than only `run/john`).
COPY --from=john-builder /usr/src/john/run /opt/john/run

# Thin wrappers put `john` and `ssh2john` on PATH as plain commands:
#  - `john` refuses to run via a bare PATH symlink ("Cannot find John home" —
#    it needs a real/relative pathname to locate its config, not just
#    argv[0]="john"), so the wrapper exec's the real path directly.
#  - ssh2john.py's own shebang wants `python`, which this image doesn't have
#    (only `python3`), so the wrapper invokes python3 explicitly.
# Both behaviors were verified by hand — the naive symlink approach fails.
RUN printf '#!/bin/sh\nexec /opt/john/run/john "$@"\n' > /usr/local/bin/john \
 && printf '#!/bin/sh\nexec python3 /opt/john/run/ssh2john.py "$@"\n' > /usr/local/bin/ssh2john \
 && chmod +x /usr/local/bin/john /usr/local/bin/ssh2john \
 # John writes john.pot/john.log next to the binary by default. The
 # workstation runs as non-root `ctf` (below), so that directory needs to be
 # writable by it too — verified: without this, `john` fails outright with
 # "open: /opt/john/run/john.log: Permission denied".
 && chmod -R a+rwX /opt/john/run

# Wordlist for cracking the leaked SSH key's passphrase. Named/pathed like
# the conventional rockyou.txt, but it's a CURATED list, not the real ~14M-line
# breach corpus: Debian has no `wordlists` package (that's Kali-specific),
# and fetching the genuine file from a third-party mirror at build time is an
# unpinnable, flaky network dependency for a lab image — worse, at ~25-27
# guesses/sec against ssh2john's bcrypt-pbkdf KDF (measured), the full 14M
# lines could take over an hour depending on where the passphrase falls,
# which would blow the "seconds to low minutes" target. A short curated list
# guarantees a fast, predictable crack. It includes the actual passphrase
# challenge-1's leaked key is protected with.
RUN mkdir -p /usr/share/wordlists
COPY rockyou.txt /usr/share/wordlists/rockyou.txt

RUN useradd --create-home --shell /bin/bash ctf

# Authoritative prompt for the interactive terminal session (terminal.js
# execs `bash`, which sources this on start). Overwrites the skel-copied
# default outright rather than appending — Debian's stock ~/.bashrc ALSO
# sets PS1 (with ANSI color codes) and runs AFTER /etc/bash.bashrc, so it
# would win over anything added there instead. Verified by hand: without
# this, PS1 still contains the desired \u@\h:\w\$ escapes (just colorized);
# with it, PS1 is exactly '\u@\h:\w\$ ' for the ctf user.
RUN cat > /home/ctf/.bashrc <<'EOF'
PS1='\u@\h:\w\$ '
# AWS CLI v2 pipes output >1 page through a pager by default (e.g. any
# --output text result, or a long JSON response) — this image has no
# `less`/`more` installed, so that fails outright with "Unable to redirect
# output to pager" (verified by hand). A CTF workstation terminal has no
# use for an interactive pager anyway; disabling it is the CLI's own
# documented fix for exactly this non-interactive-terminal scenario.
export AWS_PAGER=""
EOF
RUN chown ctf:ctf /home/ctf/.bashrc

USER ctf
WORKDIR /home/ctf

# LocalStack accepts any credentials by default, but the AWS CLI itself
# still refuses to run with NONE configured at all ("Unable to locate
# credentials"). Bake in the conventional LocalStack dummy values plus a
# region, so `aws --endpoint-url=http://localstack:4566 ...` works out of
# the box — no `aws configure` step required before a learner's first
# command. Written directly as `ctf` (no root/chown needed).
RUN mkdir -p /home/ctf/.aws \
 && printf '[default]\naws_access_key_id = test\naws_secret_access_key = test\n' > /home/ctf/.aws/credentials \
 && printf '[default]\nregion = us-east-1\noutput = json\n' > /home/ctf/.aws/config

CMD ["sleep", "infinity"]
