# file: server/docker/workstation/Dockerfile
FROM debian:bookworm-slim AS john-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libssl-dev zlib1g-dev libbz2-dev git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/openwall/john.git /usr/src/john \
 && cd /usr/src/john \
 && git checkout 9a336d800a091bec9650c29282485145f31c9ffc
WORKDIR /usr/src/john/src
RUN ./configure && make -s clean && make -sj"$(nproc)"

# ---- final image ------------------------------------------------------------
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash curl wget ca-certificates iputils-ping dnsutils netcat-openbsd jq procps \
     nmap ffuf dirb \
      openssh-client \
      nodejs \
      python3 libssl3 zlib1g libbz2-1.0 libgomp1 \
      unzip \
 && rm -rf /var/lib/apt/lists/*


RUN mkdir -p /usr/share/wordlists/dirb \
 && ln -s /usr/share/dirb/wordlists/common.txt /usr/share/wordlists/dirb/common.txt \
 && test -f /usr/share/wordlists/dirb/common.txt


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

COPY --from=john-builder /usr/src/john/run /opt/john/run

RUN printf '#!/bin/sh\nexec /opt/john/run/john "$@"\n' > /usr/local/bin/john \
 && printf '#!/bin/sh\nexec python3 /opt/john/run/ssh2john.py "$@"\n' > /usr/local/bin/ssh2john \
 && chmod +x /usr/local/bin/john /usr/local/bin/ssh2john \
 && chmod -R a+rwX /opt/john/run


RUN mkdir -p /usr/share/wordlists
COPY rockyou.txt /usr/share/wordlists/rockyou.txt

RUN useradd --create-home --shell /bin/bash ctf


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


RUN mkdir -p /home/ctf/.aws \
 && printf '[default]\naws_access_key_id = test\naws_secret_access_key = test\n' > /home/ctf/.aws/credentials \
 && printf '[default]\nregion = us-east-1\noutput = json\n' > /home/ctf/.aws/config

CMD ["sleep", "infinity"]
